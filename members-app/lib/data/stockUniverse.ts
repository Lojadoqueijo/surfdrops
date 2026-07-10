import { loadUniverseCache, saveUniverseCache } from "./supabase";
import { UNIVERSE, type UniverseAsset } from "./universe";
import { getYahooMarketCaps } from "./yahooQuote";

// Universo de ações DINÂMICO — fase 2 (2026-07-05): top 3000 dos EUA por
// market cap, ao estilo Bullmania.
//   Tickers: diretórios oficiais NASDAQ Trader (nasdaqlisted + otherlisted,
//     ~13k linhas), filtrados para ações comuns (sem ETFs, warrants, units,
//     preferentes, notes, test issues).
//   Market cap + ordenação: Yahoo quote API em lotes de 100 (yahooQuote.ts).
//   Setor GICS (categorias): mapa do CSV do S&P 500 (datahub) — só os ~500
//     do índice têm categoria; os restantes ficam sem (filtro continua útil).
//   Logos: CDN da Parqet por símbolo (cobre a grande maioria; quando 404 a
//     UI cai para as iniciais via onError).
//   Velas: Yahoo (providers/yahoo.ts), processadas em fatias de 500 pelo
//     cron (?batch=1&slice=K) — Vercel cobre as fatias 0-2, GitHub Actions
//     as 3-5 (ver .github/workflows/refresh-stocks-extra.yml no repo).
// Fallback em cascata: sem mcaps → S&P 500 alfabético; sem CSV → estáticos.

const NASDAQ_LISTED = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt";
const OTHER_LISTED = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt";
const SP500_CSV =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";

export const STOCK_TOP_N = 3000;
export const STOCK_SLICE_SIZE = 500;

let cache: { at: number; assets: UniverseAsset[] } | null = null;
const CACHE_MS = 60 * 60 * 1000;

