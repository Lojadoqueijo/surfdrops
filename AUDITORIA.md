# Auditoria multivertente — Ecossistema DeFi Surfers

> Data: 2026-07-07 · Fundamentada em leitura direta do código (branch `defi-surfers`) + pesquisa de mercado 2026.
> Severidades: 🔴 crítico · 🟠 alto · 🟡 médio · 🟢 melhoria.
> **Nota:** engenharia/produto, não é parecer jurídico nem auditoria de segurança certificada.

**Âmbito:** hub (defisurfers.xyz), Radar do Swell (members-app, Next.js), Surf Drops, pipeline de dados (Supabase + GitHub Actions + 8 providers), bot Telegram, funil de venda.

---

## 0. Resumo executivo — o que fazer primeiro

| # | Área | Achado | Sev |
|---|------|--------|-----|
| 1 | Segurança | `DISCORD_CLIENT_SECRET` foi colado em chat (queimado) **e** assina as sessões → se não foi rodado, **cookies de sessão são forjáveis** (impersonar qualquer membro) | 🔴 |
| 2 | Segurança | `CRON_SECRET` só protege se estiver definida (`if (env && ...)` = **fail-open**); endpoint pesado exposto se faltar | 🔴/verificar |
| 3 | Segurança | Sem RLS no schema versionado; `alert_subs` tem PII (chat_ids, usernames) | 🟠 |
| 4 | Segurança | OAuth sem parâmetro `state` (CSRF de login) | 🟠 |
| 5 | Acesso/$$ | Cargo Discord só validado **no login**; sessão de 30 dias não revalida → membro que sai mantém acesso ~1 mês | 🟠 |
| 6 | SEO | Sem `robots.txt`/`sitemap.xml`; sem gestão de bots de IA (GEO) | 🟠 |
| 7 | Conversão | Funil sem captura de lead de baixo atrito (tudo salta para DM Telegram); sem email/retargeting | 🟠 |

---

## 1. 🔐 Segurança & boas práticas

**🔴 1.1 — Sessões potencialmente forjáveis.** `lib/auth/session.ts` assina o cookie HMAC-SHA256 com `DISCORD_CLIENT_SECRET`. Esse secret foi colado em texto no chat (queimado). Se não foi rodado, quem o tiver pode assinar um cookie `ds_session` com qualquer `discord_id` e passar o gate sem cargo. **Ação:** (a) rodar o Discord Client Secret; (b) criar env dedicada `SESSION_SECRET` (32+ bytes aleatórios) só para assinar sessões.

**🔴 1.2 — `CRON_SECRET` fail-open.** `cron/refresh/route.ts`: `if (process.env.CRON_SECRET && auth !== ...)`. Se a env não estiver definida, o endpoint fica aberto (dispara milhares de fetches + escritas Supabase). **Ação:** confirmar `CRON_SECRET` no Vercel + workflow GitHub; tornar **fail-closed** (exigir sempre o secret).

**🟠 1.3 — RLS ausente no schema versionado.** `supabase/schema.sql` não tem `enable row level security` nem policies. Mitigação: nenhuma chave `anon` é exposta ao cliente (zero `NEXT_PUBLIC_`, tudo via service-role). Mas `alert_subs` guarda dados pessoais. **Ação:** `enable row level security` + policies deny-all para anon, no schema (versionado, defesa em profundidade).

**🟠 1.4 — OAuth sem `state` (CSRF).** `auth/callback` não valida `state`. **Ação:** gerar `state` aleatório em `/api/auth/login`, cookie httpOnly curto, comparar no callback.

**🟡 1.5 — Sem headers de segurança.** Falta CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy. **Ação:** `next.config.js` `headers()` na app; `vercel.json` `headers` no hub.

**🟡 1.6 — Comparação de assinatura não constante** (timing attack teórico, baixo risco).

**✅ Bom:** token Telegram + service-role só no servidor; webhook por secret derivado + só chats privados; cookies httpOnly/secure/sameSite; zero `dangerouslySetInnerHTML`/`eval`; validação de input no cron e no `alerts/sync`; OAuth lê cargos com o token do próprio utilizador.

---

## 2. 🏗️ Arquitetura, rate limits e folga

**🟠 2.1 — Yahoo é o risco nº1** (não-oficial, todas as ações/ETFs/commodities/índices). Escala linear. Mitigações existentes: jitter, retry dual-host, `universe_cache`, vigia por email. Folga confortável até ~5-6k ações; acima, ou se morrer → **EODHD (~$20/mês)**. Recomendo ter o adaptador pronto antes de precisar.

**🟡 2.2 — Storage Supabase é o limite silencioso.** `pruneOldSnapshots(14)` capa `snapshots` (~35-50MB). `flip_events` cresce sempre (pequeno, monitorizar). Egress ~3GB/5GB via RPC `latest_snapshots`. Dobrar ativos aproxima os 5GB → Supabase Pro ($25) quando chegar.

**🟢 2.3 — Exchanges e GitHub Actions com muita folga** (margens 8-100×; minutos ilimitados no repo público). Podes acomodar já: cripto→1000, +dezenas de commodities/índices.

