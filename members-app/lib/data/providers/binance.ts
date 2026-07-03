import type { Candle } from "../../engine/types";
import type { Timeframe } from "../provider";

// Binance klines públicas — grátis, sem API key. OHLC real em 1d/1w.
// Docs: GET /api/v3/klines?symbol=BTCUSDT&interval=1w&limit=300

const BASE = "https://api.binance.com/api/v3/klines";

const INTERVAL: Record<Timeframe, string> = {
  "1day": "1d",
  "1week": "1w",
};

export async function getBinanceCandles(
  binanceSymbol: string,
  timeframe: Timeframe,
  limit: number
): Promise<Candle[]> {
  const url = `${BASE}?symbol=${encodeURIComponent(binanceSymbol)}&interval=${INTERVAL[timeframe]}&limit=${Math.min(limit, 1000)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Binance ${binanceSymbol} ${timeframe}: HTTP ${res.status}`);
  }
  const raw = (await res.json()) as unknown[];
  if (!Array.isArray(raw)) throw new Error(`Binance ${binanceSymbol}: resposta inesperada`);

  return raw.map((k) => {
    const row = k as [number, string, string, string, string, ...unknown[]];
    return {
      time: row[0],
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
    };
  });
}
