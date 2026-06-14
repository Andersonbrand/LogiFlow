-- ─────────────────────────────────────────────────────────────────────────
-- Adiciona a coluna 'nome_cliente' em carretas_carregamentos
-- Usada no modal de "Retira de Cliente" (Volume de Carregamento > Retira de Clientes)
-- Sem esta coluna, salvar/editar uma retira falha com:
--   "Could not find the 'nome_cliente' column of 'carretas_carregamentos' in the schema cache"
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE carretas_carregamentos
    ADD COLUMN IF NOT EXISTS nome_cliente text;

COMMENT ON COLUMN carretas_carregamentos.nome_cliente IS
    'Nome do cliente que retirou a carga na fábrica (preenchido apenas quando is_retira = true)';
