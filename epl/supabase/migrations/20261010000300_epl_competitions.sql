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
create or replace view public.epl_prediction_results as
 SELECT p.prediction_id, p.mode, p.match_id, p.model_name, p.model_version, p.selection_version, p.created_at, p.data_cutoff,
    p."values", p.target_models, p.pipeline_run, m.season, m.match_date, m.kickoff_utc, m.home_team, m.away_team, m.status,
    m.fthg, m.ftag, m.ftr, m.hs, m."as", m.hst, m.ast, m.hc, m.ac, m.hy, m.ay, m.hr, m.ar, p.competition
   FROM epl_predictions p JOIN epl_matches m ON m.match_id = p.match_id;
