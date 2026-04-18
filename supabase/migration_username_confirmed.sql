-- Force users to explicitly confirm their display username instead of using auto-generated Gmail name
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username_confirmed boolean NOT NULL DEFAULT false;
