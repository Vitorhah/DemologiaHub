-- ==============================================================================
-- DEMOLOGIA HUB - SISTEMA SINCRONIZADO DE MÚSICA (OST)
-- ==============================================================================
-- Este script SQL deve ser executado no SQL Editor do seu projeto Supabase.
-- Ele remove a estrutura legada e cria o novo ecossistema de áudio sincronizado.
-- ==============================================================================

-- 1. LIMPEZA DO SISTEMA ANTIGO
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.playback_state CASCADE;
DROP TABLE IF EXISTS public.tracks CASCADE;
DROP FUNCTION IF EXISTS public.server_now() CASCADE;

-- Limpar registros legados de áudio salvos em base64 na tabela de players
DELETE FROM public.players WHERE id LIKE 'GLOBAL_OST_%' OR id = 'MASTER_STATE';

-- 2. TABELA: playback_state (Estado de Reprodução por Mesa/Sala)
-- ------------------------------------------------------------------------------
CREATE TABLE public.playback_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL UNIQUE,
    track_url TEXT,
    started_at TIMESTAMPTZ,
    is_playing BOOLEAN NOT NULL DEFAULT false,
    paused_position FLOAT NOT NULL DEFAULT 0,
    volume FLOAT NOT NULL DEFAULT 1.0,
    loop BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca imediata por sala
CREATE INDEX IF NOT EXISTS idx_playback_state_room ON public.playback_state(room_id);

-- 3. TABELA: tracks (Biblioteca de Faixas da Mesa)
-- ------------------------------------------------------------------------------
CREATE TABLE public.tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('upload', 'link')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para listagem rápida por sala
CREATE INDEX IF NOT EXISTS idx_tracks_room ON public.tracks(room_id);
CREATE INDEX IF NOT EXISTS idx_tracks_created ON public.tracks(created_at DESC);

-- 4. FUNÇÃO RPC: server_now() (Relógio Preciso do Servidor para Sincronização)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.server_now()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
    SELECT clock_timestamp();
$$;

-- 5. HABILITAÇÃO DO REALTIME
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.playback_state;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tracks;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

-- 6. POLÍTICAS DE SEGURANÇA (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.playback_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

-- Remover políticas pré-existentes se houver
DROP POLICY IF EXISTS "allow_read_playback_state" ON public.playback_state;
DROP POLICY IF EXISTS "allow_insert_playback_state" ON public.playback_state;
DROP POLICY IF EXISTS "allow_update_playback_state" ON public.playback_state;
DROP POLICY IF EXISTS "allow_delete_playback_state" ON public.playback_state;

DROP POLICY IF EXISTS "allow_read_tracks" ON public.tracks;
DROP POLICY IF EXISTS "allow_insert_tracks" ON public.tracks;
DROP POLICY IF EXISTS "allow_update_tracks" ON public.tracks;
DROP POLICY IF EXISTS "allow_delete_tracks" ON public.tracks;

-- Leitura liberada para todos os jogadores na sala
CREATE POLICY "allow_read_playback_state" ON public.playback_state 
    FOR SELECT USING (true);

CREATE POLICY "allow_read_tracks" ON public.tracks 
    FOR SELECT USING (true);

-- Permissões de escrita (Mestre gerencia pelo app com validação do client isMestreAuth)
CREATE POLICY "allow_insert_playback_state" ON public.playback_state 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_update_playback_state" ON public.playback_state 
    FOR UPDATE USING (true);

CREATE POLICY "allow_delete_playback_state" ON public.playback_state 
    FOR DELETE USING (true);

CREATE POLICY "allow_insert_tracks" ON public.tracks 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_update_tracks" ON public.tracks 
    FOR UPDATE USING (true);

CREATE POLICY "allow_delete_tracks" ON public.tracks 
    FOR DELETE USING (true);

-- Concessão de permissões de acesso
GRANT ALL ON TABLE public.playback_state TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tracks TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.server_now() TO anon, authenticated, service_role;

-- 7. SUPABASE STORAGE (Bucket Público: audio-tracks)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-tracks', 'audio-tracks', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para o Bucket audio-tracks
DROP POLICY IF EXISTS "Public Read Audio Tracks" ON storage.objects;
DROP POLICY IF EXISTS "Allow Insert Audio Tracks" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update Audio Tracks" ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete Audio Tracks" ON storage.objects;

CREATE POLICY "Public Read Audio Tracks"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio-tracks');

CREATE POLICY "Allow Insert Audio Tracks"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audio-tracks');

CREATE POLICY "Allow Update Audio Tracks"
ON storage.objects FOR UPDATE
USING (bucket_id = 'audio-tracks');

CREATE POLICY "Allow Delete Audio Tracks"
ON storage.objects FOR DELETE
USING (bucket_id = 'audio-tracks');
