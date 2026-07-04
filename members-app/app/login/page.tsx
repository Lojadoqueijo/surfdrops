const SEM_CARGO =
  "A tua conta Discord ainda não tem o cargo DefiSurfers — o terminal é exclusivo dos membros DeFi Surfers. Fala com a equipa no Discord ou no Telegram para desbloqueares o acesso.";

const MESSAGES: Record<string, string> = {
  "sem-codigo": "Login cancelado no Discord. Tenta outra vez.",
  config: "O login está temporariamente indisponível (configuração). A equipa já foi avisada — tenta mais tarde.",
  token: "Falha na autorização do Discord. Tenta de novo.",
  perfil: "Não foi possível ler o teu perfil do Discord. Tenta de novo.",
  "sem-cargo": SEM_CARGO,
  "nao-membro": SEM_CARGO, // chave antiga; mesmo tratamento (o servidor é aberto — o que conta é o cargo)
  verificacao: "Não conseguimos verificar o teu cargo neste momento (problema do nosso lado, não teu). Tenta de novo dentro de instantes.",
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
        <p className="muted or-note">
          Acesso reservado a membros com o cargo <b>DefiSurfers</b>.
        </p>
      </div>

      <p className="note">
        Ainda não és membro? Junta-te à comunidade DeFi Surfers — fala connosco no Telegram
        ou no Discord.
      </p>
    </main>
  );
}
