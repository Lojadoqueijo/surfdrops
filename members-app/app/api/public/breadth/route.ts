import { NextResponse } from "next/server";
import { readBreadth } from "@/lib/data/supabase";

// Maré do mercado (breadth histórico) — série do % bullish do universo por
// classe. Público (informação agregada), CORS aberto como o teaser.
//   GET /api/public/breadth?class=cripto&days=90
// Classes: cripto | acoes | etf_cmd_idx. Revalida 1h (só muda 1×/dia).

export const revalidate = 3600;

const CLASSES = new Set(["cripto", "acoes", "etf_cmd_idx"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cls = (searchParams.get("class") ?? "cripto").toLowerCase();
  if (!CLASSES.has(cls)) {
    return NextResponse.json({ ok: false, error: "class inválida" }, { status: 400 });
  }
  const days = Math.min(Math.max(Number(searchParams.get("days") ?? 90) || 90, 7), 3650);

  const series = await readBreadth(cls, days);
  const last = series[series.length - 1] ?? null;
  const prev7 = series[Math.max(0, series.length - 8)] ?? null;
  const deltaPp = last && prev7 ? Math.round((last.pct - prev7.pct) * 10) / 10 : null;

  return NextResponse.json(
    { ok: true, class: cls, days, points: series.length, deltaPp7d: deltaPp, latest: last, series },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
