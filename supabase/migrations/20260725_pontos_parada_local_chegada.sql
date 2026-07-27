-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Pontos de Parada: Tipo de Local e Destino também na CHEGADA
--
-- Até aqui, "tipo_local" e "local" descreviam um único ponto genérico do
-- registro (usado hoje como o local de SAÍDA). Isso deixava a CHEGADA sem
-- informação de destino, tornando o registro ambíguo para quem lê depois.
--
-- Agora cada registro guarda:
--   tipo_local          / local          -> de onde o motorista SAIU
--   tipo_local_chegada  / local_chegada  -> para onde o motorista CHEGOU
--
-- O mesmo padrão vale dentro de cada "ponto extra" (jsonb em horarios_extras).
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE carretas_pontos_parada
    ADD COLUMN IF NOT EXISTS tipo_local_chegada text
        CHECK (tipo_local_chegada IN ('Empresa','Fábrica','Estoque','Entrega','Posto','Oficina','Outro')),
    ADD COLUMN IF NOT EXISTS local_chegada text;

-- Rede de segurança: garante a coluna de pontos extras mesmo se algum
-- ambiente ainda não a tiver criado.
ALTER TABLE carretas_pontos_parada
    ADD COLUMN IF NOT EXISTS horarios_extras jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN carretas_pontos_parada.tipo_local IS 'Tipo do local de SAÍDA';
COMMENT ON COLUMN carretas_pontos_parada.local IS 'Destino/nome do local de SAÍDA';
COMMENT ON COLUMN carretas_pontos_parada.tipo_local_chegada IS 'Tipo do local de CHEGADA';
COMMENT ON COLUMN carretas_pontos_parada.local_chegada IS 'Destino/nome do local de CHEGADA';

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT tipo_local, local, tipo_local_chegada, local_chegada FROM carretas_pontos_parada ORDER BY created_at DESC LIMIT 20;
