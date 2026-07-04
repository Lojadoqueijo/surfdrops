# DeFi Surfers — Plano de Execução

> Documento vivo. O Fable (Claude Fable 5) tem autorização permanente para melhorar
> qualquer parte deste plano — copy, SEO, conversão, UX/UI, arquitetura, redução de
> custos — sempre que identificar uma melhoria, sem precisar de pedir confirmação
> para ajustes dentro do espírito do plano. Só pausa para confirmar em decisões
> irreversíveis (domínio, pagamentos, credenciais, apagar dados).
>
> Execução contínua, sem cortes por "semanas" — trabalha-se tarefa a tarefa até
> ao fim, turno após turno, sem pausas de calendário artificiais.

## 0. Contexto (não repetir, já validado)

- Produto central: **SwellLine**, indicador de tendência ATR calibrado
  (ATR Length 10, Long 3, Short 3, hl2; momentum EMA 12/18; exaustão 4 ATR;
  ver `swellline.pine` e `swellline_research.md` no projeto PoolParty-seo-lp).
- Negócio: comunidade **DeFi Surfers**. Canal de leads/lançamentos: **Telegram
  aberto, 3.000 membros** — não mexer nesse fluxo, é o motor de aquisição real.
- Site atual: `surfdrops.vercel.app` — **HTML estático de um único ficheiro**
  (`index.html`, ~4.200 linhas), sem framework. Tem funil de pré-lançamento
  **AO VIVO**: popup DeFi Surfers, preço real 795,07€ (desconto -20% de
  993,84€), exit-intent, CTA para Telegram. **Este funil não pode ser
  interrompido/quebrado durante o trabalho.**
- Decisão de marca: **DeFi Surfers passa a marca principal**; "Surf Drops"
  (airdrops) fica como secção pública dentro dela.
- Domínio novo a comprar: `defisurfers.<tld>` (ainda não registado).
- Gate de acesso à área privada: **cargo Discord "DeFi Surfer"** (comunidade já
  usa Discord). Atribuição do cargo é **manual no arranque** (o pagamento já
  acontece hoje via Telegram/canal atual — não automatizar já).
- Cadência de atualização do screener: **diária** (não semanal — semanal
  deixava até 6 dias de atraso nos avisos "Daily"/topos-fundos).
- Modelo de execução: **MVP primeiro**. Não reconstruir o site todo antes de
  entregar valor. Ordem: motor → entrega mínima (Discord) → site "a sério".
- Sem Node.js/npm instalado nesta máquina de trabalho — o código é escrito
  corretamente para correr via `npm install` local (quando o utilizador tiver
  Node) ou diretamente no build do Vercel. Não assumir que foi testado
  localmente sem essa confirmação.

## 1. Separação de tarefas por modelo

### 🧠 Só Fable (juízo, qualidade, decisão — não delegar)
- Copy de vendas (landing, popups, emails, mensagens de lançamento no Telegram)
- Estratégia de SEO (arquitetura de conteúdo, prioridades, meta/schema)
- Otimização de conversão (UX de funil, pricing, gatilhos de urgência/FOMO)
- Decisões de UX/UI (o que mostrar, como estruturar a área privada, hierarquia visual)
- Arquitetura técnica (escolhas de stack, modelo de dados, trade-offs)
- Decisões de redução de custos (o que vale a pena pagar vs. não)
- Revisão final de qualquer coisa antes de publicar

### ⚙️ Sonnet 5 (trabalho de código repetitivo/mecânico, bem especificado)
- Implementar componentes UI já desenhados/especificados
- Escrever testes unitários do motor SwellLine
- Scripts de fetch/parsing de dados de mercado (uma vez definida a API)
- Refactors mecânicos, correções de bugs simples e bem descritos
- Gerar variações de código repetitivo (ex: 20 componentes de card semelhantes)

### 🪶 Haiku 4.5 (volume alto, baixa complexidade)
- Traduzir copy já aprovada para PT/EN/ES (depois de o Fable escrever o original)
- Curadoria mecânica de listas de tickers (formatar, validar símbolos)
- Gerar dados de teste/mock
- Tarefas repetitivas em lote sem juízo criativo envolvido

