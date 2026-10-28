-- ─── Bônus extras dos motoristas de CAMINHÃO ─────────────────────────────────
-- Mesmo modelo de carretas_bonificacoes_extras (lançamentos avulsos do gestor).
CREATE TABLE IF NOT EXISTS caminhoes_bonificacoes_extras (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id uuid          NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  valor        numeric(10,2) NOT NULL,
  observacao   text,
  data         date          NOT NULL DEFAULT CURRENT_DATE,
  criado_por   uuid          REFERENCES user_profiles(id),
  created_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caminhoes_bonif_extras_motorista_data
  ON caminhoes_bonificacoes_extras (motorista_id, data);

ALTER TABLE caminhoes_bonificacoes_extras ENABLE ROW LEVEL SECURITY;

-- Admin/staff podem tudo
DROP POLICY IF EXISTS "admin_all_caminhoes_bonificacoes_extras" ON caminhoes_bonificacoes_extras;
CREATE POLICY "admin_all_caminhoes_bonificacoes_extras"
  ON caminhoes_bonificacoes_extras FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'master', 'staff')));

-- Operador pode consultar
DROP POLICY IF EXISTS "operador_select_caminhoes_bonificacoes_extras" ON caminhoes_bonificacoes_extras;
CREATE POLICY "operador_select_caminhoes_bonificacoes_extras"
  ON caminhoes_bonificacoes_extras FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'operador'));

-- Motorista lê apenas os próprios lançamentos
DROP POLICY IF EXISTS "motorista_select_caminhoes_bonificacoes_extras" ON caminhoes_bonificacoes_extras;
CREATE POLICY "motorista_select_caminhoes_bonificacoes_extras"
  ON caminhoes_bonificacoes_extras FOR SELECT
  USING (motorista_id = auth.uid());

-- Realtime (tela do motorista atualiza sozinha)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE caminhoes_bonificacoes_extras;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
