-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Backfill de placa/modelo em registros de caminhão
-- Execute no Supabase SQL Editor
--
-- Bug: ao editar um Abastecimento, Checklist ou OS já lançado (sem trocar o
-- veículo no formulário), o app comparava o id do veículo selecionado
-- (string) com o id vindo do banco (número) — a comparação sempre falhava,
-- então `veiculo_caminhao_placa`/`veiculo_caminhao_modelo` eram salvos como
-- null, apagando a placa que já estava correta. O bug em si já foi corrigido
-- no código; este script apenas repõe a placa/modelo nos registros que já
-- foram apagados, usando o `veiculo_caminhao_id` (que nunca foi perdido) para
-- buscar de volta em `vehicles`.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE carretas_abastecimentos a
SET veiculo_caminhao_placa = v.placa,
    veiculo_caminhao_modelo = v.modelo
FROM vehicles v
WHERE a.veiculo_caminhao_id = v.id
  AND a.veiculo_caminhao_placa IS NULL;

UPDATE carretas_checklists c
SET veiculo_caminhao_placa = v.placa,
    veiculo_caminhao_modelo = v.modelo
FROM vehicles v
WHERE c.veiculo_caminhao_id = v.id
  AND c.veiculo_caminhao_placa IS NULL;

UPDATE carretas_ordens_servico o
SET veiculo_caminhao_placa = v.placa,
    veiculo_caminhao_modelo = v.modelo
FROM vehicles v
WHERE o.veiculo_caminhao_id = v.id
  AND o.veiculo_caminhao_placa IS NULL;
