-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Múltiplas Categorias de Frete por Pedido
-- Execute no Supabase SQL Editor
--
-- Até aqui, cada pedido (romaneio_pedidos) tinha uma única categoria de
-- material (categoria_frete) e o percentual dessa categoria era aplicado
-- sobre o valor_pedido inteiro. Isso impedia pedidos que misturam materiais
-- de categorias diferentes (ex.: Telha 2% + Vergalhão 6% no mesmo pedido).
--
-- `categoria_frete` continua sendo a categoria PRINCIPAL do pedido (mantém
-- compatibilidade com relatórios e bonificação que agrupam por categoria).
-- `categorias_extra` guarda as categorias adicionais, cada uma com sua fatia
-- de valor e percentual próprio: [{ "categoria": "Telhas de Zinco", "valor": 1000 }, ...]
-- `frete_calculado` passa a guardar o total já calculado (principal + extras),
-- evitando que cada tela precise reimplementar essa soma.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE romaneio_pedidos
    ADD COLUMN IF NOT EXISTS categorias_extra jsonb DEFAULT '[]'::jsonb;

ALTER TABLE romaneio_pedidos
    ADD COLUMN IF NOT EXISTS frete_calculado numeric(12,2);

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'romaneio_pedidos' AND column_name IN ('categorias_extra','frete_calculado');
