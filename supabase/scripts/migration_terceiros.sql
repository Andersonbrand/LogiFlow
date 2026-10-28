-- ═══════════════════════════════════════════════════════
-- MIGRAÇÃO: Suporte a veículos e motoristas terceirizados
-- ═══════════════════════════════════════════════════════

-- 1. Flag is_terceiro na tabela de carregamentos
--    Distingue carregamentos de frotas próprias vs terceiras
ALTER TABLE carretas_carregamentos
    ADD COLUMN IF NOT EXISTS is_terceiro boolean NOT NULL DEFAULT false;

-- Índice para filtrar rapidamente por tipo
CREATE INDEX IF NOT EXISTS idx_carregamentos_is_terceiro
    ON carretas_carregamentos (is_terceiro);

-- 2. Flag is_terceiro na tabela de veículos
ALTER TABLE carretas_veiculos
    ADD COLUMN IF NOT EXISTS is_terceiro boolean NOT NULL DEFAULT false;

-- 3. Flag is_terceiro na tabela de perfis de usuário (motoristas)
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS is_terceiro boolean NOT NULL DEFAULT false;

-- 4. RLS: motoristas (carreteiros) podem inserir romaneios de ferragem com seu próprio ID
--    (corrige o erro "new row violates row-level security policy")
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'carretas_romaneios'
          AND policyname = 'motorista_insert_romaneio_ferragem'
    ) THEN
        EXECUTE '
            CREATE POLICY "motorista_insert_romaneio_ferragem"
            ON carretas_romaneios
            FOR INSERT
            TO authenticated
            WITH CHECK (
                motorista_id = auth.uid()
                AND tipo_carga = ''ferragem''
            )
        ';
    END IF;
END $$;

-- 5. RLS: motoristas leem apenas seus próprios romaneios
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'carretas_romaneios'
          AND policyname = 'motorista_select_proprio_romaneio'
    ) THEN
        EXECUTE '
            CREATE POLICY "motorista_select_proprio_romaneio"
            ON carretas_romaneios
            FOR SELECT
            TO authenticated
            USING (motorista_id = auth.uid())
        ';
    END IF;
END $$;
