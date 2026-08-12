-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Agrupamento de pneus trocados em lote (lote_id)
-- Execute no Supabase SQL Editor
--
-- Quando o mecânico marca várias posições no diagrama e registra tudo de
-- uma vez, cada posição ainda vira o seu próprio registro em `pneus` (cada
-- um com número sequencial próprio — necessário pro controle individual de
-- vida útil/KM), mas agora todos ganham o mesmo `lote_id`, o que permite
-- às telas (mecânico e Carretas > Pneus) mostrar isso como um único
-- registro expansível, em vez de várias linhas soltas.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE pneus
    ADD COLUMN IF NOT EXISTS lote_id uuid;

CREATE INDEX IF NOT EXISTS idx_pneus_lote_id ON pneus (lote_id) WHERE lote_id IS NOT NULL;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pneus' AND column_name = 'lote_id';
