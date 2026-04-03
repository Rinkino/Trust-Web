-- Add market tracking fields to predictions
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS market_id TEXT,
  ADD COLUMN IF NOT EXISTS selection TEXT CHECK (selection IN ('YES', 'NO'));
