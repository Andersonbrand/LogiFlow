-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Rodízio de Envios de Aço (carretas)
-- Registra cada envio de aço/ferro feito por um motorista da frota própria,
-- para gerar uma fila de prioridade (quem está há mais tempo sem levar aço
-- vai primeiro na próxima venda). Execute no Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS carretas_envios_aco (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    motorista_id    uuid REFERENCES user_profiles(id) ON DELETE CASCADE,

    data_envio      date NOT NULL DEFAULT CURRENT_DATE,
    destino         text,             -- opcional: cidade/cliente da entrega de aço
    observacoes     text,

    registrado_por  uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_envios_aco_motorista ON carretas_envios_aco (motorista_id);
CREATE INDEX IF NOT EXISTS idx_envios_aco_data      ON carretas_envios_aco (data_envio DESC);

-- RLS
ALTER TABLE carretas_envios_aco ENABLE ROW LEVEL SECURITY;

-- Todo usuário autenticado pode ver a fila (é usada para planejar distribuição)
CREATE POLICY "envios_aco_select_all" ON carretas_envios_aco
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Apenas admin/master/operador pode registrar ou remover envios
CREATE POLICY "envios_aco_insert_admin" ON carretas_envios_aco
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master','operador'))
    );

CREATE POLICY "envios_aco_delete_admin" ON carretas_envios_aco
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master','operador'))
    );
