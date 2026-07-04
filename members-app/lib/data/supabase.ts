import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AssetSnapshot } from "../engine/types";

// Persistência opcional: enquanto SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não
// existirem (projeto ainda por criar — ver .env.example), tudo aqui devolve
// "não configurado" sem rebentar o cron. O cron continua a funcionar em modo
// "live only" (computa e serve na hora) exatamente como antes desta mudança.

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export interface PersistResult {
  ok: boolean;
  skipped?: boolean;
  count?: number;
  error?: string;
}

/** snapshots: upsert de 1 linha por (symbol, date=hoje). */
export async function upsertSnapshots(snapshots: AssetSnapshot[]): Promise<PersistResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: true, skipped: true };
  if (snapshots.length === 0) return { ok: true, count: 0 };

  const date = todayIsoDate();
  const rows = snapshots.map((s) => ({
    symbol: s.symbol,
    date,
    sector: s.sector,
    trend: s.trend,
    weekly_trend: s.weeklyTrend,
    daily_trend: s.dailyTrend,
    estado: s.estado,
    next_flip: s.nextFlip,
    last_flip: s.lastFlip,
    last_flip_close: s.lastFlipClose,
    last_flip_date: s.lastFlipDate,
    daily_flip_date: s.dailyFlipDate,
    since_flip_pct: s.sinceFlipPct,
    price: s.price,
    market_cap: s.marketCap,
    strength: s.strength,
    warmup: s.warmup,
    cooldown: s.cooldown,
    exhaustion_atr: s.exhaustionAtr,
    dot_top: s.dotTop,
    dot_bottom: s.dotBottom,
    bear_div: s.bearDiv,
    bull_div: s.bullDiv,
    cheap_zone: s.cheapZone,
    tp: s.tp,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("snapshots").upsert(rows, { onConflict: "symbol,date" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: rows.length };
}

/**
 * flip_events: histórico append-only. Só persistimos o flip WEEKLY (é o que
 * tem um nível de linha próprio — lastFlip/lastFlipClose). O motor de
 * confirmação Daily (trendDirectionSeries) hoje só dá direção, sem o nível da
 * banda Supertrend exposto; persistir flips diários fica para quando essa
 * série também expuser um nível (não faz parte deste item).
 *
 * Idempotente por desenho: a unique key (symbol, timeframe, flip_at) garante
 * que reprocessar o mesmo flip em dias seguintes não duplica a linha — só
 * entra 1 linha nova quando o flip_at (data do bar do flip) muda de facto.
 */
export async function appendFlipEvents(snapshots: AssetSnapshot[]): Promise<PersistResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: true, skipped: true };

  const rows = snapshots
    .filter((s) => s.lastFlipDate !== null && s.lastFlip !== null && s.lastFlipClose !== null)
    .map((s) => ({
      symbol: s.symbol,
      sector: s.sector,
      timeframe: "weekly" as const,
      direction: s.trend,
      level: s.lastFlip as number,
      price_at_flip: s.lastFlipClose as number,
      flip_at: s.lastFlipDate as string,
    }));
  if (rows.length === 0) return { ok: true, count: 0 };

  const { error, count } = await supabase
    .from("flip_events")
    .upsert(rows, { onConflict: "symbol,timeframe,flip_at", ignoreDuplicates: true, count: "exact" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: count ?? undefined };
}
