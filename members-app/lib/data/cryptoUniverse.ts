import { UNIVERSE, type UniverseAsset } from "./universe";

// Universo cripto DINÂMICO (DEFI_SURFERS_UXUI/decisão 2026-07-05):
//   top 500 do CoinGecko (market cap, rank, nome, logo — 2 chamadas grátis)
//   ∩ pares USDT ativos na Binance, OKX ou Bybit (prioridade nessa ordem;
//   as velas vêm sempre de uma exchange — o OHLC grátis do CoinGecko dá
//   velas de 4 dias em históricos longos e não serve o motor calibrado).
// Resultado típico: ~250-350 ativos com mcap real. Fallback: lista estática.

const STABLES = new Set([
  "USDT", "USDC", "DAI", "FDUSD", "TUSD", "BUSD", "USDE", "PYUSD", "USDS",
  "USD1", "USDP", "GUSD", "EURC", "EURT", "USDD", "FRAX", "LUSD", "XAUT", "PAXG",
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

// Cache em memória da instância (o cron corre 1x/dia; visitas à página não
// chamam isto — a página lê snapshots do Supabase).
let cache: { at: number; assets: UniverseAsset[] } | null = null;
const CACHE_MS = 60 * 60 * 1000;

export function staticCryptoUniverse(): UniverseAsset[] {
  return UNIVERSE.filter((a) => a.source === "binance");
}

export async function getCryptoUniverse(): Promise<UniverseAsset[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.assets;

  try {
    const [infoRes, okxRes, bybitRes, cg1Res, cg2Res] = await Promise.all([
      fetch("https://api.binance.com/api/v3/exchangeInfo", { cache: "no-store" }),
      fetch("https://www.okx.com/api/v5/public/instruments?instType=SPOT", { cache: "no-store" }),
      fetch("https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000", {
        cache: "no-store",
      }),
      fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1",
        { cache: "no-store" }
      ),
      fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=2",
        { cache: "no-store" }
      ),
    ]);
    if (!infoRes.ok) throw new Error(`Binance exchangeInfo: HTTP ${infoRes.status}`);
    if (!cg1Res.ok) throw new Error(`CoinGecko markets p1: HTTP ${cg1Res.status}`);

    const info = (await infoRes.json()) as BinanceExchangeInfo;
    const cg1 = (await cg1Res.json()) as CoinGeckoMarket[];
    const cg2 = cg2Res.ok ? ((await cg2Res.json()) as CoinGeckoMarket[]) : [];

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

    const seen = new Set<string>();
    const assets: UniverseAsset[] = [];
    for (const c of [...cg1, ...cg2]) {
      const sym = (c.symbol || "").toUpperCase();
      if (!sym || seen.has(sym)) continue;
      if (STABLES.has(sym) || WRAPPED.has(sym)) continue;

      // Prioridade de fonte de velas: Binance → OKX → Bybit.
      let exchange: { source: "binance" | "okx" | "bybit"; tv: string } | null = null;
      if (binanceBases.has(sym)) exchange = { source: "binance", tv: `BINANCE:${sym}USDT` };
      else if (okxBases.has(sym)) exchange = { source: "okx", tv: `OKX:${sym}USDT` };
      else if (bybitBases.has(sym)) exchange = { source: "bybit", tv: `BYBIT:${sym}USDT` };
      if (!exchange) continue;

      seen.add(sym);
      assets.push({
        symbol: `${sym}/USD`,
        tvSymbol: exchange.tv,
        yahooSymbol: null, // tickers Yahoo de cripto têm colisões; curadoria fica para depois
        name: c.name,
        sector: "Cripto",
        categories:
          c.market_cap_rank !== null && c.market_cap_rank <= 10
            ? ["Crypto and Blockchain", "Majors"]
            : ["Crypto and Blockchain"],
        currency: "USD",
        country: null,
        logoUrl: c.image || null,
        rankHint: c.market_cap_rank ?? 9999,
        marketCap: c.market_cap ?? null,
        source: exchange.source,
        binanceSymbol: exchange.source === "binance" ? `${sym}USDT` : undefined,
        okxInstId: exchange.source === "okx" ? `${sym}-USDT` : undefined,
        bybitSymbol: exchange.source === "bybit" ? `${sym}USDT` : undefined,
        coingeckoId: c.id,
      });
    }

    if (assets.length < 50) throw new Error(`universo dinâmico suspeito: só ${assets.length} ativos`);

    cache = { at: Date.now(), assets };
    const bySource = assets.reduce<Record<string, number>>((acc, a) => {
      acc[a.source] = (acc[a.source] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      `[cryptoUniverse] ${assets.length} ativos (top 500 CG ∩ Binance/OKX/Bybit USDT): ${JSON.stringify(bySource)}`
    );
    return assets;
  } catch (err) {
    console.error("[cryptoUniverse] falhou, a usar lista estática:", err);
    return staticCryptoUniverse();
  }
}
