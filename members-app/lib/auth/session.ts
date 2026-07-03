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
  const s = process.env.DISCORD_CLIENT_SECRET ?? process.env.MEMBERS_GATE_KEY;
  const t = s?.trim();
  return t && t.length > 0 ? t : null;
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

export async function createSession(userId: string, days = 30): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const payload = b64url(
    enc.encode(JSON.stringify({ sub: userId, exp: Date.now() + days * 86400_000 }))
  );
  return `${payload}.${await hmac(payload, secret)}`;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if ((await hmac(payload, secret)) !== sig) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    return typeof json.exp === "number" && json.exp > Date.now();
  } catch {
    return false;
  }
}
