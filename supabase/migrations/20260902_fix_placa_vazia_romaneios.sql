-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Corrige romaneios (caminhões) com placa vazia mas vehicle_id preenchido
-- Execute no Supabase SQL Editor
--
-- Causa: vários fluxos gravam vehicle_id sem nunca preencher o texto `placa`
-- (usado direto pelas telas de listagem e do modal de detalhes): rascunho
-- promovido sem veículo escolhido na hora, sugestão automática de veículo
-- aceita depois, etc. Corrigido no código (romaneioService.js — ensurePlaca);
-- esta migration só arruma os registros que já ficaram sem placa até agora.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE romaneios r
SET placa = v.placa
FROM vehicles v
WHERE r.vehicle_id = v.id
  AND (r.placa IS NULL OR r.placa = '')
  AND v.placa IS NOT NULL;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT numero, vehicle_id, placa FROM romaneios WHERE vehicle_id IS NOT NULL AND (placa IS NULL OR placa = '');
