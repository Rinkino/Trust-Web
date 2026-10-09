-- Bookmaker odds history and the betting evaluation built on it.

-- 1. Odds as published by football-data.co.uk, one version per (match, content).
--    Insert-only: if the source ever revises a match's odds, the new version is added
--    next to the old one (stored_at tells them apart), never written over it.
create table if not exists public.epl_match_odds (
  match_id        text not null references public.epl_matches(match_id),
  odds_hash       text not null,
  season          text not null,
  match_date      date not null,
  -- {stage: {bookmaker: {market: [decimal odds]}}}; stage pre_closing | closing,
  -- bookmaker average | best | bet365 | pinnacle, market 1x2 [H,D,A] | ou25 [over,under]
  odds            jsonb not null,
  source          text not null,
  source_url      text,
  collection_note text,
  stored_at       timestamptz not null default now(),
  primary key (match_id, odds_hash)
);
alter table public.epl_match_odds enable row level security;
drop policy if exists epl_match_odds_read on public.epl_match_odds;
create policy epl_match_odds_read on public.epl_match_odds for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.epl_match_odds from anon, authenticated;

-- 2. Results of the fixed betting strategies, per pipeline run.
create table if not exists public.epl_value_backtest (
  id                  bigint generated always as identity primary key,
  run_key             text not null,
  split               text not null check (split in ('validation', 'test', 'live')),
  season              text not null,
  model_name          text not null,
  model_version       text,
  role                text not null check (role in ('baseline', 'existing_model', 'market', 'other')),
  market              text not null check (market in ('1x2', 'ou25')),
  price_source        text not null,
  strategy            text not null,
  strategy_config     jsonb not null,
  eligible_selections integer not null,
  eligible_matches    integer not null,
  metrics             jsonb not null,
  quality             jsonb not null,
  period_start        date,
  period_end          date,
  methodology         text not null,
  created_at          timestamptz not null default now(),
  unique (run_key, model_name, market, price_source, strategy, split, season)
);
create index if not exists epl_value_backtest_run on public.epl_value_backtest (run_key);
alter table public.epl_value_backtest enable row level security;
drop policy if exists epl_value_backtest_read on public.epl_value_backtest;
create policy epl_value_backtest_read on public.epl_value_backtest for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.epl_value_backtest from anon, authenticated;

-- 3. Odds coverage per season, stage, bookmaker and market (latest stored version per match),
--    against completed matches, so missing prices are visible rather than silently excluded.
create or replace view public.epl_odds_coverage with (security_invoker = true) as
with latest as (
  select distinct on (match_id) match_id, season, odds from public.epl_match_odds order by match_id, stored_at desc
), completed as (
  select season, count(*) n from public.epl_matches where status = 'completed' and season >= '2023-24' group by season
), cells as (
  select l.season, s.stage, b.book, m.market, count(*) n
  from latest l
  cross join (values ('pre_closing'), ('closing')) s(stage)
  cross join (values ('average'), ('best'), ('bet365'), ('pinnacle')) b(book)
  cross join (values ('1x2'), ('ou25')) m(market)
  where l.odds -> s.stage -> b.book -> m.market is not null
  group by 1, 2, 3, 4
)
select c.season, c.n as completed_matches, x.stage, x.book as bookmaker, x.market, coalesce(cl.n, 0) as with_odds
from completed c
cross join (select * from (values ('pre_closing'), ('closing')) s(stage),
                         (values ('average'), ('best'), ('bet365'), ('pinnacle')) b(book),
                         (values ('1x2'), ('ou25')) m(market)) x(stage, book, market)
left join cells cl on cl.season = c.season and cl.stage = x.stage and cl.book = x.book and cl.market = x.market;
grant select on public.epl_odds_coverage to anon, authenticated;
