-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Cadastro de Fornecedores (Carretas, Caminhões e Despesas Adm.)
-- Execute no Supabase SQL Editor
--
-- As telas de Despesas já chamavam fetchFornecedores*/createFornecedor* mas as
-- tabelas nunca foram criadas — por isso o cadastro sempre aparecia vazio e
-- salvar gerava erro. Esta migration cria as 3 tabelas usadas pelos módulos.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS carretas_fornecedores (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome         text NOT NULL,
    cnpj         text,
    telefone     text,
    email        text,
    endereco     text,
    categoria    text,
    observacoes  text,
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_carretas_fornecedores_nome ON carretas_fornecedores (nome);

CREATE TABLE IF NOT EXISTS caminhoes_fornecedores (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome         text NOT NULL,
    cnpj         text,
    telefone     text,
    email        text,
    endereco     text,
    categoria    text,
    observacoes  text,
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_caminhoes_fornecedores_nome ON caminhoes_fornecedores (nome);

CREATE TABLE IF NOT EXISTS despesas_adm_fornecedores (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome         text NOT NULL,
    cnpj         text,
    telefone     text,
    email        text,
    endereco     text,
    categoria    text,
    observacoes  text,
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_despesas_adm_fornecedores_nome ON despesas_adm_fornecedores (nome);

-- ── Centro de custo no registro de despesa administrativa ────────────────────
ALTER TABLE transporte_despesas_adm ADD COLUMN IF NOT EXISTS centro_custo text;

-- ── RLS — leitura para autenticados, escrita para admins ─────────────────────
ALTER TABLE carretas_fornecedores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE caminhoes_fornecedores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_adm_fornecedores  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carretas_fornecedores_select ON carretas_fornecedores;
CREATE POLICY carretas_fornecedores_select ON carretas_fornecedores FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS carretas_fornecedores_write ON carretas_fornecedores;
CREATE POLICY carretas_fornecedores_write ON carretas_fornecedores FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS caminhoes_fornecedores_select ON caminhoes_fornecedores;
CREATE POLICY caminhoes_fornecedores_select ON caminhoes_fornecedores FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS caminhoes_fornecedores_write ON caminhoes_fornecedores;
CREATE POLICY caminhoes_fornecedores_write ON caminhoes_fornecedores FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS despesas_adm_fornecedores_select ON despesas_adm_fornecedores;
CREATE POLICY despesas_adm_fornecedores_select ON despesas_adm_fornecedores FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS despesas_adm_fornecedores_write ON despesas_adm_fornecedores;
CREATE POLICY despesas_adm_fornecedores_write ON despesas_adm_fornecedores FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
