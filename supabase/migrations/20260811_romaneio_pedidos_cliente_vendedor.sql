-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Cliente e Vendedor por Pedido (Rascunhos / Romaneios)
-- Execute no Supabase SQL Editor
--
-- Cada pedido (romaneio_pedidos) já guarda numero_pedido, valor_pedido,
-- cidade_destino, etc. Este migration adiciona o nome do cliente e o nome
-- do vendedor que constam no pedido, para que fiquem salvos junto com o
-- rascunho/romaneio (igual às demais informações) e possam ser usados no
-- relatório de exportação por vendedor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE romaneio_pedidos
    ADD COLUMN IF NOT EXISTS nome_cliente text;

ALTER TABLE romaneio_pedidos
    ADD COLUMN IF NOT EXISTS nome_vendedor text;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'romaneio_pedidos' AND column_name IN ('nome_cliente','nome_vendedor');