// Ações CURADAS, fora do ranking por market cap. Prependadas ao universo (caem
// na fatia 0, sempre processada) com rankHint alto (fim da tabela).
//   · SPCX = SpaceX REAL (IPO 2026-06, NasdaqGS). Recém-listada: só ~5 velas
//     semanais, o motor (ATR Wilder-10) exclui-a até ter ~10 velas (~5 sem);
//     entra em sinal sozinha quando amadurecer.
//   · DXYZ = Destiny Tech100, fundo cotado com a SpaceX como maior posição —
//     tem 120 velas e sinaliza JÁ; exposição a SpaceX enquanto a SPCX amadurece.
const CURATED_STOCKS: UniverseAsset[] = [
  {
    symbol: "SPCX",
    tvSymbol: "SPCX",
    yahooSymbol: "SPCX",
    name: "SpaceX",
    sector: "Ações — EUA",
    categories: ["SpaceX", "Recém-listadas / IPO"],
    currency: "USD",
    country: "US",
    logoUrl: "https://assets.parqet.com/logos/symbol/SPCX?format=png",
    rankHint: 9000,
    marketCap: null,
    source: "yahoo",
  },
  {
    symbol: "DXYZ",
    tvSymbol: "DXYZ",
    yahooSymbol: "DXYZ",
    name: "Destiny Tech100 (exposição a SpaceX)",
    sector: "Ações — EUA",
    categories: ["SpaceX"],
    currency: "USD",
    country: "US",
    logoUrl: "https://assets.parqet.com/logos/symbol/DXYZ?format=png",
    rankHint: 9001,
    marketCap: null,
    source: "yahoo",
  },
  // ---------------------------------------------------------------------
  // Internacionais curadas (decisão 2026-07-10): ~50 blue chips de Nikkei/
  // FTSE/DAX/CAC + exceções CH/NL/BE/ES. Regras:
  //   · symbol = símbolo Yahoo SUFIXADO (chave única — "BA.L" ≠ "BA" Boeing);
  //   · currency da bolsa (LSE cota em PENCE → "GBp", sem conversão);
  //   · marketCap null (Yahoo devolve-o em moeda local — somá-lo ao pulso
  //     em USD mentiria; mostra "—" e fica fora da soma);
  //   · sector "Ações — Internacional" → tab Ações, MAS fora da Maré
  //     (breadthClass null) para não deslocar o % por composição;
  //   · rankHint 9999 → coluna # mostra "—" (ranking EUA não é comparável);
  //   · dedup: empresas já cobertas por listagem EUA/ADR no top-3000 (Toyota,
  //     HSBC, SAP, Novartis, ASML, TSMC…) ficam de fora — 1 empresa, 1 sinal.
  //   · manutenção: rever a lista ~trimestralmente (rebalanceamentos).
  ...(
    [
      // 🇯🇵 Japão (Nikkei 225)
      ["6758.T", "TSE:6758", "Sony Group", "JP", "JPY", ["Japão", "Gaming"]],
      ["7974.T", "TSE:7974", "Nintendo", "JP", "JPY", ["Japão", "Gaming"]],
      ["6861.T", "TSE:6861", "Keyence", "JP", "JPY", ["Japão", "Semis"]],
      ["8035.T", "TSE:8035", "Tokyo Electron", "JP", "JPY", ["Japão", "Semis"]],
      ["9984.T", "TSE:9984", "SoftBank Group", "JP", "JPY", ["Japão", "IA"]],
      ["9983.T", "TSE:9983", "Fast Retailing (Uniqlo)", "JP", "JPY", ["Japão"]],
      ["6501.T", "TSE:6501", "Hitachi", "JP", "JPY", ["Japão", "IA"]],
      ["6857.T", "TSE:6857", "Advantest", "JP", "JPY", ["Japão", "Semis"]],
      ["4063.T", "TSE:4063", "Shin-Etsu Chemical", "JP", "JPY", ["Japão", "Semis"]],
      ["8058.T", "TSE:8058", "Mitsubishi Corp", "JP", "JPY", ["Japão"]],
      ["6098.T", "TSE:6098", "Recruit Holdings", "JP", "JPY", ["Japão"]],
      ["4568.T", "TSE:4568", "Daiichi Sankyo", "JP", "JPY", ["Japão", "Farma"]],
      // 🇬🇧 Reino Unido (FTSE 100) — preços em pence (GBp)
      ["SHEL.L", "LSE:SHEL", "Shell", "GB", "GBp", ["Europa", "Energia"]],
      ["ULVR.L", "LSE:ULVR", "Unilever", "GB", "GBp", ["Europa"]],
      ["GSK.L", "LSE:GSK", "GSK", "GB", "GBp", ["Europa", "Farma"]],
      ["RR.L", "LSE:RR", "Rolls-Royce", "GB", "GBp", ["Europa", "Defesa"]],
      ["BA.L", "LSE:BA", "BAE Systems", "GB", "GBp", ["Europa", "Defesa"]],
      ["LSEG.L", "LSE:LSEG", "London Stock Exchange Group", "GB", "GBp", ["Europa"]],
      ["GLEN.L", "LSE:GLEN", "Glencore", "GB", "GBp", ["Europa", "Energia"]],
      ["NG.L", "LSE:NG", "National Grid", "GB", "GBp", ["Europa", "Energia"]],
      ["LLOY.L", "LSE:LLOY", "Lloyds Banking Group", "GB", "GBp", ["Europa", "Banca"]],
      ["VOD.L", "LSE:VOD", "Vodafone", "GB", "GBp", ["Europa"]],
      // 🇩🇪 Alemanha (DAX 40)
      ["SIE.DE", "XETR:SIE", "Siemens", "DE", "EUR", ["Europa", "IA"]],
      ["ALV.DE", "XETR:ALV", "Allianz", "DE", "EUR", ["Europa", "Banca"]],
      ["MBG.DE", "XETR:MBG", "Mercedes-Benz", "DE", "EUR", ["Europa", "Automóvel"]],
      ["BMW.DE", "XETR:BMW", "BMW", "DE", "EUR", ["Europa", "Automóvel"]],
      ["VOW3.DE", "XETR:VOW3", "Volkswagen", "DE", "EUR", ["Europa", "Automóvel"]],
      ["DTE.DE", "XETR:DTE", "Deutsche Telekom", "DE", "EUR", ["Europa"]],
      ["ADS.DE", "XETR:ADS", "Adidas", "DE", "EUR", ["Europa"]],
      ["IFX.DE", "XETR:IFX", "Infineon", "DE", "EUR", ["Europa", "Semis"]],
      ["RHM.DE", "XETR:RHM", "Rheinmetall", "DE", "EUR", ["Europa", "Defesa"]],
      ["BAS.DE", "XETR:BAS", "BASF", "DE", "EUR", ["Europa"]],
      ["DWS.DE", "XETR:DWS", "DWS Group", "DE", "EUR", ["Europa", "Banca"]],
      // 🇫🇷 França (CAC 40)
      ["MC.PA", "EURONEXT:MC", "LVMH", "FR", "EUR", ["Europa", "Luxo"]],
      ["RMS.PA", "EURONEXT:RMS", "Hermès", "FR", "EUR", ["Europa", "Luxo"]],
      ["OR.PA", "EURONEXT:OR", "L'Oréal", "FR", "EUR", ["Europa", "Luxo"]],
      ["AIR.PA", "EURONEXT:AIR", "Airbus", "FR", "EUR", ["Europa", "Defesa"]],
      ["SU.PA", "EURONEXT:SU", "Schneider Electric", "FR", "EUR", ["Europa", "IA"]],
      ["SAN.PA", "EURONEXT:SAN", "Sanofi", "FR", "EUR", ["Europa", "Farma"]],
      ["SAF.PA", "EURONEXT:SAF", "Safran", "FR", "EUR", ["Europa", "Defesa"]],
      ["AI.PA", "EURONEXT:AI", "Air Liquide", "FR", "EUR", ["Europa"]],
      ["EL.PA", "EURONEXT:EL", "EssilorLuxottica", "FR", "EUR", ["Europa", "Luxo"]],
      ["BNP.PA", "EURONEXT:BNP", "BNP Paribas", "FR", "EUR", ["Europa", "Banca"]],
      ["HO.PA", "EURONEXT:HO", "Thales", "FR", "EUR", ["Europa", "Defesa"]],
      // 🌍 Exceções: Suíça, Países Baixos, Bélgica, Espanha
      ["NESN.SW", "SIX:NESN", "Nestlé", "CH", "CHF", ["Europa"]],
      ["RO.SW", "SIX:RO", "Roche", "CH", "CHF", ["Europa", "Farma"]], // ação ao portador (ROG.SW não existe no Yahoo)
      ["CFR.SW", "SIX:CFR", "Richemont (Cartier)", "CH", "CHF", ["Europa", "Luxo"]],
      ["ABBN.SW", "SIX:ABBN", "ABB", "CH", "CHF", ["Europa", "IA"]],
      ["SDZ.SW", "SIX:SDZ", "Sandoz Group", "CH", "CHF", ["Europa", "Farma"]],
      ["ASM.AS", "EURONEXT:ASM", "ASM International", "NL", "EUR", ["Europa", "Semis"]],
      ["ADYEN.AS", "EURONEXT:ADYEN", "Adyen", "NL", "EUR", ["Europa", "Fintech"]],
      ["UCB.BR", "EURONEXT:UCB", "UCB", "BE", "EUR", ["Europa", "Farma"]],
      ["ITX.MC", "BME:ITX", "Inditex (Zara)", "ES", "EUR", ["Europa", "Luxo"]],
    ] as Array<[string, string, string, string, string, string[]]>
  ).map(([yahoo, tv, name, country, currency, categories]) => ({
    symbol: yahoo,
    tvSymbol: tv,
    yahooSymbol: yahoo,
    name,
    sector: "Ações — Internacional",
    categories,
    currency,
    country,
    logoUrl: `https://assets.parqet.com/logos/symbol/${encodeURIComponent(yahoo)}?format=png`,
    rankHint: 9999,
    marketCap: null,
    source: "yahoo" as const,
  })),
];

