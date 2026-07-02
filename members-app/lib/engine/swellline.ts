// Porta fiel da lógica calibrada em swellline.pine (projeto PoolParty-seo-lp).
// Defaults calibrados: ATR Length 10, Long 3, Short 3, source hl2.
// NÃO alterar estes defaults sem recalibrar contra o TradingView primeiro
// (ver swellline_research.md — Last Flip BTC ≈ 94.219 @ 2025-11-17).

import type { Candle, SwellLineParams, SwellLineState } from "./types";

const DEFAULT_PARAMS: Required<SwellLineParams> = {
  atrLen: 10,
  multLong: 3,
  multShort: 3,
};

function trueRange(high: number[], low: number[], close: number[]): number[] {
  const n = high.length;
  const tr = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tr[i] = high[i] - low[i];
    } else {
      tr[i] = Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1])
      );
    }
  }
  return tr;
}

// RMA / suavização de Wilder — é o que ta.atr() usa internamente no Pine.
function rma(values: number[], length: number): number[] {
  const n = values.length;
  const out = new Array<number>(n).fill(NaN);
  if (n < length) return out;
  let sum = 0;
  for (let i = 0; i < length; i++) sum += values[i];
  out[length - 1] = sum / length;
  for (let i = length; i < n; i++) {
    out[i] = (out[i - 1] * (length - 1) + values[i]) / length;
  }
  return out;
}

export function atr(high: number[], low: number[], close: number[], length: number): number[] {
  return rma(trueRange(high, low, close), length);
}

/**
 * Núcleo da SwellLine: ATR trailing stop com multiplicadores assimétricos
 * (Long/Short), regime bull/bear, flips e Since Flip %.
 * Espelha exatamente: up/dn ratchet, trend state machine, swell = linha ativa.
 */
export function computeSwellLine(
  candles: Candle[],
  params: SwellLineParams = {}
): SwellLineState[] {
  const { atrLen, multLong, multShort } = { ...DEFAULT_PARAMS, ...params };

  const n = candles.length;
  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const close = candles.map((c) => c.close);
  const src = candles.map((c) => (c.high + c.low) / 2); // hl2

  const atrArr = atr(high, low, close, atrLen);

  const up = new Array<number>(n).fill(NaN);
  const dn = new Array<number>(n).fill(NaN);
  const trend = new Array<number>(n).fill(1);
  const states: SwellLineState[] = [];

  let lastFlipPrice: number | null = null;
  let lastFlipIndex: number | null = null;

  for (let i = 0; i < n; i++) {
    if (Number.isNaN(atrArr[i])) {
      states.push({
        trend: "bullish",
        swellLevel: NaN,
        lastFlipPrice: null,
        lastFlipIndex: null,
        sinceFlipPct: null,
        atr: NaN,
      });
      continue;
    }

    const upBasic = src[i] - multLong * atrArr[i];
    const dnBasic = src[i] + multShort * atrArr[i];

    if (i === 0 || Number.isNaN(up[i - 1])) {
      up[i] = upBasic;
      dn[i] = dnBasic;
      trend[i] = 1;
    } else {
      up[i] = close[i - 1] > up[i - 1] ? Math.max(upBasic, up[i - 1]) : upBasic;
      dn[i] = close[i - 1] < dn[i - 1] ? Math.min(dnBasic, dn[i - 1]) : dnBasic;

      const prevTrend = trend[i - 1];
      if (prevTrend === -1 && close[i] > dn[i - 1]) {
        trend[i] = 1;
      } else if (prevTrend === 1 && close[i] < up[i - 1]) {
        trend[i] = -1;
      } else {
        trend[i] = prevTrend;
      }
    }

    const isBull = trend[i] === 1;
    const swell = isBull ? up[i] : dn[i];

    const prevIsBull = i > 0 ? trend[i - 1] === 1 : isBull;
    const flipBull = isBull && !prevIsBull;
    const flipBear = !isBull && prevIsBull;

    if (i > 0 && (flipBull || flipBear)) {
      lastFlipPrice = flipBear ? up[i - 1] : dn[i - 1];
      lastFlipIndex = i;
    }

    const sinceFlipPct =
      lastFlipPrice !== null ? ((close[i] - lastFlipPrice) / lastFlipPrice) * 100 : null;

    states.push({
      trend: isBull ? "bullish" : "bearish",
      swellLevel: swell,
      lastFlipPrice,
      lastFlipIndex,
      sinceFlipPct,
      atr: atrArr[i],
    });
  }

  return states;
}

/**
 * Supertrend simétrico standard — usado só para a confirmação Multi-Timeframe
 * (Weekly/Daily), tal como no f_dir() do swellline.pine: ta.supertrend(multShort, atrLen).
 * direction: -1 = bull, 1 = bear (convenção Pine); devolvemos já traduzido.
 */
export function trendDirection(
  candles: Candle[],
  atrLen = 10,
  mult = 3
): "bullish" | "bearish" | null {
  const n = candles.length;
  if (n === 0) return null;

  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const close = candles.map((c) => c.close);
  const atrArr = atr(high, low, close, atrLen);

  const finalUpper = new Array<number>(n).fill(NaN);
  const finalLower = new Array<number>(n).fill(NaN);
  const direction = new Array<number>(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    if (Number.isNaN(atrArr[i])) continue;
    const hl2 = (high[i] + low[i]) / 2;
    const upperBand = hl2 + mult * atrArr[i];
    const lowerBand = hl2 - mult * atrArr[i];

    const prevValid = i > 0 && !Number.isNaN(finalUpper[i - 1]);
    finalUpper[i] = prevValid
      ? close[i - 1] <= finalUpper[i - 1]
        ? Math.min(upperBand, finalUpper[i - 1])
        : upperBand
      : upperBand;
    finalLower[i] = prevValid
      ? close[i - 1] >= finalLower[i - 1]
        ? Math.max(lowerBand, finalLower[i - 1])
        : lowerBand
      : lowerBand;

    const prevDirValid = i > 0 && !Number.isNaN(direction[i - 1]);
    if (!prevDirValid) {
      direction[i] = close[i] <= finalUpper[i] ? 1 : -1;
    } else if (direction[i - 1] === 1) {
      direction[i] = close[i] > finalUpper[i] ? -1 : 1;
    } else {
      direction[i] = close[i] < finalLower[i] ? 1 : -1;
    }
  }

  const last = direction[n - 1];
  if (Number.isNaN(last)) return null;
  return last < 0 ? "bullish" : "bearish";
}
