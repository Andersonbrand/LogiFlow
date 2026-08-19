-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Pedidos múltiplos no Romaneio de Carretas
-- Execute no Supabase SQL Editor
--
-- Até aqui, o romaneio de Carretas guardava só o valor total da carga e do
-- frete do romaneio inteiro. Para poder usar o MESMO modelo de impressão
-- que já existe para caminhões (agrupado por cidade → empresa → material,
-- com número do pedido / cliente / vendedor / frete por pedido), o romaneio
-- de Carretas precisa da mesma estrutura de "pedidos" que romaneio_pedidos
-- já tem para caminhões — inclusive o mecanismo de categorias_extra, que
-- permite um percentual de frete diferente por material dentro do mesmo
-- pedido (ex.: telhas de zinco com percentual próprio).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS carretas_romaneio_pedidos (
    id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    romaneio_id       uuid NOT NULL REFERENCES carretas_romaneios(id) ON DELETE CASCADE,
    numero_pedido     text,
    cidade_destino    text,
    valor_pedido      numeric(12,2) DEFAULT 0,
    categoria_frete   text,
    categorias_extra  jsonb DEFAULT '[]'::jsonb,
    percentual_frete  numeric(6,4),
    frete_calculado   numeric(12,2),
    empresa           text,
    nome_cliente      text,
    nome_vendedor     text,
    created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crom_pedidos_romaneio ON carretas_romaneio_pedidos (romaneio_id);

ALTER TABLE carretas_romaneio_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crom_pedidos_select" ON carretas_romaneio_pedidos FOR SELECT USING (true);
CREATE POLICY "crom_pedidos_insert" ON carretas_romaneio_pedidos FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master','operador'))
);
CREATE POLICY "crom_pedidos_update" ON carretas_romaneio_pedidos FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master','operador'))
);
CREATE POLICY "crom_pedidos_delete" ON carretas_romaneio_pedidos FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master','operador'))
);

-- carretas_romaneio_itens ganha o vínculo com o pedido e os mesmos campos de
-- telha (corte por metro) que romaneio_itens já tem — necessários pro
-- modelo de impressão exibir peça/metragem de telhas de zinco corretamente.
ALTER TABLE carretas_romaneio_itens ADD COLUMN IF NOT EXISTS pedido_id         uuid REFERENCES carretas_romaneio_pedidos(id) ON DELETE CASCADE;
ALTER TABLE carretas_romaneio_itens ADD COLUMN IF NOT EXISTS peso_unit         numeric(12,3);
ALTER TABLE carretas_romaneio_itens ADD COLUMN IF NOT EXISTS is_telha_zinco    boolean DEFAULT false;
ALTER TABLE carretas_romaneio_itens ADD COLUMN IF NOT EXISTS comprimento_telha numeric(10,3);
ALTER TABLE carretas_romaneio_itens ADD COLUMN IF NOT EXISTS metros_totais     numeric(12,3);

CREATE INDEX IF NOT EXISTS idx_crom_itens_pedido ON carretas_romaneio_itens (pedido_id);

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_romaneio_pedidos';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_romaneio_itens' AND column_name IN ('pedido_id','peso_unit','is_telha_zinco','comprimento_telha','metros_totais');
