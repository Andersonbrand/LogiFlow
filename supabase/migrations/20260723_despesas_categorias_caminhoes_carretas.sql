-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Categorias de Despesas de Caminhões e Carretas no banco
-- Execute no Supabase SQL Editor
--
-- Mesmo problema da migração de categorias de Despesas Administrativas:
-- essas categorias também viviam só no localStorage do navegador.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS caminhoes_despesas_categorias (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text        NOT NULL,
  criado_por  uuid        REFERENCES user_profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_caminhoes_despesas_categorias_nome_unico
  ON caminhoes_despesas_categorias (lower(nome));
INSERT INTO caminhoes_despesas_categorias (nome) VALUES
  ('Pneus'), ('Peças'), ('Acessórios'), ('Oficina / Mão de obra'),
  ('Depreciação'), ('Seguro'), ('IPVA / Licenciamento'), ('Lavagem'),
  ('Pedágio'), ('Multas'), ('Combustível extra'), ('Outros')
ON CONFLICT (lower(nome)) DO NOTHING;
ALTER TABLE caminhoes_despesas_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_staff_caminhoes_despesas_categorias" ON caminhoes_despesas_categorias FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','staff','operador')));

CREATE TABLE IF NOT EXISTS carretas_despesas_categorias (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text        NOT NULL,
  criado_por  uuid        REFERENCES user_profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_carretas_despesas_categorias_nome_unico
  ON carretas_despesas_categorias (lower(nome));
-- Semente: reaproveita as categorias que já estão em uso nos registros existentes de carretas,
-- para não perder nada que já foi criado manualmente por vocês antes desta migração.
INSERT INTO carretas_despesas_categorias (nome)
  SELECT DISTINCT categoria FROM carretas_despesas_extras WHERE categoria IS NOT NULL AND categoria <> ''
  ON CONFLICT (lower(nome)) DO NOTHING;
INSERT INTO carretas_despesas_categorias (nome) VALUES
  ('Pneus'), ('Peças'), ('Acessórios'), ('Oficina / Mão de obra'),
  ('Depreciação'), ('Seguro'), ('IPVA / Licenciamento'), ('Lavagem'), ('Outros')
ON CONFLICT (lower(nome)) DO NOTHING;
ALTER TABLE carretas_despesas_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_staff_carretas_despesas_categorias" ON carretas_despesas_categorias FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','staff','operador')));

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT * FROM caminhoes_despesas_categorias ORDER BY nome;
-- SELECT * FROM carretas_despesas_categorias ORDER BY nome;
