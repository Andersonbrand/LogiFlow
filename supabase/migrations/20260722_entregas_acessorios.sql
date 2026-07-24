-- ─── Tabela de Entregas de Acessórios ───────────────────────────────────────
-- Registra itens entregues a motoristas (caminhões e carretas): cintas,
-- catracas, produtos de limpeza, coletes, etc. Vinculado a motorista e placa.
CREATE TABLE IF NOT EXISTS entregas_acessorios (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id  uuid        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  placa         text        NOT NULL,
  item          text        NOT NULL,
  quantidade    integer     NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  data_entrega  date        NOT NULL DEFAULT CURRENT_DATE,
  observacoes   text,
  criado_por    uuid        REFERENCES user_profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entregas_acessorios_motorista ON entregas_acessorios(motorista_id);
CREATE INDEX IF NOT EXISTS idx_entregas_acessorios_data      ON entregas_acessorios(data_entrega);
CREATE INDEX IF NOT EXISTS idx_entregas_acessorios_item      ON entregas_acessorios(item);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE entregas_acessorios ENABLE ROW LEVEL SECURITY;

-- Admin/staff podem fazer tudo
CREATE POLICY "admin_all_entregas_acessorios"
  ON entregas_acessorios
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff')
    )
  );

-- Motorista lê apenas os próprios registros de entrega
CREATE POLICY "motorista_select_entregas_acessorios"
  ON entregas_acessorios
  FOR SELECT
  USING (motorista_id = auth.uid());

-- Mantém updated_at em dia
CREATE OR REPLACE FUNCTION set_updated_at_entregas_acessorios()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entregas_acessorios_updated_at ON entregas_acessorios;
CREATE TRIGGER trg_entregas_acessorios_updated_at
  BEFORE UPDATE ON entregas_acessorios
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_entregas_acessorios();
