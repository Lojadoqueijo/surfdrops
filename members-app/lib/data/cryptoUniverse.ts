import { loadUniverseCache, saveUniverseCache } from "./supabase";
import { UNIVERSE, type UniverseAsset } from "./universe";

// Universo cripto DINÂMICO (DEFI_SURFERS_UXUI/decisão 2026-07-05):
//   top 750 do CoinGecko (market cap, rank, nome, logo — 3 chamadas grátis)
//   ∩ pares USDT ativos na Binance, OKX, Bybit, MEXC ou Gate (prioridade
//   nessa ordem; as velas vêm sempre de uma exchange — o OHLC grátis do
//   CoinGecko dá velas de 4 dias em históricos longos e não serve o motor).
// Resultado típico: ~250-350 ativos com mcap real. Fallback: lista estática.

const STABLES = new Set([
  "USDT", "USDC", "DAI", "FDUSD", "TUSD", "BUSD", "USDE", "PYUSD", "USDS",
  "USD1", "USDP", "GUSD", "EURC", "EURT", "USDD", "FRAX", "LUSD", "XAUT", "PAXG",
  // apanhados quando o universo passou a incluir OKX/Bybit/MEXC/Gate:
  "USDY", "RLUSD", "USD0", "USDF", "USDTB", "SUSDE", "SUSDS", "EURS", "USDG", "CUSD",
]);
const WRAPPED = new Set([
  "WBTC", "WETH", "WBETH", "STETH", "WSTETH", "CBBTC", "WEETH", "RETH",
  "CBETH", "TBTC", "LSETH", "METH", "RSETH", "EZETH", "SOLVBTC", "JITOSOL",
  "MSOL", "BNSOL", "WBNB",
]);

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  market_cap: number | null;
  market_cap_rank: number | null;
}

interface BinanceExchangeInfo {
  symbols: Array<{ symbol: string; status: string; baseAsset: string; quoteAsset: string }>;
}

