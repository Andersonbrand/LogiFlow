-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Corrige o CHECK constraint de status da OS
--
-- O app já usa o status 'Rascunho' (gerado automaticamente a partir de um
-- checklist reprovado) desde a migration 20260713_ordens_servico_checklist,
-- mas o CHECK constraint da coluna `status` nunca foi atualizado para aceitar
-- esse valor — por isso o INSERT do rascunho falhava com
-- "violates check constraint carretas_ordens_servico_status_check".
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE carretas_ordens_servico DROP CONSTRAINT IF EXISTS carretas_ordens_servico_status_check;
ALTER TABLE carretas_ordens_servico
    ADD CONSTRAINT carretas_ordens_servico_status_check
    CHECK (status IN ('Rascunho', 'Pendente', 'Em Andamento', 'Problema Reportado', 'Finalizada'));

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'carretas_ordens_servico'::regclass AND contype = 'c';
