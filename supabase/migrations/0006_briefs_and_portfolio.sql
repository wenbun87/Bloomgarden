-- Bloomgarden — Phase D: AI briefs + shared portfolio.
-- Shared/public content: every signed-in user sees the same Forecast, Greenhouse
-- state, and Field Notes. No per-user rows. Writes only via service_role (Worker).

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── market_briefs — one row per UTC date ──────────────────────────────────
create table public.market_briefs (
  date          date primary key,
  summary       text not null,             -- 2-sentence plain-English narrative
  indices_json  jsonb not null,            -- {sp500, nasdaq, dow, vix} with change%
  movers_json   jsonb not null,            -- {gainers: [...], losers: [...]}
  created_at    timestamptz not null default now()
);

-- ─── Greenhouse portfolio ──────────────────────────────────────────────────
-- Single shared simulated portfolio. Starts at $10k cash, rebalances weekly.
create table public.portfolio_cash (
  id          smallint primary key check (id = 1),    -- singleton
  balance     numeric(14,2) not null default 10000.00,
  updated_at  timestamptz not null default now()
);

insert into public.portfolio_cash (id) values (1);

create table public.portfolio_holdings (
  ticker       text primary key,
  shares       numeric(14,4) not null check (shares >= 0),
  avg_cost     numeric(14,2) not null check (avg_cost >= 0),
  updated_at   timestamptz not null default now()
);

create table public.portfolio_trades (
  id           bigserial primary key,
  executed_at  timestamptz not null default now(),
  ticker       text not null,
  action       text not null check (action in ('buy','sell')),
  shares       numeric(14,4) not null check (shares > 0),
  price        numeric(14,2) not null check (price >= 0),
  rationale    text not null,
  snapshot_id  bigint        -- filled in after the rebalance snapshot is written
);

create index portfolio_trades_time_idx on public.portfolio_trades (executed_at desc);

create table public.portfolio_snapshots (
  id            bigserial primary key,
  snapshot_at   timestamptz not null default now(),
  total_value   numeric(14,2) not null,
  sp500_value   numeric(14,2) not null     -- dollar value of an equivalent $10k-at-inception S&P position
);

create index portfolio_snapshots_time_idx on public.portfolio_snapshots (snapshot_at);

-- ─── Field Notes — weekly research digest ──────────────────────────────────
create table public.research_briefs (
  week_start    date primary key,          -- Monday UTC
  summary       text not null,             -- short intro paragraph
  bullets_json  jsonb not null,            -- [{claim, why_it_matters, source_url, source_name}]
  caveat        text not null,             -- "not medical advice" line
  created_at    timestamptz not null default now()
);

-- ─── Research feeds (configurable RSS list) ────────────────────────────────
create table public.research_feeds (
  id                bigserial primary key,
  url               text not null unique,
  name              text not null,
  enabled           boolean not null default true,
  last_fetched_at   timestamptz,
  created_at        timestamptz not null default now()
);

-- Seed with a sane default list. Edit in the dashboard post-launch.
insert into public.research_feeds (url, name) values
  ('https://feeds.megaphone.fm/hubermanlab',                       'Huberman Lab'),
  ('https://peterattiamd.com/feed/',                               'Peter Attia'),
  ('https://www.foundmyfitness.com/episodes.rss',                  'FoundMyFitness'),
  ('https://www.nature.com/subjects/health-sciences.rss',          'Nature — Health Sciences');

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — shared content: any signed-in user can read, no client writes.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.market_briefs       enable row level security;
alter table public.portfolio_cash      enable row level security;
alter table public.portfolio_holdings  enable row level security;
alter table public.portfolio_trades    enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.research_briefs     enable row level security;
alter table public.research_feeds      enable row level security;

create policy market_briefs_read       on public.market_briefs       for select using (auth.role() = 'authenticated');
create policy portfolio_cash_read      on public.portfolio_cash      for select using (auth.role() = 'authenticated');
create policy portfolio_holdings_read  on public.portfolio_holdings  for select using (auth.role() = 'authenticated');
create policy portfolio_trades_read    on public.portfolio_trades    for select using (auth.role() = 'authenticated');
create policy portfolio_snapshots_read on public.portfolio_snapshots for select using (auth.role() = 'authenticated');
create policy research_briefs_read     on public.research_briefs     for select using (auth.role() = 'authenticated');
create policy research_feeds_read      on public.research_feeds      for select using (auth.role() = 'authenticated');

-- Writes: no policies → only service_role (bypasses RLS) can write.
