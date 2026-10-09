-- Plain-language explanations of live predictions, and visitors' own picks.

-- 1. Explanations: written by the pipeline (epl-writer, insert-only), public read.
create table if not exists public.epl_prediction_explanations (
  pipeline_run  text not null,
  match_id      text not null references public.epl_matches(match_id),
  model_name    text not null,
  model_version text not null,
  explanation   jsonb not null,
  created_at    timestamptz not null default now(),
  primary key (pipeline_run, match_id)
);
alter table public.epl_prediction_explanations enable row level security;
drop policy if exists "public read" on public.epl_prediction_explanations;
create policy "public read" on public.epl_prediction_explanations for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.epl_prediction_explanations from anon, authenticated;

-- 2. Picks. A visitor is identified by sha256 of a random key kept in their browser;
--    the key itself is never stored. Only the epl-picks edge function (service role)
--    reads or writes this table: RLS is on and there are no policies for anon.
create table if not exists public.epl_user_picks (
  pick_id       uuid primary key default gen_random_uuid(),
  player_hash   text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  match_id      text not null references public.epl_matches(match_id),
  pick          text not null check (pick in ('H', 'D', 'A')),
  home_goals    smallint check (home_goals between 0 and 20),
  away_goals    smallint check (away_goals between 0 and 20),
  prediction_id uuid references public.epl_predictions(prediction_id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (player_hash, match_id),
  check ((home_goals is null) = (away_goals is null)),
  check (home_goals is null or pick = case when home_goals > away_goals then 'H'
                                           when home_goals = away_goals then 'D' else 'A' end)
);
alter table public.epl_user_picks enable row level security;
revoke all on public.epl_user_picks from anon, authenticated;
create index if not exists epl_user_picks_player on public.epl_user_picks (player_hash);

-- Picks close at kickoff, enforced by the database clock whatever the caller does.
create or replace function public.epl_user_picks_guard() returns trigger
language plpgsql set search_path = public as $$
declare ko timestamptz; st text;
begin
  select kickoff_utc, status into ko, st from public.epl_matches where match_id = new.match_id;
  if st is distinct from 'scheduled' or ko is null or ko <= now() then
    raise exception 'picks for % are closed', new.match_id;
  end if;
  if tg_op = 'UPDATE' then
    if new.player_hash <> old.player_hash or new.match_id <> old.match_id or new.created_at <> old.created_at then
      raise exception 'only the pick itself can change';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists epl_user_picks_guard on public.epl_user_picks;
create trigger epl_user_picks_guard before insert or update on public.epl_user_picks
  for each row execute function public.epl_user_picks_guard();

-- 3. Scoring against the stored result: 1 point for the right result, 2 more for the exact score.
create or replace view public.epl_user_pick_scores with (security_invoker = true) as
select p.*, m.home_team, m.away_team, m.kickoff_utc, m.status as match_status, m.fthg, m.ftag, m.ftr,
       case when m.status = 'completed' then
         (case when p.pick = m.ftr then 1 else 0 end)
         + (case when p.home_goals = m.fthg and p.away_goals = m.ftag then 2 else 0 end)
       end as points
from public.epl_user_picks p join public.epl_matches m using (match_id);
revoke all on public.epl_user_pick_scores from anon, authenticated;
