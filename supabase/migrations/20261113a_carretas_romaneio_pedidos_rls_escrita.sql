-- ═══════════════════════════════════════════════════════════════════════════
-- Carretas → Romaneios: excluir pedido dentro do modal não funcionava.
-- CAUSA: as policies de INSERT/UPDATE/DELETE de carretas_romaneio_pedidos só
-- liberavam role IN ('admin','master','operador'). Para outros perfis (ex.: staff)
-- o DELETE afetava 0 linhas SEM erro, e o pedido "excluído" voltava ao salvar.
-- Mesmo padrão já usado em fix_rls_carretas_romaneios.sql (front restringe por role).
-- Execute no Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE carretas_romaneio_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crom_pedidos_insert" ON carretas_romaneio_pedidos;
DROP POLICY IF EXISTS "crom_pedidos_update" ON carretas_romaneio_pedidos;
DROP POLICY IF EXISTS "crom_pedidos_delete" ON carretas_romaneio_pedidos;

CREATE POLICY "crom_pedidos_insert_auth" ON carretas_romaneio_pedidos
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crom_pedidos_update_auth" ON carretas_romaneio_pedidos
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crom_pedidos_delete_auth" ON carretas_romaneio_pedidos
    FOR DELETE TO authenticated USING (true);

-- Para auditar pedidos duplicados deixados por exclusões que falharam antes desta correção:
-- SELECT romaneio_id, numero_pedido, valor_pedido, count(*) FROM carretas_romaneio_pedidos
-- GROUP BY 1,2,3 HAVING count(*) > 1;
