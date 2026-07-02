# DeFi Surfers — Members App

Área privada de membros com o screener de tendências multi-setor (motor SwellLine).
Plano geral: ver `../DEFI_SURFERS_PLANO.md`.

## Estado

- ✅ Motor SwellLine portado (`lib/engine/`) — lógica calibrada do `swellline.pine`
- ✅ Página de membros com tabela, filtros por setor/estado e destaque "FLIP RECENTE"
- ✅ Endpoint de cron diário (`/api/cron/refresh`, 00:15 UTC)
- 🟡 Dados em **mock** — falta API key (Twelve Data/Polygon) → `lib/data/provider.ts`
- 🔴 Sem gate Discord ainda — falta app OAuth + bot + role ID
- 🔴 Sem BD (Supabase) — histórico de flips/notificações vem depois

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
4. O cron do `vercel.json` fica ativo automaticamente

## Variáveis de ambiente

Ver `.env.example`. Três bloqueios pendentes do utilizador:
- **API de dados** (`TWELVEDATA_API_KEY` ou `POLYGON_API_KEY`)
- **Discord** (client id/secret, bot token, guild id, role id do cargo "DeFi Surfer")
- **Supabase** (quando o histórico/notificações entrarem)

## Próximos passos (com o modelo certo — ver plano §1)

- [SONNET] Provider real Twelve Data/Polygon (substituir mock)
- [SONNET] Testes do motor contra valores validados (BTC: Last Flip ≈ 94.219 @ 2025-11-17)
- [FABLE] OAuth Discord + verificação do cargo
- [FABLE] Teasers públicos no site principal
