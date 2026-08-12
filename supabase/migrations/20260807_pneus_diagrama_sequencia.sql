-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Pneus: diagrama de posição + numeração sequencial (novo/recapado)
--
-- Adiciona à tela do mecânico (troca de pneu) a possibilidade de:
--  - marcar em qual posição do veículo (diagrama por eixo/lado) o pneu foi
--    instalado, de acordo com a configuração do veículo (2, 3, 4 ou 9 eixos)
--  - identificar se o pneu usado é NOVO ou RECAPADO
--  - gerar automaticamente um número sequencial de rastreio, com contadores
--    separados para novos e recapados (ex.: N-0001, R-0001)
--
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE pneus
    ADD COLUMN IF NOT EXISTS tipo_pneu text CHECK (tipo_pneu IN ('novo', 'recapado'));
ALTER TABLE pneus
    ADD COLUMN IF NOT EXISTS numero_sequencial text;
ALTER TABLE pneus
    ADD COLUMN IF NOT EXISTS posicao_diagrama text;
ALTER TABLE pneus
    ADD COLUMN IF NOT EXISTS configuracao_veiculo text;
ALTER TABLE pneus
    ADD COLUMN IF NOT EXISTS registrado_por uuid REFERENCES user_profiles(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pneus_numero_sequencial ON pneus (numero_sequencial) WHERE numero_sequencial IS NOT NULL;

-- O mecânico passa a poder registrar pneus diretamente (troca de pneu na
-- oficina) — a política original só permitia admin/staff/operador.
DROP POLICY IF EXISTS "admin_staff_pneus" ON pneus;
CREATE POLICY "admin_staff_pneus" ON pneus
    FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'operador', 'mecanico')));

DROP POLICY IF EXISTS "admin_staff_pneus_catalogo" ON pneus_catalogo;
CREATE POLICY "admin_staff_pneus_catalogo" ON pneus_catalogo
    FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'operador', 'mecanico')));


-- Contadores separados para gerar o próximo número (N-0001, N-0002... /
-- R-0001, R-0002...) sem depender de contar linhas da tabela `pneus`
-- (mais seguro contra corrida entre dois cadastros simultâneos).
CREATE TABLE IF NOT EXISTS pneus_contadores (
    tipo_pneu   text PRIMARY KEY CHECK (tipo_pneu IN ('novo', 'recapado')),
    ultimo      integer NOT NULL DEFAULT 0
);
INSERT INTO pneus_contadores (tipo_pneu, ultimo) VALUES ('novo', 0), ('recapado', 0)
ON CONFLICT DO NOTHING;

ALTER TABLE pneus_contadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_staff_pneus_contadores" ON pneus_contadores
    FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'operador', 'mecanico')));

-- Função atômica: incrementa e devolve o próximo número daquele tipo.
CREATE OR REPLACE FUNCTION proximo_numero_pneu(p_tipo text)
RETURNS integer AS $$
DECLARE
    v_num integer;
BEGIN
    UPDATE pneus_contadores SET ultimo = ultimo + 1 WHERE tipo_pneu = p_tipo
    RETURNING ultimo INTO v_num;
    IF v_num IS NULL THEN
        INSERT INTO pneus_contadores (tipo_pneu, ultimo) VALUES (p_tipo, 1)
        ON CONFLICT (tipo_pneu) DO UPDATE SET ultimo = pneus_contadores.ultimo + 1
        RETURNING ultimo INTO v_num;
    END IF;
    RETURN v_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT proximo_numero_pneu('novo');
-- SELECT * FROM pneus_contadores;
-- SELECT numero_sequencial, tipo_pneu, posicao_diagrama, configuracao_veiculo FROM pneus ORDER BY created_at DESC LIMIT 20;
