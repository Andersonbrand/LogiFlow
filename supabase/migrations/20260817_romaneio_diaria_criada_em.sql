-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — diaria_criada_em em romaneios (mês correto da diária)
-- Execute no Supabase SQL Editor
--
-- Problema: a diária do motorista (custo_motorista) era classificada no mês
-- pela data de saída do romaneio (saida) e, na falta dela, pela data de
-- criação do romaneio (created_at). Um romaneio criado no fim de um mês mas
-- que ainda não teve a saída preenchida (ex.: status "Carregando") cai no
-- mês de criação em vez do mês em que a diária realmente deveria contar.
--
-- Solução: nova coluna `diaria_criada_em`, preenchida automaticamente no
-- momento em que custo_motorista passa de vazio/zero para um valor > 0 (na
-- criação OU numa edição posterior do romaneio) — e nunca mais alterada por
-- edições seguintes, a não ser que a diária seja zerada e relançada. Essa é
-- a data usada para decidir em qual mês a diária aparece.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS diaria_criada_em timestamptz;

-- Backfill: romaneios já existentes com diária lançada (custo_motorista > 0)
-- recebem diaria_criada_em = data de saída (se houver) ou data de criação —
-- preserva o comportamento anterior para o histórico já lançado.
UPDATE romaneios
SET diaria_criada_em = COALESCE(saida::timestamptz, created_at)
WHERE COALESCE(custo_motorista, 0) > 0
  AND diaria_criada_em IS NULL;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT numero, custo_motorista, saida, created_at, diaria_criada_em FROM romaneios WHERE custo_motorista > 0 ORDER BY created_at DESC LIMIT 20;
