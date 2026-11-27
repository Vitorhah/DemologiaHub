-- Non-destructive versioned migration for Master Creations A4 visual documents
CREATE TABLE IF NOT EXISTS public.master_creations (
  id TEXT PRIMARY KEY,
  master_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Novo Documento A4',
  page_background TEXT NOT NULL DEFAULT '#0d0d12',
  page_border_color TEXT NOT NULL DEFAULT '#242430',
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  elements_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_creations_master_updated
  ON public.master_creations (master_id, updated_at DESC);

ALTER TABLE public.master_creations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'master_creations'
      AND policyname = 'master_creations_access'
  ) THEN
    CREATE POLICY master_creations_access
      ON public.master_creations
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
