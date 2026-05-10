-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Retira de clientes + Realtime para romaneios
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Coluna is_retira: identifica carregamentos de retira de clientes na fábrica
ALTER TABLE carretas_carregamentos
    ADD COLUMN IF NOT EXISTS is_retira   boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pedido_venda text;

-- Índice para filtrar retiras rapidamente
CREATE INDEX IF NOT EXISTS idx_carretas_carregamentos_is_retira
    ON carretas_carregamentos (is_retira);

-- 2. REPLICA IDENTITY FULL para carretas_romaneios
--    Necessário para o Supabase Realtime enviar atualizações (UPDATE/DELETE)
--    para a tela do motorista em tempo real
ALTER TABLE carretas_romaneios REPLICA IDENTITY FULL;

-- Publicar a tabela no canal de Realtime se ainda não estiver
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'carretas_romaneios'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE carretas_romaneios;
    END IF;
END $$;

-- 3. Garantir que registros existentes de frota não sejam marcados como retira
UPDATE carretas_carregamentos
SET is_retira = false
WHERE is_retira IS NULL;