**🟡 2.4 — Falha silenciosa de fonte dinâmica** cai no cache→estático sem alerta. **Ação:** notificar quando o universo vier do cache.

**Veredito:** cresce confortavelmente; teto real = ações Yahoo (>5-6k) e egress Supabase (dobrar), ambos resolvidos por ~$20-25/mês.

---

## 3. 🔎 SEO & GEO

**🟠 3.1 — Sem `robots.txt`/`sitemap.xml`.** Adicionar aos 3 sites; permitir bots de IA benéficos (`OAI-SearchBot`, `PerplexityBot`, `ClaudeBot`, `GPTBot`) — ~18,6% das queries comerciais disparam AI Overviews.
**🟠 3.2 — Conteúdo fino.** Criar `/aprender` ou `/blog` (ângulo flywheel/taxas é ouro para citação por LLMs; formato BLUF). Alimenta o topo do funil.
**🟡 3.3 — Rich results.** Validar FAQPage no Rich Results Test; `VideoObject` se embeber vídeo real.
**🟢 3.4 — og:image 1200×630 dedicada** (logo + claim + Radar).
**🟢 3.5 — Core Web Vitals** (LCP <2,5s, TTFB <200ms, INP baixo); considerar auto-hospedar fontes.

---

## 4. 🎨 UI/UX

**🟠 4.1 — Mobile-first** (82,9% do tráfego é mobile; vem do YouTube). Auditar hub a 375px.
**🟡 4.2 — Prova ao vivo subvalorizada.** Subir e animar o Radar ao vivo (maior diferenciador honesto). *(Em execução: Radar animado com os melhores performers desde o flip.)*
**🟡 4.3 — Testemunhos placeholder** por substituir (prioridade recolher reais).
**🟢 4.4 — Acessibilidade** (contraste WCAG AA, alt, foco de teclado).
**🟢 4.5 — Micro-interações** (hover/active nos planos, "copiado" no Telegram).

---

## 5. 📈 Conversão & funil

Benchmarks: landing média ~10,8%; nichos de urgência 12,3%; serviços financeiros 8,4%; email converte +77% vs pago; 82,9% mobile.

**🟠 5.1 — Zero captura de lead de baixo atrito.** Tudo salta para DM Telegram. **Ação:** lista de espera por email ou canal Telegram público gratuito primeiro → lista reativável em cada janela (maior alavanca em falta).
**🟠 5.2 — Fecho manual não escala.** Automatizar o Radar via pagamento on-chain; comunidade humana mas com captura assíncrona.
**🟡 5.3 — Escassez real** (janela -20% no ar): quando houver data, contagem regressiva + motivo do desconto.
**🟡 5.4 — Sem tracking.** Plausible/Umami (privacy-first) ou PostHog.
**🟢 5.5 — A/B testing** do hero/CTA com tráfego suficiente.

---

## 6. 💰 Monetização

**🟠 6.1 — Fuga de acesso = fuga de receita** (cargo só validado no login → mensal que cancela mantém ~30 dias). **Ação:** revalidação periódica.
**🟠 6.2 — Sem cobrança recorrente automática.** Piloto Base+USDC + verificação de tx + `subscriptions` + SIWE (ver relatório on-chain na memória).
**🟡 6.3 — Avaliar Unlock Protocol** (memberships NFT + cargos Discord).
**🟢 6.4 — Novos produtos:** tier Radar+, afiliados de exchanges (medir), masterclasses à lista.

---

## 7. 🚀 Novas features

- **🟠 Alertas mais ricos** (topo/fundo + resumo diário — colunas já existem).
- **🟠 Histórico/backtest visível** de flips por ativo (`flip_events` já tem os dados).
- **🟡 Digest público semanal** (topo de funil recorrente).
- **🟡 Watchlist partilhável / alertas por preço.**
- **🟡 Screener com filtros combinados guardáveis.**
- **🟢 PWA** (instalável) · **🟢 Web push.**

---

## 8. 🔔 Observabilidade — o que notificar

- 🟠 Universo a servir do cache/estático (fonte dinâmica partiu).
- 🟠 Egress/storage Supabase a 80% do limite.
- 🟠 Falha de deploy Vercel + aviso de billing/domínio.
- 🟡 Rate-limit anómalo de um provider (Yahoo 429s a subir).
- 🟡 Nova venda / novo membro (com pagamento on-chain).
- 🟡 Health do webhook Telegram.

---

## Plano de ação priorizado

- **Esta semana (🔴):** rodar `DISCORD_CLIENT_SECRET` + `SESSION_SECRET` dedicado · `CRON_SECRET` fail-closed · verificar RLS.
- **2 semanas (🟠):** RLS no schema + headers · `state` no OAuth + revalidação de cargo · robots/sitemap + bots IA · captura de lead por email · testemunhos reais.
- **Mês (🟡):** analytics privacy-first · `/aprender` (SEO/GEO) · piloto on-chain (Radar mensal) · alertas topo/fundo + histórico de flips.
- **Backlog (🟢):** PWA · web push · og:image dedicada · A/B testing · adaptador EODHD pronto.
