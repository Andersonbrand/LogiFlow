-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Data/Hora de Chegada nos Romaneios (Caminhões)
-- Execute no Supabase SQL Editor
--
-- Além da data/hora de saída já existente, passamos a registrar também a
-- data/hora de chegada do romaneio no destino.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS chegada timestamptz;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'romaneios' AND column_name = 'chegada';
