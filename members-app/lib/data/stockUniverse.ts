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
    categories: gicsSector ? [gicsSector] : [],
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
      .slice(0, STOCK_TOP_N);

    const assets = ranked.map((x, i) => {
      const sp = gics.get(x.c.symbol);
      return makeAsset(x.c.symbol, x.c.yahoo, sp?.name ?? x.c.name, i + 1, x.mcap, sp?.sector ?? null);
    });

    cache = { at: Date.now(), assets };
    console.log(
      `[stockUniverse] ${assets.length} ações (de ${unique.length} candidatas; ${mcaps.size} com mcap)`
    );
    // Contingência: guarda o último universo BOM no Supabase.
    await saveUniverseCache("acoes", assets);
    return assets;
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
