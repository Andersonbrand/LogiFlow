-- Execute no Supabase Dashboard → SQL Editor

-- 1. Colunas necessárias
ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS is_rascunho      boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sugestao_veiculo text;

-- 2. Expande CHECK de status para incluir 'Rascunho'
DO $$
DECLARE c_name text;
BEGIN
    SELECT conname INTO c_name FROM pg_constraint
    WHERE conrelid = 'romaneios'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';
    IF c_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE romaneios DROP CONSTRAINT %I', c_name);
    END IF;
END $$;

ALTER TABLE romaneios ADD CONSTRAINT romaneios_status_check
    CHECK (status IN ('Rascunho','Aguardando','Carregando','Em Trânsito','Finalizado','Cancelado'));

-- 3. Índice para busca eficiente
CREATE INDEX IF NOT EXISTS idx_romaneios_rascunho ON romaneios (is_rascunho);

-- 4. Consistência de dados existentes
UPDATE romaneios SET is_rascunho = false WHERE is_rascunho IS NULL;

-- Verificação
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'romaneios' AND column_name IN ('is_rascunho','sugestao_veiculo');
