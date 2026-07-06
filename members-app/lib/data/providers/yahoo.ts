import type { Candle } from "../../engine/types";
import type { Timeframe } from "../provider";

// Yahoo Finance chart API (não-oficial) — grátis, sem key, cobre todo o
// mercado acionista. Decisão 2026-07-05: fonte primária para equities (o
// Stooq passou a servir um challenge anti-bot com proof-of-work e o Twelve
// Data grátis só dá 800 créditos/dia). Verificado: velas semanais ancoradas
// a segunda-feira (como Binance/motor) e preços ajustados a splits.
// RISCO CONHECIDO: endpoint não-oficial, pode mudar sem aviso — por isso o
// router mantém fallback Twelve Data para ativos com twelveSymbol e o cron
// reporta contagens (quebra súbita fica visível no JSON/logs).

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// range por timeframe: folga acima dos limites do motor (300W/400D).
const PARAMS: Record<Timeframe, { interval: string; range: string }> = {
  "1week": { interval: "1wk", range: "10y" },
  "1day": { interval: "1d", range: "2y" },
};

interface YahooChart {
  chart: {
    error?: { code: string; description: string } | null;
    result?: Array<{
      timestamp?: number[];
      indicators: { quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[] }> };
    }>;
  };
}

export async function getYahooCandles(
  symbol: string,
  timeframe: Timeframe,
  limit: number
): Promise<Candle[]> {
  const { interval, range } = PARAMS[timeframe];
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const host = HOSTS[attempt % HOSTS.length];
    // Jitter de 50-200ms: dessincroniza os workers paralelos (evita rajadas
    // síncronas de 12 pedidos que convidam o rate-limit do endpoint não-oficial).
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 150));
    try {
      const res = await fetch(`${host}${path}`, {
        headers: { "User-Agent": UA },
        next: { revalidate: 0 },
      });
      if (res.status === 429 || res.status === 999) {
        // rate-limit: espera curta com jitter e tenta o outro host
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
        lastErr = new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`Yahoo ${symbol} ${timeframe}: HTTP ${res.status}`);
      const body = (await res.json()) as YahooChart;
      if (body.chart.error) {
        throw new Error(`Yahoo ${symbol}: ${body.chart.error.description || body.chart.error.code}`);
      }
      const r = body.chart.result?.[0];
      const ts = r?.timestamp;
      const q = r?.indicators.quote?.[0];
      if (!r || !ts || !q) throw new Error(`Yahoo ${symbol}: resposta sem velas`);

      const candles: Candle[] = [];
      for (let i = 0; i < ts.length; i++) {
        const open = q.open[i];
        const high = q.high[i];
        const low = q.low[i];
        const close = q.close[i];
        // O Yahoo mete null em feriados/lacunas — saltar essas entradas.
        if (open == null || high == null || low == null || close == null) continue;
        candles.push({ time: ts[i] * 1000, open, high, low, close });
      }
      return candles.slice(-limit); // já vêm ascendentes (mais antiga primeiro)
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Yahoo ${symbol}: falhou`);
}
