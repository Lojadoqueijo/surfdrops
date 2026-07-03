import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";

// Gate da área de membros:
//  1) Sessão Discord válida (cookie ds_session assinado) → entra.
//  2) Password de membro (MEMBERS_GATE_KEY) via /login ou ?key= → cookie 30d.
//  3) Caso contrário → redirect para /login.
// Comparações com .trim() para tolerar espaços/enters acidentais no env var.

const GATE_COOKIE = "ds_gate";
const PUBLIC = [/^\/login/, /^\/api\/auth\//, /^\/api\/cron\//, /^\/favicon/];

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  // 1) Sessão Discord
  if (await verifySession(req.cookies.get("ds_session")?.value)) {
    return NextResponse.next();
  }

  // 2) Password de membro
  const gateKey = process.env.MEMBERS_GATE_KEY?.trim();
  if (gateKey) {
    if (req.cookies.get(GATE_COOKIE)?.value === gateKey) return NextResponse.next();

    const q = searchParams.get("key")?.trim();
    if (q === gateKey) {
      const url = req.nextUrl.clone();
      url.searchParams.delete("key");
      const res = NextResponse.redirect(url);
      res.cookies.set(GATE_COOKIE, gateKey, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
      return res;
    }
    if (q !== undefined && q !== null) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?error=key";
      return NextResponse.redirect(url);
    }
  }

  // 3) Sem credenciais → página de login
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
