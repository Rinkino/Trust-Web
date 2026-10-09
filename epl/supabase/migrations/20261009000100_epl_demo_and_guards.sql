-- Guards on stored results and a results view.

-- Completed results are never silently rewritten. Corrections must be made by a
-- migration that states the reason (and disables this trigger for that statement).
create or replace function public.epl_matches_protect_results() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'completed' and (
       new.status is distinct from 'completed'
    or new.fthg is distinct from old.fthg or new.ftag is distinct from old.ftag
    or new.hs is distinct from old.hs or new."as" is distinct from old."as"
    or new.hst is distinct from old.hst or new.ast is distinct from old.ast
    or new.hc is distinct from old.hc or new.ac is distinct from old.ac
    or new.hy is distinct from old.hy or new.ay is distinct from old.ay
    or new.hr is distinct from old.hr or new.ar is distinct from old.ar
    or new.match_date is distinct from old.match_date
    or new.home_team is distinct from old.home_team or new.away_team is distinct from old.away_team) then
    raise exception 'completed result % is protected; corrections need an explicit migration', old.match_id;
  end if;
  return new;
end $$;
create trigger epl_matches_protect before update on public.epl_matches
  for each row execute function public.epl_matches_protect_results();

-- Three-match demonstration runs are created by the epl-demo edge function
-- (supabase/functions/epl-demo) with the service role, so no elevated function is
-- exposed to the public role. Visitors can only read the resulting rows.

-- Predictions beside the actual result. security_invoker keeps the callers' RLS.
create or replace view public.epl_prediction_results with (security_invoker = true) as
select p.prediction_id, p.mode, p.match_id, p.model_name, p.model_version, p.selection_version,
       p.created_at, p.data_cutoff, p.values, p.target_models, p.pipeline_run,
       m.season, m.match_date, m.kickoff_utc, m.home_team, m.away_team, m.status,
       m.fthg, m.ftag, m.ftr, m.hs, m."as", m.hst, m.ast, m.hc, m.ac, m.hy, m.ay, m.hr, m.ar
from public.epl_predictions p
join public.epl_matches m on m.match_id = p.match_id;

grant select on public.epl_prediction_results to anon, authenticated;
