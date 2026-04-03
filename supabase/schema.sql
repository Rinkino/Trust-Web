-- Trust-Web Database Schema
-- Run this in your Supabase SQL editor

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,

  -- Scoring
  credit_score float default 0 not null,
  visibility_score float default 0 not null,

  -- Streak tracking
  correct_streak int default 0 not null,        -- current consecutive correct 24hr windows
  wrong_streak int default 0 not null,           -- consecutive wrong calls (resets on win)
  best_streak_ever int default 0 not null,

  -- Activity tracking
  total_resolved int default 0 not null,
  total_correct int default 0 not null,
  days_inactive int default 0 not null,
  last_resolved_at timestamptz,

  -- State
  user_state text default 'DECAYING' check (user_state in ('ACTIVE', 'PENDING', 'DECAYING', 'DORMANT')),

  created_at timestamptz default now() not null
);

-- Predictions
create table public.predictions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,

  title text not null,
  betslip_code text unique not null,
  betslip_link text,
  odds float not null check (odds >= 1.01),
  platform text not null,

  status text default 'PENDING' check (status in ('PENDING', 'WON', 'LOST', 'VOID')) not null,

  event_start_time timestamptz not null,
  locked_at timestamptz default now() not null,
  resolved_at timestamptz,

  score_contribution float,

  created_at timestamptz default now() not null
);

-- Score history (never delete — used for ML later)
create table public.score_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  prediction_id uuid references public.predictions(id) on delete set null,

  credit_before float not null,
  credit_after float not null,
  credit_delta float not null,

  visibility_before float not null,
  visibility_after float not null,
  visibility_delta float not null,

  result text not null,

  created_at timestamptz default now() not null
);

-- Indexes
create index predictions_user_id_idx on public.predictions(user_id);
create index predictions_status_idx on public.predictions(status);
create index predictions_locked_at_idx on public.predictions(locked_at desc);
create index profiles_credit_score_idx on public.profiles(credit_score desc);
create index profiles_visibility_score_idx on public.profiles(visibility_score desc);
create index profiles_correct_streak_idx on public.profiles(correct_streak desc);
create index profiles_username_idx on public.profiles(username);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.predictions enable row level security;
alter table public.score_history enable row level security;

-- Profiles: anyone can read, only owner can update
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Predictions: anyone can read, only owner can insert
create policy "Predictions are viewable by everyone"
  on public.predictions for select using (true);

create policy "Users can insert own predictions"
  on public.predictions for insert with check (auth.uid() = user_id);

-- Score history: only service role can write (backend), users can read own
create policy "Users can view own score history"
  on public.score_history for select using (auth.uid() = user_id);
