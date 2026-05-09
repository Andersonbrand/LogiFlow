-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Tabela de fretes por cidade (frota própria e terceiros)
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS carretas_fretes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo            text NOT NULL CHECK (tipo IN ('frota', 'terceiros')),
    cidade          text NOT NULL,
    km              integer,
    frete_por_saco  numeric(10, 2) NOT NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- Índice para filtrar por tipo rapidamente
CREATE INDEX IF NOT EXISTS idx_carretas_fretes_tipo ON carretas_fretes (tipo);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_carretas_fretes_updated_at ON carretas_fretes;
CREATE TRIGGER trg_carretas_fretes_updated_at
    BEFORE UPDATE ON carretas_fretes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: somente usuários autenticados leem; somente admin escreve
ALTER TABLE carretas_fretes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fretes_select" ON carretas_fretes;
CREATE POLICY "fretes_select"
    ON carretas_fretes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fretes_insert" ON carretas_fretes;
CREATE POLICY "fretes_insert"
    ON carretas_fretes FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "fretes_update" ON carretas_fretes;
CREATE POLICY "fretes_update"
    ON carretas_fretes FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "fretes_delete" ON carretas_fretes;
CREATE POLICY "fretes_delete"
    ON carretas_fretes FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Também adicionar coluna veiculo_id ao carregamento de terceiros
-- (para registrar a placa do veículo terceirizado no lançamento)
-- Já existia na tabela, mas caso não exista:
ALTER TABLE carretas_carregamentos
    ADD COLUMN IF NOT EXISTS tipo_calculo_frete text,
    ADD COLUMN IF NOT EXISTS valor_base_frete   numeric(10, 2);
