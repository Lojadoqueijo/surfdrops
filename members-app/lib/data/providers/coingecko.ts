import type { Candle } from "../../engine/types";
import type { Timeframe } from "../provider";

// CoinGecko — SÓ FALLBACK para tokens fora da Binance.
// Limitação conhecida (plano grátis): /coins/{id}/ohlc devolve velas de 4 DIAS
// para períodos > 30 dias → as "semanas" são aproximadas e o ATR perde precisão.
// Preferir sempre a Binance quando o par existir lá. Ver DEFI_SURFERS_PLANO.md §3.5.

const BASE = "https://api.coingecko.com/api/v3";

export async function getCoinGeckoCandles(
  coingeckoId: string,
  timeframe: Timeframe,
  _limit: number
): Promise<Candle[]> {
  const days = 365; // máximo útil no tier grátis com granularidade de 4 dias
  const url = `${BASE}/coins/${encodeURIComponent(coingeckoId)}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`CoinGecko ${coingeckoId}: HTTP ${res.status}`);

  const raw = (await res.json()) as [number, number, number, number, number][];
  if (!Array.isArray(raw)) throw new Error(`CoinGecko ${coingeckoId}: resposta inesperada`);

  const candles: Candle[] = raw.map(([time, open, high, low, close]) => ({
    time,
    open,
    high,
    low,
    close,
  }));

  if (timeframe === "1day") return candles;

  // "Semanal" aproximado: agregar velas de 4d em pares (~8 dias).
  const weekly: Candle[] = [];
  for (let i = 0; i < candles.length; i += 2) {
    const chunk = candles.slice(i, i + 2);
    weekly.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      close: chunk[chunk.length - 1].close,
    });
  }
  return weekly;
}
