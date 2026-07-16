-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Estrutura da Diária do Motorista dentro do Romaneio (Caminhões)
-- Execute no Supabase SQL Editor
--
-- O código do app (painel do motorista, impressão/exportação de diária) já
-- fazia referência às colunas `dias_diaria` e `valor_diaria_dia` da tabela
-- `romaneios`, mas elas nunca chegaram a ser criadas por nenhuma migração.
-- Isso fazia o SELECT que busca "Diárias via Romaneios" falhar silenciosamente
-- (coluna inexistente) e o painel do motorista sempre mostrar "Nenhum
-- romaneio com diária no período", mesmo quando o romaneio tinha uma diária
-- (custo_motorista) lançada.
--
-- Esta migração cria as colunas que faltavam e adiciona uma descrição/motivo
-- para a diária, permitindo que o romaneio já carregue a estrutura completa
-- (dias, valor por dia e descrição) usada na ficha impressa/exportada —
-- sem precisar de lançamento manual avulso depois.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS dias_diaria integer;

ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS valor_diaria_dia numeric(10,2);

ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS diaria_descricao text;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'romaneios' AND column_name IN ('dias_diaria','valor_diaria_dia','diaria_descricao');
