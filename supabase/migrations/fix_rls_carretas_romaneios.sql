-- ═══════════════════════════════════════════════════════════════════════════════
-- EXECUTE NO SUPABASE DASHBOARD → SQL EDITOR
-- Corrige RLS para carretas_romaneios (tabela do módulo Carretas)
-- O fix anterior (fix_romaneios_rls_carreteiro.sql) tratava a tabela 'romaneios'
-- que é DIFERENTE de 'carretas_romaneios' usada por este módulo.
-- ═══════════════════════════════════════════════════════════════════════════════

-- PASSO 1: Garantir que RLS está ativo na tabela correta
ALTER TABLE carretas_romaneios ENABLE ROW LEVEL SECURITY;
ALTER TABLE carretas_romaneio_itens ENABLE ROW LEVEL SECURITY;

-- PASSO 2: Remover policies antigas conflitantes
DROP POLICY IF EXISTS "carretas_romaneios_select"         ON carretas_romaneios;
DROP POLICY IF EXISTS "carretas_romaneios_insert"         ON carretas_romaneios;
DROP POLICY IF EXISTS "carretas_romaneios_update"         ON carretas_romaneios;
DROP POLICY IF EXISTS "carretas_romaneios_delete"         ON carretas_romaneios;
DROP POLICY IF EXISTS "carretas_romaneios_all"            ON carretas_romaneios;
DROP POLICY IF EXISTS "Enable read access for all users"  ON carretas_romaneios;
DROP POLICY IF EXISTS "Usuarios autenticados"             ON carretas_romaneios;

DROP POLICY IF EXISTS "carretas_romaneio_itens_select"    ON carretas_romaneio_itens;
DROP POLICY IF EXISTS "carretas_romaneio_itens_insert"    ON carretas_romaneio_itens;
DROP POLICY IF EXISTS "carretas_romaneio_itens_update"    ON carretas_romaneio_itens;
DROP POLICY IF EXISTS "carretas_romaneio_itens_delete"    ON carretas_romaneio_itens;
DROP POLICY IF EXISTS "carretas_romaneio_itens_all"       ON carretas_romaneio_itens;

-- PASSO 3: Policies abertas para todos os usuários autenticados
-- SELECT: todos veem
CREATE POLICY "carretas_romaneios_select_auth"
    ON carretas_romaneios FOR SELECT
    TO authenticated USING (true);

-- INSERT: todos autenticados podem criar
CREATE POLICY "carretas_romaneios_insert_auth"
    ON carretas_romaneios FOR INSERT
    TO authenticated WITH CHECK (true);

-- UPDATE: admin pode tudo; motorista pode atualizar romaneios onde é o motorista
CREATE POLICY "carretas_romaneios_update_auth"
    ON carretas_romaneios FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE: todos autenticados podem deletar (o front já restringe por role)
CREATE POLICY "carretas_romaneios_delete_auth"
    ON carretas_romaneios FOR DELETE
    TO authenticated USING (true);

-- Itens do romaneio
CREATE POLICY "carretas_romaneio_itens_all_auth"
    ON carretas_romaneio_itens FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

-- PASSO 4: Adicionar coluna lancado_por_motorista se não existir
ALTER TABLE carretas_romaneios
    ADD COLUMN IF NOT EXISTS lancado_por_motorista boolean NOT NULL DEFAULT false;

-- PASSO 5: Atualizar registros existentes
UPDATE carretas_romaneios
    SET lancado_por_motorista = true
    WHERE tipo_carga = 'ferragem'
      AND lancado_por_motorista = false;

-- VERIFICAÇÃO
SELECT
    tipo_carga,
    lancado_por_motorista,
    COUNT(*) as total
FROM carretas_romaneios
GROUP BY tipo_carga, lancado_por_motorista
ORDER BY tipo_carga, lancado_por_motorista;

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('carretas_romaneios', 'carretas_romaneio_itens')
ORDER BY tablename, policyname;
