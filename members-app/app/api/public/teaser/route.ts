import { NextResponse } from "next/server";
import { readLatestSnapshots } from "@/lib/data/supabase";

// Teaser PÚBLICO do Radar do Swell — alimenta as secções de venda no Surf
// Drops e no hub. Deliberadamente limitado a 3 exemplos curados (decisão
// 2026-07-05): Bitcoin primeiro (referência que toda a gente conhece), depois
// o MAIOR flip bullish e o MAIOR flip bearish do universo inteiro — prova de
// que a ferramenta funciona nos dois sentidos. O resto (3k+ ativos, watchlist,
// alertas) fica atrás do login.
// CORS aberto: é informação pública por natureza (dados de mercado agregados).

// 4h: os dados só mudam 1x/dia por classe (crons); revalidar de hora a hora
// era egress do Supabase desperdiçado (a leitura completa custa ~3,5MB).
export const revalidate = 14400;

export async function GET() {
  const db = await readLatestSnapshots();
  if (!db?.rows?.length) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const bull = db.rows.filter((r) => r.trend === "bullish").length;

  const candidates = db.rows.filter((r) => r.sinceFlipPct !== null);
  const btc = candidates.find((r) => r.symbol === "BTC/USD");
  const bestBull = candidates
    .filter((r) => r.trend === "bullish" && r.symbol !== "BTC/USD")
    .sort((a, b) => (b.sinceFlipPct ?? 0) - (a.sinceFlipPct ?? 0))[0];
  const bestBear = candidates
    .filter((r) => r.trend === "bearish" && r.symbol !== "BTC/USD")
    .sort((a, b) => (a.sinceFlipPct ?? 0) - (b.sinceFlipPct ?? 0))[0];

  const top = [btc, bestBull, bestBear]
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      symbol: r.symbol,
      name: r.name,
      logoUrl: r.logoUrl,
      trend: r.trend,
      sinceFlipPct: r.sinceFlipPct,
      price: r.price,
      marketCap: r.marketCap,
    }));

  // "Melhores performers desde o flip": os que mais subiram desde que a Linha
  // os virou bullish (maior sinceFlipPct positivo). Alimenta o Radar animado
  // do hub — prova viva de que o indicador apanha movimentos reais.
  // Filtro de CREDIBILIDADE: só ativos com >= $1B de market cap. Sem ele, o
  // topo enche-se de microcaps com ganhos absurdos (+4000%) e sem logo, que
  // num teaser de vendas parecem pump-list e queimam confiança em vez de a
  // construir. Assim mostra ganhos fortes MAS acreditáveis, de nomes reais.
  const MIN_MCAP = 1e9;
  const movers = candidates
    .filter(
      (r) => r.trend === "bullish" && (r.sinceFlipPct ?? 0) > 0 && (r.marketCap ?? 0) >= MIN_MCAP
    )
    .sort((a, b) => (b.sinceFlipPct ?? 0) - (a.sinceFlipPct ?? 0))
    .slice(0, 12)
    .map((r) => ({
      symbol: r.symbol,
      name: r.name,
      logoUrl: r.logoUrl,
      trend: r.trend,
      sinceFlipPct: r.sinceFlipPct,
      price: r.price,
    }));

  return NextResponse.json(
    {
      ok: true,
      totalAssets: db.rows.length,
      bull,
      bear: db.rows.length - bull,
      updatedAt: db.updatedAt,
      top,
      movers,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
