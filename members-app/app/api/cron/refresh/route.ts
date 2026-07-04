import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCryptoUniverse } from "@/lib/data/cryptoUniverse";
import { getSnapshots, getSnapshotsParallel } from "@/lib/data/getSnapshots";
import { appendFlipEvents, isSupabaseConfigured, upsertSnapshots } from "@/lib/data/supabase";
import { UNIVERSE } from "@/lib/data/universe";

// Cron diário (ver vercel.json + DEFI_SURFERS_PLANO.md §3.5/§6 item 4).
//
// Processamento por lotes: em vez de varrer os ~26 ativos numa única
// invocação (Twelve Data grátis = 8 pedidos/minuto; com o throttle de 16s/
// ativo isso aproxima-se do maxDuration à medida que o universo cresce), o
// vercel.json chama este endpoint uma vez por lote, ?batch=0..N-1, cada um
// num horário diferente — mas todos no mesmo dia UTC, cobertura diária
// completa mantida, só a EXECUÇÃO é repartida. Sem ?batch, processa tudo de
// uma vez (comportamento antigo — útil local/dev/teste).
//
// O Vercel Hobby só permite 5 cron jobs por projeto (1x/dia cada) — por isso
// os setores estão agrupados manualmente em 4 lotes (não 1 lote por setor),
// deixando folga para 1 cron extra no futuro. Cripto (33 ativos) fica junto
// porque a Binance não tem limite de pedidos/min; os lotes Twelve Data ficam
// ≤ ~13 ativos cada (13 × 16s de throttle ≈ 208s < maxDuration 300s).
// Lote 0 é ESPECIAL: usa o universo cripto DINÂMICO (top 500 CoinGecko ∩
// Binance USDT, ~300 ativos) processado em paralelo — a Binance não tem
// limite por minuto relevante. Os restantes lotes são Twelve Data (≤13
// ativos cada, sequenciais com throttle de 16s).
const CRON_BATCHES: string[][] = [
  ["<cripto dinâmico>"],
  ["Ações — Semis & Hardware"],
  ["Ações — Mega Tech"],
  ["Ações — Cripto-expostas", "ETFs", "Commodities", "Índices"],
];

// Persistência: se SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY estiverem
// definidas, cada lote grava em `snapshots` (upsert do dia) e `flip_events`
// (histórico append-only). Sem essas env vars, o cron continua a funcionar
// exatamente como antes (calcula e serve ao vivo, sem persistir nada).

export const dynamic = "force-dynamic";
export const maxDuration = 300; // cobre com folga o pior lote e o fallback "tudo de uma vez"

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const batchParam = searchParams.get("batch");
  const batchIndex = batchParam !== null ? Number(batchParam) : null;

  if (
    batchIndex !== null &&
    (!Number.isInteger(batchIndex) || batchIndex < 0 || batchIndex >= CRON_BATCHES.length)
  ) {
    return NextResponse.json(
      { error: `batch inválido: ${batchParam} (esperado 0..${CRON_BATCHES.length - 1})` },
      { status: 400 }
    );
  }
  const batchSectors = batchIndex !== null ? CRON_BATCHES[batchIndex] : null;

  let snapshots;
  if (batchIndex === 0) {
    // Cripto dinâmico, em paralelo (Binance sem throttle).
    snapshots = await getSnapshotsParallel(await getCryptoUniverse());
  } else if (batchSectors) {
    snapshots = await getSnapshots(UNIVERSE.filter((a) => batchSectors.includes(a.sector)));
  } else {
    // Sem ?batch: cripto dinâmico + Twelve Data sequencial (dev/local).
    const crypto = await getSnapshotsParallel(await getCryptoUniverse());
    const td = await getSnapshots(UNIVERSE.filter((a) => a.source === "twelvedata"));
    snapshots = [...crypto, ...td];
  }
  revalidatePath("/members");

  const persistence = isSupabaseConfigured()
    ? {
        snapshots: await upsertSnapshots(snapshots),
        flipEvents: await appendFlipEvents(snapshots),
      }
    : { snapshots: { ok: true, skipped: true }, flipEvents: { ok: true, skipped: true } };

  const freshFlips = snapshots.filter(
    (s) => s.sinceFlipPct !== null && Math.abs(s.sinceFlipPct) < 3
  );

  return NextResponse.json({
    ok: true,
    batch: batchIndex,
    sectors: batchSectors,
    assets: snapshots.length,
    freshFlips: freshFlips.map((s) => ({ symbol: s.symbol, trend: s.trend })),
    persistence,
    at: new Date().toISOString(),
  });
}
