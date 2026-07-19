-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Telhas de zinco: peça + metragem em romaneio_itens
--
-- A tela já calculava peça/comprimento/metros no formulário, mas essas
-- colunas nunca existiram na tabela romaneio_itens — o INSERT descartava
-- silenciosamente esses campos (Supabase ignora chaves que não mapeiam para
-- uma coluna real só quando vêm de PostgREST com esse comportamento; aqui o
-- efeito prático é que a informação nunca chegava a ser gravada). Esta
-- migration cria as colunas que faltavam para que a metragem passe a ser
-- persistida e exibida corretamente em rascunhos, romaneios e no Excel.
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE romaneio_itens
    ADD COLUMN IF NOT EXISTS is_telha_zinco   boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS comprimento_telha numeric(10,2),
    ADD COLUMN IF NOT EXISTS metros_totais     numeric(12,2),
    ADD COLUMN IF NOT EXISTS peso_unit         numeric(12,4);

-- A configuração "esta é uma telha de zinco (corte por metro)" também nunca
-- tinha colunas correspondentes na tabela de materiais — o checkbox na tela
-- de cadastro de materiais não tinha onde gravar o valor.
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS is_telha_zinco  boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS peso_base_metro numeric(10,2);

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'romaneio_itens' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'materials' ORDER BY ordinal_position;
