import type { Candle } from "../../engine/types";
import type { Timeframe } from "../provider";

// OKX candles públicas — grátis, sem API key. Usadas para tokens do top 500
// que NÃO têm par USDT na Binance. Barras "utc" para alinhar com as semanas
// Monday-00:00-UTC da Binance/TradingView.
// Docs: GET /api/v5/market/candles?instId=BTC-USDT&bar=1Wutc&limit=300
// Limite máx. por pedido: 300 velas (300 semanais ≈ 5,7 anos; 300 diárias
// chegam para a confirmação Daily do motor).

const BASE = "https://www.okx.com/api/v5/market/candles";

const BAR: Record<Timeframe, string> = {
  "1day": "1Dutc",
  "1week": "1Wutc",
};

interface OkxResponse {
  code: string;
  msg: string;
  data: string[][]; // [ts, o, h, l, c, ...] — da mais RECENTE para a mais antiga
}

export async function getOkxCandles(
  instId: string,
  timeframe: Timeframe,
  limit: number
): Promise<Candle[]> {
  const url = `${BASE}?instId=${encodeURIComponent(instId)}&bar=${BAR[timeframe]}&limit=${Math.min(limit, 300)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`OKX ${instId} ${timeframe}: HTTP ${res.status}`);
  const body = (await res.json()) as OkxResponse;
  if (body.code !== "0" || !Array.isArray(body.data)) {
    throw new Error(`OKX ${instId}: ${body.msg || "resposta inesperada"}`);
  }

  return body.data
    .map((row) => ({
      time: Number(row[0]),
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
    }))
    .reverse(); // OKX devolve da mais recente para a mais antiga
}
