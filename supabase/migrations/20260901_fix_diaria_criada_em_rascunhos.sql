-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Correção de diaria_criada_em para romaneios vindos de rascunho
-- Execute no Supabase SQL Editor
--
-- Causa raiz (01/09): createRascunho, updateRascunho e promoverRascunho nunca
-- gravavam diaria_criada_em, mesmo quando custo_motorista era preenchido
-- ainda como rascunho. Resultado: ao promover o rascunho para romaneio
-- oficial, a coluna continuava NULL e a tela de diárias (e o consolidado do
-- mês) caía no fallback (saida, ou created_at do rascunho original) — que
-- normalmente é uma data anterior à data real do lançamento da diária.
-- Exemplo: ROM-037 (motorista Danilo), rascunho criado em 31/08, diária
-- lançada em 01/09, mas exibida/contabilizada em agosto por causa do
-- created_at do rascunho.
--
-- Código corrigido em src/utils/romaneioService.js (createRascunho,
-- updateRascunho, promoverRascunho). Esta migration é só o backfill único
-- dos registros que já ficaram presos com diaria_criada_em NULL.
--
-- Não há como recuperar a data exata do lançamento retroativamente — usa-se
-- created_at como melhor aproximação disponível, mesma abordagem das
-- migrations anteriores de diaria_criada_em.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE romaneios
SET diaria_criada_em = COALESCE(saida::timestamptz, created_at)
WHERE COALESCE(custo_motorista, 0) > 0
  AND diaria_criada_em IS NULL;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT numero, custo_motorista, saida, created_at, diaria_criada_em, is_rascunho
-- FROM romaneios WHERE custo_motorista > 0 ORDER BY created_at DESC LIMIT 20;
