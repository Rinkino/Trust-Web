-- Predictions a signed-in user saves from a match page ("Arsenal more corners than Leeds"),
-- settled automatically from the final match statistics. Only the epl-picks edge function
-- (service role) reads or writes them: RLS on, no policies for anon or authenticated.
create table if not exists public.epl_saved_props (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  match_id      text not null references public.epl_matches(match_id),
  prop_key      text not null check (prop_key ~ '^(res:[HDA]|dc:(HD|DA|HA)|btts:(yes|no)|tot:(goals|corners|yellows|shots|sot):(over|under):[0-9]{1,2}\.5|team:(home|away):(goals|corners|yellows|shots|sot):(over|under):[0-9]{1,2}\.5|cmp:(corners|yellows|shots|sot):(home|away))$'),
  label         text not null check (char_length(label) between 1 and 120),
  model_prob    real check (model_prob between 0 and 1),
  prediction_id uuid references public.epl_predictions(prediction_id),
  created_at    timestamptz not null default now(),
  unique (user_id, match_id, prop_key)
);
alter table public.epl_saved_props enable row level security;
revoke all on public.epl_saved_props from anon, authenticated;
create index if not exists epl_saved_props_user on public.epl_saved_props (user_id);

-- Saving and removing close at kickoff, by the database clock: a losing prediction cannot
-- be deleted after the event, nor a prediction added once the match has started.
create or replace function public.epl_saved_props_guard() returns trigger language plpgsql as '
declare k timestamptz; st text; mid text;
begin
  mid := case when tg_op = ''DELETE'' then old.match_id else new.match_id end;
  select kickoff_utc, status into k, st from public.epl_matches where match_id = mid;
  if st is distinct from ''scheduled'' or k is null or k <= now() then
    raise exception ''predictions for this match are closed'';
  end if;
  return case when tg_op = ''DELETE'' then old else new end;
end';
drop trigger if exists epl_saved_props_guard on public.epl_saved_props;
create trigger epl_saved_props_guard before insert or update or delete on public.epl_saved_props
  for each row execute function public.epl_saved_props_guard();

-- Settlement, mirroring settle() in epl/web/lib/props.ts. null = not settled yet.
create or replace function public.epl_settle_prop(k text, m public.epl_matches) returns boolean
language sql immutable as $$
  with p as (select string_to_array(k, ':') a),
  v as (
    select a,
      case a[1] when 'tot' then a[2] when 'team' then a[3] when 'cmp' then a[2] else 'goals' end as stat
    from p
  ),
  c as (
    select a, stat,
      case stat when 'goals' then m.fthg when 'corners' then m.hc when 'yellows' then m.hy when 'shots' then m.hs when 'sot' then m.hst end as h,
      case stat when 'goals' then m.ftag when 'corners' then m.ac when 'yellows' then m.ay when 'shots' then m."as" when 'sot' then m.ast end as aw
    from v
  )
  select case
    when m.status <> 'completed' or m.fthg is null or m.ftag is null then null
    when a[1] = 'res' then a[2] = case when m.fthg > m.ftag then 'H' when m.fthg = m.ftag then 'D' else 'A' end
    when a[1] = 'dc' then position((case when m.fthg > m.ftag then 'H' when m.fthg = m.ftag then 'D' else 'A' end) in a[2]) > 0
    when a[1] = 'btts' then ((m.fthg > 0 and m.ftag > 0) = (a[2] = 'yes'))
    when h is null or aw is null then null
    when a[1] = 'tot' then case a[3] when 'over' then h + aw > a[4]::numeric else h + aw < a[4]::numeric end
    when a[1] = 'team' then case a[4] when 'over' then (case a[2] when 'home' then h else aw end) > a[5]::numeric
                                       else (case a[2] when 'home' then h else aw end) < a[5]::numeric end
    when a[1] = 'cmp' then case a[3] when 'home' then h > aw else aw > h end
  end
  from c
$$;

create or replace view public.epl_saved_prop_results as
select s.id, s.user_id, s.match_id, s.prop_key, s.label, s.model_prob, s.prediction_id, s.created_at,
       m.home_team, m.away_team, m.kickoff_utc, m.status as match_status, m.fthg, m.ftag,
       public.epl_settle_prop(s.prop_key, m) as won
from public.epl_saved_props s join public.epl_matches m using (match_id);
revoke all on public.epl_saved_prop_results from anon, authenticated;
