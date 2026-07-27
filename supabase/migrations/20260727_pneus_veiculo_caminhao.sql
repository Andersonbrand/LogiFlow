-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Pneus: suporte a caminhões da página de Veículos
-- Execute no Supabase SQL Editor
--
-- A tela de Pneus (aba Carretas) só permitia vincular um pneu a um veículo de
-- `carretas_veiculos` (frota de carretas). Passamos a permitir também vincular
-- a um caminhão da página de Veículos (tabela `vehicles`, tipo = 'Caminhão',
-- `id` do tipo bigint), seguindo o mesmo padrão já usado em Ordens de Serviço,
-- Abastecimentos e Checklists: como `veiculo_id` já é FK para
-- `carretas_veiculos` (uuid), adicionamos colunas específicas para referenciar
-- `vehicles`.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pneus'
          AND column_name = 'veiculo_caminhao_id'
          AND data_type <> 'bigint'
    ) THEN
        ALTER TABLE pneus DROP COLUMN veiculo_caminhao_id;
    END IF;
END $$;

ALTER TABLE pneus
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_id bigint REFERENCES vehicles(id) ON DELETE SET NULL;
ALTER TABLE pneus
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_placa text;
ALTER TABLE pneus
    ADD COLUMN IF NOT EXISTS veiculo_caminhao_modelo text;
CREATE INDEX IF NOT EXISTS idx_pneus_veiculo_caminhao_id ON pneus (veiculo_caminhao_id);

-- veiculo_id agora é opcional (o pneu pode estar vinculado a um caminhão em vez de uma carreta)
ALTER TABLE pneus ALTER COLUMN veiculo_id DROP NOT NULL;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'pneus' ORDER BY ordinal_position;
