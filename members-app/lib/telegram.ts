// Cliente mínimo da Bot API do Telegram. O token vive só no servidor
// (TELEGRAM_BOT_TOKEN, colado no Vercel pelo utilizador — nunca no cliente,
// nunca no chat). Sem token, telegramConfigured() = false e tudo degrada.

const API = "https://api.telegram.org";

function token(): string | null {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return t && t.length > 0 ? t : null;
}

export function telegramConfigured(): boolean {
  return token() !== null;
}

export async function tgCall<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const t = token();
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN em falta");
  const res = await fetch(`${API}/bot${t}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? res.status}`);
  return data.result as T;
}

let cachedUsername: string | null | undefined;
export async function getBotUsername(): Promise<string | null> {
  if (cachedUsername !== undefined) return cachedUsername;
  try {
    const me = await tgCall<{ username?: string }>("getMe", {});
    cachedUsername = me.username ?? null;
  } catch {
    cachedUsername = null;
  }
  return cachedUsername;
}

export async function sendMessage(chatId: number | string, text: string): Promise<void> {
  await tgCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

// Segredo do webhook derivado do token (sem env var extra). O Telegram
// devolve-o no header X-Telegram-Bot-Api-Secret-Token de cada update.
export async function webhookSecret(): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(`ds-webhook:${token() ?? ""}`));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