// Temas cripto (decisão 2026-07-06): o filtro por categoria estava morto (só
// "Crypto and Blockchain"). O CoinGecko tem 837 categorias e devolve as moedas
// de cada uma numa só chamada — tocamos os temas que os membros procuram.
// categoryId do CoinGecko → etiqueta no filtro.
const CRYPTO_THEMES: Record<string, string> = {
  "artificial-intelligence": "IA",
  "meme-token": "Memes",
  "decentralized-finance-defi": "DeFi", // engloba DEX, lending, liquid staking, yield farming
  "real-world-assets-rwa": "RWA",
  gaming: "Gaming",
  "layer-1": "Layer 1",
  "layer-2": "Layer 2",
  "privacy-coins": "Privacidade",
  oracle: "Oráculos",
  "ai-agents": "Agentes IA",
  depin: "DePIN",
  "decentralized-perpetuals": "Perpétuos",
  "zero-knowledge-zk": "ZK",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Mapa symbol(maiúsculas) → etiquetas de tema. Sequencial e tolerante a
 * falhas: cada tema é uma chamada CoinGecko; se uma falhar (429), esse tema
 * fica por marcar nesta corrida — as categorias são cosméticas, nunca partem
 * o universo. Espaço de 300ms entre chamadas para respeitar o free tier.
 */
async function fetchCryptoThemes(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const [categoryId, label] of Object.entries(CRYPTO_THEMES)) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${categoryId}&order=market_cap_desc&per_page=250&page=1`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        console.warn(`[cryptoThemes] ${categoryId}: HTTP ${res.status}`);
        continue;
      }
      const coins = (await res.json()) as Array<{ symbol: string }>;
      for (const c of coins) {
        const sym = (c.symbol || "").toUpperCase();
        if (!sym) continue;
        const cur = map.get(sym) ?? [];
        cur.push(label);
        map.set(sym, cur);
      }
    } catch (err) {
      console.warn(`[cryptoThemes] ${categoryId} falhou:`, err);
    }
    await sleep(300);
  }
  return map;
}

// Cache em memória da instância (o cron corre 1x/dia; visitas à página não
// chamam isto — a página lê snapshots do Supabase).
let cache: { at: number; assets: UniverseAsset[] } | null = null;
const CACHE_MS = 60 * 60 * 1000;

export function staticCryptoUniverse(): UniverseAsset[] {
  return UNIVERSE.filter((a) => a.source === "binance");
}

export async function getCryptoUniverse(force = false): Promise<UniverseAsset[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.assets;

  try {
    const cgPage = (page: number) =>
      fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`,
        { cache: "no-store" }
      );
    const [infoRes, okxRes, bybitRes, mexcRes, gateRes, cg1Res, cg2Res, cg3Res] = await Promise.all([
      fetch("https://api.binance.com/api/v3/exchangeInfo", { cache: "no-store" }),
      fetch("https://www.okx.com/api/v5/public/instruments?instType=SPOT", { cache: "no-store" }),
      fetch("https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000", {
        cache: "no-store",
      }),
      fetch("https://api.mexc.com/api/v3/exchangeInfo", { cache: "no-store" }),
      fetch("https://api.gateio.ws/api/v4/spot/currency_pairs", { cache: "no-store" }),
      cgPage(1),
      cgPage(2),
      cgPage(3), // top 750 (decisão 2026-07-06)
    ]);
    if (!infoRes.ok) throw new Error(`Binance exchangeInfo: HTTP ${infoRes.status}`);
    if (!cg1Res.ok) throw new Error(`CoinGecko markets p1: HTTP ${cg1Res.status}`);

    const info = (await infoRes.json()) as BinanceExchangeInfo;
    const cg1 = (await cg1Res.json()) as CoinGeckoMarket[];
    const cg2 = cg2Res.ok ? ((await cg2Res.json()) as CoinGeckoMarket[]) : [];
    const cg3 = cg3Res.ok ? ((await cg3Res.json()) as CoinGeckoMarket[]) : [];

    const binanceBases = new Set(
      info.symbols
        .filter((s) => s.quoteAsset === "USDT" && s.status === "TRADING")
        .map((s) => s.baseAsset.toUpperCase())
    );

    // OKX e Bybit são opcionais — se falharem, seguimos só com a Binance.
    const okxBases = new Set<string>();
    if (okxRes.ok) {
      try {
        const okx = (await okxRes.json()) as {
          data?: Array<{ instId: string; baseCcy: string; quoteCcy: string; state: string }>;
        };
        for (const i of okx.data ?? []) {
          if (i.quoteCcy === "USDT" && i.state === "live") okxBases.add(i.baseCcy.toUpperCase());
        }
      } catch {
        /* segue sem OKX */
      }
    }
    const bybitBases = new Set<string>();
    if (bybitRes.ok) {
      try {
        const bybit = (await bybitRes.json()) as {
          result?: { list?: Array<{ baseCoin: string; quoteCoin: string; status: string }> };
        };
        for (const i of bybit.result?.list ?? []) {
          if (i.quoteCoin === "USDT" && i.status === "Trading") bybitBases.add(i.baseCoin.toUpperCase());
        }
      } catch {
        /* segue sem Bybit */
      }
    }
    const mexcBases = new Set<string>();
    if (mexcRes.ok) {
      try {
        const mexc = (await mexcRes.json()) as {
          symbols?: Array<{
            baseAsset: string;
            quoteAsset: string;
            isSpotTradingAllowed?: boolean;
            status: string;
          }>;
        };
        for (const s of mexc.symbols ?? []) {
          // status "1" = a negociar (a MEXC usa códigos numéricos em string)
          if (s.quoteAsset === "USDT" && s.isSpotTradingAllowed !== false && s.status === "1") {
            mexcBases.add(s.baseAsset.toUpperCase());
          }
        }
      } catch {
        /* segue sem MEXC */
      }
    }
    const gateBases = new Set<string>();
    if (gateRes.ok) {
      try {
        const gate = (await gateRes.json()) as Array<{
          base: string;
          quote: string;
          trade_status: string;
        }>;
        for (const p of gate) {
          if (p.quote === "USDT" && p.trade_status === "tradable") gateBases.add(p.base.toUpperCase());
        }
      } catch {
        /* segue sem Gate */
      }
    }

    const seen = new Set<string>();
    const assets: UniverseAsset[] = [];
    for (const c of [...cg1, ...cg2, ...cg3]) {
      const sym = (c.symbol || "").toUpperCase();
      if (!sym || seen.has(sym)) continue;
      if (STABLES.has(sym) || WRAPPED.has(sym)) continue;
      // Ações tokenizadas (Ondo "Tokenized Stock", xStocks) não são cripto —
      // as ações reais já vivem na tab "Ações" via Twelve Data.
      const nameLower = (c.name || "").toLowerCase();
      if (nameLower.includes("tokenized") || nameLower.includes("xstock")) continue;

      // Prioridade de fonte de velas: Binance → OKX → Bybit → MEXC → Gate.
      let exchange: { source: "binance" | "okx" | "bybit" | "mexc" | "gate"; tv: string } | null =
        null;
      if (binanceBases.has(sym)) exchange = { source: "binance", tv: `BINANCE:${sym}USDT` };
      else if (okxBases.has(sym)) exchange = { source: "okx", tv: `OKX:${sym}USDT` };
      else if (bybitBases.has(sym)) exchange = { source: "bybit", tv: `BYBIT:${sym}USDT` };
      else if (mexcBases.has(sym)) exchange = { source: "mexc", tv: `MEXC:${sym}USDT` };
      else if (gateBases.has(sym)) exchange = { source: "gate", tv: `GATEIO:${sym}USDT` };
      if (!exchange) continue;

      seen.add(sym);
      assets.push({
        symbol: `${sym}/USD`,
        tvSymbol: exchange.tv,
        yahooSymbol: null, // tickers Yahoo de cripto têm colisões; curadoria fica para depois
        name: c.name,
        sector: "Cripto",
        // "Crypto and Blockchain" era redundante na tab Cripto (tudo é cripto).
        // Só "Majors" p/ o top 10; os temas (DeFi/IA/Privacidade/...) são
        // acrescentados depois por fetchCryptoThemes.
        categories:
          c.market_cap_rank !== null && c.market_cap_rank <= 10 ? ["Majors"] : [],
        currency: "USD",
        country: null,
        logoUrl: c.image || null,
        rankHint: c.market_cap_rank ?? 9999,
        marketCap: c.market_cap ?? null,
        source: exchange.source,
        binanceSymbol: exchange.source === "binance" ? `${sym}USDT` : undefined,
        okxInstId: exchange.source === "okx" ? `${sym}-USDT` : undefined,
        bybitSymbol: exchange.source === "bybit" ? `${sym}USDT` : undefined,
        mexcSymbol: exchange.source === "mexc" ? `${sym}USDT` : undefined,
        gatePair: exchange.source === "gate" ? `${sym}_USDT` : undefined,
        coingeckoId: c.id,
      });
    }

    if (assets.length < 50) throw new Error(`universo dinâmico suspeito: só ${assets.length} ativos`);

    // Temas (IA/Memes/DeFi/RWA/...): melhor esforço, nunca partem o universo.
    const themes = await fetchCryptoThemes();
    if (themes.size > 0) {
      for (const a of assets) {
        const sym = a.symbol.split("/")[0];
        const t = themes.get(sym);
        if (t && t.length > 0) a.categories = [...a.categories, ...t];
      }
    }

    cache = { at: Date.now(), assets };
    const bySource = assets.reduce<Record<string, number>>((acc, a) => {
      acc[a.source] = (acc[a.source] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      `[cryptoUniverse] ${assets.length} ativos (top 750 CG ∩ 5 exchanges USDT): ${JSON.stringify(bySource)}`
    );
    // Contingência: guarda o último universo BOM no Supabase.
    await saveUniverseCache("cripto", assets);
    return assets;
  } catch (err) {
    console.error("[cryptoUniverse] build falhou, a tentar cache do último universo bom:", err);
    const cached = await loadUniverseCache<UniverseAsset>("cripto");
    if (cached && cached.length >= 50) {
      console.log(`[cryptoUniverse] a usar cache (${cached.length} ativos)`);
      return cached;
    }
    console.error("[cryptoUniverse] sem cache utilizável — lista estática");
    return staticCryptoUniverse();
  }
}
