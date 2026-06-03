-- 1. Certifique-se de que o RLS está habilitado
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- 2. Remova políticas antigas caso existam para evitar duplicação
DROP POLICY IF EXISTS "Permitir leitura pública" ON public.players;
DROP POLICY IF EXISTS "Permitir inserção pública" ON public.players;
DROP POLICY IF EXISTS "Permitir atualização pública" ON public.players;
DROP POLICY IF EXISTS "Permitir delete publico" ON public.players;
DROP POLICY IF EXISTS "enable_read_all" ON public.players;
DROP POLICY IF EXISTS "enable_insert_all" ON public.players;
DROP POLICY IF EXISTS "enable_update_all" ON public.players;
DROP POLICY IF EXISTS "enable_delete_all" ON public.players;

-- 3. Crie as políticas para permitir que a chave anônima (public) leia e modifique os dados
CREATE POLICY "enable_read_all" ON public.players FOR SELECT USING (true);
CREATE POLICY "enable_insert_all" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "enable_update_all" ON public.players FOR UPDATE USING (true);
CREATE POLICY "enable_delete_all" ON public.players FOR DELETE USING (true);

-- 4. Garantir que as roles anon e authenticated têm permissão de acesso à tabela
GRANT ALL ON TABLE public.players TO anon;
GRANT ALL ON TABLE public.players TO authenticated;
GRANT ALL ON TABLE public.players TO service_role;
