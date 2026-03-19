-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Romaneios de Carreta
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Tabela principal
CREATE TABLE IF NOT EXISTS carretas_romaneios (
    id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    numero               text NOT NULL UNIQUE,
    status               text NOT NULL DEFAULT 'Aguardando' CHECK (status IN ('Aguardando','Carregando','Em Trânsito','Entrega finalizada','Cancelado')),
    motorista_id         uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
    veiculo_id           uuid REFERENCES carretas_veiculos(id) ON DELETE SET NULL,
    data_saida           date,
    data_chegada         date,
    destino              text,
    toneladas            numeric(10,3),
    empresa              text,
    valor_frete          numeric(12,2) DEFAULT 0,
    tipo_calculo_frete   text DEFAULT 'fixo',   -- 'fixo' | 'por_tonelada' | 'por_km'
    aprovado             boolean DEFAULT false,
    aprovado_por         uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
    aprovado_em          timestamptz,
    observacoes          text,
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now()
);

-- Itens do romaneio (produtos)
CREATE TABLE IF NOT EXISTS carretas_romaneio_itens (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    romaneio_id  uuid NOT NULL REFERENCES carretas_romaneios(id) ON DELETE CASCADE,
    material_id  uuid REFERENCES materials(id) ON DELETE SET NULL,
    descricao    text,              -- fallback se material_id for null
    quantidade   numeric(12,3) NOT NULL DEFAULT 1,
    unidade      text DEFAULT 'ton',
    peso_total   numeric(12,3),
    observacoes  text,
    created_at   timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_crom_motorista  ON carretas_romaneios (motorista_id);
CREATE INDEX IF NOT EXISTS idx_crom_veiculo    ON carretas_romaneios (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_crom_status     ON carretas_romaneios (status);
CREATE INDEX IF NOT EXISTS idx_crom_data       ON carretas_romaneios (data_saida);
CREATE INDEX IF NOT EXISTS idx_crom_itens_rom  ON carretas_romaneio_itens (romaneio_id);

-- RLS
ALTER TABLE carretas_romaneios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE carretas_romaneio_itens  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crom_select_all"    ON carretas_romaneios FOR SELECT USING (true);
CREATE POLICY "crom_insert_admin"  ON carretas_romaneios FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master','operador'))
);
CREATE POLICY "crom_update_admin"  ON carretas_romaneios FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master','operador'))
);
CREATE POLICY "crom_delete_admin"  ON carretas_romaneios FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
);

CREATE POLICY "crom_itens_select"  ON carretas_romaneio_itens FOR SELECT USING (true);
CREATE POLICY "crom_itens_insert"  ON carretas_romaneio_itens FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master','operador'))
);
CREATE POLICY "crom_itens_update"  ON carretas_romaneio_itens FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master','operador'))
);
CREATE POLICY "crom_itens_delete"  ON carretas_romaneio_itens FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
);
