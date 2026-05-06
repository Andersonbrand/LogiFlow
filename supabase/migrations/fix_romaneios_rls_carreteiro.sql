-- ═══════════════════════════════════════════════════════════════════════════════
-- EXECUTE ESTE SQL NO SUPABASE DASHBOARD → SQL EDITOR
-- Corrige as políticas RLS para que carreteiros e admins vejam os romaneios
-- ═══════════════════════════════════════════════════════════════════════════════

-- PASSO 1: Diagnóstico — ver o que existe hoje
-- SELECT tablename, policyname, roles, cmd, qual
-- FROM pg_policies WHERE tablename = 'romaneios';

-- PASSO 2: Apaga políticas antigas que possam estar bloqueando
DROP POLICY IF EXISTS "romaneios_select_admin"      ON romaneios;
DROP POLICY IF EXISTS "romaneios_select_motorista"  ON romaneios;
DROP POLICY IF EXISTS "romaneios_select_carreteiro" ON romaneios;
DROP POLICY IF EXISTS "romaneios_select_all"        ON romaneios;
DROP POLICY IF EXISTS "select_romaneios"            ON romaneios;
DROP POLICY IF EXISTS "Enable read access for all users" ON romaneios;
DROP POLICY IF EXISTS "Usuarios autenticados podem ver romaneios" ON romaneios;

-- PASSO 3: Política ABERTA — todos os usuários autenticados leem romaneios
-- (mais simples e resolve o problema imediatamente)
CREATE POLICY "romaneios_authenticated_read" ON romaneios
FOR SELECT
TO authenticated
USING (true);

-- PASSO 4: Mesma coisa para as tabelas relacionadas
DROP POLICY IF EXISTS "romaneio_pedidos_select" ON romaneio_pedidos;
DROP POLICY IF EXISTS "romaneio_itens_select"   ON romaneio_itens;

CREATE POLICY "romaneio_pedidos_authenticated_read" ON romaneio_pedidos
FOR SELECT TO authenticated USING (true);

CREATE POLICY "romaneio_itens_authenticated_read" ON romaneio_itens
FOR SELECT TO authenticated USING (true);

-- PASSO 5: Confirma que RLS está ativo
ALTER TABLE romaneios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE romaneio_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE romaneio_itens   ENABLE ROW LEVEL SECURITY;

-- VERIFICAÇÃO FINAL:
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('romaneios', 'romaneio_pedidos', 'romaneio_itens')
ORDER BY tablename, policyname;
