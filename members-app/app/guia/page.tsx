import Link from "next/link";
import { PrintButton } from "./PrintButton";

export const metadata = {
  title: "Guia — Linha do Swell · Radar do Swell",
  robots: { index: false, follow: false },
};

// Guia educativo da Linha do Swell (docs consultáveis, fonte única da verdade).
// VOZ: descritiva e impessoal — descreve o que o INDICADOR mostra, nunca dá
// ordens ao leitor ("o indicador marca" em vez de "compra"). Exemplos sempre
// marcados como ILUSTRATIVOS. Camada legal inspirada no modelo Bullmania:
// posicionamento educativo + secção de Risco dedicada + disclaimer consistente.

export default function GuiaPage() {
  return (
    <main className="container guia-page">
      <header className="guia-head">
        <div className="brand">
          <h1>📖 Guia da Linha do Swell</h1>
          <span className="tag">Material educativo · Radar do Swell</span>
        </div>
        <div className="guia-actions">
          <Link className="guia-back" href="/members">
            ← Voltar ao Radar
          </Link>
          <PrintButton />
        </div>
      </header>

      <nav className="guia-toc" aria-label="Índice">
        <a href="#o-que-e">1. O que é</a>
        <a href="#linha">2. Ler a linha</a>
        <a href="#flip-level">3. O Flip Level</a>
        <a href="#estado">4. Estado (Alinhado/Conflito)</a>
        <a href="#avisos">5. Avisos de topo/fundo</a>
        <a href="#metodo">6. O método, resumido</a>
        <a href="#risco">7. Risco</a>
      </nav>

      <section id="o-que-e" className="guia-sec">
        <h2>1. O que é a Linha do Swell</h2>
        <p>
          A Linha do Swell é um <b>indicador de tendência</b>. Descreve uma única leitura sobre um
          ativo: se, segundo o cálculo do indicador, a tendência de fundo está para <b>cima</b> ou
          para <b>baixo</b>. Uma linha acompanha o preço, adapta-se à volatilidade e muda de cor
          quando esse cálculo de tendência inverte.
        </p>
        <p className="guia-note">
          O indicador não prevê o mercado nem sabe o futuro — é uma leitura mecânica de dados de
          preço passados. O que faz a seguir com essa informação é, sempre, decisão tua.
        </p>
      </section>

      <section id="linha" className="guia-sec">
        <h2>2. Ler a linha: verde e vermelho</h2>
        <ul className="guia-list">
          <li>
            <b>Linha verde por baixo do preço</b> — o indicador identifica uma tendência de subida.
          </li>
          <li>
            <b>Fecho abaixo da linha</b> — o indicador vira para <i>bearish</i> (um &quot;flip&quot;).
          </li>
          <li>
            <b>Linha vermelha por cima do preço</b> — o indicador identifica uma tendência de descida.
          </li>
          <li>
            <b>Fecho acima da linha</b> — o indicador vira para <i>bullish</i> (novo flip).
          </li>
        </ul>
        <p className="guia-note">
          A mudança de cor só é considerada no <b>fecho da vela</b>. No timeframe semanal, isso
          significa o fecho de domingo. Um pavio que fura a linha durante a semana não conta até a
          vela fechar.
        </p>
      </section>

      <section id="flip-level" className="guia-sec">
        <h2>3. O Flip Level</h2>
        <p>
          O <b>Flip Level</b> (no Radar: &quot;Next Flip&quot;) é o valor exato onde, pelo cálculo do
          indicador, a tendência inverteria. Numa subida, esse nível sobe sozinho atrás do preço e
          nunca desce — vai acompanhando o movimento.
        </p>
        <div className="guia-example">
          <b>Exemplo ilustrativo</b> (números hipotéticos, apenas para explicar a mecânica — não é
          uma referência a qualquer ativo real nem a qualquer momento):
          <ul>
            <li>Flip bullish num ativo a 60.000 → Flip Level inicial em ~52.000.</li>
            <li>O preço sobe para 100.000 → o Flip Level acompanha para ~85.000.</li>
            <li>Uma semana fecha abaixo de 85.000 → o indicador vira para bearish.</li>
          </ul>
        </div>
        <p className="guia-note">Conta o fecho da vela, não o toque momentâneo.</p>
      </section>

      <section id="estado" className="guia-sec">
        <h2>4. Estado: Alinhado ou Conflito</h2>
        <p>
          A tabela de estado compara dois relógios do indicador — o <b>Weekly</b> (semanal) e o{" "}
          <b>Daily</b> (diário):
        </p>
        <ul className="guia-list">
          <li>
            <b>ALINHADO</b> — o Weekly e o Daily apontam na mesma direção.
          </li>
          <li>
            <b>CONFLITO</b> — o Weekly e o Daily divergem.
          </li>
        </ul>
        <p>
          A força (a barra colorida) descreve a intensidade do momentum medido pelo indicador —
          de vendedores fortes (vermelho) a compradores fortes (verde), passando por zonas de
          transição.
        </p>
      </section>

      <section id="avisos" className="guia-sec">
        <h2>5. Avisos de topo e fundo</h2>
        <p>
          Sinais que o indicador costuma marcar <b>antes</b> de uma viragem. São contexto, não um
          gatilho — o flip só é considerado no fecho da vela.
        </p>
        <ul className="guia-list">
          <li>
            <b>Ponto verde</b> por baixo de uma vela: possível fundo (o Daily virou para cima durante
            um Weekly bearish).
          </li>
          <li>
            <b>Ponto vermelho</b> por cima de uma vela: possível topo (o Daily virou para baixo
            durante um Weekly bullish).
          </li>
          <li>
            <b>Divergência de fundo/topo</b>: o preço faz novo extremo, mas a força já não acompanha.
          </li>
          <li>
            <b>Losango laranja</b> (exaustão): o preço está esticado face à linha — zona de contexto,
            não de leitura de entrada.
          </li>
        </ul>
      </section>

      <section id="metodo" className="guia-sec">
        <h2>6. O método, resumido</h2>
        <p>
          A forma como o indicador foi desenhado para ser lido — descritiva, para tua referência:
        </p>
        <ul className="guia-list">
          <li>A cor da linha resume a tendência que o indicador identifica.</li>
          <li>O estado <b>ALINHADO</b> indica que o Weekly e o Daily concordam; o Conflito, que divergem.</li>
          <li>O <b>Flip Level</b> marca o nível onde o indicador inverteria a tendência.</li>
          <li>Os avisos de topo/fundo são contexto antecipado; a viragem só conta no fecho da vela.</li>
          <li>No desenho do método, o Weekly serve para a leitura de fundo e o Daily para afinar o timing.</li>
        </ul>
        <p className="guia-note">
          Poucos sinais por ano é o comportamento esperado de um indicador de tendência de longo
          prazo — não é um defeito.
        </p>
      </section>

      <section id="risco" className="guia-sec guia-risco">
        <h2>7. Risco — lê antes de qualquer decisão</h2>
        <p>
          Os mercados de criptoativos e financeiros são <b>altamente voláteis</b> e podem originar a{" "}
          <b>perda total do capital</b>. Nada neste guia, no Radar ou na Linha do Swell constitui
          recomendação de compra ou venda, nem aconselhamento financeiro, fiscal ou jurídico.
        </p>
        <ul className="guia-list">
          <li>
            Os indicadores são <b>cálculos mecânicos</b> sobre dados históricos, iguais para todos,
            sem qualquer valor preditivo e sem consideração pela tua situação.
          </li>
          <li>
            Quaisquer exemplos ou referências a desempenho são <b>meramente ilustrativos</b> e não
            representam resultados típicos nem garantidos. Desempenho passado não indica resultados
            futuros.
          </li>
          <li>
            Alavancagem elevada pode levar à liquidação da posição <b>antes</b> de qualquer nível do
            indicador. Gestão de risco é responsabilidade de cada um.
          </li>
          <li>As decisões, e o risco, são exclusivamente teus.</li>
        </ul>
        <p className="guia-note">
          Os DeFi Surfers são uma comunidade de <b>educação e ferramentas de análise</b>, não estão
          registados nem autorizados junto de qualquer autoridade reguladora para prestar serviços de
          investimento, e não os prestam. Ver os{" "}
          <Link href="/termos">Termos de Utilização</Link> completos.
        </p>
      </section>
    </main>
  );
}
