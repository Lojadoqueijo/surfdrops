const MESSAGES: Record<string, string> = {
  "sem-codigo": "Login cancelado no Discord. Tenta outra vez.",
  config: "Login Discord ainda não configurado — entra com a password de membro.",
  token: "Falha na autorização do Discord. Tenta de novo.",
  perfil: "Não foi possível ler o teu perfil do Discord.",
  "nao-membro": "Essa conta Discord não está no servidor DeFi Surfers.",
  "sem-cargo": "A tua conta não tem o cargo DefiSurfers. Fala com a equipa no Discord.",
  sessao: "Erro ao criar a sessão. Tenta de novo.",
  key: "Password errada. Confirma e tenta outra vez.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="container login-page">
      <div className="brand">
        <h1>🌊 DeFi Surfers</h1>
        <span className="tag">área de membros</span>
      </div>
      <p className="muted">Screener de tendências multi-setor — acesso exclusivo a membros.</p>

      {error && <p className="login-error">{MESSAGES[error] ?? "Erro no login."}</p>}

      <div className="login-box">
        <a className="btn-discord" href="/api/auth/login">
          Entrar com Discord
        </a>
        <p className="muted or">— ou —</p>
        <form action="/members" method="get" className="key-form">
          <input type="password" name="key" placeholder="Password de membro" required />
          <button type="submit">Entrar</button>
        </form>
      </div>

      <p className="note">
        Ainda não és membro? Junta-te à comunidade DeFi Surfers — fala connosco no Telegram
        ou no Discord.
      </p>
    </main>
  );
}
