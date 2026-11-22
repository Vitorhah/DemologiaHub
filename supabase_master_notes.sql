-- =============================================================================
-- DEMOLOGIA HUB — Migração Versionada: Anotações Privadas do Mestre (v1)
-- =============================================================================
-- OBJETIVO:
--   Criar a tabela minimalista `public.master_notes` para armazenar anotações
--   de texto simples do Mestre com baixo consumo de armazenamento, I/O e rede.
--
-- CARACTERÍSTICAS:
--   - Sem Supabase Realtime (consultas apenas sob demanda via CRUD simples).
--   - Coluna `preview` gerada automaticamente no PostgreSQL para que a listagem
--     carregue apenas `id, master_id, title, preview, updated_at` sem transferir
--     o texto completo (`content`) até o Mestre abrir uma anotação específica.
--   - RLS habilitado para privacidade por `master_id`.
--
-- COMO APLICAR:
--   Execute este script no SQL Editor do projeto Supabase. É idempotente e não
--   altera nenhuma tabela existente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.master_notes (
  id text PRIMARY KEY CHECK (char_length(id) > 0 AND char_length(id) <= 128),
  master_id text NOT NULL CHECK (char_length(master_id) > 0 AND char_length(master_id) <= 128),
  title text NOT NULL DEFAULT 'Nova anotação' CHECK (char_length(title) <= 200),
  content text NOT NULL DEFAULT '',
  preview text GENERATED ALWAYS AS (
    left(trim(regexp_replace(content, E'[\\r\\n\\t]+', ' ', 'g')), 140)
  ) STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice composto para listagem ordenada por atualização mais recente de cada Mestre
CREATE INDEX IF NOT EXISTS idx_master_notes_master_updated
  ON public.master_notes (master_id, updated_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.master_notes ENABLE ROW LEVEL SECURITY;

-- Limpar políticas anteriores caso o script seja reexecutado
DROP POLICY IF EXISTS "master_notes_select_policy" ON public.master_notes;
DROP POLICY IF EXISTS "master_notes_insert_policy" ON public.master_notes;
DROP POLICY IF EXISTS "master_notes_update_policy" ON public.master_notes;
DROP POLICY IF EXISTS "master_notes_delete_policy" ON public.master_notes;

-- Políticas de privacidade:
-- 1. Quando o usuário está autenticado via Supabase Auth (`auth.uid() IS NOT NULL`),
--    somente o próprio mestre proprietário (`master_id = auth.uid()::text`) pode
--    ler, criar, editar ou excluir suas anotações.
-- 2. Para compatibilidade com o modo atual de sessão local (anon) do Demologia Hub,
--    permite acesso com `master_id` válido quando `auth.uid() IS NULL`.
--    Quando o projeto exigir login obrigatório via Supabase Auth, remova a cláusula
--    `OR auth.uid() IS NULL` abaixo e revogue privilégios da role `anon`.
CREATE POLICY "master_notes_select_policy"
  ON public.master_notes
  FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND master_id = auth.uid()::text)
    OR auth.uid() IS NULL
  );

CREATE POLICY "master_notes_insert_policy"
  ON public.master_notes
  FOR INSERT
  WITH CHECK (
    char_length(id) > 0
    AND char_length(id) <= 128
    AND char_length(master_id) > 0
    AND char_length(master_id) <= 128
    AND char_length(title) <= 200
    AND (
      (auth.uid() IS NOT NULL AND master_id = auth.uid()::text)
      OR auth.uid() IS NULL
    )
  );

CREATE POLICY "master_notes_update_policy"
  ON public.master_notes
  FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND master_id = auth.uid()::text)
    OR auth.uid() IS NULL
  )
  WITH CHECK (
    char_length(master_id) > 0
    AND char_length(master_id) <= 128
    AND char_length(title) <= 200
    AND (
      (auth.uid() IS NOT NULL AND master_id = auth.uid()::text)
      OR auth.uid() IS NULL
    )
  );

CREATE POLICY "master_notes_delete_policy"
  ON public.master_notes
  FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND master_id = auth.uid()::text)
    OR auth.uid() IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.master_notes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.master_notes TO authenticated;
GRANT ALL ON TABLE public.master_notes TO service_role;
