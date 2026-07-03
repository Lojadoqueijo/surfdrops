import type { Candle } from "../../engine/types";
import type { Timeframe } from "../provider";

// Twelve Data — plano Basic grátis: 800 créditos/dia, MÁXIMO 8/minuto.
// Docs: GET https://api.twelvedata.com/time_series?symbol=AAPL&interval=1week
//        &outputsize=300&apikey=KEY  → { values: [{datetime,open,high,low,close}], status }
// O throttle (respeitar 8/min) é responsabilidade do chamador (getSnapshots/cron).

const BASE = "https://api.twelvedata.com/time_series";

const INTERVAL: Record<Timeframe, string> = {
  "1day": "1day",
  "1week": "1week",
};

interface TDValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export async function getTwelveDataCandles(
  twelveSymbol: string,
  timeframe: Timeframe,
  limit: number
): Promise<Candle[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error("TWELVEDATA_API_KEY não configurada");

  const url =
    `${BASE}?symbol=${encodeURIComponent(twelveSymbol)}` +
    `&interval=${INTERVAL[timeframe]}&outputsize=${Math.min(limit, 5000)}&apikey=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`TwelveData ${twelveSymbol} ${timeframe}: HTTP ${res.status}`);

  const json = (await res.json()) as { status?: string; message?: string; values?: TDValue[] };
  if (json.status === "error" || !json.values) {
    throw new Error(`TwelveData ${twelveSymbol}: ${json.message ?? "sem valores"}`);
  }

  // A API devolve do mais recente para o mais antigo → inverter para cronológico.
  return json.values
    .map((v) => ({
      time: new Date(v.datetime).getTime(),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
    }))
    .reverse();
}
