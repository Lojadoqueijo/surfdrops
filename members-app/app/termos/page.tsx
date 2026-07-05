import { TERMS_VERSION } from "@/lib/terms";

export const metadata = { title: "Termos de Utilização · DeFi Surfers" };

// Termos de Utilização — aceitação obrigatória no primeiro login (e a cada
// nova versão). Redação defensiva: plataforma exclusivamente de dados e
// educação, zero aconselhamento, dados de terceiros "tal como estão".

export default function TermosPage() {
  return (
    <main className="container terms-page">
      <div className="brand">
        <h1>🌊 DeFi Surfers</h1>
        <span className="tag">Termos de Utilização · versão {TERMS_VERSION}</span>
      </div>

      <div className="terms-box">
        <div className="terms-tldr">
          <h2>Termos de Utilização — o essencial</h2>
          <ul>
            <li>A Plataforma é <b>estritamente educativa e informativa</b>.</li>
            <li><b>Nada</b> aqui é recomendação de compra/venda nem aconselhamento financeiro.</li>
            <li>Os dados vêm de terceiros e são apresentados <b>&quot;tal como estão&quot;</b>.</li>
            <li>As decisões e o <b>risco</b> (incluindo perda total) são exclusivamente teus.</li>
            <li>Aplica-se a <b>lei portuguesa</b>. Ao aceitar, confirmas que leste os termos completos abaixo.</li>
          </ul>
        </div>

        <div className="terms-scroll">
          <h3>1. O que esta plataforma é (e o que não é)</h3>
        <p>
          A plataforma de membros DeFi Surfers (&quot;Plataforma&quot;) é uma ferramenta de{" "}
          <b>visualização de dados de mercado e de conteúdo educativo</b>, disponibilizada como um
          dos benefícios da comunidade DeFi Surfers. A Plataforma limita-se a apresentar dados
          públicos de mercado e cálculos matemáticos efetuados sobre esses dados (médias,
          indicadores, tendências históricas).
        </p>
        <p>
          A Plataforma <b>não é</b> um serviço de consultoria financeira, de intermediação
          financeira, de gestão de ativos ou de receção/transmissão de ordens, e os DeFi Surfers{" "}
          <b>não estão registados nem autorizados junto de qualquer autoridade reguladora</b>{" "}
          (incluindo CMVM, Banco de Portugal, ESMA ou equivalentes) para prestar tais serviços —
          nem os prestam.
        </p>

        <h3>2. Nenhum conteúdo é recomendação ou aconselhamento</h3>
        <p>
          Nada na Plataforma — dados, indicadores, tendências, filtros, alertas, textos, sessões ou
          mensagens da comunidade — constitui recomendação de compra, venda ou detenção de qualquer
          ativo, aconselhamento financeiro, de investimento, fiscal ou jurídico, nem oferta ou
          solicitação de qualquer transação. Os indicadores apresentados (incluindo estados
          &quot;bullish&quot;/&quot;bearish&quot;, flips, alvos e avisos) são{" "}
          <b>resultados mecânicos de fórmulas aplicadas a preços históricos</b>, iguais para todos
          os membros, sem qualquer consideração pela tua situação financeira, objetivos ou
          tolerância ao risco, e <b>sem qualquer valor preditivo</b>.
        </p>
        <p>
          Qualquer pessoa que, em nome dos DeFi Surfers, te prometa retornos, gira fundos por ti ou
          te peça acesso a carteiras ou credenciais está a cometer fraude — reporta-a de imediato à
          equipa.
        </p>

        <h3>3. Dados de terceiros, &quot;tal como estão&quot;</h3>
        <p>
          Os dados exibidos provêm de fontes terceiras (exchanges e agregadores públicos) e são
          apresentados <b>&quot;tal como estão&quot; e &quot;conforme disponíveis&quot;</b>, sem
          garantias de exatidão, completude, atualidade, continuidade ou adequação a qualquer fim.
          Podem conter erros, atrasos, lacunas ou interrupções. A Plataforma pode ser alterada,
          suspensa ou descontinuada, no todo ou em parte, a qualquer momento e sem aviso.
        </p>

        <h3>4. Risco — a decisão é sempre tua</h3>
        <p>
          Os mercados de criptoativos e financeiros são altamente voláteis e podem originar a{" "}
          <b>perda total do capital investido</b>. Desempenho passado não é indicativo de
          resultados futuros. Toda e qualquer decisão que tomes com base em informação vista na
          Plataforma é <b>exclusivamente tua e por tua conta e risco</b>. Antes de investir,
          considera a tua situação e, se necessário, consulta um profissional devidamente
          habilitado e independente.
        </p>

        <h3>5. Acesso e conduta</h3>
        <p>
          O acesso é pessoal e intransmissível, reservado a membros com o cargo Discord aplicável e
          maiores de 18 anos. É proibido partilhar o acesso, copiar, extrair de forma automatizada
          (scraping), redistribuir, revender ou publicar os dados, indicadores ou alertas da
          Plataforma. És responsável por cumprir as leis e obrigações fiscais da tua jurisdição.
          Podemos suspender ou terminar o acesso em caso de violação destes Termos, sem prejuízo
          dos restantes benefícios da comunidade que não dependam da Plataforma.
        </p>

        <h3>6. Limitação de responsabilidade</h3>
        <p>
          Na medida máxima permitida pela lei aplicável, os DeFi Surfers e as pessoas que operam a
          Plataforma não respondem por quaisquer perdas de negociação ou investimento, lucros
          cessantes, perda de dados ou danos indiretos, incidentais ou consequenciais decorrentes
          do uso (ou impossibilidade de uso) da Plataforma ou da confiança nos dados nela exibidos.
          Em qualquer caso, a responsabilidade total agregada fica limitada ao montante que pagaste
          especificamente pelo acesso à comunidade nos 12 meses anteriores ao evento. Aceitas ainda
          indemnizar os DeFi Surfers por reclamações de terceiros resultantes do teu uso indevido
          da Plataforma. Nada nestes Termos exclui responsabilidade que não possa ser excluída por
          lei.
        </p>

        <h3>7. Alterações, lei e foro</h3>
        <p>
          Estes Termos podem ser atualizados; alterações materiais exigem nova aceitação no login
          seguinte. Aplica-se a lei portuguesa e, salvo norma imperativa em contrário, são
          competentes os tribunais portugueses. Se alguma cláusula for considerada inválida, as
          restantes mantêm-se em vigor. Dúvidas: fala com a equipa no Telegram (
          <a href="https://t.me/surfistacrypto" target="_blank" rel="noopener noreferrer">
            t.me/surfistacrypto
          </a>
          ).
        </p>
        </div>

        <form method="POST" action="/api/terms/accept" className="terms-actions">
          <button type="submit" className="btn-accept">
            Li e aceito os Termos — entrar na plataforma
          </button>
          <a className="btn-decline" href="/api/auth/logout">
            Não aceito · sair
          </a>
        </form>
      </div>
    </main>
  );
}
