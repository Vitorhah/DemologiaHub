-- =============================================================================
-- DEMOLOGIA HUB — Migração Versionada: Pause de Sessão & Enquetes em Tempo Real
-- =============================================================================
-- Não-destrutiva e idempotente. Garante:
--   1. Isolamento estrito por `room_id` e `master_id`.
--   2. Validação no backend via funções RPC (`SECURITY DEFINER`) exigindo
--      correspondência do `master_id` e hash do token de sessão do Mestre.
--   3. Expiração automática de Pause caso o Mestre desconecte (`heartbeat_at`).
--   4. Garantia de voto único por jogador por enquete (`PRIMARY KEY (poll_id, voter_id)`).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabela de estado de Pause por sala/mesa
CREATE TABLE IF NOT EXISTS public.tabletop_session_pauses (
  room_id TEXT PRIMARY KEY CHECK (char_length(room_id) > 0 AND char_length(room_id) <= 64),
  master_id TEXT NOT NULL CHECK (char_length(master_id) > 0 AND char_length(master_id) <= 128),
  master_session_hash TEXT NOT NULL CHECK (char_length(master_session_hash) >= 16),
  is_active BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 300),
  allowed_settings JSONB NOT NULL DEFAULT '{"audio":true,"notifications":false,"visual":false}'::jsonb,
  allowed_minigames JSONB NOT NULL DEFAULT '[]'::jsonb,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Enquetes por sala/mesa
CREATE TABLE IF NOT EXISTS public.tabletop_session_polls (
  id TEXT PRIMARY KEY CHECK (char_length(id) > 0 AND char_length(id) <= 64),
  room_id TEXT NOT NULL CHECK (char_length(room_id) > 0 AND char_length(room_id) <= 64),
  master_id TEXT NOT NULL CHECK (char_length(master_id) > 0 AND char_length(master_id) <= 128),
  master_session_hash TEXT NOT NULL CHECK (char_length(master_session_hash) >= 16),
  question TEXT NOT NULL CHECK (char_length(trim(question)) > 0 AND char_length(question) <= 220),
  options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 8),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds BETWEEN 15 AND 3600),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tabletop_session_polls_room_started
  ON public.tabletop_session_polls (room_id, started_at DESC);

-- 3. Tabela de Votos (voto único por jogador por enquete garantido por PK)
CREATE TABLE IF NOT EXISTS public.tabletop_poll_votes (
  poll_id TEXT NOT NULL REFERENCES public.tabletop_session_polls(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL CHECK (char_length(room_id) > 0 AND char_length(room_id) <= 64),
  voter_id TEXT NOT NULL CHECK (char_length(voter_id) > 0 AND char_length(voter_id) <= 128),
  option_id TEXT NOT NULL CHECK (char_length(option_id) > 0 AND char_length(option_id) <= 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_tabletop_poll_votes_room_poll
  ON public.tabletop_poll_votes (room_id, poll_id);

-- 4. Habilitar RLS e restringir escrita direta (mutações passam pelas RPCs validadas)
ALTER TABLE public.tabletop_session_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabletop_session_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabletop_poll_votes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tabletop_session_pauses' AND policyname = 'tabletop_pauses_read'
  ) THEN
    CREATE POLICY tabletop_pauses_read ON public.tabletop_session_pauses
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tabletop_session_polls' AND policyname = 'tabletop_polls_read'
  ) THEN
    CREATE POLICY tabletop_polls_read ON public.tabletop_session_polls
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tabletop_poll_votes' AND policyname = 'tabletop_poll_votes_read'
  ) THEN
    CREATE POLICY tabletop_poll_votes_read ON public.tabletop_poll_votes
      FOR SELECT USING (true);
  END IF;
END
$$;

-- 5. RPC: Ativar ou atualizar Pause (somente o Mestre responsável pela sessão)
CREATE OR REPLACE FUNCTION public.set_tabletop_pause(
  p_room_id TEXT,
  p_master_id TEXT,
  p_master_token TEXT,
  p_message TEXT,
  p_allowed_settings JSONB,
  p_allowed_minigames JSONB
)
RETURNS public.tabletop_session_pauses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash TEXT;
  v_existing public.tabletop_session_pauses;
  v_result public.tabletop_session_pauses;
  v_clean_msg TEXT;
