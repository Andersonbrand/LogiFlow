-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Pontos de Parada do Carreteiro
-- Registra horários de saída e chegada em locais (fábrica, estoque, entrega)
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS carretas_pontos_parada (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    motorista_id    uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
    veiculo_id      uuid REFERENCES carretas_veiculos(id) ON DELETE SET NULL,

    -- Local e tipo
    local           text NOT NULL,                          -- texto livre: "Fábrica Cachoeirinha", "Estoque Bahia", etc.
    tipo_local      text DEFAULT 'Outro'
                    CHECK (tipo_local IN ('Fábrica','Estoque','Entrega','Posto','Oficina','Outro')),

    -- Saída
    data_saida      date NOT NULL,
    horario_saida   time,
    km_saida        numeric(10,1),

    -- Chegada
    data_chegada    date,
    horario_chegada time,
    km_chegada      numeric(10,1),

    -- Cupom fiscal / NF
    cupom_fiscal    text,

    -- Observações livres
    observacoes     text,

    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pp_motorista ON carretas_pontos_parada (motorista_id);
CREATE INDEX IF NOT EXISTS idx_pp_data      ON carretas_pontos_parada (data_saida DESC);

-- RLS
ALTER TABLE carretas_pontos_parada ENABLE ROW LEVEL SECURITY;

-- Motorista vê e gerencia apenas os seus próprios registros
CREATE POLICY "pp_select_own" ON carretas_pontos_parada
    FOR SELECT USING (motorista_id = auth.uid());

CREATE POLICY "pp_insert_own" ON carretas_pontos_parada
    FOR INSERT WITH CHECK (motorista_id = auth.uid());

CREATE POLICY "pp_update_own" ON carretas_pontos_parada
    FOR UPDATE USING (motorista_id = auth.uid());

CREATE POLICY "pp_delete_own" ON carretas_pontos_parada
    FOR DELETE USING (motorista_id = auth.uid());

-- Admin/master pode ver todos os registros
CREATE POLICY "pp_select_admin" ON carretas_pontos_parada
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('admin','master','operador')
        )
    );
