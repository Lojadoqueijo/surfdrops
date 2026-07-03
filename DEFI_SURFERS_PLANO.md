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

## 4. Histórico de decisões (para não repetir discussões)
- Domínio: `defisurfers.<tld>` em vez de manter `surfdrops.vercel.app`
  (subdomínio partilhado sem equity de SEO real a proteger; a marca
  reconhecida pela audiência real — YouTube/comunidade — é DeFi Surfers).
- Cadência: diária, não semanal (resolve o lag de até 6 dias nos avisos).
- Gate: Discord role, não wallet/NFT nem Stripe no arranque.
- Modelo de negócio: preço real 795,07€ (-20% de 993,84€), fluxo de venda
  atual via Telegram mantido sem alterações.