export function staticStockUniverse(): UniverseAsset[] {
  return UNIVERSE.filter((a) => a.sector.startsWith("Ações"));
}

// Parser CSV mínimo (o dataset S&P tem vírgulas dentro de aspas).
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// Instrumentos que não são ações comuns — filtrados pelo nome no diretório.
// "\bfund\b"/"closed-end"/"term trust" apanha os closed-end funds (não levam
// flag ETF e entravam no top 3000: PIMCO/Eaton Vance/Gabelli/BlackRock "Term
// Trust" etc.); REITs ficam (usam "Trust" sozinho, não "Fund"/"Term Trust").
const NAME_EXCLUDES =
  /\bwarrant|\bright(s)?\b|\bunit(s)?\b|preferred|preference|depositary|\bnotes?\b|debenture|% |\bfund\b|closed[- ]end|term trust|\betn\b/i;

function cleanName(raw: string): string {
  return raw
    .replace(/ (Common Stock|Common Shares|Ordinary Shares|Class [A-Z] Common Stock).*$/i, "")
    .replace(/ American Depositary Shares.*$/i, " (ADR)")
    .replace(/\s+-\s*$/, "")
    .trim();
}

interface Candidate {
  symbol: string; // formato do diretório (BRK.B)
  yahoo: string; // formato Yahoo (BRK-B)
  name: string;
}

