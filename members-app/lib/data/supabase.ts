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
 * Últimos snapshots por ativo (para a página de membros LER da BD em vez de
 * recomputar ao vivo — com o universo expandido, o throttle do Twelve Data
 * torna a computação por pedido inviável). Devolve null se o Supabase não
 * estiver configurado ou ainda não houver dados (fallback: computar ao vivo).
 */
export async function readLatestSnapshots(): Promise<
  { rows: AssetSnapshot[]; updatedAt: string } | null
> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const since = new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("snapshots")
    .select("*")
    .gte("date", since)
    .order("date", { ascending: false });
  if (error) {
    console.error("[supabase] leitura de snapshots falhou:", error.message);
    return null;
  }
  if (!data || data.length === 0) return null;

  const seen = new Set<string>();
  const rows: AssetSnapshot[] = [];
  let updatedAt = "";
  for (const r of data as Record<string, unknown>[]) {
    const symbol = r.symbol as string;
    if (seen.has(symbol)) continue; // ordenado por data desc → primeiro = mais recente
    seen.add(symbol);
    const rowUpdated = (r.updated_at as string) ?? "";
    if (rowUpdated > updatedAt) updatedAt = rowUpdated;
    rows.push({
      symbol,
      sector: r.sector as string,
      trend: r.trend as AssetSnapshot["trend"],
      weeklyTrend: (r.weekly_trend as AssetSnapshot["weeklyTrend"]) ?? null,
      dailyTrend: (r.daily_trend as AssetSnapshot["dailyTrend"]) ?? null,
      estado: (r.estado as AssetSnapshot["estado"]) ?? null,
      nextFlip: r.next_flip as number,
      lastFlip: (r.last_flip as number) ?? null,
      lastFlipClose: (r.last_flip_close as number) ?? null,
      lastFlipDate: (r.last_flip_date as string) ?? null,
      dailyFlipDate: (r.daily_flip_date as string) ?? null,
      sinceFlipPct: (r.since_flip_pct as number) ?? null,
      price: r.price as number,
      updatedAt: rowUpdated,
      marketCap: (r.market_cap as number) ?? null,
      strength: (r.strength as number) ?? null,
      warmup: Boolean(r.warmup),
      cooldown: Boolean(r.cooldown),
      exhaustionAtr: (r.exhaustion_atr as number) ?? null,
      dotTop: Boolean(r.dot_top),
      dotBottom: Boolean(r.dot_bottom),
      bearDiv: Boolean(r.bear_div),
      bullDiv: Boolean(r.bull_div),
      cheapZone: Boolean(r.cheap_zone),
      tp: (r.tp as AssetSnapshot["tp"]) ?? null,
    });
  }
  return { rows, updatedAt };
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
