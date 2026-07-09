import { NextResponse, type NextRequest } from "next/server";

// Início do fluxo OAuth: redireciona para a página de autorização do Discord.

export function GET(req: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${req.nextUrl.origin}/login?error=config`);
  }
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${req.nextUrl.origin}/api/auth/callback`);
  url.searchParams.set("response_type", "code");
  // guilds.members.read: o PRÓPRIO membro autoriza a leitura dos seus cargos no
  // servidor — dispensa bot no servidor para o login (o anti-bot do AuthGG
  // expulsava o nosso bot; assim o gate não depende dele).
  url.searchParams.set("scope", "identify guilds.members.read");
  // state anti-CSRF (auditoria 1.4): valor aleatório vai no URL e num cookie
  // httpOnly de vida curta; o callback exige que coincidam.
  const state = crypto.randomUUID().replace(/-/g, "");
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set("ds_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
