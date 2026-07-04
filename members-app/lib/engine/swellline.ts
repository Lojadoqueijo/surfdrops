// Porta fiel da lógica calibrada em swellline.pine (projeto PoolParty-seo-lp).
// Defaults calibrados: ATR Length 10, Long 3, Short 3, source hl2.
// NÃO alterar estes defaults sem recalibrar contra o TradingView primeiro
// (ver swellline_research.md — Last Flip BTC ≈ 94.219 @ 2025-11-17).
//
// Esta versão estende o núcleo com os módulos "Medidor de força" e
// "Topos & Fundos" do Pine (momentum, exaustão, divergências, 200W MA,
// alvos TP) — ver DEFI_SURFERS_UXUI.md §3.2. Os dots (viragem Daily contra
// Weekly) ficam de fora deste ficheiro de propósito: precisam de comparar
// duas séries de timeframes diferentes, o que só faz sentido em snapshot.ts
// (o equivalente ao par hiTrend/loTrend do Pine).

import type { Candle, SwellLineParams, SwellLineState, TPTargets } from "./types";

const DEFAULT_PARAMS: Required<SwellLineParams> = {
  atrLen: 10,
  multLong: 3,
  multShort: 3,
  momFast: 12,
  momSlow: 18,
  meterSm: 3,
  meterMax: 1.0,
  divLook: 2,
  extThresh: 4.0,
  ma200Len: 200,
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

// EMA ao estilo Pine (ta.ema): semeia com SMA dos primeiros `length` valores
// válidos e continua em EMA a partir daí. Tolera um prefixo de NaN (ex: mom/atr
// durante o aquecimento do ATR) — a EMA só arranca depois do primeiro valor válido.
function ema(values: number[], length: number): number[] {
  const n = values.length;
  const out = new Array<number>(n).fill(NaN);
  let start = 0;
  while (start < n && Number.isNaN(values[start])) start++;
  const seedEnd = start + length - 1;
  if (seedEnd >= n) return out;

  let sum = 0;
  for (let i = start; i <= seedEnd; i++) sum += values[i];
  out[seedEnd] = sum / length;

  const k = 2 / (length + 1);
  for (let i = seedEnd + 1; i < n; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function atr(high: number[], low: number[], close: number[], length: number): number[] {
  return rma(trueRange(high, low, close), length);
}

// Pivote alto/baixo ao estilo ta.pivothigh/pivotlow: o valor central tem de
// ser estritamente maior/menor que TODOS os outros na janela [i-left, i+right].
// Confirmação só é possível `right` bars depois (tal como no Pine).
function pivotHigh(values: number[], left: number, right: number): Array<number | null> {
  const n = values.length;
  const out = new Array<number | null>(n).fill(null);
  for (let i = left; i < n - right; i++) {
    const center = values[i];
    if (Number.isNaN(center)) continue;
    let isPivot = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (Number.isNaN(values[j]) || values[j] >= center) {
        isPivot = false;
        break;
      }
    }
    out[i] = isPivot ? center : null;
  }
  return out;
}

function pivotLow(values: number[], left: number, right: number): Array<number | null> {
  const n = values.length;
  const out = new Array<number | null>(n).fill(null);
  for (let i = left; i < n - right; i++) {
    const center = values[i];
    if (Number.isNaN(center)) continue;
    let isPivot = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (Number.isNaN(values[j]) || values[j] <= center) {
        isPivot = false;
        break;
      }
    }
    out[i] = isPivot ? center : null;
  }
  return out;
}

/**
 * Núcleo da SwellLine: ATR trailing stop com multiplicadores assimétricos
 * (Long/Short), regime bull/bear, flips e Since Flip %. Estende com o medidor
 * de força (momentum MACD÷ATR), exaustão, divergências, zona 200W e alvos TP
 * — tudo o que só depende desta série de candles (single-timeframe, como no
 * Pine antes da confirmação MTF).
 * Espelha exatamente: up/dn ratchet, trend state machine, swell = linha ativa.
 */
export function computeSwellLine(
  candles: Candle[],
  params: SwellLineParams = {}
): SwellLineState[] {
  const p = { ...DEFAULT_PARAMS, ...params };
  // extThresh não é aplicado aqui de propósito: guardamos exhaustionAtr em bruto
  // (com sinal) e é o consumidor (snapshot/UI) que decide o limiar de aviso —
  // mantém-se em SwellLineParams só para documentar o default do Pine (4.0 ATR).
  const { atrLen, multLong, multShort, momFast, momSlow, meterSm, meterMax, divLook, ma200Len } = p;

  const n = candles.length;
  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const close = candles.map((c) => c.close);
  const src = candles.map((c) => (c.high + c.low) / 2); // hl2

  const atrArr = atr(high, low, close, atrLen);

  const up = new Array<number>(n).fill(NaN);
  const dn = new Array<number>(n).fill(NaN);
  const trend = new Array<number>(n).fill(1);
  const swellArr = new Array<number>(n).fill(NaN);
  const isBullArr = new Array<boolean>(n).fill(true);
  const lastFlipPriceArr = new Array<number | null>(n).fill(null);
  const lastFlipIndexArr = new Array<number | null>(n).fill(null);
  const lastFlipCloseArr = new Array<number | null>(n).fill(null);
  const atrAtFlipArr = new Array<number | null>(n).fill(null);
  const sinceFlipPctArr = new Array<number | null>(n).fill(null);

  let lastFlipPrice: number | null = null;
  let lastFlipIndex: number | null = null;
  let lastFlipClose: number | null = null;
  let atrAtFlip: number | null = null;

  for (let i = 0; i < n; i++) {
    if (Number.isNaN(atrArr[i])) continue;

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
    isBullArr[i] = isBull;
    swellArr[i] = swell;

    const prevIsBull = i > 0 ? trend[i - 1] === 1 : isBull;
    const flipBull = isBull && !prevIsBull;
    const flipBear = !isBull && prevIsBull;

    if (i > 0 && (flipBull || flipBear)) {
      lastFlipPrice = flipBear ? up[i - 1] : dn[i - 1];
      lastFlipIndex = i;
      lastFlipClose = close[i];
      atrAtFlip = atrArr[i];
    }

    lastFlipPriceArr[i] = lastFlipPrice;
    lastFlipIndexArr[i] = lastFlipIndex;
    lastFlipCloseArr[i] = lastFlipClose;
    atrAtFlipArr[i] = atrAtFlip;
    sinceFlipPctArr[i] =
      lastFlipPrice !== null ? ((close[i] - lastFlipPrice) / lastFlipPrice) * 100 : null;
  }

  // --- Medidor de força: mom = EMA(momFast) - EMA(momSlow); strength = EMA(mom/atr, meterSm) ---
  const emaFast = ema(close, momFast);
  const emaSlow = ema(close, momSlow);
  const momOverAtr = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(emaFast[i]) && !Number.isNaN(emaSlow[i]) && !Number.isNaN(atrArr[i]) && atrArr[i] !== 0) {
      momOverAtr[i] = (emaFast[i] - emaSlow[i]) / atrArr[i];
    }
  }
  const strengthRaw = ema(momOverAtr, meterSm);
  const strengthArr = strengthRaw.map((v) => (Number.isNaN(v) ? null : clamp(v, -meterMax, meterMax)));

  // --- Exaustão: (close - swell) / atr, com sinal ---
  const exhaustionArr = new Array<number | null>(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(swellArr[i]) && !Number.isNaN(atrArr[i]) && atrArr[i] !== 0) {
      exhaustionArr[i] = (close[i] - swellArr[i]) / atrArr[i];
    }
  }

  // --- Divergências: pivôs no strength vs extremos de preço (ta.pivothigh/low(strength, divLook, divLook)) ---
  const strengthForPivot = strengthArr.map((v) => (v === null ? NaN : v));
  const phArr = pivotHigh(strengthForPivot, divLook, divLook);
  const plArr = pivotLow(strengthForPivot, divLook, divLook);
  const bearDivArr = new Array<boolean>(n).fill(false);
  const bullDivArr = new Array<boolean>(n).fill(false);
  {
    let prevPH: number | null = null;
    let prevPHp: number | null = null;
    let prevPL: number | null = null;
    let prevPLp: number | null = null;
    for (let i = 0; i < n; i++) {
      const ph = phArr[i];
      if (ph !== null) {
        const confirmAt = i + divLook;
        if (prevPH !== null && prevPHp !== null && ph < prevPH && high[i] > prevPHp && confirmAt < n) {
          bearDivArr[confirmAt] = true;
        }
        prevPH = ph;
        prevPHp = high[i];
      }
      const pl = plArr[i];
      if (pl !== null) {
        const confirmAt = i + divLook;
        if (prevPL !== null && prevPLp !== null && pl > prevPL && low[i] < prevPLp && confirmAt < n) {
          bullDivArr[confirmAt] = true;
        }
        prevPL = pl;
        prevPLp = low[i];
      }
    }
  }

  // --- 200 (semanas/período) SMA + zona "barata" ---
  const cheapZoneArr = new Array<boolean>(n).fill(false);
  if (n >= ma200Len) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += close[i];
      if (i >= ma200Len) sum -= close[i - ma200Len];
      if (i >= ma200Len - 1) {
        const sma200 = sum / ma200Len;
        cheapZoneArr[i] = close[i] <= sma200;
      }
    }
  }

  // --- Alvos TP 1/2/3 ATR a partir do flip em curso, com tracking de hit ---
  const tpArr = new Array<TPTargets | null>(n).fill(null);
  {
    let runExtreme: number | null = null; // máximo (bull) ou mínimo (bear) de close desde o flip
    let curFlipIdx: number | null = null;
    for (let i = 0; i < n; i++) {
      if (lastFlipIndexArr[i] === null || lastFlipPriceArr[i] === null || atrAtFlipArr[i] === null) continue;
      if (lastFlipIndexArr[i] !== curFlipIdx) {
        curFlipIdx = lastFlipIndexArr[i];
        runExtreme = close[i];
      } else if (runExtreme !== null) {
        runExtreme = isBullArr[i] ? Math.max(runExtreme, close[i]) : Math.min(runExtreme, close[i]);
      }
      const sign = isBullArr[i] ? 1 : -1;
      const base = lastFlipPriceArr[i] as number;
      const a = atrAtFlipArr[i] as number;
      const t1 = base + sign * 1 * a;
      const t2 = base + sign * 2 * a;
      const t3 = base + sign * 3 * a;
      const ext = runExtreme as number;
      tpArr[i] = {
        t1,
        t2,
        t3,
        hit1: sign > 0 ? ext >= t1 : ext <= t1,
        hit2: sign > 0 ? ext >= t2 : ext <= t2,
        hit3: sign > 0 ? ext >= t3 : ext <= t3,
      };
    }
  }

  // --- strengthRising/Falling: comparação de 2 bars (proxy simples de "aquecer/arrefecer") ---
  const risingArr = new Array<boolean>(n).fill(false);
  const fallingArr = new Array<boolean>(n).fill(false);
  for (let i = 2; i < n; i++) {
    if (strengthArr[i] === null || strengthArr[i - 2] === null) continue;
    risingArr[i] = (strengthArr[i] as number) > (strengthArr[i - 2] as number);
    fallingArr[i] = (strengthArr[i] as number) < (strengthArr[i - 2] as number);
  }

  const states: SwellLineState[] = [];
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(atrArr[i])) {
      states.push({
        trend: "bullish",
        swellLevel: NaN,
        lastFlipPrice: null,
        lastFlipIndex: null,
        lastFlipClose: null,
        sinceFlipPct: null,
        atr: NaN,
        strength: null,
        strengthRising: false,
        strengthFalling: false,
        exhaustionAtr: null,
        bearDiv: false,
        bullDiv: false,
        cheapZone: false,
        tp: null,
      });
      continue;
    }
    states.push({
      trend: isBullArr[i] ? "bullish" : "bearish",
      swellLevel: swellArr[i],
      lastFlipPrice: lastFlipPriceArr[i],
      lastFlipIndex: lastFlipIndexArr[i],
      lastFlipClose: lastFlipCloseArr[i],
      sinceFlipPct: sinceFlipPctArr[i],
      atr: atrArr[i],
      strength: strengthArr[i],
      strengthRising: risingArr[i],
      strengthFalling: fallingArr[i],
      exhaustionAtr: exhaustionArr[i],
      bearDiv: bearDivArr[i],
      bullDiv: bullDivArr[i],
      cheapZone: cheapZoneArr[i],
      tp: tpArr[i],
    });
  }

  return states;
}

/**
 * Supertrend simétrico standard — usado para a confirmação Multi-Timeframe
 * (Weekly/Daily), tal como no f_dir() do swellline.pine: ta.supertrend(multShort, atrLen).
 * Devolve a série completa (precisa para detetar dots de viragem Daily-contra-Weekly
 * e a data do último flip Daily) — direction interna: -1 = bull, 1 = bear (convenção
 * Pine); devolvemos já traduzido em cada posição.
 */
export function trendDirectionSeries(
  candles: Candle[],
  atrLen = 10,
  mult = 3
): Array<"bullish" | "bearish" | null> {
  const n = candles.length;
  if (n === 0) return [];

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

  return direction.map((d) => (Number.isNaN(d) ? null : d < 0 ? "bullish" : "bearish"));
}

/** Última direção da série — mantido para compatibilidade dos chamadores existentes. */
export function trendDirection(
  candles: Candle[],
  atrLen = 10,
  mult = 3
): "bullish" | "bearish" | null {
  const series = trendDirectionSeries(candles, atrLen, mult);
  return series.length > 0 ? series[series.length - 1] : null;
}
