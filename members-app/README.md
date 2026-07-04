# DeFi Surfers — Members App

Área privada de membros com o screener de tendências multi-setor (motor SwellLine).
Plano geral: ver `../DEFI_SURFERS_PLANO.md`. Spec UX/UI/dados: ver `../DEFI_SURFERS_UXUI.md`.

## Estado

- ✅ Motor SwellLine portado e estendido (`lib/engine/`) — trailing stop
  calibrado + medidor de força, exaustão, divergências, 200-período MA/cheapZone,
  alvos TP 1/2/3 ATR com hit tracking, dots Daily-contra-Weekly, warmup/cooldown
- ✅ Universo com metadados (`lib/data/universe.ts`): logos, moeda, país,
  categorias temáticas, link TradingView + Yahoo Finance por ativo
- ✅ Dados reais: Binance (cripto, sem key) + Twelve Data (resto, precisa de key)
- ✅ Cron diário por lotes (`/api/cron/refresh?batch=0..3`, ver `vercel.json`) —
  4 lotes por causa do limite do Vercel Hobby (máx. 5 cron jobs/projeto, 1x/dia)
- ✅ Persistência opcional Supabase (`lib/data/supabase.ts`): `snapshots`
  (upsert diário) + `flip_events` (histórico append-only) — funciona em modo
  "live only" (sem gravar nada) enquanto o projeto Supabase não existir
- 🟡 Página de membros ainda no layout MVP antigo (tabela simples) — a
  reescrita para o layout "terminal" (espelhado no Bullmania, ver UXUI §2)
  ainda não foi feita
- 🔴 Sem gate Discord ainda — falta app OAuth + bot + role ID
- 🔴 Sem projeto Supabase criado — `supabase/schema.sql` pronto a correr

## Correr localmente

```bash
cd members-app
npm install
npm run dev   # http://localhost:3000/members
```

(Requer Node.js ≥ 18. Sem `.env`, arranca em modo mock — funciona já.)

## Deploy (novo projeto Vercel, separado do site estático)

1. Vercel → Add New Project → importar `Lojadoqueijo/surfdrops`
2. **Root Directory: `members-app`** (crítico — não deployar a raiz)
3. Definir env vars (ver `.env.example`)
4. Os crons do `vercel.json` ficam ativos automaticamente

## Ligar o Supabase (opcional, mas necessário para histórico/alertas)

1. Criar projeto em supabase.com
2. SQL Editor → colar e correr `supabase/schema.sql` (cria `snapshots` e `flip_events`)
3. Copiar `SUPABASE_URL` e a **Service Role Key** (não a `anon`) para as env
   vars do Vercel — a service role key é secreta, nunca no cliente/repo
4. Redeploy; o próximo cron já persiste

## Variáveis de ambiente

Ver `.env.example`. Bloqueios pendentes do utilizador:
- **Discord** (client secret, bot token — os IDs públicos já estão no `.env.example`)
- **Supabase** (criar o projeto + colar `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`)

## Próximos passos (com o modelo certo — ver plano §1)

- [SONNET] Testar `npm run build` num ambiente com Node (não disponível na
  máquina onde o motor foi estendido — ver nota no `DEFI_SURFERS_PLANO.md`)
- [FABLE spec fina → SONNET código] Reescrever o terminal `/members` (UXUI §2)
- [FABLE] OAuth Discord + verificação do cargo; remover fallback `?key=`
- [FABLE] Teasers públicos no site principal
