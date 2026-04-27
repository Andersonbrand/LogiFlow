-- ================================================================
-- LOGIFLOW — Adiciona campo "local_carregamento" nos registros
-- de viagem lançados pelos motoristas de carreta
-- Execute no SQL Editor do Supabase
-- ================================================================

ALTER TABLE public.carretas_registros_viagem
    ADD COLUMN IF NOT EXISTS local_carregamento text;

-- Índice opcional para filtros futuros
CREATE INDEX IF NOT EXISTS idx_carretas_registros_viagem_local
    ON public.carretas_registros_viagem(local_carregamento);
