export interface Candle {
  time: number; // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface SwellLineParams {
  atrLen?: number; // default 10
  multLong?: number; // default 3
  multShort?: number; // default 3
}

export interface SwellLineState {
  trend: "bullish" | "bearish";
  swellLevel: number; // = "Next Flip" na tabela
  lastFlipPrice: number | null;
  lastFlipIndex: number | null;
  sinceFlipPct: number | null;
  atr: number;
}

export type TrendDir = "bullish" | "bearish" | null;
export type Estado = "ALIGNED BULL" | "ALIGNED BEAR" | "CONFLICT" | null;

export interface AssetSnapshot {
  symbol: string;
  sector: string;
  trend: "bullish" | "bearish";
  weeklyTrend: TrendDir;
  dailyTrend: TrendDir;
  estado: Estado;
  nextFlip: number;
  lastFlip: number | null;
  sinceFlipPct: number | null;
  price: number;
  updatedAt: string;
}
