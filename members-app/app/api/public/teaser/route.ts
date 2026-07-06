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

  return NextResponse.json(
    {
      ok: true,
      totalAssets: db.rows.length,
      bull,
      bear: db.rows.length - bull,
      updatedAt: db.updatedAt,
      top,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
