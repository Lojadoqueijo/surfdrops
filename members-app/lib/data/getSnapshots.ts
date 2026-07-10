import { buildAssetSnapshot } from "../engine/snapshot";
import type { AssetSnapshot } from "../engine/types";
import { marketKindOf, onlyClosedCandles } from "./closedCandles";
import { getCandlesForAsset, isThrottled } from "./provider";
import { UNIVERSE, type UniverseAsset } from "./universe";

// 300 semanas (~5,7 anos) para o ATR/ratchet convergirem; 400 dias para o Daily.
const WEEKLY_LIMIT = 300;
const DAILY_LIMIT = 400;

// Twelve Data grátis: 8 créditos/minuto → 2 pedidos por ativo (1W+1D) = 4 ativos/min.
// Espaçamos ~16s entre ativos Twelve Data. NOTA: com muitos ativos isto excede o
// timeout de uma função Vercel — o cron por lotes (plano §3.5) resolve isso; para
// já serve para listas curtas e para execução local.
const THROTTLE_MS = 16_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function snapshotForAsset(asset: UniverseAsset): Promise<AssetSnapshot | null> {
  const [weeklyRaw, dailyRaw] = await Promise.all([
    getCandlesForAsset(asset, "1week", WEEKLY_LIMIT),
    getCandlesForAsset(asset, "1day", DAILY_LIMIT),
  ]);
  // REGRA NUCLEAR: o motor só vê velas FECHADAS (closedCandles.ts) — um flip
  // só existe confirmado no fecho, para todos os ativos e fontes futuras.
  const kind = marketKindOf(asset);
  const weekly = onlyClosedCandles(weeklyRaw, "1week", kind);
  const daily = onlyClosedCandles(dailyRaw, "1day", kind);
  return buildAssetSnapshot({
    symbol: asset.symbol,
    sector: asset.sector,
    weeklyCandles: weekly,
    dailyCandles: daily,
    meta: {
      name: asset.name,
      logoUrl: asset.logoUrl,
      tvSymbol: asset.tvSymbol,
      yahooSymbol: asset.yahooSymbol,
      rank: asset.rankHint,
      categories: asset.categories,
      marketCap: asset.marketCap ?? null,
      country: asset.country ?? null,
      currency: asset.currency ?? null,
    },
  });
}

/**
 * Versão paralela para fontes SEM limite por minuto (Binance): o universo
 * cripto dinâmico (~300 ativos × 2 timeframes) sequencial não caberia no
 * maxDuration do cron; com 8 workers fica ~60-90s. NUNCA usar com Twelve Data.
 */
export async function getSnapshotsParallel(
  assets: UniverseAsset[],
  concurrency = 8
): Promise<AssetSnapshot[]> {
  const out: AssetSnapshot[] = [];
  let next = 0;
  async function worker() {
    while (next < assets.length) {
      const asset = assets[next++];
      try {
        const snap = await snapshotForAsset(asset);
        if (snap) out.push(snap);
      } catch (err) {
        console.error(`[snapshots] falhou ${asset.symbol}:`, err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, assets.length) }, worker));
  return out;
}

export async function getSnapshots(
  assets: UniverseAsset[] = UNIVERSE,
  opts: { throttle?: boolean } = {}
): Promise<AssetSnapshot[]> {
  // throttle=true (default; cron): respeita os 8 req/min do Twelve Data.
  // throttle=false (página, fallback sem BD): responde depressa e deixa o 429
  // acontecer — alguns ativos TD falham nesse pedido, mas a página carrega.
  const throttle = opts.throttle ?? true;
  const out: AssetSnapshot[] = [];

  for (const asset of assets) {
    try {
      const snap = await snapshotForAsset(asset);
      if (snap) out.push(snap);
    } catch (err) {
      console.error(`[snapshots] falhou ${asset.symbol}:`, err);
    } finally {
      // A pausa tem de acontecer MESMO quando o pedido falha — um 429 em
      // cadeia sem pausa queima o limite por minuto do Twelve Data em segundos.
      if (throttle && isThrottled(asset)) await sleep(THROTTLE_MS);
    }
  }
  return out;
}
