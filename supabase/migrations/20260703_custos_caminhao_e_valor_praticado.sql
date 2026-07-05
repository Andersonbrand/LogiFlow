-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Custos de Rodagem: replicar dados para Caminhões + preencher
-- "Valor Praticado" das Carretas a partir de Ibipitanga
-- Execute no Supabase SQL Editor
--
-- Fonte: aba "Custos de Rodagem" (TabCustos.jsx) já suporta o seletor
-- Carretas/Caminhões (tipoVeiculo), mas só existiam dados de exemplo (seed)
-- para 'carreta'. Este script:
--   1) Replica os Itens de Custo (KM e Dia) de 'carreta' para 'caminhao'
--   2) Replica os Destinos (distância/dias) de 'carreta' para 'caminhao'
--   3) Preenche o Valor Praticado dos destinos de CARRETA a partir da cidade
--      "Ibipitanga" (ordem alfabética), usando a coluna "Valor do Frete
--      9 Eixos (Rotrem)" da aba "Valor do Frete - Estimado" da planilha
--      "Informações para análise de frete.xls".
-- Idempotente: pode ser executado mais de uma vez sem duplicar dados.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Itens de custo (KM e Dia): 'carreta' → 'caminhao' ──────────────────────
INSERT INTO custos_itens (tipo_veiculo, categoria, nome, preco_unidade, km_vida_util, unidades_por_veiculo, valor_mensal, valor_anual, ordem)
SELECT 'caminhao', c.categoria, c.nome, c.preco_unidade, c.km_vida_util, c.unidades_por_veiculo, c.valor_mensal, c.valor_anual, c.ordem
FROM custos_itens c
WHERE c.tipo_veiculo = 'carreta'
  AND NOT EXISTS (
      SELECT 1 FROM custos_itens x
      WHERE x.tipo_veiculo = 'caminhao' AND x.categoria = c.categoria AND x.nome = c.nome
  );

-- ── 2) Destinos (distância/dias de viagem): 'carreta' → 'caminhao' ───────────
-- Observação: o Valor Praticado NÃO é copiado aqui de propósito — a coluna
-- "Valor do Frete 9 Eixos (Rotrem)" da planilha se refere especificamente a
-- carretas (bitrem/rodotrem), não se aplica a caminhões.
INSERT INTO custos_destinos (tipo_veiculo, destino, distancia_km, dias_viagem)
SELECT 'caminhao', c.destino, c.distancia_km, c.dias_viagem
FROM custos_destinos c
WHERE c.tipo_veiculo = 'carreta'
  AND NOT EXISTS (
      SELECT 1 FROM custos_destinos x
      WHERE x.tipo_veiculo = 'caminhao' AND x.destino = c.destino
  );

-- ── 3) Valor Praticado (Carretas) — a partir de Ibipitanga ───────────────────
UPDATE custos_destinos SET valor_praticado = 9946.05, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Ibipitanga';
UPDATE custos_destinos SET valor_praticado = 10849.14, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Ibitiara (frete c/ antecedência)';
UPDATE custos_destinos SET valor_praticado = 7803.12, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Ibitira';
UPDATE custos_destinos SET valor_praticado = 11170.57, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Ibotirama (frete c/ antecedência)';
UPDATE custos_destinos SET valor_praticado = 7665.36, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Igaporã';
UPDATE custos_destinos SET valor_praticado = 10083.81, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Ituaçu';
UPDATE custos_destinos SET valor_praticado = 8002.11, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Iuiú';
UPDATE custos_destinos SET valor_praticado = 6058.17, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Jacaraci  (entrada de Urandi)';
UPDATE custos_destinos SET valor_praticado = 7940.88, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Julião';
UPDATE custos_destinos SET valor_praticado = 10466.47, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Jussiape';
UPDATE custos_destinos SET valor_praticado = 7956.19, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Lagoa Real';
UPDATE custos_destinos SET valor_praticado = 5874.49, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Licinio de Almeida (entrada de Urandi)';
UPDATE custos_destinos SET valor_praticado = 9639.91, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Livramento';
UPDATE custos_destinos SET valor_praticado = 9670.53, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Macaubas';
UPDATE custos_destinos SET valor_praticado = 10037.89, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Maetinga (frete c/ antecedência)';
UPDATE custos_destinos SET valor_praticado = 8139.87, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Malhada';
UPDATE custos_destinos SET valor_praticado = 8507.23, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Malhada de Pedra';
UPDATE custos_destinos SET valor_praticado = 10114.42, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Marcolino Moura, Rio de Contas';
UPDATE custos_destinos SET valor_praticado = 7129.63, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Matina';
UPDATE custos_destinos SET valor_praticado = 12517.56, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Morpará (frete c/ antecedência)';
UPDATE custos_destinos SET valor_praticado = 6915.34, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Morrinhos';
UPDATE custos_destinos SET valor_praticado = 6425.53, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Mortugaba  (entrada de Urandi)';
UPDATE custos_destinos SET valor_praticado = 6900.03, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Mutans';
UPDATE custos_destinos SET valor_praticado = 12777.77, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Novo Horizonte (frete c/ antecedência)';
UPDATE custos_destinos SET valor_praticado = 10879.75, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Oliveira dos Brejinhos (frete c/ antecedência)';
UPDATE custos_destinos SET valor_praticado = 7129.63, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Palmas de M. Alto';
UPDATE custos_destinos SET valor_praticado = 9073.57, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Paramirim';
UPDATE custos_destinos SET valor_praticado = 10175.65, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Paratinga';
UPDATE custos_destinos SET valor_praticado = 6195.93, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Pilões';
UPDATE custos_destinos SET valor_praticado = 5951.02, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Pindai';
UPDATE custos_destinos SET valor_praticado = 9685.83, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Presidente Jânio Quadros';
UPDATE custos_destinos SET valor_praticado = 7726.59, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Riacho de Santana (Por Matina)';
UPDATE custos_destinos SET valor_praticado = 9823.59, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Rio de contas';
UPDATE custos_destinos SET valor_praticado = 8323.55, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Rio do Antonio';
UPDATE custos_destinos SET valor_praticado = 9379.70, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Rio do Pires';
UPDATE custos_destinos SET valor_praticado = 10497.08, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Santa Maria da Vitória';
UPDATE custos_destinos SET valor_praticado = 12946.14, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Seabra (frete c/ antecedência)';
UPDATE custos_destinos SET valor_praticado = 7971.50, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Sebastião Laranjeiras';
UPDATE custos_destinos SET valor_praticado = 9823.59, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Serra do Ramalho';
UPDATE custos_destinos SET valor_praticado = 9808.29, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Sitio do Mato';
UPDATE custos_destinos SET valor_praticado = 9395.01, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Sussuarana';
UPDATE custos_destinos SET valor_praticado = 9685.83, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Tanhaçu';
UPDATE custos_destinos SET valor_praticado = 8124.56, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Tanque Novo';
UPDATE custos_destinos SET valor_praticado = 6088.78, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Tauape (entrada de Urandi)';
UPDATE custos_destinos SET valor_praticado = 5484.17, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Urandi';
UPDATE custos_destinos SET valor_praticado = 12670.62, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Vespaziano (frete c/ antecedência)';
UPDATE custos_destinos SET valor_praticado = 9410.32, updated_at = now() WHERE tipo_veiculo = 'carreta' AND destino = 'Vila Mariana (frete c/ antecedência)';