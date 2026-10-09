-- Optional Google sign-in (the same Supabase Auth as TrustWeb) so picks survive across
-- devices. A pick belongs either to a browser key (player_hash) or to an account (user_id).

alter table public.epl_user_picks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.epl_user_picks alter column player_hash drop not null;
alter table public.epl_user_picks add constraint epl_user_picks_owner check (player_hash is not null or user_id is not null);
alter table public.epl_user_picks add constraint epl_user_picks_user_match unique (user_id, match_id);

-- Picks still close at kickoff. The one change allowed afterwards is moving an
-- unchanged pick from a browser key to the account that signed in on that browser.
create or replace function public.epl_user_picks_guard() returns trigger
language plpgsql set search_path = public as $$
declare ko timestamptz; st text;
begin
  if tg_op = 'UPDATE' and old.user_id is null and new.user_id is not null
     and new.pick = old.pick and new.home_goals is not distinct from old.home_goals
     and new.away_goals is not distinct from old.away_goals and new.match_id = old.match_id
     and new.created_at = old.created_at and new.updated_at = old.updated_at
     and new.prediction_id is not distinct from old.prediction_id then
    return new;
  end if;
  select kickoff_utc, status into ko, st from public.epl_matches where match_id = new.match_id;
  if st is distinct from 'scheduled' or ko is null or ko <= now() then
    raise exception 'picks for % are closed', new.match_id;
  end if;
  if tg_op = 'UPDATE' then
    if new.player_hash is distinct from old.player_hash or new.user_id is distinct from old.user_id
       or new.match_id <> old.match_id or new.created_at <> old.created_at then
      raise exception 'only the pick itself can change';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Same view, with the owner column added at the end.
create or replace view public.epl_user_pick_scores with (security_invoker = true) as
select p.pick_id, p.player_hash, p.match_id, p.pick, p.home_goals, p.away_goals, p.prediction_id, p.created_at, p.updated_at,
       m.home_team, m.away_team, m.kickoff_utc, m.status as match_status, m.fthg, m.ftag, m.ftr,
       case when m.status = 'completed' then
         (case when p.pick = m.ftr then 1 else 0 end)
         + (case when p.home_goals = m.fthg and p.away_goals = m.ftag then 2 else 0 end)
       end as points,
       p.user_id
from public.epl_user_picks p join public.epl_matches m using (match_id);
revoke all on public.epl_user_pick_scores from anon, authenticated;
