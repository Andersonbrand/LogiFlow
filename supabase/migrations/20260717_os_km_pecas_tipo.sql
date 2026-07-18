-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Ordens de Serviço: KM atual, observações, tipo de manutenção
-- e solicitação de peças pelo mecânico (com aprovação do admin)
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. KM atual do veículo, informado pelo admin junto com a abertura da OS
ALTER TABLE carretas_ordens_servico
    ADD COLUMN IF NOT EXISTS km_atual numeric(10,1);

-- 2. Observações do serviço (distinto da descrição do problema/solicitação)
ALTER TABLE carretas_ordens_servico
    ADD COLUMN IF NOT EXISTS observacoes text;

-- 3. Tipo de manutenção
ALTER TABLE carretas_ordens_servico
    ADD COLUMN IF NOT EXISTS tipo_manutencao text
        CHECK (tipo_manutencao IN ('Corretiva','Preventiva'));

-- 4. Peças solicitadas pelo mecânico durante a execução do serviço.
--    Estrutura de cada item (jsonb): { id, item, quantidade, status,
--    observacao_admin, solicitado_em, respondido_em }
--    status: 'Pendente' | 'Aprovado' | 'Reprovado'
ALTER TABLE carretas_ordens_servico
    ADD COLUMN IF NOT EXISTS pecas_solicitadas jsonb DEFAULT '[]'::jsonb;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_ordens_servico' ORDER BY ordinal_position;
