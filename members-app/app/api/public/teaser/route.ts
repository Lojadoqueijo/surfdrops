import { NextResponse } from "next/server";
import { readLatestSnapshots } from "@/lib/data/supabase";

// Teaser PÚBLICO do Radar do Swell — alimenta a secção de venda no Surf Drops.
// Deliberadamente limitado: top 10 cripto por market cap + contagens globais.
// O resto do universo (3k+ ativos, watchlist, alertas, alvos, avisos) fica
// atrás do login — isto é a amostra que faz o produto vender-se sozinho.
// CORS aberto: é informação pública por natureza (dados de mercado agregados).

export const revalidate = 3600; // mesma cadência da página de membros

export async function GET() {
  const db = await readLatestSnapshots();
  if (!db?.rows?.length) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const bull = db.rows.filter((r) => r.trend === "bullish").length;
  const top = db.rows
    .filter((r) => r.sector.startsWith("Cripto") && (r.marketCap ?? 0) > 0)
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, 10)
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
