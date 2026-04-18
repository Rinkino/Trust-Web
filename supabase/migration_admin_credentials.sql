-- Admin credentials stored in DB so .env alone cannot grant admin access
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  username  text PRIMARY KEY,
  password_hash text NOT NULL  -- bcrypt hash
);

-- Only the service role can read/write this table
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
-- No RLS policies = no access for anon or authenticated roles, only service role bypasses RLS
