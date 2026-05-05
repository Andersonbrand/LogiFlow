-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Adiciona campos de placa nas diárias
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- carretas_diarias: adiciona vínculo opcional com veículo (carreta)
ALTER TABLE carretas_diarias
    ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES carretas_veiculos(id) ON DELETE SET NULL;

-- carretas_diarias: adiciona campo texto para placa avulsa (motoristas caminhão)
ALTER TABLE carretas_diarias
    ADD COLUMN IF NOT EXISTS placa text;

-- Índice para filtros por veículo
CREATE INDEX IF NOT EXISTS idx_cdiarias_veiculo ON carretas_diarias (veiculo_id);
