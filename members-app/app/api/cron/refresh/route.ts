import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCryptoUniverse } from "@/lib/data/cryptoUniverse";
import { getSnapshots, getSnapshotsParallel } from "@/lib/data/getSnapshots";
import { getStockUniverse } from "@/lib/data/stockUniverse";
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
// O Vercel Hobby só permite 5 cron jobs por projeto (1x/dia cada).
// Lote 0: universo cripto DINÂMICO (top 500 CoinGecko ∩ 5 exchanges, ~330
//   ativos) em paralelo — exchanges sem limite por minuto relevante.
// Lote 1: universo de ações DINÂMICO (S&P 500 via Yahoo, ~500 ativos) em
//   paralelo com concorrência mais baixa (endpoint não-oficial — gentileza).
//   As ações estáticas antigas (Semis/Mega Tech/Cripto-expostas) estão
//   contidas no S&P 500 e deixaram de ter lote próprio.
// Lote 2: restantes ativos estáticos (ETFs/Commodities/Índices, ~11) via
//   Twelve Data, sequencial com throttle de 16s (8 créditos/min no grátis).
const CRON_BATCHES: string[][] = [
  ["<cripto dinâmico>"],
  ["<ações dinâmico>"],
  ["ETFs", "Commodities", "Índices"],
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
    // Cripto dinâmico, em paralelo (exchanges sem throttle).
    snapshots = await getSnapshotsParallel(await getCryptoUniverse());
  } else if (batchIndex === 1) {
    // Ações dinâmicas (S&P 500) via Yahoo — concorrência 6 por cortesia.
    snapshots = await getSnapshotsParallel(await getStockUniverse(), 6);
  } else if (batchSectors) {
    snapshots = await getSnapshots(UNIVERSE.filter((a) => batchSectors.includes(a.sector)));
  } else {
    // Sem ?batch: tudo de uma vez (dev/local).
    const crypto = await getSnapshotsParallel(await getCryptoUniverse());
    const stocks = await getSnapshotsParallel(await getStockUniverse(), 6);
    const td = await getSnapshots(UNIVERSE.filter((a) => a.source === "twelvedata"));
    snapshots = [...crypto, ...stocks, ...td];
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
