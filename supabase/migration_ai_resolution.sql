-- Track how a prediction was resolved and store AI reasoning
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS resolution_source TEXT CHECK (resolution_source IN ('auto', 'ai', 'manual')),
  ADD COLUMN IF NOT EXISTS resolution_note   TEXT;