BEGIN
  IF p_room_id IS NULL OR char_length(trim(p_room_id)) = 0 THEN
    RAISE EXCEPTION 'room_id obrigatório';
  END IF;
  IF p_master_id IS NULL OR char_length(trim(p_master_id)) = 0 THEN
    RAISE EXCEPTION 'master_id obrigatório';
  END IF;
  IF p_master_token IS NULL OR char_length(p_master_token) < 16 THEN
    RAISE EXCEPTION 'Token de sessão do Mestre inválido';
  END IF;

  v_clean_msg := trim(coalesce(p_message, ''));
  IF char_length(v_clean_msg) = 0 THEN
    RAISE EXCEPTION 'Informe uma mensagem para o Pause';
  END IF;
  IF char_length(v_clean_msg) > 280 THEN
    v_clean_msg := left(v_clean_msg, 280);
  END IF;

  v_token_hash := encode(digest(p_master_token, 'sha256'), 'hex');

  SELECT * INTO v_existing
  FROM public.tabletop_session_pauses
  WHERE room_id = p_room_id;

  -- Se há um pause ativo e não expirado de outro Mestre/sessão, bloquear usurpação
  IF FOUND
     AND v_existing.is_active
     AND v_existing.heartbeat_at > (NOW() - INTERVAL '90 seconds')
     AND (v_existing.master_id <> p_master_id OR v_existing.master_session_hash <> v_token_hash)
  THEN
    RAISE EXCEPTION 'Apenas o Mestre que ativou este Pause pode alterá-lo.';
  END IF;

  INSERT INTO public.tabletop_session_pauses (
    room_id,
    master_id,
    master_session_hash,
    is_active,
    message,
    allowed_settings,
    allowed_minigames,
    activated_at,
    heartbeat_at,
    updated_at
  )
  VALUES (
    p_room_id,
    p_master_id,
    v_token_hash,
    true,
    v_clean_msg,
    coalesce(p_allowed_settings, '{"audio":true,"notifications":false,"visual":false}'::jsonb),
    coalesce(p_allowed_minigames, '[]'::jsonb),
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (room_id) DO UPDATE SET
    master_id = EXCLUDED.master_id,
    master_session_hash = EXCLUDED.master_session_hash,
    is_active = true,
    message = EXCLUDED.message,
    allowed_settings = EXCLUDED.allowed_settings,
    allowed_minigames = EXCLUDED.allowed_minigames,
    activated_at = CASE
      WHEN public.tabletop_session_pauses.is_active
           AND public.tabletop_session_pauses.master_id = EXCLUDED.master_id
           AND public.tabletop_session_pauses.master_session_hash = EXCLUDED.master_session_hash
      THEN public.tabletop_session_pauses.activated_at
      ELSE NOW()
    END,
    heartbeat_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 6. RPC: Heartbeat do Mestre enquanto Pause está ativo
CREATE OR REPLACE FUNCTION public.heartbeat_tabletop_pause(
  p_room_id TEXT,
  p_master_id TEXT,
  p_master_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash TEXT;
  v_rows INTEGER;
BEGIN
  IF p_master_token IS NULL OR char_length(p_master_token) < 16 THEN
    RETURN false;
  END IF;
  v_token_hash := encode(digest(p_master_token, 'sha256'), 'hex');

  UPDATE public.tabletop_session_pauses
  SET heartbeat_at = NOW(), updated_at = NOW()
  WHERE room_id = p_room_id
    AND master_id = p_master_id
    AND master_session_hash = v_token_hash
    AND is_active = true;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- 7. RPC: Encerrar Pause (somente o Mestre responsável)
CREATE OR REPLACE FUNCTION public.end_tabletop_pause(
  p_room_id TEXT,
  p_master_id TEXT,
  p_master_token TEXT
)
RETURNS public.tabletop_session_pauses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash TEXT;
  v_result public.tabletop_session_pauses;
BEGIN
  IF p_master_token IS NULL OR char_length(p_master_token) < 16 THEN
    RAISE EXCEPTION 'Token de sessão do Mestre inválido';
  END IF;
  v_token_hash := encode(digest(p_master_token, 'sha256'), 'hex');

  UPDATE public.tabletop_session_pauses
  SET is_active = false, updated_at = NOW()
  WHERE room_id = p_room_id
    AND (
      (master_id = p_master_id AND master_session_hash = v_token_hash)
      OR heartbeat_at <= (NOW() - INTERVAL '90 seconds')
    )
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apenas o Mestre responsável pode encerrar este Pause.';
  END IF;

  RETURN v_result;
END;
$$;

-- 8. RPC: Criar nova Enquete na sala (encerra eventual enquete anterior do mesmo Mestre)
CREATE OR REPLACE FUNCTION public.create_tabletop_poll(
  p_poll_id TEXT,
  p_room_id TEXT,
  p_master_id TEXT,
  p_master_token TEXT,
  p_question TEXT,
  p_options JSONB,
  p_duration_seconds INTEGER
)
RETURNS public.tabletop_session_polls
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash TEXT;
  v_clean_q TEXT;
  v_duration INTEGER;
  v_result public.tabletop_session_polls;
BEGIN
  IF p_poll_id IS NULL OR char_length(trim(p_poll_id)) = 0 OR char_length(p_poll_id) > 64 THEN
    RAISE EXCEPTION 'poll_id inválido';
  END IF;
  IF p_room_id IS NULL OR char_length(trim(p_room_id)) = 0 OR char_length(p_room_id) > 64 THEN
    RAISE EXCEPTION 'room_id obrigatório';
  END IF;
  IF p_master_id IS NULL OR char_length(trim(p_master_id)) = 0 OR char_length(p_master_id) > 128 THEN
    RAISE EXCEPTION 'master_id obrigatório';
  END IF;
  IF p_master_token IS NULL OR char_length(p_master_token) < 16 THEN
    RAISE EXCEPTION 'Token de sessão do Mestre inválido';
  END IF;
  v_clean_q := trim(coalesce(p_question, ''));
  IF char_length(v_clean_q) = 0 OR char_length(v_clean_q) > 220 THEN
    RAISE EXCEPTION 'Pergunta da enquete inválida';
  END IF;
  IF p_options IS NULL OR jsonb_typeof(p_options) <> 'array' OR jsonb_array_length(p_options) NOT BETWEEN 2 AND 8 THEN
    RAISE EXCEPTION 'A enquete deve ter entre 2 e 8 opções';
  END IF;

  v_duration := greatest(15, least(3600, coalesce(p_duration_seconds, 60)));
  v_token_hash := encode(digest(p_master_token, 'sha256'), 'hex');

  -- Encerra enquetes ativas anteriores nesta sala
  UPDATE public.tabletop_session_polls
  SET status = 'closed', closed_at = NOW(), updated_at = NOW()
  WHERE room_id = p_room_id AND status = 'active';

  INSERT INTO public.tabletop_session_polls (
    id,
    room_id,
    master_id,
    master_session_hash,
    question,
    options,
    duration_seconds,
    status,
    started_at,
    ends_at,
    closed_at,
    updated_at
  )
  VALUES (
    p_poll_id,
    p_room_id,
    p_master_id,
    v_token_hash,
    v_clean_q,
    p_options,
    v_duration,
    'active',
    NOW(),
    NOW() + make_interval(secs => v_duration),
    NULL,
    NOW()
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 9. RPC: Encerrar Enquete manualmente (somente o Mestre responsável)
CREATE OR REPLACE FUNCTION public.close_tabletop_poll(
  p_poll_id TEXT,
  p_room_id TEXT,
  p_master_id TEXT,
  p_master_token TEXT
)
RETURNS public.tabletop_session_polls
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash TEXT;
  v_result public.tabletop_session_polls;
BEGIN
  IF p_master_token IS NULL OR char_length(p_master_token) < 16 THEN
    RAISE EXCEPTION 'Token de sessão do Mestre inválido';
  END IF;
  v_token_hash := encode(digest(p_master_token, 'sha256'), 'hex');

  UPDATE public.tabletop_session_polls
  SET status = 'closed',
      closed_at = coalesce(closed_at, NOW()),
      updated_at = NOW()
  WHERE id = p_poll_id
    AND room_id = p_room_id
    AND master_id = p_master_id
    AND master_session_hash = v_token_hash
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apenas o Mestre responsável pode encerrar esta enquete.';
  END IF;

  RETURN v_result;
END;
$$;

-- 10. RPC: Registrar voto único e atômico de jogador
CREATE OR REPLACE FUNCTION public.cast_tabletop_poll_vote(
  p_poll_id TEXT,
  p_room_id TEXT,
  p_voter_id TEXT,
  p_option_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll public.tabletop_session_polls;
  v_option_valid BOOLEAN;
  v_inserted INTEGER;
BEGIN
  IF p_voter_id IS NULL OR char_length(trim(p_voter_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_voter');
  END IF;

  SELECT * INTO v_poll
  FROM public.tabletop_session_polls
  WHERE id = p_poll_id AND room_id = p_room_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_poll.status <> 'active' OR NOW() >= v_poll.ends_at THEN
    UPDATE public.tabletop_session_polls
    SET status = 'closed', closed_at = coalesce(closed_at, ends_at), updated_at = NOW()
    WHERE id = p_poll_id AND status = 'active';
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_poll.options) AS opt
    WHERE opt ->> 'id' = p_option_id
  ) INTO v_option_valid;

  IF NOT v_option_valid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_option');
  END IF;

  INSERT INTO public.tabletop_poll_votes (poll_id, room_id, voter_id, option_id)
  VALUES (p_poll_id, p_room_id, p_voter_id, p_option_id)
  ON CONFLICT (poll_id, voter_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_voted');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_tabletop_pause(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_tabletop_pause(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_tabletop_pause(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_tabletop_poll(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_tabletop_poll(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_tabletop_poll_vote(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 11. Publicação idempotente no Supabase Realtime (postgres_changes por room_id)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tabletop_session_pauses;
  EXCEPTION
    WHEN duplicate_object OR undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tabletop_session_polls;
  EXCEPTION
    WHEN duplicate_object OR undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tabletop_poll_votes;
  EXCEPTION
    WHEN duplicate_object OR undefined_object THEN NULL;
  END;
END
$$;
