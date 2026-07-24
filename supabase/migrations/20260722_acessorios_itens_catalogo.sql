-- ─── Catálogo de Itens de Acessórios ─────────────────────────────────────────
-- Antes os itens selecionáveis (Cinta, Catraca, Colete...) eram uma lista fixa
-- no código. Agora viram um cadastro no banco, editável pelo admin direto na
-- tela de Entregas de Acessórios (criar, editar, excluir/desativar item).
CREATE TABLE IF NOT EXISTS acessorios_itens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text        NOT NULL,
  ativo       boolean     NOT NULL DEFAULT true,
  criado_por  uuid        REFERENCES user_profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_acessorios_itens_nome_unico
  ON acessorios_itens (lower(nome));

-- ─── Seed com a lista que já existia fixa no código ─────────────────────────
INSERT INTO acessorios_itens (nome) VALUES
  ('Cinta'), ('Catraca'), ('Colete'), ('Luva'), ('Produtos de Limpeza'),
  ('Lona'), ('Corda'), ('Extintor'), ('Triângulo'), ('Chave de Roda'),
  ('Macaco'), ('Lanterna'), ('Capacete'), ('Óculos de Proteção'), ('Protetor Auricular')
ON CONFLICT (lower(nome)) DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE acessorios_itens ENABLE ROW LEVEL SECURITY;

-- A tela inteira de Entregas de Acessórios é admin-only (AdminRoute), então
-- só admin/staff precisa ler ou gerenciar este catálogo.
CREATE POLICY "admin_all_acessorios_itens"
  ON acessorios_itens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff')
    )
  );

-- Mantém updated_at em dia
CREATE OR REPLACE FUNCTION set_updated_at_acessorios_itens()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_acessorios_itens_updated_at ON acessorios_itens;
CREATE TRIGGER trg_acessorios_itens_updated_at
  BEFORE UPDATE ON acessorios_itens
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_acessorios_itens();
