-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Abastecimentos e Checklists: caminhões da página de Veículos
-- Execute no Supabase SQL Editor
--
-- A tela do motorista de caminhão usava a lista completa de `carretas_veiculos`
-- (frota de Carretas) para escolher o veículo ao registrar abastecimento ou
-- checklist — uma lista longa e sem relação com os caminhões reais do
-- motorista. Passamos a usar os caminhões cadastrados na página de Veículos
-- (tabela `vehicles`, tipo = 'Caminhão', `id` do tipo bigint). Como
-- `veiculo_id` já é FK para `carretas_veiculos` (uuid), adicionamos colunas
-- específicas para referenciar `vehicles`, preservando os registros antigos.
--
-- Correção: uma tentativa anterior desta migration criou as colunas como
-- uuid, o que falha ao criar a FK porque vehicles.id é bigint. Este script
-- remove as colunas com tipo errado (se existirem) antes de recriá-las
-- corretamente.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'carretas_abastecimentos'
          AND column_name = 'veiculo_caminhao_id'
          AND data_type <> 'bigint'
    ) THEN
        ALTER TABLE carretas_abastecimentos DROP COLUMN veiculo_caminhao_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'carretas_checklists'
          AND column_name = 'veiculo_caminhao_id'
          AND data_type <> 'bigint'
    ) THEN
        ALTER TABLE carretas_checklists DROP COLUMN veiculo_caminhao_id;
    END IF;
END $$;

ALTER TABLE carretas_abastecimentos
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_id bigint REFERENCES vehicles(id) ON DELETE SET NULL;
ALTER TABLE carretas_abastecimentos
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_placa text;
ALTER TABLE carretas_abastecimentos
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_modelo text;
CREATE INDEX IF NOT EXISTS idx_abast_veiculo_caminhao_id ON carretas_abastecimentos (veiculo_caminhao_id);

ALTER TABLE carretas_checklists
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_id bigint REFERENCES vehicles(id) ON DELETE SET NULL;
ALTER TABLE carretas_checklists
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_placa text;
ALTER TABLE carretas_checklists
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_modelo text;
CREATE INDEX IF NOT EXISTS idx_checklist_veiculo_caminhao_id ON carretas_checklists (veiculo_caminhao_id);

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'carretas_abastecimentos' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'carretas_checklists' ORDER BY ordinal_position;
