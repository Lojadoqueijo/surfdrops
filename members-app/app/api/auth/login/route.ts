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
  url.searchParams.set("scope", "identify");
  return NextResponse.redirect(url);
}
