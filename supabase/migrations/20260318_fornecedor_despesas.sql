-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Adiciona coluna fornecedor em carretas_despesas_extras
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE carretas_despesas_extras
    ADD COLUMN IF NOT EXISTS fornecedor text;

-- Índice para buscas por fornecedor
CREATE INDEX IF NOT EXISTS idx_despesas_fornecedor
    ON carretas_despesas_extras (fornecedor);

-- Verificação
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'carretas_despesas_extras' AND column_name = 'fornecedor';
