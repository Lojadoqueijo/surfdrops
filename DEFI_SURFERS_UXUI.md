# DeFi Surfers — Especificação UX / UI / Arquitetura de Dados (v2)

_v2 escrita por Fable a 2026-07-04, depois de analisar screenshots reais do
BULLMANIA TERMINAL (scanner.bullmania.com) e investigar a plataforma. Substitui
a v1: SEM gráficos no site (links TradingView + Yahoo por linha), tabela
espelhada no terminal dele + os nossos extras. Fonte de verdade para
implementação (componentes → Sonnet)._

## 0. O que a Bullmania oferece (levantamento 2026-07-04)

Confirmado por screenshots do terminal + site público + help center:

1. **Money Line** — indicador TradingView invite-only; alertas TV manuais
   ("Downtrend to Uptrend", once per bar close). Página pública de backtests
   (BTC/ETH/SOL/SUI semanal; "drawdown 36% vs 90% buy&hold") usada como prova
   de vendas.
2. **Money Scanner / BULLMANIA TERMINAL** (Pro Plan + "Connect Discord"):
   - Tabs por classe: Crypto · Stocks · Commodities · ETFs · Forex · **Portfolio**
   - Barra de stats: total market cap, nº ativos, contagem/percentagem
     BULLISH vs BEARISH (o "pulso de mercado")
   - Pesquisa por nome/símbolo; "Last Update" com timestamp UTC
   - Filtros: **Trend (BULLISH / BEARISH / WARMUP)** · Time Since Flipped ·
     **Timeframe (Daily / Weekly / Monthly)** · Country · **Categories**
     (AI Stage 1/2/3, Biotech, Crypto & Blockchain, Defense & Army,
     Gold & Silver Miners, Mag7) · Market Cap; pares USD / BTC / SPX no cripto
   - Colunas: # rank · ❤ · ativo (logo, nome, ticker) · Trend chip ·
     **Price Change Since Flip %** · **Time Since Flip** (1Y 3W 3D 9h) ·
     Price (moeda local: USD/KRW/TWD/JPY) · Market Cap · bandeira do país ·
     link TradingView · link Yahoo Finance
   - **❤ = portfolio + alerta automático quando o ativo flipa** (retenção!)
   - Caixa "Trade on Bybit / PIONEX / Capital.com" = referrals dele
   - Escala: ~8.000 ativos, ações internacionais (KR, TW, JP…)
3. **Market Pulse** — feed de notícias cripto/TradFi com análise/sentimento AI.
4. **Comunidade/educação** — Discord privado, sessões semanais, flat fee,
   funil com treino grátis em vídeo; programa de afiliados "Earn $1000+".

**Posicionamento nosso:** ele varre 8.000 ativos; nós somos o **radar curado**
(~50-100 ativos que interessam à comunidade) com preço transparente, sem
chamada de vendas — e o digest diário chega ao Discord sem abrir o site.

## 1. Decisões desta versão (do utilizador, 2026-07-04)

- **Login: exclusivamente cargo Discord "DefiSurfers"** (role id 1193224247573741699).
  Quando o OAuth estiver ativo ponta a ponta, **remover o fallback `?key=`** do
  middleware — sem porta lateral.
- **Sem gráficos no site.** Cada linha tem link para TradingView e Yahoo
  Finance (como o terminal dele). Cai o mini-gráfico da v1.
- **UI da tabela = espelho do terminal dele** com todos aqueles dados, mais os
  nossos extras (§3).
- **Referrals de corretoras do utilizador** entram mais à frente — a UI já
  nasce com o slot reservado.

## 2. Arquitetura de informação

```
/login                → "Entrar com Discord" (só cargo DefiSurfers)
/members              → TERMINAL (uma página, tabs por classe de ativo)
/members/como-ler     → guia do método (confiança/retenção)
Surf Drops (público)  → teaser "X flips esta semana" sem símbolos
```

Uma única página de terminal com tabs — não páginas separadas por setor — para
manter a sensação de "sala de comando" e simplificar o estado dos filtros.

