import type { Candle } from "../engine/types";
import type { UniverseAsset } from "./universe";
import { getBinanceCandles } from "./providers/binance";
import { getBybitCandles } from "./providers/bybit";
import { getCoinGeckoCandles } from "./providers/coingecko";
import { getOkxCandles } from "./providers/okx";
import { getTwelveDataCandles } from "./providers/twelvedata";

export type Timeframe = "1day" | "1week";

// ---------------------------------------------------------------------------
// Router por ativo (ver DEFI_SURFERS_PLANO.md §3.5):
//   cripto → Binance (grátis, OHLC perfeito) → fallback CoinGecko
//   resto  → Twelve Data (precisa TWELVEDATA_API_KEY; throttle 8/min no chamador)
// USE_MOCK=1 (ou falta de chave no caso Twelve Data) → mock determinístico,
// para a UI funcionar end-to-end sem credenciais.
// ---------------------------------------------------------------------------

export async function getCandlesForAsset(
  asset: UniverseAsset,
  timeframe: Timeframe,
  limit: number
): Promise<Candle[]> {
  if (process.env.USE_MOCK === "1") return mockCandles(asset.symbol, timeframe, limit);

  if (asset.source === "binance") {
    try {
      if (!asset.binanceSymbol) throw new Error("sem binanceSymbol");
      return await getBinanceCandles(asset.binanceSymbol, timeframe, limit);
    } catch (err) {
      if (asset.coingeckoId) {
        console.warn(`[data] Binance falhou para ${asset.symbol}, fallback CoinGecko:`, err);
        return getCoinGeckoCandles(asset.coingeckoId, timeframe, limit);
      }
      throw err;
    }
  }

  if (asset.source === "okx") {
    if (!asset.okxInstId) throw new Error(`${asset.symbol}: sem okxInstId`);
    return getOkxCandles(asset.okxInstId, timeframe, limit);
  }

  if (asset.source === "bybit") {
    if (!asset.bybitSymbol) throw new Error(`${asset.symbol}: sem bybitSymbol`);
    return getBybitCandles(asset.bybitSymbol, timeframe, limit);
  }

  // twelvedata
  if (!process.env.TWELVEDATA_API_KEY) {
    console.warn(`[data] TWELVEDATA_API_KEY em falta — mock para ${asset.symbol}`);
    return mockCandles(asset.symbol, timeframe, limit);
  }
  if (!asset.twelveSymbol) throw new Error(`${asset.symbol}: sem twelveSymbol`);
  return getTwelveDataCandles(asset.twelveSymbol, timeframe, limit);
}

export function isThrottled(asset: UniverseAsset): boolean {
  // Só o Twelve Data tem limite por minuto (8/min no plano grátis).
  return asset.source === "twelvedata" && !!process.env.TWELVEDATA_API_KEY && process.env.USE_MOCK !== "1";
}

// ---------------------------------------------------------------------------
// Mock determinístico (random walk por símbolo) — dev/preview sem credenciais.
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function hashSymbol(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mockCandles(symbol: string, timeframe: Timeframe, limit: number): Candle[] {
  const rand = seededRandom(hashSymbol(symbol + timeframe));
  const stepMs = timeframe === "1week" ? 7 * 86400_000 : 86400_000;
  const now = Date.now();
  const candles: Candle[] = [];
  let price = 50 + rand() * 500;

  for (let i = 0; i < limit; i++) {
    const drift = (rand() - 0.47) * 0.06;
    const open = price;
    const close = Math.max(0.01, open * (1 + drift));
    const high = Math.max(open, close) * (1 + rand() * 0.02);
    const low = Math.min(open, close) * (1 - rand() * 0.02);
    candles.push({ time: now - (limit - i) * stepMs, open, high, low, close });
    price = close;
  }
  return candles;
}
