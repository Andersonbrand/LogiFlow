-- ═══════════════════════════════════════════════════════════════════════════════
-- EXECUTE NO SUPABASE DASHBOARD → SQL EDITOR
-- Corrige erro: "update or delete on table romaneio_pedidos violates foreign
-- key constraint romaneio_itens_pedido_id_fkey on table romaneio_itens"
--
-- CAUSA RAIZ:
-- romaneio_itens.pedido_id referencia romaneio_pedidos.id SEM "ON DELETE
-- CASCADE". O app já foi corrigido para apagar romaneio_itens antes de
-- romaneio_pedidos (ordem correta), mas essa migration adiciona uma camada
-- extra de segurança no próprio banco: se qualquer rotina (atual ou futura,
-- via app, script manual, ou Supabase Dashboard) apagar um romaneio_pedido
-- enquanto ainda existem itens vinculados a ele, o banco remove os itens
-- automaticamente em vez de bloquear a operação com erro de FK.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'romaneio_itens'::regclass
      AND contype = 'f'
      AND confrelid = 'romaneio_pedidos'::regclass;

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE romaneio_itens DROP CONSTRAINT %I', fk_name);
    END IF;
END $$;

ALTER TABLE romaneio_itens
    ADD CONSTRAINT romaneio_itens_pedido_id_fkey
    FOREIGN KEY (pedido_id) REFERENCES romaneio_pedidos(id) ON DELETE CASCADE;

-- VERIFICAÇÃO FINAL:
SELECT
    conname AS constraint_name,
    confdeltype AS delete_action  -- 'c' = CASCADE (esperado), 'a' = NO ACTION (antigo/errado)
FROM pg_constraint
WHERE conrelid = 'romaneio_itens'::regclass
  AND contype = 'f'
  AND confrelid = 'romaneio_pedidos'::regclass;
