-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Vínculo entre Checklist e Ordem de Serviço (OS)
-- Execute no Supabase SQL Editor
--
-- Quando o admin registra "Manutenção" em um checklist, o sistema passa a
-- criar automaticamente um RASCUNHO de OS vinculado a esse checklist, para
-- que o admin confira, complete (mecânico, prioridade, PDF) e envie a OS.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Vínculo da OS com o checklist que a originou (nulo para OS criadas manualmente)
ALTER TABLE carretas_ordens_servico
    ADD COLUMN IF NOT EXISTS checklist_id uuid REFERENCES carretas_checklists(id) ON DELETE SET NULL;

-- 2. Quem criou a OS (admin) — útil para rastrear rascunhos gerados automaticamente
ALTER TABLE carretas_ordens_servico
    ADD COLUMN IF NOT EXISTS criada_por uuid REFERENCES user_profiles(id) ON DELETE SET NULL;

-- 3. Índice para consultar rapidamente a(s) OS geradas por um checklist
CREATE INDEX IF NOT EXISTS idx_os_checklist_id ON carretas_ordens_servico (checklist_id);

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_ordens_servico' ORDER BY ordinal_position;
