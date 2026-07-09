import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";

// Callback OAuth do Discord:
//  código → access token (scopes: identify + guilds.members.read) → id do
//  utilizador → leitura dos PRÓPRIOS cargos no servidor (endpoint
//  /users/@me/guilds/{id}/member, autorizado pelo próprio membro) → cookie
//  de sessão assinado.
//
// NOTA: o gate NÃO depende de bot no servidor. A verificação por bot
// (DISCORD_BOT_TOKEN) foi abandonada para o login porque o anti-bot do
// servidor (AuthGG) expulsava o nosso bot ao entrar — ver DEFI_SURFERS_PLANO.
// O bot token continua reservado para features futuras (tabela diária no canal).

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=sem-codigo`);

  // state anti-CSRF (auditoria 1.4): tem de coincidir com o cookie posto no
  // /api/auth/login. Sem match, o code pode ter sido plantado por terceiros.
  const state = req.nextUrl.searchParams.get("state");
  const stateCookie = req.cookies.get("ds_oauth_state")?.value;
  if (!state || !stateCookie || state !== stateCookie) {
    return NextResponse.redirect(`${origin}/login?error=state`);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const guildId = process.env.DISCORD_GUILD_ID;
  const roleId = process.env.DISCORD_ROLE_ID;
  if (!clientId || !clientSecret || !guildId || !roleId) {
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
  const me = (await meRes.json()) as {
    id: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
  };

  // Cargos do próprio membro, com o token DELE (scope guilds.members.read).
  const memberRes = await fetch(
    `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  // 404 = a conta não está no servidor → tratamento igual a "sem cargo"
  // (o servidor é aberto; o que dá acesso é o cargo — mensagem de adesão).
  if (memberRes.status === 404) {
    return NextResponse.redirect(`${origin}/login?error=sem-cargo`);
  }
  if (!memberRes.ok) {
    console.error(`[auth] leitura de cargos falhou: HTTP ${memberRes.status}`);
    return NextResponse.redirect(`${origin}/login?error=verificacao`);
  }

  // DISCORD_ROLE_ID aceita vários IDs separados por vírgula (ex: cargo base +
  // "DefiSurfer Adm" + "DefiSurfer #1") — basta ter UM deles para entrar.
  const allowedRoles = roleId.split(",").map((r) => r.trim()).filter(Boolean);
  const member = (await memberRes.json()) as {
    roles?: string[];
    nick?: string | null;
    avatar?: string | null;
  };
  if (!member.roles?.some((r) => allowedRoles.includes(r))) {
    return NextResponse.redirect(`${origin}/login?error=sem-cargo`);
  }

  // Perfil para a UI: preferir identidade DO SERVIDOR (nick/avatar de guild),
  // depois a global. Só nome de exibição + URL do avatar vão no cookie —
  // o mínimo necessário, assinado e httpOnly.
  const name = member.nick || me.global_name || me.username || "DeFi Surfer";
  const avatar = member.avatar
    ? `https://cdn.discordapp.com/guilds/${guildId}/users/${me.id}/avatars/${member.avatar}.png?size=96`
    : me.avatar
      ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=96`
      : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(me.id) >> 22n) % 6}.png`;

  const session = await createSession(me.id, { name, avatar });
  if (!session) return NextResponse.redirect(`${origin}/login?error=sessao`);

  const res = NextResponse.redirect(`${origin}/members`);
  res.cookies.set("ds_session", session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  // state consumido — apagar (uso único).
  res.cookies.set("ds_oauth_state", "", { maxAge: 0, path: "/" });
  return res;
}
