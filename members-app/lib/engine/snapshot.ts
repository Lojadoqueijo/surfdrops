import { computeSwellLine, trendDirectionSeries } from "./swellline";
import type { AssetSnapshot, Candle, DailyBundle, Estado, TrendDir } from "./types";

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Leitura DIÁRIA: a MESMA Linha do Swell sobre as velas 1d (que já são
 * buscadas — zero pedidos extra). null quando a linha diária ainda é NaN
 * (velas insuficientes p/ o ATR) — o toggle "Diário" exclui o ativo, tal
 * como o guard semanal. Os alertas continuam a usar SÓ o semanal.
 */
function dailyBundleOf(dailyCandles: Candle[]): DailyBundle | null {
  if (dailyCandles.length === 0) return null;
  const states = computeSwellLine(dailyCandles);
  const dLast = states[states.length - 1];
  if (!Number.isFinite(dLast.swellLevel)) return null;
  return {
    trend: dLast.trend,
    nextFlip: dLast.swellLevel,
    lastFlip: dLast.lastFlipPrice,
    lastFlipClose: dLast.lastFlipClose,
    lastFlipDate:
      dLast.lastFlipIndex !== null ? toIsoDate(dailyCandles[dLast.lastFlipIndex].time) : null,
    sinceFlipPct: dLast.sinceFlipPct,
    strength: dLast.strength,
  };
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
export interface SnapshotMeta {
  name?: string | null;
  logoUrl?: string | null;
  tvSymbol?: string | null;
  yahooSymbol?: string | null;
  rank?: number | null;
  categories?: string[] | null;
  marketCap?: number | null;
  country?: string | null; // ISO-3166 (internacionais curadas)
  currency?: string | null; // EUR, GBp, JPY… (null = USD)
}

export function buildAssetSnapshot(params: {
  symbol: string;
  sector: string;
  weeklyCandles: Candle[];
  dailyCandles: Candle[];
  meta?: SnapshotMeta;
}): AssetSnapshot | null {
  const { symbol, sector, weeklyCandles, dailyCandles, meta } = params;
  if (weeklyCandles.length === 0) return null;

  const weeklyStates = computeSwellLine(weeklyCandles);
  const last = weeklyStates[weeklyStates.length - 1];

  // Ativo demasiado recente para o motor semanal (menos velas do que o ATR
  // precisa → linha ainda NaN): visível como "novo" — sem sinal, sem flip,
  // sem níveis — em vez de invisível (decisão 2026-07-10, caso SPCX).
  if (!Number.isFinite(last.swellLevel)) {
    const lastPrice =
      (dailyCandles.length > 0 ? dailyCandles[dailyCandles.length - 1].close : undefined) ??
      weeklyCandles[weeklyCandles.length - 1].close;
    return {
      symbol,
      sector,
      name: meta?.name ?? null,
      logoUrl: meta?.logoUrl ?? null,
      tvSymbol: meta?.tvSymbol ?? null,
      yahooSymbol: meta?.yahooSymbol ?? null,
      rank: meta?.rank ?? null,
      categories: meta?.categories ?? null,
      country: meta?.country ?? null,
      currency: meta?.currency ?? null,
      trend: "novo",
      weeklyTrend: null,
      dailyTrend: null,
      estado: null,
      nextFlip: 0,
      lastFlip: null,
      lastFlipClose: null,
      lastFlipDate: null,
      dailyFlipDate: null,
      sinceFlipPct: null,
      price: lastPrice,
      updatedAt: new Date().toISOString(),
      athPct: null, // recém-listado: "máximo histórico" ainda não significa nada
      marketCap: meta?.marketCap ?? null,
      strength: null,
      warmup: false,
      cooldown: false,
      exhaustionAtr: null,
      dotTop: false,
      dotBottom: false,
      bearDiv: false,
      bullDiv: false,
      cheapZone: false,
      tp: null,
      // a linha diária aquece muito antes da semanal (~11 dias vs ~11 semanas)
      // — um recém-listado pode já ter leitura diária real no toggle "Diário"
      daily: dailyBundleOf(dailyCandles),
    };
  }

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

  // Distância ao máximo do histórico disponível (~300 velas ≈ 6 anos).
  let athHigh = 0;
  for (const c of weeklyCandles) if (c.high > athHigh) athHigh = c.high;
  const athPct = athHigh > 0 ? lastPrice / athHigh - 1 : null;

  return {
    symbol,
    sector,
    name: meta?.name ?? null,
    logoUrl: meta?.logoUrl ?? null,
    tvSymbol: meta?.tvSymbol ?? null,
    yahooSymbol: meta?.yahooSymbol ?? null,
    rank: meta?.rank ?? null,
    categories: meta?.categories ?? null,
    country: meta?.country ?? null,
    currency: meta?.currency ?? null,
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
    athPct,
    marketCap: meta?.marketCap ?? null, // cripto: CoinGecko (universo dinâmico); ações: fase 2
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
    daily: dailyBundleOf(dailyCandles),
  };
}
