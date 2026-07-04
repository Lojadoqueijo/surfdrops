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
