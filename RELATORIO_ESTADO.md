# DeFi Surfers — Relatório de Estado

_Última atualização: 2026-07-03_

## 1. O que estamos a construir (visão)

Uma **área privada de membros "DeFi Surfers"** cujo produto central é um
**screener de tendências multi-setor**: uma tabela que mostra, por setor
(cripto, ações, ETFs, commodities, índices), quais os ativos que acabaram de
**flipar bullish/bearish**, usando a lógica do indicador **SwellLine** (réplica
calibrada da "MoneyLine" do Ivan on Tech).

**Objetivo de negócio:** captar novas vendas, reter a comunidade já paga, e
criar FOMO em quem está de fora. Inspirado no "Money Scanner" da Bullmania, mas
com preço transparente e sem chamada de vendas.

- **Marca principal:** DeFi Surfers. "Surf Drops" (airdrops) = secção pública.
- **Aquisição:** Telegram aberto com 3.000 membros (funil ao vivo, preço 795€
  com -20% de lançamento) — não mexer.
- **Acesso:** cargo Discord "DefiSurfers".

## 2. O que já temos (FEITO ✅)

| Área | Estado |
|---|---|
| **Motor SwellLine em TypeScript** | ✅ Portado e validado contra o TradingView (BTC: -35,8%, flip ~81,9k) |
| **Members-app (Next.js)** | ✅ AO VIVO em `defi-surfers-members.vercel.app` |
| **Dados de cripto (Binance)** | ✅ Reais, sem API key |
| **Dados ações/ETFs/etc (Twelve Data)** | ✅ Key colada no Vercel (plano grátis) |
| **Tabela de membros** | ✅ Filtros por setor/estado, badge "FLIP RECENTE", link TradingView, 26 ativos/6 setores |
| **Cron diário** | ✅ Configurado (00:15 UTC) |
| **Gate por password (temporário)** | ✅ Funciona (middleware) |
| **App + bot Discord** | ✅ Criados; bot no servidor; Server Members Intent ativo |
| **Login Discord (OAuth) — código** | ✅ Escrito: /login, /api/auth/*, sessões assinadas, verificação de cargo |
| **Domínio defisurfers.xyz** | ✅ Comprado (ainda não ligado) |
| **Infra Vercel isolada** | ✅ Projeto próprio; funil de vendas ao vivo intocado |

Tudo versionado no GitHub, branch **`defi-surfers`** (repo `Lojadoqueijo/surfdrops`).

## 3. Em que fase estamos

**Fase atual: ativar o login Discord (fim do Bloco C).**
O código do login OAuth está pronto e no ar; falta apenas ligar as credenciais
para funcionar de ponta a ponta.

### Pendente (só o utilizador pode fazer — são credenciais/segredos)
1. **Redirect URI no portal Discord:** adicionar
   `https://defi-surfers-members.vercel.app/api/auth/callback` em OAuth2 → Redirects → Salvar.
2. **Env vars no Vercel** (projeto defi-surfers-members → Settings → Environment Variables):
   - `DISCORD_CLIENT_SECRET` (recomendado: redefinir no Discord e colar o novo)
   - `DISCORD_BOT_TOKEN` (Discord → Bot → Redefinir token → colar)
3. **Redeploy** para aplicar.

⚠️ **Segurança:** um Client Secret foi colado em texto no chat — considerar
queimado; rodar quando possível.

## 4. O que falta fazer (roadmap)

| Bloco | Descrição | Modelo |
|---|---|---|
| **Ativar login Discord** | Colar segredos + redirect URI + testar ponta a ponta | Fable + utilizador |
| **Bot da tabela diária** | Bot posta o screener no canal privado todos os dias | Sonnet (mecânico) |
| **Supabase + cron por lotes** | Persistir snapshots/histórico de flips; respeitar 8 req/min do Twelve Data | Sonnet |
| **Ligar domínio** | `app.defisurfers.xyz` → members-app | rápido |
| **Teasers públicos** | Bloco "X ativos flipraram esta semana" no Surf Drops → FOMO | Fable |
| **Notificações de flip** | "coração"/favoritos + alerta quando um ativo da lista flipar | Fable+Sonnet |
| **Migração do site principal** | Funil estático → Next.js sob a marca DeFi Surfers (sem quebrar conversão) | Fable |
| **Monetização automática** | (fase tardia) Stripe/checkout + atribuição automática de cargo | Fable |

## 5. Decisões técnicas fechadas (não reabrir)

- Fontes de dados: Binance (cripto, primário) + CoinGecko (fallback) + Twelve
  Data (resto). TradingView **não** tem API pública — excluído.
- Cadência: diária (não semanal).
- Motor calibrado: ATR 10, Long 3, Short 3, hl2 (ver swellline_research.md no
  outro projeto). Não recalibrar sem motivo.
- MVP-primeiro: entregar valor antes de reconstruir o site todo.

## 6. Referências

- Roteiro detalhado: `DEFI_SURFERS_PLANO.md` (§3.5 fontes de dados, §3.6 estado do deploy).
- Motor/indicador: projeto `PoolParty-seo-lp` → `swellline.pine`, `swellline_research.md`.
- Memória persistente do Fable: `defi-surfers-undertaking`, `model-switching-defi-surfers`, `swellline-project`.
