-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Seed inicial de Custos de Rodagem (carretas)
-- Baseado na planilha 'Informações para análise de frete' (Comercial Araguaia)
-- Execute após 20260701_custos_rodagem.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Itens de custo por KM rodado (carretas) ──────────────────────────────────
INSERT INTO custos_itens (tipo_veiculo, categoria, nome, preco_unidade, km_vida_util, unidades_por_veiculo, ordem) VALUES
    ('carreta', 'km', 'Pneus - Cavalo', 3589.00, 140000, 6, 1),
    ('carreta', 'km', 'Pneus - Implemento', 2005.00, 100000, 24, 2),
    ('carreta', 'km', 'Troca de Óleo Motor / Direção', 2850.00, 33000, 1, 3),
    ('carreta', 'km', 'Troca de Óleo Caixa / Diferencial', 6800.00, 110000, 1, 4)
ON CONFLICT DO NOTHING;

-- ── Itens de custo por dia (carretas) — valores médios da frota ──────────────
INSERT INTO custos_itens (tipo_veiculo, categoria, nome, valor_mensal, valor_anual, ordem) VALUES
    ('carreta', 'dia', 'Salários c/ Encargos', 4853.30, NULL, 1),
    ('carreta', 'dia', 'Rastreamento', 110.00, NULL, 2),
    ('carreta', 'dia', 'IPVA', NULL, 5760.70, 3),
    ('carreta', 'dia', 'Seguro', NULL, 15069.55, 4),
    ('carreta', 'dia', 'Manutenção / Oficina', 11686.48, NULL, 5),
    ('carreta', 'dia', 'Depreciação', NULL, 75000.00, 6)
ON CONFLICT DO NOTHING;

-- ── Margem de lucro padrão ────────────────────────────────────────────────────
UPDATE custos_config SET margem_lucro_pct = 20 WHERE tipo_veiculo = 'carreta';

-- ── Destinos — distância e dias de viagem (carretas / cavalo mecânico) ───────
INSERT INTO custos_destinos (tipo_veiculo, destino, distancia_km, dias_viagem) VALUES
('carreta', 'Agrovila 2, 4, 6, 8,9,10,11', 1180, 2.0),
('carreta', 'Agrovilia 14,15,16, Marrequeiro', 1120, 2.0),
('carreta', 'Aracatu', 1096, 3.0),
('carreta', 'Arapiranga, Rio de Contas', 1230, 2.0),
('carreta', 'Bom Jesus da Lapa (Por Matina)', 1046, 2.0),
('carreta', 'Boninal (frete c/ antecedência)', 1630, 2.0),
('carreta', 'Boquira', 1212, 2.0),
('carreta', 'Botuporã', 1004, 2.0),
('carreta', 'Brumado', 1030, 2.0),
('carreta', 'Caculé', 970, 2.0),
('carreta', 'Caetité', 826, 2.0),
('carreta', 'Candiba', 736, 2.0),
('carreta', 'Caraguataí, Jussiape', 1294, 2.0),
('carreta', 'Caraibas de Paramirim', 1134, 2.0),
('carreta', 'Carinhanha', 972, 2.0),
('carreta', 'Caturama', 1064, 2.0),
('carreta', 'Cocôs (Por Feira da mata)', 1160, 2.0),
('carreta', 'Coribe (frete c/ antecedência)', 1402, 2.0),
('carreta', 'Dom Basilio', 1136, 2.0),
('carreta', 'Erico Cardoso', 1122, 2.0),
('carreta', 'Feira da Mata', 1050, 2.0),
('carreta', 'Guajeru', 1062, 2.0),
('carreta', 'Guanambi', 748, 2.0),
('carreta', 'Ibiassucê', 918, 2.0),
('carreta', 'Ibipitanga', 1202, 2.0),
('carreta', 'Ibitiara (frete c/ antecedência)', 1320, 2.0),
('carreta', 'Ibitira', 922, 2.0),
('carreta', 'Ibotirama (frete c/ antecedência)', 1362, 2.0),
('carreta', 'Igaporã', 904, 2.0),
('carreta', 'Iuiú', 948, 2.0),
('carreta', 'Julião', 940, 2.0),
('carreta', 'Jussiape', 1270, 2.0),
('carreta', 'Lagoa Real', 942, 2.0),
('carreta', 'Livramento', 1162, 2.0),
('carreta', 'Macaubas', 1166, 2.0),
('carreta', 'Malhada', 966, 2.0),
('carreta', 'Malhada de Pedra', 1014, 2.0),
('carreta', 'Marcolino Moura, Rio de Contas', 1224, 2.0),
('carreta', 'Matina', 834, 2.0),
('carreta', 'Morpará (frete c/ antecedência)', 1538, 2.0),
('carreta', 'Morrinhos', 806, 2.0),
('carreta', 'Mutans', 804, 2.0),
('carreta', 'Novo Horizonte (frete c/ antecedência)', 1572, 2.0),
('carreta', 'Oliveira dos Brejinhos (frete c/ antecedência)', 1324, 2.0),
('carreta', 'Palmas de M. Alto', 834, 2.0),
('carreta', 'Paramirim', 1088, 2.0),
('carreta', 'Paratinga', 1232, 2.0),
('carreta', 'Pilões', 712, 2.0),
('carreta', 'Pindai', 680, 2.0),
('carreta', 'Presidente Jânio Quadros', 1168, 2.0),
('carreta', 'Riacho de Santana (Por Matina)', 912, 2.0),
('carreta', 'Rio de contas', 1186, 2.0),
('carreta', 'Rio do Antonio', 990, 2.0),
('carreta', 'Rio do Pires', 1128, 2.0),
('carreta', 'Santa Maria da Vitória', 1274, 2.0),
('carreta', 'Seabra (frete c/ antecedência)', 1594, 2.0),
('carreta', 'Sebastião Laranjeiras', 944, 2.0),
('carreta', 'Serra do Ramalho', 1186, 2.0),
('carreta', 'Sitio do Mato', 1184, 2.0),
('carreta', 'Tanque Novo', 964, 2.0),
('carreta', 'Urandi', 616, 2.0),
('carreta', 'Vila Mariana (frete c/ antecedência)', 1132, 2.0),
('carreta', 'Vespaziano (frete c/ antecedência)', 1558, 3.0),
('carreta', 'Barra da Estiva', 1268, 2.0),
('carreta', 'Barreiras', 1808, 2.0),
('carreta', 'Condeúba', 1100, 2.0),
('carreta', 'Ituaçu', 1220, 2.0),
('carreta', 'Maetinga (frete c/ antecedência)', 1214, 2.0),
('carreta', 'Sussuarana', 1130, 2.0),
('carreta', 'Tanhaçu', 1168, 2.0),
('carreta', 'Jacaraci  (entrada de Urandi)', 694, 2.0),
('carreta', 'Licinio de Almeida (entrada de Urandi)', 670, 2.0),
('carreta', 'Mortugaba  (entrada de Urandi)', 742, 2.0),
('carreta', 'Tauape (entrada de Urandi)', 698, 2.0)
ON CONFLICT DO NOTHING;
