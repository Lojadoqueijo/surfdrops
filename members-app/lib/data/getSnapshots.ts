import { buildAssetSnapshot } from "../engine/snapshot";
import type { AssetSnapshot } from "../engine/types";
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
  const [weekly, daily] = await Promise.all([
    getCandlesForAsset(asset, "1week", WEEKLY_LIMIT),
    getCandlesForAsset(asset, "1day", DAILY_LIMIT),
  ]);
  return buildAssetSnapshot({
    symbol: asset.symbol,
    sector: asset.sector,
    weeklyCandles: weekly,
    dailyCandles: daily,
  });
}

export async function getSnapshots(assets: UniverseAsset[] = UNIVERSE): Promise<AssetSnapshot[]> {
  const out: AssetSnapshot[] = [];

  for (const asset of assets) {
    try {
      const snap = await snapshotForAsset(asset);
      if (snap) out.push(snap);
      if (isThrottled(asset)) await sleep(THROTTLE_MS);
    } catch (err) {
      console.error(`[snapshots] falhou ${asset.symbol}:`, err);
    }
  }
  return out;
}
