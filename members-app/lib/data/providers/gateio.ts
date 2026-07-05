import type { Candle } from "../../engine/types";
import type { Timeframe } from "../provider";

// Gate.io candlesticks públicas — grátis, sem API key. Quinta fonte de velas
// (última da cadeia) para tokens do top 500 ausentes das outras exchanges.
// ATENÇÃO à ordem dos campos, diferente de todas as outras:
//   [ts(s), volume_quote, CLOSE, high, low, OPEN, volume_base, finished]
// Ordem ascendente (mais antiga primeiro); semanas "7d" fecham segunda-feira
// 00:00 UTC (verificado 2026-07-05), alinhadas com a Binance.
// Docs: GET /api/v4/spot/candlesticks?currency_pair=BTC_USDT&interval=7d&limit=1000

const BASE = "https://api.gateio.ws/api/v4/spot/candlesticks";

const INTERVAL: Record<Timeframe, string> = {
  "1day": "1d",
  "1week": "7d",
};

export async function getGateCandles(
  currencyPair: string,
  timeframe: Timeframe,
  limit: number
): Promise<Candle[]> {
  const url = `${BASE}?currency_pair=${encodeURIComponent(currencyPair)}&interval=${INTERVAL[timeframe]}&limit=${Math.min(limit, 1000)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Gate ${currencyPair} ${timeframe}: HTTP ${res.status}`);
  const body = (await res.json()) as string[][];
  if (!Array.isArray(body)) throw new Error(`Gate ${currencyPair}: resposta inesperada`);

  return body.map((row) => ({
    time: Number(row[0]) * 1000, // Gate usa segundos
    open: parseFloat(row[5]),
    high: parseFloat(row[3]),
    low: parseFloat(row[4]),
    close: parseFloat(row[2]),
  }));
}
