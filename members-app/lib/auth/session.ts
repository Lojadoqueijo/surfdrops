// Sessões assinadas (HMAC-SHA256 via Web Crypto — funciona em Edge middleware
// e em rotas Node). Cookie: ds_session = payloadB64url.assinatura

const enc = new TextEncoder();

function b64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getSecret(): string | null {
  // SESSION_SECRET dedicada (auditoria 1.1) — as sessões deixam de partilhar
  // o Client Secret do Discord. Fallback para o Client Secret (entretanto
  // rodado) só para preview/dev onde a env possa faltar.
  const s = process.env.SESSION_SECRET ?? process.env.DISCORD_CLIENT_SECRET;
  const t = s?.trim();
  return t && t.length > 0 ? t : null;
}

/** Comparação em tempo constante (auditoria 1.6 — evita timing attack). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64url(sig);
}

export interface SessionProfile {
  name?: string; // nick no servidor ou display name do Discord
  avatar?: string; // URL completo do avatar (CDN do Discord)
}

export async function createSession(
  userId: string,
  profile: SessionProfile = {},
  days = 30
): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const payload = b64url(
    enc.encode(
      JSON.stringify({
        sub: userId,
        name: profile.name,
        avatar: profile.avatar,
        exp: Date.now() + days * 86400_000,
      })
    )
  );
  return `${payload}.${await hmac(payload, secret)}`;
}

/** Payload da sessão se o token for válido (assinatura + validade); senão null. */
export async function readSession(
  token: string | undefined
): Promise<{ sub: string; name?: string; avatar?: string } | null> {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(await hmac(payload, secret), sig)) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      sub?: string;
      name?: string;
      avatar?: string;
      exp?: number;
    };
    if (typeof json.exp !== "number" || json.exp <= Date.now() || !json.sub) return null;
    return { sub: json.sub, name: json.name, avatar: json.avatar };
  } catch {
    return null;
  }
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (!safeEqual(await hmac(payload, secret), sig)) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    return typeof json.exp === "number" && json.exp > Date.now();
  } catch {
    return false;
  }
}
