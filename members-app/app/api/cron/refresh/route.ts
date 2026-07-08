import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { dispatchFlipAlerts } from "@/lib/data/alertDispatch";
import { getCryptoUniverse } from "@/lib/data/cryptoUniverse";
import { getSnapshots, getSnapshotsParallel } from "@/lib/data/getSnapshots";
import { getStockUniverse, STOCK_SLICE_SIZE } from "@/lib/data/stockUniverse";
import {
  appendFlipEvents,
  isSupabaseConfigured,
  pruneOldSnapshots,
  upsertSnapshots,
} from "@/lib/data/supabase";
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
//   ativos) em paralelo, às 00:15 UTC (a vela diária cripto fecha às 00:00).
// Lote 1: universo de ações DINÂMICO (top 3000 EUA por mcap via Yahoo) em
//   FATIAS de 500 (?batch=1&slice=0..5) — cada fatia cabe folgada no
//   maxDuration. Fatias 0-2 = crons Vercel (21:45/21:55/22:05 UTC, depois do
//   fecho de Wall Street em ambos os regimes de DST); fatias 3-5 = GitHub
//   Actions às 22:15 (o limite de 5 crons do Hobby não chega para tudo).
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

  // Fatia opcional do lote de ações (?slice=0..N): top 3000 ÷ 500 = 6 fatias.
  const sliceParam = searchParams.get("slice");
  const slice = sliceParam !== null ? Number(sliceParam) : null;
  if (slice !== null && (!Number.isInteger(slice) || slice < 0)) {
    return NextResponse.json({ error: `slice inválido: ${sliceParam}` }, { status: 400 });
  }

  // ?fresh=1: fura a cache em memória do universo (1h) — para refresh manual
  // depois de mudar temas/filtros ver o efeito já, sem esperar a expiração.
  const fresh = searchParams.get("fresh") === "1";

  let snapshots;
  // Histograma de categorias do universo cripto (observabilidade: confirmar
  // pelo próprio endpoint que os temas entraram, sem adivinhar).
  let cryptoCategories: Record<string, number> | undefined;
  if (batchIndex === 0) {
    // Cripto dinâmico, em paralelo (exchanges sem throttle).
    const universe = await getCryptoUniverse(fresh);
    cryptoCategories = {};
    for (const a of universe)
      for (const cat of a.categories)
        cryptoCategories[cat] = (cryptoCategories[cat] ?? 0) + 1;
    snapshots = await getSnapshotsParallel(universe);
  } else if (batchIndex === 1) {
    // Ações dinâmicas via Yahoo — concorrência 6 por cortesia (não-oficial).
    const universe = await getStockUniverse();
    const assets =
      slice !== null
        ? universe.slice(slice * STOCK_SLICE_SIZE, (slice + 1) * STOCK_SLICE_SIZE)
        : universe;
    snapshots = await getSnapshotsParallel(assets, 6);
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

  // Retenção: só no lote diário da cripto (batch 0), para não repetir por
  // fatia. Apaga snapshots > 14 dias — trava o crescimento do storage.
  const pruned =
    batchIndex === 0 && isSupabaseConfigured() ? await pruneOldSnapshots(14) : undefined;

  // Alertas Telegram dos flips recentes (no-op sem bot/Supabase).
  const alerts = await dispatchFlipAlerts(snapshots);

  const freshFlips = snapshots.filter(
    (s) => s.sinceFlipPct !== null && Math.abs(s.sinceFlipPct) < 3
  );

  return NextResponse.json({
    ok: true,
    batch: batchIndex,
    slice,
    forced: fresh,
    sectors: batchSectors,
    assets: snapshots.length,
    cryptoCategories,
    freshFlips: freshFlips.map((s) => ({ symbol: s.symbol, trend: s.trend })),
    persistence,
    pruned,
    alerts,
    at: new Date().toISOString(),
  });
}