### 2.1 Terminal `/members` (de cima para baixo)

1. **Barra de stats** (pulso do mar): nº de ativos no radar, contagem + % 
   BULLISH / BEARISH / WARMUP, "Last update HH:MM UTC". Muda todos os dias →
   hábito de abrir.
2. **Tabs de classe**: Cripto · Ações · ETFs · Commodities · Índices
   (Forex fica para depois; Portfolio/favoritos = fase 2).
3. **Pesquisa** por nome/símbolo + **filtros**: Trend (Bullish/Bearish/Warmup) ·
   Time since flip (Hoje / Esta semana / Este mês / Qualquer) · Timeframe
   (Daily/Weekly) · Categoria · Market cap. País só quando tivermos ações
   internacionais.
4. **Tabela** (colunas, por ordem):
   | # | ❤ | Ativo (logo+nome+ticker) | Trend | Δ% desde flip | Tempo desde flip | Preço (moeda) | Market cap | Estado W/D | Força | TV | Yahoo |
   - **Δ% desde flip** = coluna de ordenação default (desc) — é o que vende
     (Samsung +1340% no dele).
   - **Estado W/D** (ALIGNED/CONFLICT) e **Força** (mini heatmap) são os
     nossos extras que o dele NÃO tem na tabela — diferenciação visível.
   - Linha expandível (accordion, sem sair da página): Next Flip (o stop),
     Last Flip + data, alvos 1/2/3 ATR com ✅/⭕, avisos ativos (exaustão,
     divergência, dot topo/fundo, zona 200W barata) com frase de ação.
5. **Caixa "Trade" (referrals)**: slot na coluna lateral/fundo, escondido até
   o utilizador fornecer os links de afiliado dele.

### 2.2 Estado "WARMUP" (adotar, com a nossa mecânica)

No dele, WARMUP é um terceiro estado de trend. No nosso motor já existe a
matéria-prima: **WARMUP = trend bearish MAS (momentum a aquecer OU dot de
fundo OU divergência bullish)** — chip amarelo. Simétrico: **COOLDOWN** para
bull a arrefecer (o dele não mostra; vantagem nossa). Regra exata afinável no
motor, mas o conceito fica fechado: é o funil de atenção pré-flip.

### 2.3 ❤ Favoritos + alertas (fase 2, mas desenhar já a UI)

Coração na linha = watchlist pessoal (por membro Discord) + alerta automático
por DM/canal Discord quando esse ativo flipa. É a feature de retenção mais
forte do terminal dele — fica no roadmap logo a seguir ao core.

## 3. Arquitetura de dados

### 3.1 Universo — metadados novos (estáticos, custo zero)

`UniverseAsset` ganha: `name`, `logoUrl` (clearbit/estático), `currency`
(USD/KRW/…), `country` (ISO p/ bandeira), `categories: string[]`
(ex: ["AI","Semis"], ["Mag7"], ["Gold"]), `yahooSymbol` (link),
`rankHint` (ordem por mcap). Tudo curado à mão no ficheiro — sem API.

### 3.2 Snapshot — extensão (paridade Pine + colunas do terminal)

```ts
interface AssetSnapshot {
  // existente: symbol, sector, trend, weeklyTrend, dailyTrend, estado,
  //            nextFlip, lastFlip, sinceFlipPct, price, updatedAt
  lastFlipDate: string | null;   // → coluna "tempo desde flip" (calculado no cliente)
  marketCap: number | null;      // cripto: CoinGecko grátis; ações: fase 2
  strength: number | null;       // momentum MACD÷ATR (-1..+1) → coluna Força
  warmup: boolean;               // §2.2
  cooldown: boolean;
  exhaustionAtr: number | null;
  dotTop: boolean; dotBottom: boolean;
  bearDiv: boolean; bullDiv: boolean;
  cheapZone: boolean;            // close ≤ 200W MA
  tp: { t1: number; t2: number; t3: number;
        hit1: boolean; hit2: boolean; hit3: boolean } | null;
}
```

