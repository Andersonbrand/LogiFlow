-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Adiciona coluna 'empresa' em carretas_despesas_extras
--
-- O campo "Empresa" (select com EMPRESAS_LOGIFLOW) foi adicionado ao
-- formulário de despesas de carretas, mas a coluna nunca foi criada na
-- tabela. Isso causava o erro ao salvar:
--   "Could not find the 'empresa' column of 'carretas_despesas_extras'
--    in the schema cache"
-- As outras duas tabelas de despesa (caminhoes_despesas e
-- transporte_despesas_adm) já possuem essa coluna.
-- Execute no Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE carretas_despesas_extras
    ADD COLUMN IF NOT EXISTS empresa text;

CREATE INDEX IF NOT EXISTS idx_cdespesas_empresa
    ON carretas_despesas_extras (empresa);

-- Verificação:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'carretas_despesas_extras' AND column_name = 'empresa';
