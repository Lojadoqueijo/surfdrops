import { NextResponse, type NextRequest } from "next/server";
import { TERMS_COOKIE, TERMS_VERSION } from "@/lib/terms";

// Regista a aceitação dos Termos: cookie por versão, 1 ano. O middleware só
// deixa chegar aqui quem tem sessão Discord válida.
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/members", req.url), 303);
  res.cookies.set(TERMS_COOKIE, TERMS_VERSION, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
