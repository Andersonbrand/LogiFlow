-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Ordens de Serviço: suporte a caminhões da página de Veículos
-- Execute no Supabase SQL Editor
--
-- O módulo de Carretas guarda seus próprios veículos em `carretas_veiculos`
-- (coluna `veiculo_id` da OS referencia essa tabela). Os caminhões cadastrados
-- na página de Veículos (tabela `vehicles`, usada pelo módulo de Romaneios)
-- são um cadastro totalmente separado, com `id` do tipo bigint (não uuid).
-- Para permitir abrir uma OS também para esses caminhões — sem quebrar a FK
-- existente de `veiculo_id` — adicionamos colunas específicas para
-- referenciar um veículo de `vehicles`.
-- Uma OS deve preencher OU `veiculo_id` (carreta/caminhão da frota de
-- Carretas) OU `veiculo_caminhao_id` (caminhão da página de Veículos), nunca
-- os dois.
--
-- Correção: uma tentativa anterior desta migration criou a coluna como uuid,
-- o que falha ao criar a FK porque vehicles.id é bigint. Este script remove
-- a coluna com tipo errado (se existir) antes de recriá-la corretamente.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'carretas_ordens_servico'
          AND column_name = 'veiculo_caminhao_id'
          AND data_type <> 'bigint'
    ) THEN
        ALTER TABLE carretas_ordens_servico DROP COLUMN veiculo_caminhao_id;
    END IF;
END $$;

ALTER TABLE carretas_ordens_servico
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_id bigint REFERENCES vehicles(id) ON DELETE SET NULL;

-- Placa/modelo denormalizados: garantem que a OS continue exibindo o veículo
-- corretamente mesmo se o cadastro em `vehicles` for editado ou removido.
ALTER TABLE carretas_ordens_servico
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_placa text;

ALTER TABLE carretas_ordens_servico
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_modelo text;

CREATE INDEX IF NOT EXISTS idx_os_veiculo_caminhao_id ON carretas_ordens_servico (veiculo_caminhao_id);

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'carretas_ordens_servico' ORDER BY ordinal_position;
