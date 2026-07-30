-- ═══════════════════════════════════════════════════════════════════════════
-- EXECUTE NO SUPABASE DASHBOARD → SQL EDITOR
--
-- Bug: excluir um "Ponto de Parada" pela tela de Admin (Carretas → Pontos de
-- Parada) mostra mensagem de sucesso, mas o registro continua no banco.
--
-- Causa raiz: a migração original (20260506_pontos_parada.sql) só criou
-- policy de DELETE para o próprio motorista ("pp_delete_own", USING
-- motorista_id = auth.uid()) e de UPDATE também só para o próprio motorista
-- ("pp_update_own"). Não existe policy de DELETE nem de UPDATE para
-- admin/operador — só de SELECT ("pp_select_admin").
--
-- Como o Supabase, quando o RLS bloqueia todas as linhas de um DELETE/UPDATE,
-- não retorna erro (apenas afeta 0 linhas), o front-end recebia sucesso
-- mesmo sem nada ter sido de fato excluído/alterado.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "pp_delete_admin" ON carretas_pontos_parada;
CREATE POLICY "pp_delete_admin" ON carretas_pontos_parada
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'master', 'operador')
        )
    );

DROP POLICY IF EXISTS "pp_update_admin" ON carretas_pontos_parada;
CREATE POLICY "pp_update_admin" ON carretas_pontos_parada
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'master', 'operador')
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'master', 'operador')
        )
    );

-- ── VERIFICAÇÃO ───────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'carretas_pontos_parada'
ORDER BY cmd, policyname;
