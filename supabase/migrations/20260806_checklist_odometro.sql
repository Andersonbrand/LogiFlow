-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Checklist: campo de odômetro (km do veículo)
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE carretas_checklists
    ADD COLUMN IF NOT EXISTS odometro numeric(10,1);

COMMENT ON COLUMN carretas_checklists.odometro IS 'Quilometragem do veículo informada pelo motorista no momento do checklist (caminhão ou carreta).';

-- SELECT odometro FROM carretas_checklists LIMIT 5;
