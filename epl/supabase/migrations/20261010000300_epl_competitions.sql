-- Several competitions (Premier League 'EPL', Championship 'ELC'). Every model-side table
-- gains a competition column; existing rows are Premier League. Each competition has its own
-- models, selection and evaluation, so uniqueness includes the competition.
alter table public.epl_predictions add column if not exists competition text not null default 'EPL';
create index if not exists epl_predictions_comp_live on public.epl_predictions (competition, mode, model_name, kickoff_utc);

alter table public.epl_model_evaluations add column if not exists competition text not null default 'EPL';
alter table public.epl_model_evaluations drop constraint if exists epl_model_evaluations_run_key_model_name_model_version_targ_key;
alter table public.epl_model_evaluations add constraint epl_model_evaluations_unique
  unique (competition, run_key, model_name, model_version, target, split, season);

alter table public.epl_target_selection add column if not exists competition text not null default 'EPL';
alter table public.epl_target_selection drop constraint if exists epl_target_selection_pkey;
alter table public.epl_target_selection add primary key (competition, selection_version, target);

alter table public.epl_model_registry add column if not exists competition text not null default 'EPL';
alter table public.epl_model_registry drop constraint if exists epl_model_registry_pkey;
alter table public.epl_model_registry add primary key (competition, model_name, model_version);

alter table public.epl_value_backtest add column if not exists competition text not null default 'EPL';
alter table public.epl_value_backtest drop constraint if exists epl_value_backtest_run_key_model_name_market_price_source_s_key;
alter table public.epl_value_backtest add constraint epl_value_backtest_unique
  unique (competition, run_key, model_name, market, price_source, strategy, split, season);

-- History page view: the competition is appended (a replaced view may only add columns at the end).
create or replace view public.epl_prediction_results with (security_invoker = true) as
 SELECT p.prediction_id, p.mode, p.match_id, p.model_name, p.model_version, p.selection_version, p.created_at, p.data_cutoff,
    p."values", p.target_models, p.pipeline_run, m.season, m.match_date, m.kickoff_utc, m.home_team, m.away_team, m.status,
    m.fthg, m.ftag, m.ftr, m.hs, m."as", m.hst, m.ast, m.hc, m.ac, m.hy, m.ay, m.hr, m.ar, p.competition
   FROM epl_predictions p JOIN epl_matches m ON m.match_id = p.match_id;

-- Odds coverage per competition (appended column, as above).
create or replace view public.epl_odds_coverage with (security_invoker = true) as
with latest as (
  select distinct on (o.match_id) o.match_id, o.season, o.odds
  from public.epl_match_odds o
  order by o.match_id, o.stored_at desc
), completed as (
  select competition, season, count(*) as n
  from public.epl_matches
  where status = 'completed' and season >= '2023-24'
  group by competition, season
), cells as (
  select m.competition, l.season, s.stage, b.book, mk.market, count(*) as n
  from latest l
  join public.epl_matches m on m.match_id = l.match_id
  cross join (values ('pre_closing'), ('closing')) s(stage)
  cross join (values ('average'), ('best'), ('bet365'), ('pinnacle')) b(book)
  cross join (values ('1x2'), ('ou25')) mk(market)
  where l.odds -> s.stage -> b.book -> mk.market is not null
  group by m.competition, l.season, s.stage, b.book, mk.market
)
select c.season, c.n as completed_matches, x.stage, x.book as bookmaker, x.market,
       coalesce(cl.n, 0) as with_odds, c.competition
from completed c
cross join (
  select s.stage, b.book, mk.market
  from (values ('pre_closing'), ('closing')) s(stage),
       (values ('average'), ('best'), ('bet365'), ('pinnacle')) b(book),
       (values ('1x2'), ('ou25')) mk(market)
) x(stage, book, market)
left join cells cl on cl.competition = c.competition and cl.season = c.season
  and cl.stage = x.stage and cl.book = x.book and cl.market = x.market;

create or replace view public.epl_best_price_check with (security_invoker = true) as
with latest as (
  select distinct on (o.match_id) o.match_id, o.season, o.odds
  from public.epl_match_odds o
  where o.season >= '2023-24'
  order by o.match_id, o.stored_at desc
), m as (
  select l.season, mk.market, l.odds -> 'pre_closing' -> 'best' -> mk.market as b, mt.competition
  from latest l
  join public.epl_matches mt on mt.match_id = l.match_id
  cross join (values ('1x2'), ('ou25')) mk(market)
)
select season, market, count(*) as matches,
       count(*) filter (where (select sum(1::double precision / x.value::double precision)
                               from jsonb_array_elements_text(m.b) x(value)) < 1) as below_100pct,
       competition
from m
where b is not null
group by competition, season, market;
