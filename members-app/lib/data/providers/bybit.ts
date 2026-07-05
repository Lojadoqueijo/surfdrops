import type { Candle } from "../../engine/types";
import type { Timeframe } from "../provider";

// Bybit klines públicas — grátis, sem API key. Terceira fonte de velas para
// tokens do top 500 sem par USDT na Binance nem na OKX.
// Docs: GET /v5/market/kline?category=spot&symbol=BTCUSDT&interval=W&limit=1000
// Semanas alinham a segunda-feira 00:00 UTC (igual à Binance).

const BASE = "https://api.bybit.com/v5/market/kline";

const INTERVAL: Record<Timeframe, string> = {
  "1day": "D",
  "1week": "W",
};

interface BybitResponse {
  retCode: number;
  retMsg: string;
  result?: { list?: string[][] }; // [start, o, h, l, c, ...] — da mais RECENTE para a mais antiga
}

export async function getBybitCandles(
  symbol: string,
  timeframe: Timeframe,
  limit: number
): Promise<Candle[]> {
  const url = `${BASE}?category=spot&symbol=${encodeURIComponent(symbol)}&interval=${INTERVAL[timeframe]}&limit=${Math.min(limit, 1000)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Bybit ${symbol} ${timeframe}: HTTP ${res.status}`);
  const body = (await res.json()) as BybitResponse;
  if (body.retCode !== 0 || !Array.isArray(body.result?.list)) {
    throw new Error(`Bybit ${symbol}: ${body.retMsg || "resposta inesperada"}`);
  }

  return body.result.list
    .map((row) => ({
      time: Number(row[0]),
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
    }))
    .reverse(); // Bybit devolve da mais recente para a mais antiga
}
