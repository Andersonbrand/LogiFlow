-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Cadastro de Fornecedores único e global
--
-- Hoje existem 3 tabelas separadas (carretas_fornecedores,
-- caminhoes_fornecedores, despesas_adm_fornecedores), uma para cada tela de
-- despesas. Isso faz com que um fornecedor cadastrado em Carretas não
-- apareça em Caminhões nem em Despesas Administrativas.
--
-- Esta migration cria uma tabela única "fornecedores", migra (com
-- deduplicação por CNPJ/nome) os registros das 3 tabelas antigas para ela,
-- e mantém as tabelas antigas intactas (não são apagadas, apenas deixam de
-- ser usadas pelo app) — assim nada quebra caso algum relatório antigo
-- ainda aponte pra elas.
-- Execute no Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fornecedores (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome         text NOT NULL,
    cnpj         text,
    telefone     text,
    email        text,
    endereco     text,
    categoria    text,
    observacoes  text,
    origem       text,             -- de onde veio na migração: 'carretas' | 'caminhoes' | 'despesas_adm' | null (novo cadastro)
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fornecedores_nome ON fornecedores (nome);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedores_cnpj_unico
    ON fornecedores (cnpj) WHERE cnpj IS NOT NULL AND cnpj <> '';

-- ── Migra dados existentes, evitando duplicar por CNPJ (quando preenchido) ───
INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco, categoria, observacoes, origem, created_at)
SELECT nome, NULLIF(cnpj, ''), telefone, email, endereco, categoria, observacoes, 'carretas', created_at
FROM carretas_fornecedores
ON CONFLICT (cnpj) WHERE cnpj IS NOT NULL AND cnpj <> '' DO NOTHING;

INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco, categoria, observacoes, origem, created_at)
SELECT nome, NULLIF(cnpj, ''), telefone, email, endereco, categoria, observacoes, 'caminhoes', created_at
FROM caminhoes_fornecedores
ON CONFLICT (cnpj) WHERE cnpj IS NOT NULL AND cnpj <> '' DO NOTHING;

INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco, categoria, observacoes, origem, created_at)
SELECT nome, NULLIF(cnpj, ''), telefone, email, endereco, categoria, observacoes, 'despesas_adm', created_at
FROM despesas_adm_fornecedores
ON CONFLICT (cnpj) WHERE cnpj IS NOT NULL AND cnpj <> '' DO NOTHING;

-- Fornecedores sem CNPJ não caem no ON CONFLICT acima (índice parcial), então
-- removemos duplicados exatos por nome (mantendo o mais antigo) à parte:
DELETE FROM fornecedores a USING fornecedores b
WHERE a.id <> b.id
  AND (a.cnpj IS NULL OR a.cnpj = '')
  AND (b.cnpj IS NULL OR b.cnpj = '')
  AND lower(trim(a.nome)) = lower(trim(b.nome))
  AND a.created_at > b.created_at;

-- ── RLS — leitura para autenticados, escrita para admins ─────────────────────
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fornecedores_select ON fornecedores;
CREATE POLICY fornecedores_select ON fornecedores FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS fornecedores_write ON fornecedores;
CREATE POLICY fornecedores_write ON fornecedores FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Verificação:
-- SELECT origem, count(*) FROM fornecedores GROUP BY origem;
