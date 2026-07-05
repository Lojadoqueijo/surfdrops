import { UNIVERSE, type UniverseAsset } from "./universe";

// Universo de ações DINÂMICO — fase 1 (2026-07-05): S&P 500 completo.
//   Constituintes: dataset público datahub/datasets (CSV no GitHub, mantido
//   pela comunidade e atualizado com as revisões do índice).
//   Velas: Yahoo Finance (ver providers/yahoo.ts).
// Fases seguintes: NASDAQ-100/Russell até 3k+ tickers (diretório NASDAQ Trader).
// Fallback: entradas estáticas de ações da lista UNIVERSE (curadas à mão).

const CSV_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";

let cache: { at: number; assets: UniverseAsset[] } | null = null;
const CACHE_MS = 60 * 60 * 1000;

export function staticStockUniverse(): UniverseAsset[] {
  return UNIVERSE.filter((a) => a.sector.startsWith("Ações"));
}

// Parser CSV mínimo (o dataset tem vírgulas dentro de aspas, ex. sedes).
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

export async function getStockUniverse(): Promise<UniverseAsset[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.assets;

  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`constituents.csv: HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    const header = parseCsvLine(lines[0]);
    const iSymbol = header.indexOf("Symbol");
    const iName = header.indexOf("Security");
    const iSector = header.indexOf("GICS Sector");
    if (iSymbol < 0 || iName < 0 || iSector < 0) {
      throw new Error(`constituents.csv: colunas inesperadas (${header.join(",")})`);
    }

    const seen = new Set<string>();
    const assets: UniverseAsset[] = [];
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line);
      const sym = (cols[iSymbol] || "").trim().toUpperCase();
      if (!sym || seen.has(sym)) continue;
      seen.add(sym);
      assets.push({
        symbol: sym,
        tvSymbol: sym, // o TradingView resolve o ticker simples para a bolsa certa
        yahooSymbol: sym.replace(/\./g, "-"), // BRK.B → BRK-B (convenção Yahoo)
        name: (cols[iName] || sym).trim(),
        sector: "Ações — S&P 500",
        categories: cols[iSector] ? [cols[iSector].trim()] : [],
        currency: "USD",
        country: "US",
        logoUrl: null, // sem fonte grátis fiável de logos para 500 tickers — UI mostra iniciais
        rankHint: assets.length + 1, // ordem alfabética do índice; mcap real fica para depois
        marketCap: null,
        source: "yahoo",
      });
    }

    if (assets.length < 400) throw new Error(`universo S&P suspeito: só ${assets.length} tickers`);

    cache = { at: Date.now(), assets };
    console.log(`[stockUniverse] ${assets.length} ações (S&P 500 via datahub)`);
    return assets;
  } catch (err) {
    console.error("[stockUniverse] falhou, a usar lista estática:", err);
    return staticStockUniverse();
  }
}
