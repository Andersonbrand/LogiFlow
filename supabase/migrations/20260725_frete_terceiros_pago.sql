-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Pagamento de Frete de Terceiros
--
-- A aba "Terceiros" (Carretas > Volume) calcula o frete devido a cada
-- carregamento de veículo/motorista terceirizado, mas não havia como marcar
-- esse frete como pago. Adiciona o status de pagamento por registro.
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE carretas_carregamentos
    ADD COLUMN IF NOT EXISTS frete_pago boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS frete_pago_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_carregamentos_frete_pago
    ON carretas_carregamentos (frete_pago);

COMMENT ON COLUMN carretas_carregamentos.frete_pago IS 'Indica se o frete deste carregamento (tipicamente de terceiro) já foi pago ao motorista/transportador.';
COMMENT ON COLUMN carretas_carregamentos.frete_pago_em IS 'Data/hora em que o frete foi marcado como pago.';

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT id, data_carregamento, is_terceiro, valor_frete_calculado, frete_pago, frete_pago_em
-- FROM carretas_carregamentos WHERE is_terceiro = true ORDER BY data_carregamento DESC LIMIT 20;
