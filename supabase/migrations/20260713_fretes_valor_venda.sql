-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Preço de Venda por cidade (Fretes da Frota) para cálculo de margem
-- Execute no Supabase SQL Editor
--
-- Margem de Venda = Preço de Venda − (Custo Médio do Produto + Custo Operacional)
-- Custo Médio do Produto e Custo Operacional são valores globais (rateados por
-- saco) configurados na aba Fretes → Fretes da Frota, salvos em app_settings.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE carretas_fretes
    ADD COLUMN IF NOT EXISTS valor_venda numeric(10,2);

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_fretes' ORDER BY ordinal_position;
