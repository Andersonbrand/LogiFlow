-- =====================================================================
-- MIGRAÇÃO: Módulo Transporte - Carretas
-- Execute no Supabase SQL Editor
-- =====================================================================

-- 1. Adicionar campo tipo_veiculo na tabela user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS tipo_veiculo TEXT DEFAULT 'caminhao'
CHECK (tipo_veiculo IN ('caminhao', 'carreta'));

-- 2. Empresas vinculadas ao frete
CREATE TABLE IF NOT EXISTS carretas_empresas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL,
    cnpj        TEXT,
    observacoes TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO carretas_empresas (nome) VALUES
    ('Comercial Araguaia'),
    ('Confiança Indústria'),
    ('Aços Confiança')
ON CONFLICT DO NOTHING;

-- 3. Veículos (carretas)
CREATE TABLE IF NOT EXISTS carretas_veiculos (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placa                  TEXT NOT NULL UNIQUE,
    marca                  TEXT NOT NULL,
    modelo                 TEXT NOT NULL,
    ano_fabricacao         INTEGER,
    tipo_composicao        TEXT DEFAULT 'Cavalo + Carreta'
                           CHECK (tipo_composicao IN ('Cavalo + Carreta','Truck','Toco','Bitrem','Outro')),
    capacidade_carga       NUMERIC(10,2),  -- toneladas
    media_consumo          NUMERIC(5,2),   -- km/l
    capacidade_tanque      NUMERIC(8,2),   -- litros
    ativo                  BOOLEAN DEFAULT TRUE,
    observacoes            TEXT,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Viagens
CREATE TABLE IF NOT EXISTS carretas_viagens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero        TEXT NOT NULL UNIQUE,
    status        TEXT DEFAULT 'Agendado'
                  CHECK (status IN ('Agendado','Em processamento','Aguardando no pátio','Em trânsito','Entrega finalizada','Cancelado')),
    motorista_id  UUID REFERENCES user_profiles(id),
    veiculo_id    UUID REFERENCES carretas_veiculos(id),
    data_saida    DATE,
    destino       TEXT,
    responsavel_cadastro TEXT,
    observacoes   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Abastecimentos
CREATE TABLE IF NOT EXISTS carretas_abastecimentos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motorista_id        UUID REFERENCES user_profiles(id),
    veiculo_id          UUID REFERENCES carretas_veiculos(id),
    data_abastecimento  DATE NOT NULL,
    horario             TIME,
    posto               TEXT,
    litros_diesel       NUMERIC(10,2) DEFAULT 0,
    valor_diesel        NUMERIC(10,2) DEFAULT 0,
    litros_arla         NUMERIC(10,2) DEFAULT 0,
    valor_arla          NUMERIC(10,2) DEFAULT 0,
    valor_total         NUMERIC(10,2) GENERATED ALWAYS AS (valor_diesel + valor_arla) STORED,
    observacoes         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Checklists semanais
CREATE TABLE IF NOT EXISTS carretas_checklists (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motorista_id          UUID REFERENCES user_profiles(id),
    veiculo_id            UUID REFERENCES carretas_veiculos(id),
    semana_ref            DATE NOT NULL,   -- primeira segunda da semana
    itens                 JSONB DEFAULT '{}',  -- { pneus: true, iluminacao: false, ... }
    problemas             TEXT,
    necessidades          TEXT,
    observacoes_livres    TEXT,
    aprovado              BOOLEAN DEFAULT FALSE,
    aprovado_por          UUID REFERENCES user_profiles(id),
    aprovado_em           TIMESTAMPTZ,
    manutencao_registrada BOOLEAN DEFAULT FALSE,
    obs_manutencao        TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Carregamentos e Fretes
CREATE TABLE IF NOT EXISTS carretas_carregamentos (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motorista_id           UUID REFERENCES user_profiles(id),
    veiculo_id             UUID REFERENCES carretas_veiculos(id),
    empresa_id             UUID REFERENCES carretas_empresas(id),
    data_carregamento      DATE NOT NULL,
    numero_pedido          TEXT,
    destino                TEXT NOT NULL,
    quantidade             NUMERIC(12,3),
    unidade_quantidade     TEXT DEFAULT 'saca'
                           CHECK (unidade_quantidade IN ('saca','tonelada','carga')),
    empresa_origem         TEXT,
    tipo_calculo_frete     TEXT DEFAULT 'por_saca'
                           CHECK (tipo_calculo_frete IN ('percentual','por_saca','por_tonelada','por_carga')),
    valor_base_frete       NUMERIC(12,2),
    valor_frete_calculado  NUMERIC(12,2),
    observacoes            TEXT,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS: permitir acesso autenticado ─────────────────────────────────────────
ALTER TABLE carretas_empresas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE carretas_veiculos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE carretas_viagens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE carretas_abastecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE carretas_checklists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE carretas_carregamentos ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados podem ler tudo
CREATE POLICY IF NOT EXISTS "auth_read_empresas"      ON carretas_empresas      FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_read_veiculos"      ON carretas_veiculos      FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_read_viagens"       ON carretas_viagens       FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_read_abastecimentos" ON carretas_abastecimentos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_read_checklists"    ON carretas_checklists    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_read_carregamentos" ON carretas_carregamentos FOR SELECT USING (auth.role() = 'authenticated');

-- Políticas: usuários autenticados podem inserir/atualizar/deletar
CREATE POLICY IF NOT EXISTS "auth_write_empresas"      ON carretas_empresas      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_write_veiculos"      ON carretas_veiculos      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_write_viagens"       ON carretas_viagens       FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_write_abastecimentos" ON carretas_abastecimentos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_write_checklists"    ON carretas_checklists    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_write_carregamentos" ON carretas_carregamentos FOR ALL USING (auth.role() = 'authenticated');
