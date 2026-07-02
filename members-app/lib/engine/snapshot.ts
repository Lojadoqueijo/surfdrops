import { computeSwellLine, trendDirection } from "./swellline";
import type { AssetSnapshot, Candle, Estado } from "./types";

/**
 * Junta Weekly (linha + flips) e Daily (confirmação) num snapshot pronto
 * para a tabela de membros. É o que o cron diário deve calcular por ativo.
 */
export function buildAssetSnapshot(params: {
  symbol: string;
  sector: string;
  weeklyCandles: Candle[];
  dailyCandles: Candle[];
}): AssetSnapshot | null {
  const { symbol, sector, weeklyCandles, dailyCandles } = params;
  if (weeklyCandles.length === 0) return null;

  const weeklyStates = computeSwellLine(weeklyCandles);
  const last = weeklyStates[weeklyStates.length - 1];

  const weeklyTrend = trendDirection(weeklyCandles);
  const dailyTrend = dailyCandles.length > 0 ? trendDirection(dailyCandles) : null;

  let estado: Estado = null;
  if (weeklyTrend !== null && dailyTrend !== null) {
    estado =
      weeklyTrend === dailyTrend
        ? weeklyTrend === "bullish"
          ? "ALIGNED BULL"
          : "ALIGNED BEAR"
        : "CONFLICT";
  }

  const lastPrice =
    (dailyCandles.length > 0 ? dailyCandles[dailyCandles.length - 1].close : undefined) ??
    weeklyCandles[weeklyCandles.length - 1].close;

  return {
    symbol,
    sector,
    trend: last.trend,
    weeklyTrend,
    dailyTrend,
    estado,
    nextFlip: last.swellLevel,
    lastFlip: last.lastFlipPrice,
    sinceFlipPct: last.sinceFlipPct,
    price: lastPrice,
    updatedAt: new Date().toISOString(),
  };
}
