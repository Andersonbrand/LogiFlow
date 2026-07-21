-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Fracionamento de Diárias nos Romaneios (Caminhões)
-- Execute no Supabase SQL Editor
--
-- A coluna `dias_diaria` foi criada como integer, o que impedia salvar
-- diárias fracionadas (1,5 / 2,5 / 3,5 dias etc.), sempre arredondando para
-- o inteiro mais próximo. Alteramos para numeric(6,2) para permitir meio-dia.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE romaneios
    ALTER COLUMN dias_diaria TYPE numeric(6,2) USING dias_diaria::numeric(6,2);

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'romaneios' AND column_name = 'dias_diaria';
