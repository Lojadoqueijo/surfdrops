import { NextResponse, type NextRequest } from "next/server";

// Termina a sessão: limpa o cookie de sessão Discord e o cookie do gate
// temporário por password, e volta ao login.

export function GET(req: NextRequest) {
  const res = NextResponse.redirect(`${req.nextUrl.origin}/login`);
  res.cookies.set("ds_session", "", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 0, path: "/" });
  res.cookies.set("ds_gate", "", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 0, path: "/" });
  return res;
}
