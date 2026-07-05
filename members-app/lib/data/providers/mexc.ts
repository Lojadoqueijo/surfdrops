import type { Candle } from "../../engine/types";
import type { Timeframe } from "../provider";

// MEXC klines públicas — grátis, sem API key. Quarta fonte de velas para
// tokens do top 500 sem par USDT na Binance/OKX/Bybit. A API imita a da
// Binance: mesmas colunas, ordem ascendente (mais antiga primeiro) e semanas
// "1W" a fechar segunda-feira 00:00 UTC (verificado 2026-07-05).
// Docs: GET /api/v3/klines?symbol=BTCUSDT&interval=1W&limit=1000

const BASE = "https://api.mexc.com/api/v3/klines";

const INTERVAL: Record<Timeframe, string> = {
  "1day": "1d",
  "1week": "1W",
};

export async function getMexcCandles(
  symbol: string,
  timeframe: Timeframe,
  limit: number
): Promise<Candle[]> {
  const url = `${BASE}?symbol=${encodeURIComponent(symbol)}&interval=${INTERVAL[timeframe]}&limit=${Math.min(limit, 1000)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`MEXC ${symbol} ${timeframe}: HTTP ${res.status}`);
  const body = (await res.json()) as Array<Array<string | number>>;
  if (!Array.isArray(body)) throw new Error(`MEXC ${symbol}: resposta inesperada`);

  // [openTime(ms), open, high, low, close, volume, closeTime, ...] — ascendente
  return body.map((row) => ({
    time: Number(row[0]),
    open: parseFloat(String(row[1])),
    high: parseFloat(String(row[2])),
    low: parseFloat(String(row[3])),
    close: parseFloat(String(row[4])),
  }));
}
