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
  momFast?: number; // default 12
  momSlow?: number; // default 18
  meterSm?: number; // default 3
  meterMax?: number; // default 1.0
  divLook?: number; // default 2
  extThresh?: number; // default 4.0
  ma200Len?: number; // default 200
}

export interface TPTargets {
  t1: number;
  t2: number;
  t3: number;
  hit1: boolean;
  hit2: boolean;
  hit3: boolean;
}

export interface SwellLineState {
  trend: "bullish" | "bearish";
  swellLevel: number; // = "Next Flip" na tabela
  lastFlipPrice: number | null;
  lastFlipIndex: number | null;
  lastFlipClose: number | null; // close do bar do flip (distinto de lastFlipPrice = nível da linha partida)
  sinceFlipPct: number | null;
  atr: number;
  // --- extensões (paridade com o grupo "Topos & Fundos" / medidor do Pine) ---
  strength: number | null; // momentum MACD÷ATR suavizado, clamp [-meterMax, meterMax]
  strengthRising: boolean; // strength a subir nos últimos 2 bars (proxy de "aquecer")
  strengthFalling: boolean; // strength a descer nos últimos 2 bars (proxy de "arrefecer")
  exhaustionAtr: number | null; // (close-swell)/atr, com sinal — >=extThresh (bull) ou <=-extThresh (bear) = esticado
  bearDiv: boolean; // divergência de topo confirmada NESTE bar
  bullDiv: boolean; // divergência de fundo confirmada NESTE bar
  cheapZone: boolean; // close <= SMA200 (na mesma série de candles)
  tp: TPTargets | null; // alvos 1/2/3 ATR do flip em curso + se já foram atingidos
}

export type TrendDir = "bullish" | "bearish" | null;
export type Estado = "ALIGNED BULL" | "ALIGNED BEAR" | "CONFLICT" | null;

// Bundle da leitura DIÁRIA da mesma Linha do Swell (mesmo motor, velas 1d).
// Espelha os campos-chave do flip semanal para a UI poder alternar timeframe.
// null quando o ativo não tem velas diárias suficientes (linha ainda NaN).
export interface DailyBundle {
  trend: TrendDir;
  nextFlip: number;
  lastFlip: number | null;
  lastFlipClose: number | null;
  lastFlipDate: string | null; // ISO date do fecho diário onde ocorreu o flip
  sinceFlipPct: number | null;
  strength: number | null;
}

export interface AssetSnapshot {
  symbol: string;
  sector: string;
  // Metadados de exibição embebidos no snapshot (denormalizados de propósito:
  // o universo cripto é dinâmico e a página lê só da BD, sem lista estática).
  name: string | null;
  logoUrl: string | null;
  tvSymbol: string | null;
  yahooSymbol: string | null;
  rank: number | null;
  categories: string[] | null;
  trend: "bullish" | "bearish";
  weeklyTrend: TrendDir;
  dailyTrend: TrendDir;
  estado: Estado;
  nextFlip: number;
  lastFlip: number | null;
  lastFlipClose: number | null; // preço de fecho no bar do flip (para flip_events)
  lastFlipDate: string | null; // ISO date do close semanal onde ocorreu o flip
  dailyFlipDate: string | null; // ISO date do último flip Daily (para badge "FLIP HOJE")
  sinceFlipPct: number | null;
  price: number;
  updatedAt: string;
  // --- extensões UXUI v2 (§3.2) ---
  marketCap: number | null; // null até termos fonte (cripto: CoinGecko; ações: fase 2)
  strength: number | null;
  warmup: boolean; // trend bearish + (momentum a aquecer OU dot de fundo OU divergência bullish)
  cooldown: boolean; // trend bullish + (momentum a arrefecer OU dot de topo OU divergência bearish)
  exhaustionAtr: number | null;
  dotTop: boolean;
  dotBottom: boolean;
  bearDiv: boolean;
  bullDiv: boolean;
  cheapZone: boolean;
  tp: TPTargets | null;
  daily: DailyBundle | null; // leitura diária da Linha (para o toggle Semanal/Diário)
}
