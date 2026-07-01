-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Mecanismo de Custos de Rodagem (caminhões e carretas)
-- Execute no Supabase SQL Editor
--
-- Reproduz a lógica da planilha "Informações para análise de frete":
--   • Itens de custo por KM rodado (pneus, óleo, etc.) → gera um Custo/KM
--   • Itens de custo por dia (salário, IPVA, seguro, manutenção, depreciação,
--     rastreamento) → gera um Custo/Dia
--   • Por destino: Custo Total = distancia_km * custo_km + dias * custo_dia
--     Valor Estimado = Custo Total / (1 - margem_lucro_pct/100)
-- Tudo editável pelo admin, separado por tipo de veículo (caminhao / carreta).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Itens de custo (por KM ou por dia) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custos_itens (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_veiculo        text NOT NULL CHECK (tipo_veiculo IN ('caminhao', 'carreta')),
    categoria           text NOT NULL CHECK (categoria IN ('km', 'dia')),
    -- categoria = 'km' → custo por unidade trocada, rateado pela vida útil em KM
    nome                text NOT NULL,
    preco_unidade       numeric(12,2),   -- ex: preço do jogo de pneus
    km_vida_util        numeric(12,2),   -- ex: km rodados até troca
    unidades_por_veiculo numeric(6,2) DEFAULT 1, -- ex: 6 pneus no cavalo
    -- categoria = 'dia' → custo recorrente, informado como valor mensal ou anual
    valor_mensal        numeric(12,2),
    valor_anual          numeric(12,2),
    ordem               integer DEFAULT 0,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custos_itens_tipo ON custos_itens (tipo_veiculo, categoria);

-- ── Margem de lucro padrão por tipo de veículo ────────────────────────────────
CREATE TABLE IF NOT EXISTS custos_config (
    tipo_veiculo   text PRIMARY KEY CHECK (tipo_veiculo IN ('caminhao', 'carreta')),
    margem_lucro_pct numeric(5,2) NOT NULL DEFAULT 20,
    updated_at     timestamptz DEFAULT now()
);
INSERT INTO custos_config (tipo_veiculo, margem_lucro_pct) VALUES
    ('caminhao', 20), ('carreta', 20)
ON CONFLICT (tipo_veiculo) DO NOTHING;

-- ── Custos por destino (distância, dias de viagem, valor praticado) ──────────
CREATE TABLE IF NOT EXISTS custos_destinos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_veiculo    text NOT NULL CHECK (tipo_veiculo IN ('caminhao', 'carreta')),
    destino         text NOT NULL,
    distancia_km    numeric(10,2) NOT NULL DEFAULT 0,
    dias_viagem     numeric(6,2) NOT NULL DEFAULT 1,
    margem_lucro_pct numeric(5,2), -- se nulo, usa a margem padrão de custos_config
    valor_praticado numeric(12,2), -- valor de frete atualmente cobrado (opcional, para comparação)
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custos_destinos_tipo ON custos_destinos (tipo_veiculo, destino);

-- RLS — leitura liberada a todos autenticados, escrita restrita a admins
ALTER TABLE custos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_destinos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custos_itens_select ON custos_itens;
CREATE POLICY custos_itens_select ON custos_itens FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS custos_itens_write ON custos_itens;
CREATE POLICY custos_itens_write ON custos_itens FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS custos_config_select ON custos_config;
CREATE POLICY custos_config_select ON custos_config FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS custos_config_write ON custos_config;
CREATE POLICY custos_config_write ON custos_config FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS custos_destinos_select ON custos_destinos;
CREATE POLICY custos_destinos_select ON custos_destinos FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS custos_destinos_write ON custos_destinos;
CREATE POLICY custos_destinos_write ON custos_destinos FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