### 3.3 Persistência (Supabase, inalterado da v1)

- `snapshots` (symbol, date) — upsert diário do cron (lotes, 8 req/min TD).
- `flip_events` (symbol, date, dir, level, price, timeframe) — **append-only**;
  alimenta "time since flip", teaser público, histórico e futuras estatísticas.
- Fase 2: `favorites` (discord_user_id, symbol) → alertas do bot.

### 3.4 Timeframes

Daily + Weekly já calculados (é o par que define ALIGNED/CONFLICT). Monthly
(que o dele tem) = agregação das velas semanais que já temos, custo zero —
adicionar ao motor quando a tabela suportar o filtro. Não é prioritário.

## 4. Princípios de UI (mantidos da v1 + ajustes)

- Dark, acentos lima/vermelho/amarelo (bull/bear/warmup) — as cores do indicador.
- Chips coloridos, nunca texto puro; `tabular-nums`; preço formatado por moeda.
- Mobile-first: tabela → cards; filtros → chips scrolláveis; accordion no toque.
- A coluna **Força** (heatmap) é a assinatura visual DeFi Surfers.
- Logos dos ativos importam (o terminal dele parece "produto" por causa disso).

## 5. Features dele — decisão de integração (recomendação Fable)

| Feature dele | Veredicto | Porquê |
|---|---|---|
| Tabela rank/Δ%/tempo/mcap/links TV+Yahoo | **SIM, agora** | é o pedido desta v2 |
| WARMUP | **SIM, agora** | temos a mecânica; custo ~zero; grande valor percebido |
| ❤ favoritos + alerta de flip | **SIM, fase 2** | melhor retenção; precisa de Supabase + bot |
| Timeframe Monthly | sim, barato | agregação local; fazer quando sobrar tempo |
| Stats bar (pulso de mercado) | **SIM, agora** | 3 números, FOMO diário |
| Categorias temáticas (AI Stages, Mag7…) | sim, curadoria manual | narrativa de venda; sem custo de dados |
| Portfolio tab | mais tarde | favoritos cobrem 80% do valor primeiro |
| Pares BTC/SPX (trend noutro denominador) | discutir | interessante p/ alts vs BTC; adia — nicho |
| Market Pulse (news + sentimento AI) | **NÃO por agora** | custo/ruído alto, fora do core "flips" |
| Ações internacionais (KR/TW/JP) | não no MVP | Twelve Data grátis não cobre bem; rever com receita |
| Página pública de backtests | **SIM (marketing)** | prova de vendas p/ funil Telegram; Fable escreve |
| Programa de afiliados próprio | fase monetização | depois do Stripe/checkout |
| Referrals corretoras (os do utilizador) | slot já na UI | ativa quando ele der os links |

## 6. Ordem de implementação (etiquetas de modelo)

1. [FABLE] ✅ Esta especificação v2.
2. [SONNET] Motor: momentum/exaustão/dots/divergências/200W/TP/warmup +
   `lastFlipDate` + snapshot §3.2 + testes vs. Pine.
3. [SONNET] Universo com metadados §3.1 (curadoria inicial Fable→lista, Sonnet→código).
4. [SONNET] Supabase (`snapshots`, `flip_events`) + cron por lotes.
5. [FABLE spec fina → SONNET código] Terminal §2.1 (stats bar, tabs, filtros,
   tabela, accordion, slot referrals).
6. [FABLE] Remover fallback `?key=` quando o OAuth Discord estiver validado E2E.
7. [FABLE] Teaser público + página "como ler" + (marketing) backtests.
8. [HAIKU] Traduções PT/EN/ES do copy aprovado.

Bloqueadores do utilizador (inalterados): Redirect URI Discord +
`DISCORD_CLIENT_SECRET`/`DISCORD_BOT_TOKEN` no Vercel + redeploy;
links de referral das corretoras (quando quiser ativar a caixa Trade).