**Regra gravada em memória:** o Fable deve **avisar proativamente** o
utilizador sempre que a próxima tarefa cair claramente numa das categorias
acima e sugerir a troca de modelo antes de a executar, para controlar custo
sem perder qualidade onde importa.

## 2. Roteiro de execução (sem semanas — por ordem de dependência)

### Bloco A — Motor (zero dependências externas) — FABLE arranca, Sonnet reforça
1. [FABLE] Portar a lógica do `swellline.pine` para TypeScript: ATR trailing
   stop assimétrico, flip, Since Flip %, alinhamento MTF (Weekly/Daily),
   momentum (MACD/ATR), divergências, exaustão, zona 200W MA.
2. [SONNET] Testes unitários do motor contra os valores já validados no BTC
   (Last Flip ≈ 94.219 em 2025-11-17, Since Flip ≈ -33%).
3. [FABLE] Definir o schema de saída (o que a tabela de membros precisa: Trend,
   Weekly, Daily, Estado, Since Flip %, Last Flip Date, Next Flip).

### Bloco B — Entrega mínima (Discord, sem site novo)
4. [SONNET, depois de o utilizador ter credenciais Discord — Tarefa #6] Bot
   Discord que posta a tabela diária num canal privado restrito ao cargo
   "DeFi Surfer".
5. [FABLE] Desenhar o formato da mensagem/tabela (legibilidade, hierarquia,
   destaque para "acabou de flipar").

### Bloco C — App de membros (Next.js, isolado do funil ao vivo)
6. [FABLE arranca a estrutura, SONNET preenche componentes repetitivos]
   Scaffold do `members-app/` (Next.js, App Router, i18n PT/EN/ES).
7. [SONNET] Integração com fonte de dados (Twelve Data/Polygon — pendente
   Tarefa #7) uma vez definida por Fable qual usar.
8. [FABLE] Desenho da tabela/filtros (setor, bullish/bearish, "recém-flipados").
9. [SONNET] Cron diário (Vercel Cron) a recalcular e gravar em BD (Supabase).
10. [FABLE, pendente Tarefa #6] Integração OAuth Discord + verificação do
    cargo "DeFi Surfer".

### Bloco D — Site "a sério" (só depois do motor validado)
11. [FABLE] Plano de migração do `index.html` atual para Next.js SEM
    interromper o funil ao vivo (preservar meta/OG/JSON-LD, canonical, i18n).
12. [FABLE, pendente Tarefa #5] Ligar domínio `defisurfers.<tld>`, redirects
    301 do `surfdrops.vercel.app`, atualizar canonical/sitemap.
13. [FABLE] Rebranding: DeFi Surfers como marca principal, Surf Drops como
    secção.
14. [FABLE] Teasers públicos (bloco "esta semana X ativos flipraram bullish —
    completo só para membros").
15. [HAIKU] Traduzir todo o novo conteúdo para PT/EN/ES depois de aprovado.

### Bloco E — Monetização (fase seguinte, não bloqueia o lançamento)
16. [FABLE] Avaliar quando automatizar pagamento + atribuição de cargo
    (Stripe ou checkout cripto) — não fazer no arranque.

## 3. O que só o utilizador pode desbloquear (paralelo ao trabalho de código)
- Comprar/confirmar domínio `defisurfers.<tld>` (Tarefa #5) — utilizador decidiu deixar PARA O FIM
- ~~Criar app Discord + bot + Server Members Intent + role ID (Tarefa #6)~~ ✅ FEITO 2026-07-02
- Criar conta e obter API key na fonte de dados de mercado (Tarefa #7)

### ✅ Discord — credenciais públicas (concluído 2026-07-02, via browser)
- Application/Client ID: **1522367057671491685**
- Guild ID (servidor "Defi Surfers", 303 membros): **1193216608030687284**
- Role ID do cargo **"DefiSurfers"** (200 membros — o cargo dos membros pagos): **1193224247573741699**
  - Nota: existem também "DefiSurfer Adm" (10) e "DefiSurfer #1" (1, integração); o gate usa "DefiSurfers".
- Server Members Intent: **ativado** ✅
- Bot adicionado ao servidor com permissões mínimas (Ver canais + Enviar mensagens) ✅
- **PENDENTE (utilizador):** gerar o Bot Token (Developer Portal → Bot → "Redefinir token")
  e guardá-lo como env var no Vercel (`DISCORD_BOT_TOKEN`) quando formos ligar o bot/verificação.
  O token é secreto — nunca colar no chat nem em ficheiros do repo.
- **PENDENTE (depois do domínio):** adicionar OAuth2 Redirect URI no Developer Portal
  (ex: `https://defisurfers.<tld>/api/auth/callback/discord`).

## 3.5 Fontes de dados de mercado (DECISÃO FECHADA 2026-07-02)
Cobertura igual à do Bullmania (tokens, ações, ETFs, commodities, índices):
- **Cripto → Binance API pública** (primário): klines 1W/1D com OHLC completo,
  grátis, sem API key, sem limites relevantes. **CoinGecko = fallback** apenas
  para tokens fora da Binance (limitação: OHLC grátis do CoinGecko dá velas de
  4 dias em históricos longos → qualidade inferior; evitar quando possível).
- **Ações / ETFs / commodities / índices → Twelve Data** (plano Basic GRÁTIS,
  confirmado na página oficial de preços): 800 créditos/dia, máx. 8/minuto.
- Uso estimado atual: ~46 pedidos/dia total, dos quais ~28 no Twelve Data
  (≈6% do limite diário). Cripto não gasta créditos nenhuns (Binance).
- **Restrição a respeitar: 8 pedidos/minuto no Twelve Data** → o cron não pode
  disparar tudo de rajada. Como as funções Vercel têm timeout (60s no hobby),
  a solução é processar por lotes: vários crons espaçados (ex: 00:15, 00:20,
  00:25) com cursor em BD, ou cron único por setor. [implementação: SONNET,
  junto com o Bloco C.9/Supabase]
- TradingView NÃO tem API pública de dados (confirmado) — é só visualização;
  scrapers violam os ToS e ficam excluídos.

## 3.6 Estado do deploy (2026-07-03)
- ✅ **Members-app AO VIVO em produção:** `defi-surfers-members.vercel.app` —
  projeto Vercel novo `defi-surfers-members` (team lojadoqueijo, Hobby),
  Root Directory `members-app`, Framework Next.js, **Production Branch =
  `defi-surfers`** (não a main!). O projeto do site estático/funil continua
  intocado.
- ✅ **Cripto com dados REAIS da Binance** (sem key): BTC 59.980, ALIGNED BEAR,
  Since Flip -35,8%, Flip Level 81.908 — **valida o motor TS contra o Pine**
  (TradingView mostrava -35,78% / ~80-83k). Ações/ETFs/etc. em mock até a
  TWELVEDATA_API_KEY ser colada.
- ✅ **Gate temporário** (middleware.ts): bloqueado por defeito; acesso via
  `?key=<MEMBERS_GATE_KEY>` (cookie 30 dias). Vercel Auth "All Deployments"
  é só Pro — não usada. Substituir pelo OAuth Discord (C.10).
- ✅ **Env vars colocadas + redeploy feito (2026-07-03):** `TWELVEDATA_API_KEY`
  (dados reais de ações/ETFs/commodities/índices ativos) e `MEMBERS_GATE_KEY`
  (password do gate temporário, escolhida pelo utilizador — o Fable não a viu).
  Ambas "Sensitive", Production+Preview. Gate verificado: `/members` sem chave
  devolve 401 "acesso só para membros". Acesso com `/members?key=<password>`.
- ⏳ Domínio `defisurfers.xyz` comprado, ainda não ligado (fica para a fase
  do site principal; a members-app pode receber ex: `app.defisurfers.xyz`).
- Histórico: 1º projeto de import (surfdrops-8uc4) foi criado por engano com
  root ./ e publicou uma CÓPIA do funil em surfdrops-8uc4.vercel.app —
  **apagado pelo utilizador**. Lição: o wizard de import da Vercel lê a
  DEFAULT branch (main); para monorepo em branch, criar com build a falhar
  (`exit 1`) e corrigir Root Directory/Production Branch nas settings depois.

## 3.7 Especificação UX/UI/Dados (2026-07-04 — v2)
Escrita e fechada em **`DEFI_SURFERS_UXUI.md`** (v2, substitui a v1 no mesmo
dia após o utilizador partilhar screenshots reais do BULLMANIA TERMINAL):
- **Sem gráficos no site** — cada linha da tabela tem links TradingView + Yahoo.
- Terminal de página única com tabs por classe, stats bar (pulso de mercado),
  tabela espelhada na do Ivan (rank, ❤, Δ% desde flip, tempo desde flip, preço,
  mcap, bandeira, links) + extras nossos (Estado W/D, coluna Força, accordion
  com stop/TP/avisos), estado **WARMUP** (e COOLDOWN), slot para referrals de
  corretoras do utilizador.
- Login: exclusivamente cargo Discord "DefiSurfers"; remover fallback `?key=`
  quando o OAuth estiver validado.
- Levantamento completo da plataforma Bullmania + tabela de decisão de
  integração (o que copiar já, fase 2, ou rejeitar) no §0/§5 do documento.
Próxima tarefa concreta: item 2 do §6 (motor, [SONNET]).

### ✅ Itens 2-3 do §6 concluídos (2026-07-04, Sonnet)
- **Motor estendido** (`lib/engine/swellline.ts`): medidor de força (EMA12/18÷ATR,
  suavização EMA3, clamp ±1), exaustão sinalizada, divergências (pivô ±2 bars),
  200-período SMA + `cheapZone`, alvos TP 1/2/3 ATR com tracking de `hit1/2/3`
  (baseado em closes desde o flip). Núcleo up/dn/trend **intocado** (zero risco
  de regressão). Nova `trendDirectionSeries()` (série completa, não só o último
  valor) — necessária para os dots.
- **`lib/engine/snapshot.ts`**: agora calcula `dotTop`/`dotBottom` (Daily vira
  contra Weekly), `warmup`/`cooldown` (invenção própria — ver UXUI §2.2),
  `lastFlipDate`/`dailyFlipDate` (ISO, a partir do timestamp da candle).
- **`lib/data/universe.ts`**: todos os 26 ativos com `yahooSymbol` (verificado
  um a um — atenção ao Toncoin: `TON11419-USD`, não `TON-USD`, que é outro
  token), `logoUrl` (Clearbit para empresas, jsDelivr cryptocurrency-icons para
  cripto), `currency`, `country`, `categories[]`, `rankHint`.
- **Validação:** sem Node/npm nesta máquina (não instalado) — não foi possível
  correr `tsc`/testes reais. Em vez disso, portei a lógica nova para PowerShell
  e corri contra os dados semanais reais do BTC (Bitstamp): sem NaN após o
  warmup, sinais coerentes (strength/exaustão com o sinal certo, cheapZone
  false fora de bear profundo, 3 divergências detetadas na série, TP1/2/3
  todos `hit=true` num movimento de -35%). O core (não tocado) continua a
  bater com o comportamento já validado. **Ainda falta**: correr
  `npm install && npm run build` num ambiente com Node para apanhar erros de
  tipos que a leitura manual não apanhe, e escrever testes unitários reais
  (Jest/Vitest) — ficou por fazer por falta de Node nesta máquina.
- **`AssetSnapshot.marketCap` fica `null`** por agora (fonte de dados adiada,
  não fazia parte deste item).
- **Por fazer a seguir:** item 4 do §6 (Supabase: `snapshots` + `flip_events`
  + cron por lotes) e item 5 (reescrever o terminal `/members` para o layout
  espelhado no Bullmania — precisa de uma spec fina do Fable antes do código).

### ✅ Item 4 do §6 concluído (2026-07-04, Sonnet) — Supabase + cron por lotes
- **`supabase/schema.sql`** (novo, na raiz do `members-app`): tabelas
  `snapshots` (1 linha/ativo/dia, upsert por `(symbol,date)`) e `flip_events`
  (histórico **append-only**, unique `(symbol,timeframe,flip_at)` — evita
  duplicar o mesmo flip em execuções seguintes). Ainda não corrido em lado
  nenhum — o projeto Supabase não existe. Só persistimos flips **weekly**: o
  motor de confirmação Daily (`trendDirectionSeries`) só dá direção, não
  expõe um nível de linha próprio — persistir flips diários fica para depois
  de o motor Daily expor esse nível.
- **`lib/data/supabase.ts`** (novo): cliente + `upsertSnapshots()` +
  `appendFlipEvents()`. Grau de robustez: sem `SUPABASE_URL`/
  `SUPABASE_SERVICE_ROLE_KEY`, ambas as funções devolvem `{ skipped: true }`
  sem rebentar nada — o cron continua "live only" como hoje.
- **Adicionado `AssetSnapshot.lastFlipClose`** (preço de fecho no bar do
  flip, distinto de `lastFlip` = nível da linha partida) — necessário para
  gravar `price_at_flip` em `flip_events` com um valor real, não inventado.
- **Cron por lotes** (`app/api/cron/refresh/route.ts` + `vercel.json`):
  descoberta importante a meio da tarefa — **o Vercel Hobby só permite 5 cron
  jobs por projeto** (1x/dia cada), não "vários crons espaçados" à vontade
  como o plano original sugeria. Por isso os 6 setores foram agrupados
  manualmente em **4 lotes** (`CRON_BATCHES` no route.ts): Cripto sozinho
  (Binance, sem limite/min), Ações AI/Tech sozinho, Ações Cripto-expostas+ETFs
  juntos, Commodities+Índices juntos — todos a correr no mesmo dia UTC
  (00:15/00:20/00:25/00:30), cobertura diária completa mantida, só a execução
  fica repartida. Fica 1 cron de folga no orçamento do Hobby. Endpoint aceita
  `?batch=0..3`; sem o parâmetro processa tudo de uma vez (fallback local/dev).
- **`@supabase/supabase-js` adicionado ao `package.json`** — não foi possível
  correr `npm install` nesta máquina (sem Node); a próxima pessoa/CI a fazer
  build vai instalá-lo.
- **Por fazer:** criar o projeto Supabase (utilizador), correr o
  `schema.sql`, colar as env vars no Vercel + redeploy. Depois disso, o
  próximo passo natural é a página `/members` passar a LER de `snapshots`
  em vez de recomputar tudo ao vivo em cada pedido — decidir isso junto com
  a reescrita do terminal (item 5), não antes.

### ✅ Item 5 do §6 concluído (2026-07-04, Fable/Opus) — terminal `/members` reescrito
- **Layout espelhado no BULLMANIA TERMINAL** (UXUI §2.1), agora sim substitui
  a tabela MVP antiga. `app/members/Terminal.tsx` (novo, client component) +
  `lib/data/terminal.ts` (novo, enriquecimento snapshot×universo) + `page.tsx`
  reescrito (server: fetch → enrich → passa ao client) + `globals.css` (bloco
  "Terminal de membros").
- **Componentes:** stats bar (pulso: nº ativos + bullish/bearish/warmup da
  classe ativa), tabs por classe de ativo (Cripto/Ações/ETFs/Commodities/
  Índices), pesquisa, chips de trend (Bullish/Bearish/Warmup), dropdowns
  (tempo desde flip · categoria dinâmica por classe), tabela ordenável
  (default Δ% desde flip desc) com logo+nome+ticker, chip de trend, Δ%, tempo,
  preço (formatado por moeda), mkt cap, **Estado W/D** e **coluna Força**
  (heatmap — extras nossos que o Ivan não tem na tabela), links **TV + Yahoo**
  por linha (sem gráficos no site, como pedido). Linha expande em accordion:
  Next Flip (stop), Last Flip+data, alvos 1/2/3 ATR com ✅/⭕, avisos ativos
  (exaustão/divergência/dot/zona barata) com tooltip de ação.
- **Painel lateral:** slot "Negociar" (referrals de corretoras — placeholders
  "em breve" à espera dos links do utilizador) + "Como ler".
- **❤ favoritos:** ícone presente mas inerte (tooltip "em breve") — a feature
  real (watchlist + alerta de flip) é fase 2, precisa de Supabase+bot.
- **WARMUP/COOLDOWN** aparecem como chip de trend próprio (amarelo/aqua).
- **Verificado ao vivo** (localhost, Node instalado nesta sessão): build de
  produção limpo (typecheck OK), tabs/filtros/ordenação/accordion/força/logos
  todos a funcionar; responsive mobile empilha controlos + scroll horizontal
  da tabela. Testado em modo mock (dados reais precisam da TWELVEDATA_API_KEY).
- **Nota:** a página continua a RECOMPUTAR ao vivo em cada pedido (revalidate
  1h). Passar a LER de `snapshots` (Supabase) fica para quando o projeto
  Supabase existir — é uma troca de fonte no `page.tsx`, não mexe no Terminal.

## 3.8 Login Discord ATIVO (2026-07-04, sessão épica de debugging)
**Estado final: login end-to-end A FUNCIONAR** (confirmado nos logs: /members 200
com sessão válida). Cadeia de problemas resolvidos, por ordem:
1. Faltavam as env vars públicas no Vercel (`DISCORD_CLIENT_ID/GUILD_ID/ROLE_ID`)
   → adicionadas via browser; `?error=config` desapareceu.
2. O token no Vercel era de outra app (o utilizador tem 3 apps: LagostaSurfista,
   Lagosta_Surfista, DeFi Surfers) → resetado na app certa.
3. **O anti-bot AuthGG (configurado pelo Danyunder) expulsava o bot DeFi
   Surfers#7820 segundos após entrar** (3x confirmado no audit log: kick +
   exclusão da integração), mesmo com kick/manage-guild desligados no cargo dele.
4. **Solução definitiva: login SEM bot** — scope OAuth `identify
   guilds.members.read`; o próprio membro autoriza a leitura dos seus cargos
   (`GET /users/@me/guilds/{id}/member`). Zero dependência de bot no servidor.
   Commit d6d0679.
Melhorias de UX/diagnóstico feitas pelo caminho: mensagens de erro orientadas
ao cargo (nunca "não estás no servidor" — o servidor é aberto), CTA de venda só
via Telegram (t.me/surfistacrypto) com botão próprio, erro técnico distinto do
"sem cargo", logs com status+code+identidade do bot, `DISCORD_ROLE_ID` aceita
vários cargos separados por vírgula (para Adm/#1).

**Pendências que esta sessão deixa:**
- [FABLE] Remover o fallback `?key=` (MEMBERS_GATE_KEY) do middleware — o
  OAuth está validado; o gate por password já não é preciso.
- [utilizador→Danyunder] Whitelist do bot `DeFi Surfers#7820` no AuthGG —
  pré-requisito APENAS do Bloco B/bot da tabela diária, não do login.
- `DISCORD_BOT_TOKEN` no Vercel está válido e da app certa; sem uso no login.
- Erros 429 do Twelve Data no /members (recomputação ao vivo por pedido)
  reforçam a migração da página para ler do Supabase (§ item 4 do §6).

## 4. Histórico de decisões (para não repetir discussões)
- Domínio: `defisurfers.<tld>` em vez de manter `surfdrops.vercel.app`
  (subdomínio partilhado sem equity de SEO real a proteger; a marca
  reconhecida pela audiência real — YouTube/comunidade — é DeFi Surfers).
- Cadência: diária, não semanal (resolve o lag de até 6 dias nos avisos).
- Gate: Discord role, não wallet/NFT nem Stripe no arranque.
- Modelo de negócio: preço real 795,07€ (-20% de 993,84€), fluxo de venda
  atual via Telegram mantido sem alterações.
