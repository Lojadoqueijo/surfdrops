-- DeFi Surfers — schema Supabase (DEFI_SURFERS_PLANO.md §3.5/§6 item 4)
-- Correr uma vez no SQL Editor do projeto Supabase (quando for criado).
--
-- snapshots   : 1 linha por ativo/dia, upsert diário do cron. Serve o dashboard.
-- flip_events : histórico PERMANENTE de flips — append-only, NUNCA apagar.
--               Alimenta "acabou de flipar", o histórico da ficha e o teaser público.

create table if not exists snapshots (
  symbol text not null,
  date date not null,
  sector text not null,
  name text,
  logo_url text,
  tv_symbol text,
  yahoo_symbol text,
  rank integer,
  categories jsonb,
  trend text not null check (trend in ('bullish', 'bearish')),
  weekly_trend text check (weekly_trend in ('bullish', 'bearish')),
  daily_trend text check (daily_trend in ('bullish', 'bearish')),
  estado text check (estado in ('ALIGNED BULL', 'ALIGNED BEAR', 'CONFLICT')),
  next_flip double precision not null,
  last_flip double precision,
  last_flip_close double precision,
  last_flip_date timestamptz,
  daily_flip_date timestamptz,
  since_flip_pct double precision,
  price double precision not null,
  market_cap double precision,
  strength double precision,
  warmup boolean not null default false,
  cooldown boolean not null default false,
  exhaustion_atr double precision,
  dot_top boolean not null default false,
  dot_bottom boolean not null default false,
  bear_div boolean not null default false,
  bull_div boolean not null default false,
  cheap_zone boolean not null default false,
  tp jsonb,
  updated_at timestamptz not null default now(),
  primary key (symbol, date)
);

create index if not exists snapshots_date_idx on snapshots (date desc);
create index if not exists snapshots_sector_date_idx on snapshots (sector, date desc);

-- Timeframe é o que faz a linha (hoje só "weekly" — o "daily" do motor é uma
-- confirmação Supertrend sem nível de linha próprio exposto; ver nota em
-- lib/data/supabase.ts antes de começar a persistir flips diários aqui).
create table if not exists flip_events (
  id bigint generated always as identity primary key,
  symbol text not null,
  sector text not null,
  timeframe text not null check (timeframe in ('weekly', 'daily')),
  direction text not null check (direction in ('bullish', 'bearish')),
  level double precision not null,
  price_at_flip double precision not null,
  flip_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (symbol, timeframe, flip_at)
);

create index if not exists flip_events_symbol_idx on flip_events (symbol, flip_at desc);
create index if not exists flip_events_recent_idx on flip_events (flip_at desc);

-- Migração 2026-07-05 (universo cripto dinâmico — metadados embebidos no snapshot).
-- Idempotente; corre por cima de bases criadas com a versão anterior do schema.
alter table snapshots
  add column if not exists name text,
  add column if not exists logo_url text,
  add column if not exists tv_symbol text,
  add column if not exists yahoo_symbol text,
  add column if not exists rank integer,
  add column if not exists categories jsonb;

-- ==========================================================================
-- Alertas Telegram (2026-07-06). O membro liga o Telegram uma vez (deep-link
-- /start com código curto), guardamos o chat_id, e o cron envia alertas dos
-- ativos da sua watchlist quando ocorre um flip.
-- ==========================================================================

-- Subscrição de alertas por membro (chave = Discord id, o "sub" da sessão).
create table if not exists alert_subs (
  discord_id text primary key,
  chat_id bigint,                       -- null enquanto não ligar o Telegram
  telegram_username text,
  flips boolean not null default true,  -- alerta de flip semanal
  signals boolean not null default false, -- avisos topo/fundo (v2)
  digest boolean not null default false,  -- resumo diário (v2)
  watchlist text[] not null default '{}',
  linked_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists alert_subs_chat_idx on alert_subs (chat_id);

-- Códigos de ligação de uso único (deep-link t.me/bot?start=CODE), TTL curto.
create table if not exists alert_link_codes (
  code text primary key,
  discord_id text not null,
  expires_at timestamptz not null
);

-- Log de envios para deduplicar: 1 alerta por (membro, símbolo, flip).
create table if not exists alert_log (
  discord_id text not null,
  symbol text not null,
  flip_at date not null,
  sent_at timestamptz not null default now(),
  primary key (discord_id, symbol, flip_at)
);

-- Lista de espera (captura de lead — auditoria 5.1). Upsert por email = sem
-- duplicados. Só o servidor escreve/lê (service_role; RLS deny p/ o resto).
create table if not exists leads (
  email text primary key,
  source text not null default 'hub',
  created_at timestamptz not null default now()
);

-- Maré do mercado (breadth histórico): 1 linha por (class, date) com a
-- contagem bull/bear do universo por classe. Append-only, NUNCA se poda
-- (~4 linhas/dia). Alimenta o gráfico "Maré" no Radar e a futura /mercado.
create table if not exists breadth_daily (
  class text not null,           -- cripto | acoes | etf_cmd_idx
  date date not null,
  bull int not null,
  bear int not null,
  total int not null,
  updated_at timestamptz not null default now(),
  primary key (class, date)
);
create index if not exists breadth_daily_date_idx on breadth_daily (date);

-- ============================================================================
-- ROW LEVEL SECURITY (fecha o aviso "rls_disabled_in_public" do Supabase).
-- A app acede ao Supabase SÓ com a SERVICE_ROLE_KEY (server-side), que IGNORA
-- RLS — logo o cron/leituras continuam a funcionar na mesma. Nenhum cliente usa
-- a chave anon. Ativar RLS sem policies => deny total para anon/authenticated,
-- fechando o acesso público direto via PostgREST. Idempotente.
-- Cobre TODAS as tabelas do schema public (inclui universe_cache e futuras).
-- ============================================================================
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end $$;
