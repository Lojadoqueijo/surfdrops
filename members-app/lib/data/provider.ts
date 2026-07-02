import type { Candle } from "../engine/types";

export type Timeframe = "1day" | "1week";

export interface MarketDataProvider {
  getCandles(symbol: string, timeframe: Timeframe, limit: number): Promise<Candle[]>;
}

// ---------------------------------------------------------------------------
// MOCK provider — random walk determinístico por símbolo.
// Serve para a UI e o pipeline funcionarem end-to-end SEM API key.
// Substituir por TwelveDataProvider/PolygonProvider quando a Tarefa #7
// (API key) estiver desbloqueada. [implementação real: tarefa SONNET]
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

export class MockProvider implements MarketDataProvider {
  async getCandles(symbol: string, timeframe: Timeframe, limit: number): Promise<Candle[]> {
    const rand = seededRandom(hashSymbol(symbol + timeframe));
    const stepMs = timeframe === "1week" ? 7 * 86400_000 : 86400_000;
    const now = Date.now();
    const candles: Candle[] = [];
    let price = 50 + rand() * 500;

    for (let i = 0; i < limit; i++) {
      const drift = (rand() - 0.47) * 0.06; // ligeiro viés de alta
      const open = price;
      const close = Math.max(0.01, open * (1 + drift));
      const high = Math.max(open, close) * (1 + rand() * 0.02);
      const low = Math.min(open, close) * (1 - rand() * 0.02);
      candles.push({ time: now - (limit - i) * stepMs, open, high, low, close });
      price = close;
    }
    return candles;
  }
}

export function getProvider(): MarketDataProvider {
  const which = process.env.MARKET_DATA_PROVIDER ?? "mock";
  switch (which) {
    case "mock":
      return new MockProvider();
    // case "twelvedata": return new TwelveDataProvider(process.env.TWELVEDATA_API_KEY!);
    // case "polygon":    return new PolygonProvider(process.env.POLYGON_API_KEY!);
    default:
      throw new Error(`MARKET_DATA_PROVIDER desconhecido ou ainda não implementado: ${which}`);
  }
}
