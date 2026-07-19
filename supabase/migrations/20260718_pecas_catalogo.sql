-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Catálogo de Peças (para solicitação de peças nas OS)
--
-- O mecânico passa a escolher a peça em um select (em vez de texto livre),
-- alimentado por este catálogo. O admin cadastra, edita e exclui itens.
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS carretas_pecas_catalogo (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nome        text NOT NULL,
    categoria   text NOT NULL DEFAULT 'Ambos' CHECK (categoria IN ('Caminhão','Carreta','Ambos')),
    ativo       boolean DEFAULT true,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pecas_catalogo_categoria ON carretas_pecas_catalogo (categoria);

ALTER TABLE carretas_pecas_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pecas_catalogo_select_all" ON carretas_pecas_catalogo
    FOR SELECT USING (true);

CREATE POLICY "pecas_catalogo_write_admin" ON carretas_pecas_catalogo
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
    );

-- Seed inicial com itens comuns (só insere se a tabela estiver vazia)
INSERT INTO carretas_pecas_catalogo (nome, categoria)
SELECT * FROM (VALUES
    ('Pastilha de freio dianteira', 'Ambos'),
    ('Pastilha de freio traseira', 'Ambos'),
    ('Lona de freio', 'Ambos'),
    ('Filtro de óleo', 'Ambos'),
    ('Filtro de ar', 'Ambos'),
    ('Filtro de combustível', 'Ambos'),
    ('Óleo de motor', 'Caminhão'),
    ('Óleo de câmbio/diferencial', 'Ambos'),
    ('Pneu recapado', 'Ambos'),
    ('Câmara de ar', 'Ambos'),
    ('Amortecedor', 'Ambos'),
    ('Mola feixe', 'Ambos'),
    ('Rolamento de roda', 'Ambos'),
    ('Lâmpada / lanterna', 'Ambos'),
    ('Bateria', 'Caminhão'),
    ('Correia', 'Caminhão'),
    ('Disco de freio', 'Ambos'),
    ('Cabo de embreagem', 'Caminhão'),
    ('Retentor', 'Ambos'),
    ('Terminal de direção', 'Caminhão')
) AS seed(nome, categoria)
WHERE NOT EXISTS (SELECT 1 FROM carretas_pecas_catalogo);

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT * FROM carretas_pecas_catalogo ORDER BY categoria, nome;
