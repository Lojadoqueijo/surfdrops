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

/**
 * Retenção: apaga snapshots com mais de `days` dias. A página só lê os últimos
 * 4 dias; sem isto a tabela cresceria sem limite (~2,5 MB/dia → 500 MB do
 * plano grátis em ~6 meses). Com prune a 14 dias, o storage fica ~capado a
 * 14 × universo, a qualquer escala. flip_events é histórico e NÃO se toca.
 */
export async function pruneOldSnapshots(days = 14): Promise<PersistResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: true, skipped: true };
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { error, count } = await supabase
    .from("snapshots")
    .delete({ count: "exact" })
    .lt("date", cutoff);
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: count ?? undefined };
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
    name: s.name,
    logo_url: s.logoUrl,
    tv_symbol: s.tvSymbol,
    yahoo_symbol: s.yahooSymbol,
    rank: s.rank,
    categories: s.categories,
    country: s.country,
    currency: s.currency,
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
    // ath_pct: RE-ATIVAR após a migração `alter table snapshots add column
    // ath_pct` (dashboard Supabase em baixo em 2026-07-11). Sem a coluna, o
    // upsert inteiro falharia (PGRST204) e nenhum snapshot persistiria.
    // ath_pct: s.athPct,
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

// Classe de amplitude (Maré). Mesma partição que /api/public/health.
// null = fora da Maré: as internacionais curadas não entram na contagem
// (juntá-las a "acoes" deslocaria o % por composição, não por mercado).
export function breadthClass(sector: string): "cripto" | "acoes" | "etf_cmd_idx" | null {
  if (sector.startsWith("Cripto")) return "cripto";
  if (sector === "Ações — Internacional") return null;
  if (sector.startsWith("Ações")) return "acoes";
  return "etf_cmd_idx";
}

/**
 * breadth_daily: 1 linha por (class, date) com a contagem bull/bear do universo
 * FILTRADO por closed-candles (o "termómetro" da Maré). Append histórico que
 * NUNCA se poda — cresce ~4 linhas/dia (~KBs/ano). Idempotente (upsert do dia).
 */
export async function recordBreadthDaily(
  snapshots: Array<{ sector: string; trend: "bullish" | "bearish" | "novo" }>,
  date = todayIsoDate()
): Promise<PersistResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: true, skipped: true };
  if (snapshots.length === 0) return { ok: true, count: 0 };

  const agg = new Map<string, { bull: number; bear: number }>();
  for (const s of snapshots) {
    const cls = breadthClass(s.sector);
    if (cls === null) continue; // internacionais: fora da Maré
    const a = agg.get(cls) ?? { bull: 0, bear: 0 };
    if (s.trend === "bullish") a.bull++;
    else if (s.trend === "bearish") a.bear++; // "novo" fica fora da Maré
    else continue;
    agg.set(cls, a);
  }
  const rows = [...agg.entries()].map(([cls, a]) => ({
    class: cls,
    date,
    bull: a.bull,
    bear: a.bear,
    total: a.bull + a.bear,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("breadth_daily").upsert(rows, { onConflict: "class,date" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: rows.length };
}

/** Série da Maré para a UI: [{date, bull, bear, total, pct}] de uma classe. */
export async function readBreadth(
  cls: string,
  days = 90
): Promise<Array<{ date: string; bull: number; bear: number; total: number; pct: number }>> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("breadth_daily")
    .select("date, bull, bear, total")
    .eq("class", cls)
    .gte("date", since)
    .order("date", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    date: r.date as string,
    bull: r.bull as number,
    bear: r.bear as number,
    total: r.total as number,
    pct: r.total ? Math.round(((r.bull as number) / (r.total as number)) * 1000) / 10 : 0,
  }));
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
  // RPC latest_snapshots (DISTINCT ON symbol): só a linha mais recente por
  // ativo dentro da janela — ~3,5k linhas em vez de ~15k. Corta o egress do
  // Supabase ~4× (era o limite matemático mais próximo de rebentar no plano
  // grátis). Paginação mantida: o PostgREST corta a 1000 por pedido.
  const PAGE = 1000;
  const data: Record<string, unknown>[] = [];
  for (let from = 0; from < 40_000; from += PAGE) {
    const { data: page, error } = await supabase
      .rpc("latest_snapshots", { since })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[supabase] leitura de snapshots falhou:", error.message);
      return null;
    }
    if (!page || page.length === 0) break;
    data.push(...(page as Record<string, unknown>[]));
    if (page.length < PAGE) break;
  }
  if (data.length === 0) return null;

  const seen = new Set<string>();
  const rows: AssetSnapshot[] = [];
  let updatedAt = "";
  for (const r of data) {
    const symbol = r.symbol as string;
    if (seen.has(symbol)) continue; // ordenado por data desc → primeiro = mais recente
    seen.add(symbol);
    const rowUpdated = (r.updated_at as string) ?? "";
    if (rowUpdated > updatedAt) updatedAt = rowUpdated;
    rows.push({
      symbol,
      sector: r.sector as string,
      name: (r.name as string) ?? null,
      logoUrl: (r.logo_url as string) ?? null,
      tvSymbol: (r.tv_symbol as string) ?? null,
      yahooSymbol: (r.yahoo_symbol as string) ?? null,
      rank: (r.rank as number) ?? null,
      categories: (r.categories as string[]) ?? null,
      country: (r.country as string) ?? null,
      currency: (r.currency as string) ?? null,
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
      athPct: (r.ath_pct as number) ?? null,
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
 * Cache do último universo dinâmico BOM (cripto/ações) — contingência para
 * quando os fornecedores de listas falham (CoinGecko 429, crumb do Yahoo
 * bloqueado, NASDAQ Trader em baixo). Sem isto, a falha do builder colapsava
 * o universo para a lista estática (33 criptos / 503 ações alfabéticas).
 */
export async function saveUniverseCache(cls: string, assets: unknown[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || assets.length === 0) return;
  const { error } = await supabase
    .from("universe_cache")
    .upsert({ class: cls, assets, updated_at: new Date().toISOString() }, { onConflict: "class" });
  if (error) console.error(`[supabase] universe_cache save ${cls}:`, error.message);
}

export async function loadUniverseCache<T>(cls: string): Promise<T[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("universe_cache")
    .select("assets, updated_at")
    .eq("class", cls)
    .maybeSingle();
  if (error || !data) return null;
  return (data.assets as T[]) ?? null;
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
