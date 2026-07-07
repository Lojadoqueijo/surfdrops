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

/**
 * Devolve a série SEM as velas finais que ainda não fecharam — corta em CADEIA,
 * não só a última.
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
  let end = candles.length;
  while (end > 0 && !isCandleClosed(candles[end - 1], timeframe, kind, now)) {
    end--;
  }
  return end === candles.length ? candles : candles.slice(0, end);
}
