import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";

// Callback OAuth do Discord:
//  código → access token → id do utilizador → verificação do cargo
//  "DefiSurfers" no servidor (via bot) → cookie de sessão assinado.

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=sem-codigo`);

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const roleId = process.env.DISCORD_ROLE_ID;
  if (!clientId || !clientSecret || !botToken || !guildId || !roleId) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/api/auth/callback`,
    }),
  });
  if (!tokenRes.ok) return NextResponse.redirect(`${origin}/login?error=token`);
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return NextResponse.redirect(`${origin}/login?error=token`);

  const meRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!meRes.ok) return NextResponse.redirect(`${origin}/login?error=perfil`);
  const me = (await meRes.json()) as { id: string };

  const memberRes = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${me.id}`,
    { headers: { Authorization: `Bot ${botToken}` } }
  );
  // 404 = a conta não está no servidor → sem cargo (o servidor é aberto; o que
  // dá acesso é o cargo — a mensagem é a mesma, orientada à adesão).
  // Qualquer outro erro (401/403/5xx) é problema NOSSO (token do bot, bot fora
  // do servidor, Discord em baixo) — nunca culpar o membro.
  if (memberRes.status === 404) {
    return NextResponse.redirect(`${origin}/login?error=sem-cargo`);
  }
  if (!memberRes.ok) {
    console.error(`[auth] verificação de cargo falhou: HTTP ${memberRes.status}`);
    return NextResponse.redirect(`${origin}/login?error=verificacao`);
  }
  // DISCORD_ROLE_ID aceita vários IDs separados por vírgula (ex: cargo base +
  // "DefiSurfer Adm" + "DefiSurfer #1") — basta ter UM deles para entrar.
  const allowedRoles = roleId.split(",").map((r) => r.trim()).filter(Boolean);
  const member = (await memberRes.json()) as { roles?: string[] };
  if (!member.roles?.some((r) => allowedRoles.includes(r))) {
    return NextResponse.redirect(`${origin}/login?error=sem-cargo`);
  }

  const session = await createSession(me.id);
  if (!session) return NextResponse.redirect(`${origin}/login?error=sessao`);

  const res = NextResponse.redirect(`${origin}/members`);
  res.cookies.set("ds_session", session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
