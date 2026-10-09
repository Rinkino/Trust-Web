-- EPL match-statistics predictor: core schema.
-- All objects are prefixed epl_ so they live alongside the TrustWeb tables in the
-- same Supabase project without touching them.
--
-- Write model: only the pipeline (GitHub Actions -> epl-writer edge function,
-- service role) writes. Public visitors get read-only access through RLS, plus a
-- single SECURITY DEFINER function that records three-match demonstration runs.

create extension if not exists pgcrypto;

-- ── Matches: completed results and scheduled fixtures ──────────────────────────
create table if not exists public.epl_matches (
  match_id            text primary key,                 -- e.g. 2025-26_2025-08-15_liverpool_bournemouth
  season              text not null,                    -- '2025-26'
  competition         text not null default 'EPL',
  match_date          date not null,                    -- local (UK) calendar date as published
  kickoff_time        time,                             -- local UK time when published
  kickoff_utc         timestamptz,                      -- when known
  round               smallint,
  home_team           text not null,
  away_team           text not null,
  status              text not null check (status in ('completed','scheduled','postponed','abandoned')),
  fthg smallint, ftag smallint, ftr char(1) check (ftr in ('H','D','A')),
  hthg smallint, htag smallint,
  hs  smallint, "as" smallint, hst smallint, ast smallint,
  hc  smallint, ac  smallint, hf  smallint, af  smallint,
  hy  smallint, ay  smallint, hr  smallint, ar  smallint,
  hxg real, axg real,
  referee             text,                             -- stored for completeness, never used as a feature
  -- Average pre-closing market odds. Used only as an external reference in evaluation.
  odds_avg_h real, odds_avg_d real, odds_avg_a real, odds_avg_over25 real, odds_avg_under25 real,
  source              text not null,
  source_url          text,
  source_row_hash     text,
  first_ingested_at   timestamptz not null default now(),
  last_ingested_at    timestamptz not null default now(),
  unique (season, home_team, away_team),
  check (home_team <> away_team),
  check (status <> 'completed' or (fthg is not null and ftag is not null and fthg >= 0 and ftag >= 0))
);
create index if not exists epl_matches_date_idx   on public.epl_matches (match_date);
create index if not exists epl_matches_season_idx on public.epl_matches (season, match_date);
create index if not exists epl_matches_status_idx on public.epl_matches (status, kickoff_utc);
create index if not exists epl_matches_home_idx   on public.epl_matches (home_team);
create index if not exists epl_matches_away_idx   on public.epl_matches (away_team);

-- ── Model registry ─────────────────────────────────────────────────────────────
create table if not exists public.epl_model_registry (
  model_name          text not null,
  model_version       text not null,
  algorithm           text not null,
  description         text not null,
  feature_set         jsonb not null default '[]'::jsonb,
  config              jsonb not null default '{}'::jsonb,   -- reproducible training configuration
  training_cutoff     date,
  training_start      date,
  training_end        date,
  metrics             jsonb not null default '{}'::jsonb,
  artifact_location   text,
  status              text not null default 'candidate' check (status in ('candidate','production','retired')),
  created_at          timestamptz not null default now(),
  primary key (model_name, model_version)
);

-- Which model serves each target, and why.
create table if not exists public.epl_target_selection (
  selection_version   text not null,
  target              text not null,
  target_kind         text not null check (target_kind in ('count','probability','outcome')),
  selected_model      text not null,
  selected_version    text not null,
  primary_metric      text not null,
  selection_period    text not null,
  reason              text not null,
  metrics             jsonb not null default '{}'::jsonb,
  reliable            boolean not null default true,
  created_at          timestamptz not null default now(),
  primary key (selection_version, target)
);

