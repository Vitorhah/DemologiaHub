-- =============================================================================
-- DEMOLOGIA HUB — Migração Versionada: Biblioteca de Criaturas do Mestre (v1)
-- =============================================================================
-- OBJETIVO:
--   Criar as tabelas dedicadas para pastas, fichas-modelo de criaturas e
--   vínculos/skills exclusivas de criaturas da Biblioteca do Mestre.
--
-- CARACTERÍSTICAS:
--   - Listagem enxuta (description_preview gerada no PostgreSQL, sem carregar
--     ficha completa nem skills até o Mestre abrir uma criatura).
--   - Integridade referencial com ON DELETE CASCADE nas skills da criatura:
--     excluir uma criatura remove automaticamente suas skills exclusivas e
--     vínculos, sem jamais excluir skills compartilhadas da Biblioteca nem
--     instâncias já invocadas em sessões (EXTRA_FICHA_*).
--   - RLS habilitado por master_id seguindo o mesmo padrão de master_notes.
--
-- COMO APLICAR:
--   Execute este script no SQL Editor do projeto Supabase. É idempotente e não
--   altera tabelas existentes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.master_creature_folders (
  id text PRIMARY KEY CHECK (char_length(id) > 0 AND char_length(id) <= 128),
  master_id text NOT NULL CHECK (char_length(master_id) > 0 AND char_length(master_id) <= 128),
  name text NOT NULL CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 80),
  parent_id text NULL REFERENCES public.master_creature_folders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_creature_folders_master
  ON public.master_creature_folders (master_id, name);

CREATE TABLE IF NOT EXISTS public.master_creatures (
  id text PRIMARY KEY CHECK (char_length(id) > 0 AND char_length(id) <= 128),
  master_id text NOT NULL CHECK (char_length(master_id) > 0 AND char_length(master_id) <= 128),
  folder_id text NULL REFERENCES public.master_creature_folders(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Nova Criatura' CHECK (char_length(name) <= 140),
  description text NOT NULL DEFAULT '',
  description_preview text GENERATED ALWAYS AS (
    left(trim(regexp_replace(description, E'[\\r\\n\\t]+', ' ', 'g')), 140)
  ) STORED,
  variables jsonb NOT NULL DEFAULT '{"VIT":1,"AGL":1,"FOR":1,"OCU":1,"INT":1,"SAN":1}'::jsonb,
  hp_max integer NOT NULL DEFAULT 26 CHECK (hp_max >= 1),
  pe_max integer NOT NULL DEFAULT 10 CHECK (pe_max >= 0),
  sm_max integer NOT NULL DEFAULT 34 CHECK (sm_max >= 1),
  skills_count integer NOT NULL DEFAULT 0 CHECK (skills_count >= 0),
  legacy_extra_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_creatures_master_updated
  ON public.master_creatures (master_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_master_creatures_master_folder
  ON public.master_creatures (master_id, folder_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_creatures_legacy_dedup
  ON public.master_creatures (master_id, legacy_extra_id)
  WHERE legacy_extra_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.master_creature_skills (
  id text PRIMARY KEY CHECK (char_length(id) > 0 AND char_length(id) <= 128),
  creature_id text NOT NULL REFERENCES public.master_creatures(id) ON DELETE CASCADE,
  master_id text NOT NULL CHECK (char_length(master_id) > 0 AND char_length(master_id) <= 128),
  ownership text NOT NULL CHECK (ownership IN ('exclusive', 'linked')),
  library_skill_id text NULL,
  skill_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_creature_skills_creature
  ON public.master_creature_skills (creature_id, position);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.master_creature_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_creatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_creature_skills ENABLE ROW LEVEL SECURITY;

-- Folders policies
DROP POLICY IF EXISTS "master_creature_folders_select" ON public.master_creature_folders;
DROP POLICY IF EXISTS "master_creature_folders_insert" ON public.master_creature_folders;
DROP POLICY IF EXISTS "master_creature_folders_update" ON public.master_creature_folders;
DROP POLICY IF EXISTS "master_creature_folders_delete" ON public.master_creature_folders;

CREATE POLICY "master_creature_folders_select"
  ON public.master_creature_folders FOR SELECT
  USING ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

CREATE POLICY "master_creature_folders_insert"
  ON public.master_creature_folders FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

CREATE POLICY "master_creature_folders_update"
  ON public.master_creature_folders FOR UPDATE
  USING ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL)
  WITH CHECK ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

CREATE POLICY "master_creature_folders_delete"
  ON public.master_creature_folders FOR DELETE
  USING ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

-- Creatures policies
DROP POLICY IF EXISTS "master_creatures_select" ON public.master_creatures;
DROP POLICY IF EXISTS "master_creatures_insert" ON public.master_creatures;
DROP POLICY IF EXISTS "master_creatures_update" ON public.master_creatures;
DROP POLICY IF EXISTS "master_creatures_delete" ON public.master_creatures;

CREATE POLICY "master_creatures_select"
  ON public.master_creatures FOR SELECT
  USING ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

CREATE POLICY "master_creatures_insert"
  ON public.master_creatures FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

CREATE POLICY "master_creatures_update"
  ON public.master_creatures FOR UPDATE
  USING ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL)
  WITH CHECK ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

CREATE POLICY "master_creatures_delete"
  ON public.master_creatures FOR DELETE
  USING ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

-- Creature skills policies
DROP POLICY IF EXISTS "master_creature_skills_select" ON public.master_creature_skills;
DROP POLICY IF EXISTS "master_creature_skills_insert" ON public.master_creature_skills;
DROP POLICY IF EXISTS "master_creature_skills_update" ON public.master_creature_skills;
DROP POLICY IF EXISTS "master_creature_skills_delete" ON public.master_creature_skills;

CREATE POLICY "master_creature_skills_select"
  ON public.master_creature_skills FOR SELECT
  USING ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

CREATE POLICY "master_creature_skills_insert"
  ON public.master_creature_skills FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

CREATE POLICY "master_creature_skills_update"
  ON public.master_creature_skills FOR UPDATE
  USING ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL)
  WITH CHECK ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

CREATE POLICY "master_creature_skills_delete"
  ON public.master_creature_skills FOR DELETE
  USING ((auth.uid() IS NOT NULL AND master_id = auth.uid()::text) OR auth.uid() IS NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.master_creature_folders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.master_creatures TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.master_creature_skills TO anon, authenticated;
GRANT ALL ON TABLE public.master_creature_folders TO service_role;
GRANT ALL ON TABLE public.master_creatures TO service_role;
GRANT ALL ON TABLE public.master_creature_skills TO service_role;

-- =============================================================================
-- DEMOLOGIA HUB — Migração Incremental v2: Fichas Dinâmicas em Blocos
-- =============================================================================
ALTER TABLE public.master_creatures
  ADD COLUMN IF NOT EXISTS lv integer NOT NULL DEFAULT 1 CHECK (lv >= 1),
  ADD COLUMN IF NOT EXISTS affiliations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rituals jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sheet_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sheet_version integer NOT NULL DEFAULT 2;

