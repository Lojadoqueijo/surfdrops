import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { TERMS_COOKIE, TERMS_VERSION } from "@/lib/terms";

// Gate da área de membros:
//  1) Sem sessão Discord válida (cookie ds_session assinado) → /login.
//  2) Com sessão mas sem os Termos aceites (nesta versão) → /termos.
//  3) Caso contrário → entra.
// O antigo fallback por password (MEMBERS_GATE_KEY / ?key=) foi removido —
// o acesso é exclusivamente por cargo Discord.

const PUBLIC = [/^\/login/, /^\/api\/auth\//, /^\/api\/cron\//, /^\/favicon/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  // Bypass de desenvolvimento local: USE_MOCK=1 só existe no .env.local
  // (nunca no Vercel) — dispensa sessão Discord para trabalhar na UI.
  const devBypass = process.env.USE_MOCK === "1";

  if (!devBypass && !(await verifySession(req.cookies.get("ds_session")?.value))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Sessão ok — exigir aceitação dos Termos (uma vez por versão).
  const acceptedTerms = req.cookies.get(TERMS_COOKIE)?.value === TERMS_VERSION;
  if (!acceptedTerms && pathname !== "/termos" && !pathname.startsWith("/api/terms")) {
    const url = req.nextUrl.clone();
    url.pathname = "/termos";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
