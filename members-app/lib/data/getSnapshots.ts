import { buildAssetSnapshot } from "../engine/snapshot";
import type { AssetSnapshot } from "../engine/types";
import { getProvider } from "./provider";
import { UNIVERSE } from "./universe";

// Nº de velas pedidas: 300 semanas (~5,7 anos) chega para o ATR/ratchet
// convergirem; 400 dias para o Daily.
const WEEKLY_LIMIT = 300;
const DAILY_LIMIT = 400;

export async function getSnapshots(): Promise<AssetSnapshot[]> {
  const provider = getProvider();
  const out: AssetSnapshot[] = [];

  for (const asset of UNIVERSE) {
    try {
      const [weekly, daily] = await Promise.all([
        provider.getCandles(asset.symbol, "1week", WEEKLY_LIMIT),
        provider.getCandles(asset.symbol, "1day", DAILY_LIMIT),
      ]);
      const snap = buildAssetSnapshot({
        symbol: asset.symbol,
        sector: asset.sector,
        weeklyCandles: weekly,
        dailyCandles: daily,
      });
      if (snap) out.push(snap);
    } catch (err) {
      console.error(`[snapshots] falhou ${asset.symbol}:`, err);
    }
  }
  return out;
}