function parseDirectory(text: string, format: "nasdaq" | "other"): Candidate[] {
  const lines = text.split(/\r?\n/);
  const out: Candidate[] = [];
  for (const line of lines.slice(1)) {
    if (!line || line.startsWith("File Creation Time")) continue;
    const f = line.split("|");
    if (format === "nasdaq") {
      // Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot|ETF|NextShares
      const [symbol, name, , testIssue, , , etf] = f;
      if (!symbol || testIssue === "Y" || etf === "Y") continue;
      if (NAME_EXCLUDES.test(name ?? "")) continue;
      out.push({ symbol, yahoo: symbol.replace(/[.$]/g, "-"), name: cleanName(name ?? symbol) });
    } else {
      // ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot|Test Issue|NASDAQ Symbol
      const [symbol, name, , , etf, , testIssue] = f;
      if (!symbol || testIssue === "Y" || etf === "Y") continue;
      if (symbol.includes("$")) continue; // preferentes
      if (NAME_EXCLUDES.test(name ?? "")) continue;
      out.push({ symbol, yahoo: symbol.replace(/[.$]/g, "-"), name: cleanName(name ?? symbol) });
    }
  }
  return out;
}

async function sp500Fallback(): Promise<UniverseAsset[]> {
  const res = await fetch(SP500_CSV, { cache: "no-store" });
  if (!res.ok) throw new Error(`constituents.csv: HTTP ${res.status}`);
  const { bySymbol } = parseSp500(await res.text());
  const assets: UniverseAsset[] = [];
  for (const [sym, info] of bySymbol) {
    assets.push(makeAsset(sym, sym.replace(/\./g, "-"), info.name, assets.length + 1, null, info.sector));
  }
  if (assets.length < 400) throw new Error(`S&P fallback suspeito: ${assets.length}`);
  return assets;
}

function parseSp500(text: string): {
  bySymbol: Map<string, { name: string; sector: string }>;
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0]);
  const iSymbol = header.indexOf("Symbol");
  const iName = header.indexOf("Security");
  const iSector = header.indexOf("GICS Sector");
  const bySymbol = new Map<string, { name: string; sector: string }>();
  if (iSymbol < 0) return { bySymbol };
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const sym = (cols[iSymbol] || "").trim().toUpperCase();
    if (sym) bySymbol.set(sym, { name: (cols[iName] || sym).trim(), sector: (cols[iSector] || "").trim() });
  }
  return { bySymbol };
}

// Overlay temático CURADO (decisão 2026-07-06): temas de mercado que os
// traders procuram e que NÃO são setores GICS oficiais (IA, Semis, Quantum,
// Cripto-expostas, Defesa, EV). Lista à mão — zero custo/API; só manutenção
// humana ocasional quando o mercado muda. Etiqueta → tickers (formato Yahoo).
const STOCK_THEMES: Record<string, string[]> = {
  "Mag 7": ["AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA"],
  IA: ["NVDA", "AMD", "AVGO", "SMCI", "PLTR", "MSFT", "GOOGL", "GOOG", "META", "MRVL", "ARM", "MU", "TSM", "DELL", "ANET", "VRT", "CRWD", "SNOW", "NOW", "AI", "PATH", "PLNT", "IBM", "ORCL", "ADBE"],
  Semis: ["NVDA", "AMD", "AVGO", "MU", "MRVL", "ARM", "TSM", "QCOM", "INTC", "TXN", "ADI", "KLAC", "LRCX", "AMAT", "ASML", "NXPI", "ON", "MCHP", "MPWR", "SWKS", "TER", "ENTG", "QRVO", "SMCI"],
  "Cripto-expostas": ["COIN", "MSTR", "MARA", "RIOT", "CLSK", "HUT", "BITF", "HOOD", "GLXY", "CIFR", "WULF", "BTDR", "CORZ", "BTBT", "IREN", "SQ", "XYZ", "PYPL"],
  Quantum: ["IONQ", "RGTI", "QBTS", "QUBT", "ARQQ", "LAES"],
  Defesa: ["LMT", "RTX", "NOC", "GD", "BA", "LHX", "HII", "LDOS", "KTOS", "AVAV", "PLTR", "AXON", "HWM"],
  "Veículos elétricos": ["TSLA", "RIVN", "LCID", "NIO", "LI", "XPEV", "BYDDY", "GM", "F"],
};

