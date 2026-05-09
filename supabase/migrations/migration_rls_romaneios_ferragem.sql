-- Permite que motoristas autenticados insiram romaneios de ferragem na tabela carretas_romaneios
-- A política limita cada motorista a inserir apenas com seu próprio motorista_id

CREATE POLICY "motorista_insert_romaneio_ferragem"
ON carretas_romaneios
FOR INSERT
TO authenticated
WITH CHECK (
    motorista_id = auth.uid()
    AND tipo_carga = 'ferragem'
);

-- Permite que motoristas leiam apenas seus próprios romaneios
-- (caso ainda não exista uma policy de SELECT para motoristas)
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