-- ── Evaluations ────────────────────────────────────────────────────────────────
create table if not exists public.epl_model_evaluations (
  evaluation_id       uuid primary key default gen_random_uuid(),
  run_key             text not null,                    -- pipeline run that produced it
  model_name          text not null,
  model_version       text not null,
  target              text not null,
  target_kind         text not null check (target_kind in ('count','probability','outcome')),
  split               text not null check (split in ('validation','test')),
  season              text,                             -- 'ALL' = whole split
  eval_start          date not null,
  eval_end            date not null,
  n_matches           integer not null,
  methodology         text not null,
  mae real, rmse real, mean_nll real,
  log_loss real, brier real, accuracy real, ece real,
  coverage_50 real, coverage_80 real,
  baseline_model      text,
  baseline_metric     real,
  improvement_pct     real,
  calibration         jsonb,                            -- reliability bins
  created_at          timestamptz not null default now(),
  unique (run_key, model_name, model_version, target, split, season)
);
create index if not exists epl_eval_lookup_idx on public.epl_model_evaluations (run_key, split, target);

-- ── Predictions (insert-only) ──────────────────────────────────────────────────
create table if not exists public.epl_predictions (
  prediction_id       uuid primary key default gen_random_uuid(),
  mode                text not null check (mode in ('live','backtest')),
  match_id            text references public.epl_matches(match_id),
  home_team           text not null,
  away_team           text not null,
  kickoff_utc         timestamptz,
  match_date          date not null,
  model_name          text not null,                    -- a single model, or 'selected' (best model per target)
  model_version       text not null,
  selection_version   text,
  data_cutoff         timestamptz not null,             -- newest information the features could use
  values              jsonb not null,                   -- per-target expected counts / probabilities / intervals
  target_models       jsonb,                            -- for 'selected': target -> model that produced it
  pipeline_run        text not null,
  created_at          timestamptz not null default now(),
  -- live: really generated before kickoff. backtest: reconstructed, never claimed as live.
  generated_before_kickoff boolean generated always as (
    case when mode = 'live' and kickoff_utc is not null then created_at < kickoff_utc else null end
  ) stored
);
create index if not exists epl_pred_match_idx on public.epl_predictions (match_id, mode, model_name, created_at desc);
create index if not exists epl_pred_mode_idx  on public.epl_predictions (mode, model_name, match_date);
create index if not exists epl_pred_run_idx   on public.epl_predictions (pipeline_run);

create or replace function public.epl_predictions_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'epl_predictions rows are immutable; insert a new prediction instead';
end $$;
create trigger epl_predictions_no_update before update on public.epl_predictions
  for each row execute function public.epl_predictions_immutable();

-- ── Demonstration runs ─────────────────────────────────────────────────────────
create table if not exists public.epl_demo_runs (
  run_id              uuid primary key default gen_random_uuid(),
  mode                text not null check (mode in ('live','historical')),
  seed                text not null,
  eligible_count      integer not null,
  eligible_hash       text not null,                    -- md5 of the sorted eligible match ids
  selection_rule      text not null,
  created_at          timestamptz not null default now()
);
create table if not exists public.epl_demo_run_items (
  run_id              uuid not null references public.epl_demo_runs(run_id),
  position            smallint not null check (position between 1 and 3),
  match_id            text not null references public.epl_matches(match_id),
  prediction_id       uuid not null references public.epl_predictions(prediction_id),
  primary key (run_id, position)
);

-- ── Data provenance and pipeline status ────────────────────────────────────────
create table if not exists public.epl_data_source_audit (
  audit_id            uuid primary key default gen_random_uuid(),
  pipeline_run        text not null,
  source              text not null,
  source_url          text not null,
  retrieved_at        timestamptz not null,
  http_status         integer,
  bytes               integer,
  sha256              text,
  records_retrieved   integer not null default 0,
  records_accepted    integer not null default 0,
  records_rejected    integer not null default 0,
  validation_errors   jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists epl_audit_run_idx on public.epl_data_source_audit (pipeline_run);

create table if not exists public.epl_pipeline_runs (
  run_key             text primary key,
  started_at          timestamptz not null,
  finished_at         timestamptz,
  status              text not null check (status in ('running','succeeded','failed')),
  stages              jsonb not null default '{}'::jsonb,
  summary             jsonb not null default '{}'::jsonb,
  git_sha             text,
  workflow_url        text,
  error               text
);

-- Row Level Security is in 20261009000050_epl_rls.sql.
