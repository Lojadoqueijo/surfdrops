import { computeSwellLine, trendDirectionSeries } from "./swellline";
import type { AssetSnapshot, Candle, Estado, TrendDir } from "./types";

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString();
}

/** Índice do último bar onde a série de trend mudou de valor (para "flip date"). */
function lastChangeIndex(series: Array<TrendDir>): number | null {
  for (let i = series.length - 1; i > 0; i--) {
    if (series[i] !== null && series[i - 1] !== null && series[i] !== series[i - 1]) {
      return i;
    }
  }
  return null;
}

/**
 * Junta Weekly (linha + módulos de força/exaustão/divergência/200W/TP) e Daily
 * (confirmação + deteção de "dots" Daily-contra-Weekly) num snapshot pronto
 * para o terminal de membros. É o que o cron diário deve calcular por ativo.
 *
 * Os "dots" (aviso precoce de fundo/topo) e o estado WARMUP/COOLDOWN só fazem
 * sentido aqui, cruzando as duas séries — equivalente ao par hiTrend/loTrend
 * do swellline.pine.
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

  const weeklySeries = trendDirectionSeries(weeklyCandles);
  const dailySeries = dailyCandles.length > 0 ? trendDirectionSeries(dailyCandles) : [];
  const weeklyTrend: TrendDir = weeklySeries.length > 0 ? weeklySeries[weeklySeries.length - 1] : null;
  const dailyTrend: TrendDir = dailySeries.length > 0 ? dailySeries[dailySeries.length - 1] : null;
  const prevDailyTrend: TrendDir =
    dailySeries.length > 1 ? dailySeries[dailySeries.length - 2] : null;

  let estado: Estado = null;
  if (weeklyTrend !== null && dailyTrend !== null) {
    estado =
      weeklyTrend === dailyTrend
        ? weeklyTrend === "bullish"
          ? "ALIGNED BULL"
          : "ALIGNED BEAR"
        : "CONFLICT";
  }

  // Dots: o Daily acabou de virar CONTRA o Weekly (padrão do Ivan — aviso precoce).
  const dotBottom = weeklyTrend === "bearish" && dailyTrend === "bullish" && prevDailyTrend === "bearish";
  const dotTop = weeklyTrend === "bullish" && dailyTrend === "bearish" && prevDailyTrend === "bullish";

  // WARMUP/COOLDOWN: estado próprio (não existe no Pine/Ivan) — funil de atenção
  // pré-flip. Bearish a aquecer (momentum a subir, dot de fundo, ou divergência
  // bullish) = WARMUP; simétrico para COOLDOWN. Ver DEFI_SURFERS_UXUI.md §2.2.
  const isBullish = last.trend === "bullish";
  const warmup = !isBullish && (last.strengthRising || dotBottom || last.bullDiv);
  const cooldown = isBullish && (last.strengthFalling || dotTop || last.bearDiv);

  const lastFlipDate =
    last.lastFlipIndex !== null ? toIsoDate(weeklyCandles[last.lastFlipIndex].time) : null;
  const dailyFlipIdx = lastChangeIndex(dailySeries);
  const dailyFlipDate = dailyFlipIdx !== null ? toIsoDate(dailyCandles[dailyFlipIdx].time) : null;

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
    lastFlipClose: last.lastFlipClose,
    lastFlipDate,
    dailyFlipDate,
    sinceFlipPct: last.sinceFlipPct,
    price: lastPrice,
    updatedAt: new Date().toISOString(),
    marketCap: null, // pendente fonte de dados (cripto: CoinGecko; ações: fase 2)
    strength: last.strength,
    warmup,
    cooldown,
    exhaustionAtr: last.exhaustionAtr,
    dotTop,
    dotBottom,
    bearDiv: last.bearDiv,
    bullDiv: last.bullDiv,
    cheapZone: last.cheapZone,
    tp: last.tp,
  };
}
