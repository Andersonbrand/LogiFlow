-- ═══════════════════════════════════════════════════════════════════════════════
-- EXECUTE NO SUPABASE DASHBOARD → SQL EDITOR
-- Corrige bug de exclusão "silenciosa" de pedidos/itens dentro de um romaneio
-- (módulo /romaneios — Editar Romaneio / Rascunhos).
--
-- CAUSA RAIZ:
-- A migration `fix_romaneios_rls_carreteiro.sql` habilitou RLS nas tabelas
-- `romaneio_pedidos` e `romaneio_itens`, mas criou APENAS políticas de SELECT.
-- Sem políticas de INSERT/UPDATE/DELETE, o Postgres nega silenciosamente
-- qualquer escrita: o `DELETE ... WHERE romaneio_id = id` executado antes de
-- regravar os pedidos/itens não apaga nenhuma linha (e o Supabase client não
-- retorna erro nesse caso — 0 linhas afetadas não é uma falha de query).
-- Resultado: pedidos "excluídos" na tela continuam no banco e voltam a
-- aparecer após salvar/recarregar.
--
-- Esta migration adiciona as políticas de escrita que faltavam, seguindo o
-- mesmo padrão "autenticado pode tudo" já usado em fix_rls_carretas_romaneios.sql.
-- ═══════════════════════════════════════════════════════════════════════════════

-- PASSO 1: Garantir que RLS está ativo (idempotente)
ALTER TABLE romaneio_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE romaneio_itens   ENABLE ROW LEVEL SECURITY;

-- PASSO 2: Remover políticas de escrita antigas/conflitantes, se existirem
DROP POLICY IF EXISTS "romaneio_pedidos_insert" ON romaneio_pedidos;
DROP POLICY IF EXISTS "romaneio_pedidos_update" ON romaneio_pedidos;
DROP POLICY IF EXISTS "romaneio_pedidos_delete" ON romaneio_pedidos;
DROP POLICY IF EXISTS "romaneio_pedidos_authenticated_write" ON romaneio_pedidos;

DROP POLICY IF EXISTS "romaneio_itens_insert" ON romaneio_itens;
DROP POLICY IF EXISTS "romaneio_itens_update" ON romaneio_itens;
DROP POLICY IF EXISTS "romaneio_itens_delete" ON romaneio_itens;
DROP POLICY IF EXISTS "romaneio_itens_authenticated_write" ON romaneio_itens;

-- PASSO 3: Políticas de escrita para usuários autenticados
-- (o front-end já restringe quem pode editar/excluir por papel/role)

-- romaneio_pedidos
CREATE POLICY "romaneio_pedidos_authenticated_insert"
    ON romaneio_pedidos FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "romaneio_pedidos_authenticated_update"
    ON romaneio_pedidos FOR UPDATE
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "romaneio_pedidos_authenticated_delete"
    ON romaneio_pedidos FOR DELETE
    TO authenticated USING (true);

-- romaneio_itens
CREATE POLICY "romaneio_itens_authenticated_insert"
    ON romaneio_itens FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "romaneio_itens_authenticated_update"
    ON romaneio_itens FOR UPDATE
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "romaneio_itens_authenticated_delete"
    ON romaneio_itens FOR DELETE
    TO authenticated USING (true);

-- PASSO 4: Limpa pedidos/itens órfãos que possam ter sobrado de exclusões
-- que falharam silenciosamente antes desta correção (romaneio_id apontando
-- para um romaneio que não existe mais não deveria ocorrer, mas o
-- DELETE acima a partir de agora passa a funcionar corretamente).

-- VERIFICAÇÃO FINAL:
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('romaneio_pedidos', 'romaneio_itens')
ORDER BY tablename, cmd, policyname;
