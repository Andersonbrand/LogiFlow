-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Múltiplas fotos no checklist + categorias de despesa customizadas
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Adiciona coluna de múltiplas fotos no checklist
--    (mantém foto_url para compatibilidade com registros antigos)
ALTER TABLE carretas_checklists
    ADD COLUMN IF NOT EXISTS fotos_urls jsonb DEFAULT '[]'::jsonb;

-- 2. Tabela de categorias de despesa customizadas (admin pode criar novas)
CREATE TABLE IF NOT EXISTS carretas_categorias_despesa (
    id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nome       text NOT NULL UNIQUE,
    ativo      boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Insere as categorias padrão (ignora se já existirem)
INSERT INTO carretas_categorias_despesa (nome) VALUES
    ('Pneus'), ('Peças'), ('Acessórios'), ('Oficina / Mão de obra'),
    ('Depreciação'), ('Seguro'), ('IPVA / Licenciamento'), ('Lavagem'), ('Outros')
ON CONFLICT (nome) DO NOTHING;

-- RLS categorias
ALTER TABLE carretas_categorias_despesa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categorias_select_all"   ON carretas_categorias_despesa FOR SELECT USING (true);
CREATE POLICY "categorias_insert_admin" ON carretas_categorias_despesa FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
);
CREATE POLICY "categorias_delete_admin" ON carretas_categorias_despesa FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_categorias_nome ON carretas_categorias_despesa (nome);
