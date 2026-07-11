import type { Candle } from "../engine/types";
import type { Timeframe } from "./provider";
import type { UniverseAsset } from "./universe";

// =============================================================================
// REGRA NUCLEAR (decisão do fundador, 2026-07-06): O MOTOR SÓ VÊ VELAS FECHADAS.
// =============================================================================
// Um flip só existe quando a vela FECHA do outro lado do stop — é a regra de
// ouro da estratégia ("flip confirmado no fecho"). As exchanges/Yahoo devolvem
// a vela EM CURSO no fim da série; se ela entrar no motor, o "fecho provisório"
// (= preço atual) gera flips intra-vela que podem reverter até ao fecho real —
// alertas falsos e tabela instável. Este módulo corta essa vela à entrada,
// para TODOS os ativos, atuais e futuros: qualquer fonte nova herda a regra.
//
// Latência real: ZERO nos crons agendados —
//   · cripto: vela semanal fecha 2ª 00:00 UTC; cron 00:25 já vê a vela fechada.
//   · sessão (ações/ETFs/futuros/índices): vela semanal é final no fecho de
//     6ª; crons de 6ª (21:45+) já a veem como fechada.
//
// "Fechada" por tipo de mercado:
//   · 24/7 (cripto): fechada quando now ≥ abertura + duração exata.
//   · sessão: as âncoras variam por fornecedor (Yahoo semanal = 2ª 04:00/05:00
//     GMT; Twelve Data = 00:00; diários abrem 13:30/14:30 UTC) → o corte é por
//     CALENDÁRIO, não por offset: semanal fecha 6ª 21:05 UTC da semana da vela;
//     diário fecha às 21:05 UTC do próprio dia (cobre NYSE/Nasdaq nos dois
//     regimes de DST: 20:00 verão / 21:00 inverno). Futuros (Globex) podem
//     negociar até ~22:00 no inverno — os crons correm 22:40+, por isso na
//     prática a vela já é final; só uma corrida MANUAL entre 21:05-22:00 de
//     inverno veria uma vela de futuros marcada fechada ~1h antes do fim.

const CRYPTO_SOURCES = new Set(["binance", "okx", "bybit", "mexc", "gate"]);

export type MarketKind = "24_7" | "market_hours";

export function marketKindOf(asset: Pick<UniverseAsset, "source">): MarketKind {
  return CRYPTO_SOURCES.has(asset.source) ? "24_7" : "market_hours";
}

/** 6ª feira, 21:05 UTC, da semana a que a vela pertence. */
function fridayCutoffUtc(anchorMs: number): number {
  const d = new Date(anchorMs);
  const daysToFriday = (5 - d.getUTCDay() + 7) % 7; // âncora semanal é sempre 2ª → 4
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysToFriday, 21, 5, 0);
}

/** 21:05 UTC do dia (UTC) a que a vela diária pertence. */
function sameDayCutoffUtc(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 21, 5, 0);
}

/** Uma vela específica já fechou? */
function isCandleClosed(
  candle: Candle,
  timeframe: Timeframe,
  kind: MarketKind,
  now: number
): boolean {
  if (timeframe === "1week") {
    return kind === "24_7"
      ? now >= candle.time + 7 * 86_400_000
      : now >= fridayCutoffUtc(candle.time);
  }
  return kind === "24_7" ? now >= candle.time + 86_400_000 : now >= sameDayCutoffUtc(candle.time);
}

/** Âncora do período da vela: 2ª feira UTC (semanal) ou o próprio dia UTC (diário). */
function anchorOf(ms: number, timeframe: Timeframe): number {
  const d = new Date(ms);
  if (timeframe === "1week") {
    const dow = (d.getUTCDay() + 6) % 7; // 0 = 2ª feira
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Funde velas consecutivas do MESMO período numa só (bug RDDT, 2026-07-11):
 * à 6ª feira o Yahoo pode servir a semana PARTIDA — um bar 2ª-5ª (âncora de
 * 2ª feira) + um fragmento de 6ª datado à própria 6ª. Ambos passam o corte de
 * fecho (a semana já fechou) e o motor via o fecho de 5ª como "fecho semanal"
 * → flip falso (RDDT: flip a 200,10 = fecho de 5ª, quando a semana fechou a
 * 195,34, abaixo da linha). Fundir por âncora reconstrói a vela verdadeira
 * (O da primeira, H/L extremos, C da última) — como o TradingView faz.
 */
function mergeSameAnchor(candles: Candle[], timeframe: Timeframe): Candle[] {
  const out: Candle[] = [];
  for (const c of candles) {
    const last = out[out.length - 1];
    if (last && anchorOf(last.time, timeframe) === anchorOf(c.time, timeframe)) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
    } else {
      out.push({ ...c });
    }
  }
  return out;
}

/**
 * Salto absurdo (>3,5× em qualquer direção) entre o fecho da penúltima vela
 * semanal e a abertura da última = quase de certeza um split/reverse split que
 * a fonte ainda não ajustou no histórico (caso ABTC, 2026-07-10: semana fecha
 * a $0,56 e a seguinte abre a $8,01, sem evento de split nos dados — o motor
 * viu "+970%" e flipou bullish num gráfico que na realidade está a afundar).
 * O chamador deve SALTAR o ativo nessa corrida: o snapshot da véspera fica de
 * pé e tudo autocorrige quando a fonte regista o evento (tipicamente 1-3 dias).
 */
export function isSplitSuspect(weekly: Candle[]): boolean {
  const n = weekly.length;
  if (n < 2) return false;
  const prevClose = weekly[n - 2].close;
  const lastOpen = weekly[n - 1].open;
  if (!(prevClose > 0) || !(lastOpen > 0)) return false;
  const r = lastOpen / prevClose;
  return r > 3.5 || r < 1 / 3.5;
}

/**
 * Devolve a série SEM as velas finais que ainda não fecharam — corta em CADEIA,
 * não só a última — e com fragmentos do mesmo período FUNDIDOS numa vela só.
 *
 * Porquê em cadeia (bug corrigido 2026-07-07): o Yahoo, além da vela da
 * semana/dia EM CURSO, ACRESCENTA ainda uma vela "ao vivo" datada ao instante
 * atual (ex.: 3ª feira 18:46). A série acaba então com DUAS velas por fechar:
 * a "ao vivo" e a da semana em curso (âncora 2ª feira). Cortar só a última
 * deixava a vela da semana em curso entrar no motor → flips numa vela NÃO
 * fechada (ex.: 31 ações a "flipar" à 2ª numa 3ª feira). A cripto (Binance) só
 * tem 1 vela em curso no fim, por isso não era afetada. Cortar todas as finais
 * não-fechadas trata TODAS as fontes, atuais e futuras.
 */
export function onlyClosedCandles(
  candles: Candle[],
  timeframe: Timeframe,
  kind: MarketKind,
  now: number = Date.now()
): Candle[] {
  const merged = mergeSameAnchor(candles, timeframe);
  let end = merged.length;
  while (end > 0 && !isCandleClosed(merged[end - 1], timeframe, kind, now)) {
    end--;
  }
  return end === merged.length ? merged : merged.slice(0, end);
}