function stockThemesFor(symbol: string): string[] {
  const out: string[] = [];
  for (const [label, tickers] of Object.entries(STOCK_THEMES)) {
    if (tickers.includes(symbol)) out.push(label);
  }
  return out;
}

function makeAsset(
  symbol: string,
  yahoo: string,
  name: string,
  rank: number,
  marketCap: number | null,
  gicsSector: string | null
): UniverseAsset {
  return {
    symbol,
    tvSymbol: symbol, // o TradingView resolve o ticker simples para a bolsa certa
    yahooSymbol: yahoo,
    name,
    sector: "Ações — EUA",
    categories: [...(gicsSector ? [gicsSector] : []), ...stockThemesFor(symbol)],
    currency: "USD",
    country: "US",
    logoUrl: `https://assets.parqet.com/logos/symbol/${encodeURIComponent(yahoo)}?format=png`,
    rankHint: rank,
    marketCap,
    source: "yahoo",
  };
}

export async function getStockUniverse(): Promise<UniverseAsset[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.assets;

  try {
    const [nasdaqRes, otherRes, spRes] = await Promise.all([
      fetch(NASDAQ_LISTED, { cache: "no-store" }),
      fetch(OTHER_LISTED, { cache: "no-store" }),
      fetch(SP500_CSV, { cache: "no-store" }),
    ]);
    if (!nasdaqRes.ok || !otherRes.ok) {
      throw new Error(`diretórios NASDAQ: HTTP ${nasdaqRes.status}/${otherRes.status}`);
    }
    const candidates = [
      ...parseDirectory(await nasdaqRes.text(), "nasdaq"),
      ...parseDirectory(await otherRes.text(), "other"),
    ];
    const gics = spRes.ok ? parseSp500(await spRes.text()).bySymbol : new Map<string, { name: string; sector: string }>();

    // Dedupe por símbolo Yahoo (dual listings aparecem nos dois ficheiros).
    const seen = new Set<string>();
    const unique = candidates.filter((c) => {
      if (seen.has(c.yahoo)) return false;
      seen.add(c.yahoo);
      return true;
    });

    const mcaps = await getYahooMarketCaps(unique.map((c) => c.yahoo));
    if (mcaps.size < 1000) {
      throw new Error(`só ${mcaps.size} market caps — fluxo crumb provavelmente bloqueado`);
    }

    const ranked = unique
      .map((c) => ({ c, mcap: mcaps.get(c.yahoo) ?? 0 }))
      .filter((x) => x.mcap > 0)
      .sort((a, b) => b.mcap - a.mcap)
      // Top 3000 COMPLETO (2026-07-10): as curadas são ADITIVAS — antes
      // comiam o fim do ranking e expulsavam ~55 small caps dos EUA.
      .slice(0, STOCK_TOP_N);

    const assets = ranked.map((x, i) => {
      const sp = gics.get(x.c.symbol);
      return makeAsset(x.c.symbol, x.c.yahoo, sp?.name ?? x.c.name, i + 1, x.mcap, sp?.sector ?? null);
    });

    // Curadas primeiro no array (→ fatia 0, sempre processada); dedupe caso
    // uma já esteja no top por mcap. Total ≈ 3.055 → a fatia 6 (workflow
    // GitHub) cobre o excedente acima de 3.000.
    const existing = new Set(assets.map((a) => a.symbol));
    const merged = [...CURATED_STOCKS.filter((c) => !existing.has(c.symbol)), ...assets];

    cache = { at: Date.now(), assets: merged };
    console.log(
      `[stockUniverse] ${merged.length} ações (de ${unique.length} candidatas; ${mcaps.size} com mcap; ${CURATED_STOCKS.length} curadas)`
    );
    // Contingência: guarda o último universo BOM no Supabase.
    await saveUniverseCache("acoes", merged);
    return merged;
  } catch (err) {
    console.error("[stockUniverse] top-3000 falhou, a tentar cache do último universo bom:", err);
    const cached = await loadUniverseCache<UniverseAsset>("acoes");
    if (cached && cached.length >= 1000) {
      console.log(`[stockUniverse] a usar cache (${cached.length} ações)`);
      return cached;
    }
    console.error("[stockUniverse] sem cache utilizável — fallback S&P 500");
    try {
      return await sp500Fallback();
    } catch (err2) {
      console.error("[stockUniverse] fallback S&P falhou, lista estática:", err2);
      return staticStockUniverse();
    }
  }
}
