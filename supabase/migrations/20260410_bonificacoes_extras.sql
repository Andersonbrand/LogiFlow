-- ─── Tabela de Bonificações Extras ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carretas_bonificacoes_extras (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id uuid        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  valor        numeric(10,2) NOT NULL,
  observacao   text,
  data         date        NOT NULL DEFAULT CURRENT_DATE,
  criado_por   uuid        REFERENCES user_profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE carretas_bonificacoes_extras ENABLE ROW LEVEL SECURITY;

-- Admin/staff podem fazer tudo
CREATE POLICY "admin_all_bonificacoes_extras"
  ON carretas_bonificacoes_extras
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff')
    )
  );

-- Motorista lê apenas os próprios registros
CREATE POLICY "motorista_select_bonificacoes_extras"
  ON carretas_bonificacoes_extras
  FOR SELECT
  USING (motorista_id = auth.uid());
