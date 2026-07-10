const TELEGRAM_EQUIPA = "https://t.me/surfistacrypto";

const SEM_CARGO =
  "A tua conta Discord ainda não tem o cargo DefiSurfers — o terminal é exclusivo dos membros DeFi Surfers. Fala com a equipa no Telegram para desbloqueares o acesso.";

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
        <h1>📡 Radar do Swell</h1>
        <span className="tag">by DeFi Surfers</span>
      </div>
      <p className="muted">
        3.600+ ativos — cripto, ações dos EUA, Europa e Ásia, ETFs, commodities e índices —
        varridos pelo motor da Linha do Swell. Acesso exclusivo a membros.
      </p>

      {error && <p className="login-error">{MESSAGES[error] ?? "Erro no login."}</p>}

      <div className="login-box">
        <a className="btn-discord" href="/api/auth/login">
          Entrar com Discord
        </a>
        <p className="muted or-note">
          Acesso reservado a membros com o cargo <b>DefiSurfers</b>.
        </p>
      </div>

      <div className="note join-note">
        <p>Ainda não és membro? O Radar do Swell faz parte da comunidade DeFi Surfers.</p>
        <a
          className="btn-telegram"
          href={TELEGRAM_EQUIPA}
          target="_blank"
          rel="noopener noreferrer"
        >
          💬 Falar com a equipa no Telegram
        </a>
      </div>
    </main>
  );
}
