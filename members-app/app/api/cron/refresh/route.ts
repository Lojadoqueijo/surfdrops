import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSnapshots } from "@/lib/data/getSnapshots";

// Cron diário (ver vercel.json): recalcula os snapshots e invalida o cache da
// página de membros. Quando houver BD (Supabase — Bloco C.9), este endpoint
// passa também a persistir o histórico de flips para alertas/notificações.

export const dynamic = "force-dynamic";
export const maxDuration = 300; // throttle Twelve Data (8/min) precisa de tempo

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snapshots = await getSnapshots();
  revalidatePath("/members");

  const freshFlips = snapshots.filter(
    (s) => s.sinceFlipPct !== null && Math.abs(s.sinceFlipPct) < 3
  );

  return NextResponse.json({
    ok: true,
    assets: snapshots.length,
    freshFlips: freshFlips.map((s) => ({ symbol: s.symbol, trend: s.trend })),
    at: new Date().toISOString(),
  });
}
