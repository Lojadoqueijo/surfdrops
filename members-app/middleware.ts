import { NextResponse, type NextRequest } from "next/server";

// Cadeado TEMPORÁRIO até o gate Discord (Bloco C.10) estar pronto.
// Regras:
//  - Sem MEMBERS_GATE_KEY definida no Vercel → tudo bloqueado (seguro por defeito).
//  - Acesso: /members?key=<MEMBERS_GATE_KEY> → define cookie e entra.
//  - O cron (/api/cron/refresh) continua protegido pelo CRON_SECRET próprio.

const COOKIE = "ds_gate";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Deixar passar o cron (tem a sua própria autenticação por header).
  if (pathname.startsWith("/api/cron")) return NextResponse.next();

  const gateKey = process.env.MEMBERS_GATE_KEY;
  if (!gateKey) {
    return new NextResponse("Área privada — acesso bloqueado.", { status: 401 });
  }

  // Já tem o cookie certo?
  if (req.cookies.get(COOKIE)?.value === gateKey) return NextResponse.next();

  // Veio com ?key= correto? Define cookie e limpa o URL.
  if (searchParams.get("key") === gateKey) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("key");
    const res = NextResponse.redirect(url);
    res.cookies.set(COOKIE, gateKey, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 dias
    });
    return res;
  }

  return new NextResponse("Área privada DeFi Surfers — acesso só para membros.", {
    status: 401,
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
