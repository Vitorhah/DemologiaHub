-- =============================================================================
-- DEMOLOGIA HUB — Migração Versionada de Endurecimento de Segurança (v1)
-- =============================================================================
-- OBJETIVO:
--   Aplicar proteções estruturais não-destrutivas na tabela `public.players`
--   preservando 100% das fichas existentes e a compatibilidade com o acesso
--   anônimo atual da mesa.
--
-- COMO APLICAR:
--   Execute este script no SQL Editor do projeto Supabase. Ele é idempotente
--   (pode ser reexecutado com segurança) e NÃO remove nem altera dados existentes.
-- =============================================================================

-- 1. Garantir RLS habilitado em public.players
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- 2. Restrições estruturais não-destrutivas (NOT VALID permite aplicar sem bloquear
--    linhas legadas e valida automaticamente toda nova inserção/atualização)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_id_length_safe_chk'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_id_length_safe_chk
      CHECK (char_length(id) > 0 AND char_length(id) <= 128) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_data_is_object_chk'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_data_is_object_chk
      CHECK (data IS NULL OR jsonb_typeof(data) = 'object') NOT VALID;
  END IF;
END
$$;

-- 3. Impedir exclusão acidental de registros críticos reservados do sistema via cliente anon
DROP POLICY IF EXISTS "enable_delete_all" ON public.players;
DROP POLICY IF EXISTS "demologia_safe_delete_policy" ON public.players;

CREATE POLICY "demologia_safe_delete_policy"
  ON public.players
  FOR DELETE
  USING (
    id NOT IN (
      'MASTER_STATE',
      'MASTER_EVENTS',
      'HANDOUTS_MASTER',
      'HANDOUTS_SHARED',
      'TABLETOP_GRID',
      'CADERNO_CAMPO_SHARED'
    )
  );

-- 4. Manter leitura, inserção e atualização compatíveis com o cliente atual,
--    exigindo payload JSON objeto válido (ou nulo) para evitar corrupção estrutural
DROP POLICY IF EXISTS "enable_insert_all" ON public.players;
DROP POLICY IF EXISTS "demologia_safe_insert_policy" ON public.players;

CREATE POLICY "demologia_safe_insert_policy"
  ON public.players
  FOR INSERT
  WITH CHECK (
    char_length(id) > 0
    AND char_length(id) <= 128
    AND (data IS NULL OR jsonb_typeof(data) = 'object')
  );

DROP POLICY IF EXISTS "enable_update_all" ON public.players;
DROP POLICY IF EXISTS "demologia_safe_update_policy" ON public.players;

CREATE POLICY "demologia_safe_update_policy"
  ON public.players
  FOR UPDATE
  USING (true)
  WITH CHECK (
    char_length(id) > 0
    AND char_length(id) <= 128
    AND (data IS NULL OR jsonb_typeof(data) = 'object')
  );

-- =============================================================================
-- PRÓXIMO PASSO OPCIONAL (ENDURECIMENTO MÁXIMO COM SUPABASE AUTH):
-- Quando a mesa migrar o Mestre para uma conta autenticada no Supabase Auth
-- (com claim `app_metadata.role = 'master'`), substitua a cláusula USING/WITH CHECK
-- acima para restringir mutações de `data->'ep'`, `data->'lv'` e registros
-- `HANDOUTS_MASTER` / `MASTER_STATE` exclusivamente a:
--   (auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
-- =============================================================================
