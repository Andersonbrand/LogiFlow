-- ═══════════════════════════════════════════════════════════════════════════
-- CORREÇÃO: RLS para motoristas deletarem seus próprios romaneios de ferragem
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Verificar políticas existentes
-- SELECT * FROM pg_policies WHERE tablename = 'carretas_romaneios';

-- Adicionar política de DELETE para motoristas (apenas romaneios de ferragem deles)
DROP POLICY IF EXISTS "motorista_delete_ferragem" ON carretas_romaneios;

CREATE POLICY "motorista_delete_ferragem"
    ON carretas_romaneios
    FOR DELETE
    TO authenticated
    USING (
        motorista_id = auth.uid()
        AND tipo_carga = 'ferragem'
    );

-- Verificar se RLS está habilitado (deve estar)
ALTER TABLE carretas_romaneios ENABLE ROW LEVEL SECURITY;

-- Confirmar criação
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'carretas_romaneios'
ORDER BY policyname;
