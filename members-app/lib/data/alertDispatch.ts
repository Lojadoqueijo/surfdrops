import type { AssetSnapshot } from "../engine/types";
import { logAlert, subsForSymbol } from "./alerts";
import { isSupabaseConfigured } from "./supabase";
import { sendMessage, telegramConfigured } from "../telegram";

// Envia alertas Telegram dos flips recentes para os membros ligados que têm
// o ativo na watchlist. Chamado no fim do cron, depois de persistir.
//
// "Flip recente" = flip semanal cuja data-ÂNCORA cai nos últimos N dias.
// ATENÇÃO (auditoria 2026-07-06): o flip_at é a âncora da vela semanal
// (segunda-feira), não o dia do fecho — um flip confirmado no fecho já nasce
// com ~7 dias de idade. Janela de 12 dias dá folga para atrasos do scheduler
// (ex.: cron falhado + recuperação no dia seguinte) sem perder alertas; a
// dedup por (membro, símbolo, flip_at) no alert_log garante que cada flip só
// gera um alerta por membro, por mais corridas que aconteçam.

const RECENT_DAYS = 12;

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function fmtPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function formatFlip(s: AssetSnapshot): string {
  const up = s.trend === "bullish";
  const ticker = s.symbol.split("/")[0];
  return (
    `${up ? "🟢" : "🔴"} <b>${ticker}</b>${s.name ? ` · ${s.name}` : ""}\n` +
    `Virou <b>${up ? "BULLISH" : "BEARISH"}</b> no fecho da vela semanal.\n` +
    `Δ desde o flip: <b>${fmtPct(s.sinceFlipPct)}</b>\n\n` +
    `📡 Radar do Swell · material educativo, não é aconselhamento financeiro.`
  );
}

export async function dispatchFlipAlerts(snapshots: AssetSnapshot[]): Promise<{ sent: number }> {
  if (!isSupabaseConfigured() || !telegramConfigured()) return { sent: 0 };

  const recent = snapshots.filter(
    (s) => s.lastFlipDate && s.lastFlip !== null && daysSince(s.lastFlipDate) <= RECENT_DAYS
  );

  let sent = 0;
  for (const s of recent) {
    let subs;
    try {
      subs = await subsForSymbol(s.symbol);
    } catch (err) {
      console.error(`[alerts] subsForSymbol ${s.symbol} falhou:`, err);
      continue;
    }
    if (subs.length === 0) continue;

    const flipAt = (s.lastFlipDate as string).slice(0, 10); // YYYY-MM-DD
    for (const sub of subs) {
      if (sub.chat_id == null) continue;
      try {
        const isNew = await logAlert(sub.discord_id, s.symbol, flipAt);
        if (!isNew) continue; // já enviado para este flip
        await sendMessage(sub.chat_id, formatFlip(s));
        sent++;
      } catch (err) {
        console.error(`[alerts] envio ${s.symbol}→${sub.discord_id} falhou:`, err);
      }
    }
  }
  return { sent };
}
