import { getSupabase } from "./supabase";

// Persistência dos alertas Telegram. Chave = Discord id (o "sub" da sessão
// assinada). Tudo aqui é no-op quando o Supabase não está configurado.

export interface AlertSub {
  discord_id: string;
  chat_id: number | null;
  telegram_username: string | null;
  flips: boolean;
  signals: boolean;
  digest: boolean;
  watchlist: string[];
}

function shortCode(): string {
  // 16 chars URL-safe — bem dentro do limite de 64 do start-param do Telegram.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/** Cria um código de ligação de uso único (TTL 15 min) para o deep-link. */
export async function issueLinkCode(discordId: string): Promise<string | null> {
  const s = getSupabase();
  if (!s) return null;
  const code = shortCode();
  const expires_at = new Date(Date.now() + 15 * 60_000).toISOString();
  const { error } = await s.from("alert_link_codes").insert({ code, discord_id: discordId, expires_at });
  if (error) {
    console.error("[alerts] issueLinkCode falhou:", error.message);
    return null;
  }
  return code;
}

/** Consome o código (apaga-o) e devolve o Discord id, ou null se inválido/expirado. */
export async function consumeLinkCode(code: string): Promise<string | null> {
  const s = getSupabase();
  if (!s) return null;
  const { data } = await s.from("alert_link_codes").select("*").eq("code", code).maybeSingle();
  if (!data) return null;
  await s.from("alert_link_codes").delete().eq("code", code);
  if (new Date(data.expires_at as string) < new Date()) return null;
  return data.discord_id as string;
}

/** Liga (ou re-liga) um chat do Telegram a um membro. */
export async function linkChat(
  discordId: string,
  chatId: number,
  username: string | null
): Promise<void> {
  const s = getSupabase();
  if (!s) return;
  await s.from("alert_subs").upsert(
    {
      discord_id: discordId,
      chat_id: chatId,
      telegram_username: username,
      linked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "discord_id" }
  );
}

/** /stop: desliga o chat (mantém as preferências, só limpa o chat_id). */
export async function unlinkChat(chatId: number): Promise<void> {
  const s = getSupabase();
  if (!s) return;
  await s
    .from("alert_subs")
    .update({ chat_id: null, updated_at: new Date().toISOString() })
    .eq("chat_id", chatId);
}

export async function getSub(discordId: string): Promise<AlertSub | null> {
  const s = getSupabase();
  if (!s) return null;
  const { data } = await s.from("alert_subs").select("*").eq("discord_id", discordId).maybeSingle();
  return (data as AlertSub) ?? null;
}

/** Sincroniza preferências + watchlist do membro (chamado pelo cliente). */
export async function syncPrefs(
  discordId: string,
  prefs: { flips: boolean; signals: boolean; digest: boolean },
  watchlist: string[]
): Promise<void> {
  const s = getSupabase();
  if (!s) return;
  await s.from("alert_subs").upsert(
    {
      discord_id: discordId,
      flips: prefs.flips,
      signals: prefs.signals,
      digest: prefs.digest,
      watchlist,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "discord_id" }
  );
}

/** Membros ligados que querem alertas de flip e têm este símbolo na watchlist. */
export async function subsForSymbol(symbol: string): Promise<AlertSub[]> {
  const s = getSupabase();
  if (!s) return [];
  const { data } = await s
    .from("alert_subs")
    .select("*")
    .eq("flips", true)
    .not("chat_id", "is", null)
    .contains("watchlist", [symbol]);
  return (data as AlertSub[]) ?? [];
}

/** Regista o envio; devolve true se é novo (deduplica reenvios do mesmo flip). */
export async function logAlert(discordId: string, symbol: string, flipAt: string): Promise<boolean> {
  const s = getSupabase();
  if (!s) return false;
  const { error } = await s
    .from("alert_log")
    .insert({ discord_id: discordId, symbol, flip_at: flipAt });
  // violação de PK (23505) = já foi enviado → não reenviar.
  if (error) return false;
  return true;
}
