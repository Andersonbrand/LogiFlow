-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Adiciona 'Empresa' ao constraint de tipo_local em carretas_pontos_parada
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove o constraint antigo
ALTER TABLE carretas_pontos_parada
    DROP CONSTRAINT IF EXISTS carretas_pontos_parada_tipo_local_check;

-- Recria incluindo 'Empresa'
ALTER TABLE carretas_pontos_parada
    ADD CONSTRAINT carretas_pontos_parada_tipo_local_check
    CHECK (tipo_local IN ('Fábrica','Empresa','Estoque','Entrega','Posto','Oficina','Outro'));
