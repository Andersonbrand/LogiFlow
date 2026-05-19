-- ─── Migration: vincular romaneios admin <-> motorista ───────────────────────
-- Execute no Supabase > SQL Editor

-- 1. Adicionar coluna lancado_por_motorista (false = criado pelo admin, true = motorista vinculou)
ALTER TABLE carretas_romaneios
    ADD COLUMN IF NOT EXISTS lancado_por_motorista boolean NOT NULL DEFAULT false;

-- 2. Marcar todos os romaneios existentes com tipo_carga = 'ferragem' como vinculados pelo motorista
UPDATE carretas_romaneios
    SET lancado_por_motorista = true
    WHERE tipo_carga = 'ferragem';

-- 3. Marcar todos os demais (cimento/null) como criados pelo admin
UPDATE carretas_romaneios
    SET lancado_por_motorista = false
    WHERE tipo_carga IS DISTINCT FROM 'ferragem';

-- 4. Índice para queries de vínculo (opcional, melhora performance)
CREATE INDEX IF NOT EXISTS idx_carretas_romaneios_lancado_por_motorista
    ON carretas_romaneios (lancado_por_motorista);

-- Verificar resultado
SELECT
    tipo_carga,
    lancado_por_motorista,
    COUNT(*) as total
FROM carretas_romaneios
GROUP BY tipo_carga, lancado_por_motorista
ORDER BY tipo_carga, lancado_por_motorista;
