-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Correção de diaria_criada_em desatualizada
-- Execute no Supabase SQL Editor
--
-- A migration anterior (20260817_romaneio_diaria_criada_em.sql) só
-- preenchia diaria_criada_em onde ele estava NULL. Só que a coluna já
-- existia de uma tentativa mais antiga (sessão 04/08) e já tinha sido
-- preenchida à força com created_at, antes da data de saída (saida) ter
-- sido definida. Resultado: romaneios como o ROM-022, cuja saída só foi
-- preenchida depois (18/08), continuaram presos na data de criação (30/07)
-- porque o "WHERE diaria_criada_em IS NULL" pulava essas linhas.
--
-- Esta migration reseta e recalcula diaria_criada_em para TODOS os
-- romaneios com diária lançada, usando os valores atuais de saida/created_at
-- — uma correção pontual e única. Dali em diante, o próprio app
-- (createRomaneio/updateRomaneio) mantém a coluna corretamente a cada
-- lançamento ou edição de diária, então não é preciso repetir isso de novo.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE romaneios
SET diaria_criada_em = COALESCE(saida::timestamptz, created_at)
WHERE COALESCE(custo_motorista, 0) > 0;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT numero, custo_motorista, saida, created_at, diaria_criada_em FROM romaneios WHERE custo_motorista > 0 ORDER BY created_at DESC LIMIT 20;
