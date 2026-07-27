-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Categorias de Despesas Administrativas no banco (não mais localStorage)
-- Execute no Supabase SQL Editor
--
-- As categorias criadas em "Nova Despesa Administrativa" eram guardadas só no
-- localStorage do navegador (chave adm_transporte_categorias_v2). Isso fazia
-- com que uma categoria criada em um computador/navegador não aparecesse em
-- outro, e nem sempre atualizava a tela de ranking/resumo por categoria sem
-- recarregar a página. Esta migração move isso para uma tabela de verdade.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS despesas_adm_categorias (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text        NOT NULL,
  criado_por  uuid        REFERENCES user_profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_despesas_adm_categorias_nome_unico
  ON despesas_adm_categorias (lower(nome));

-- Seed com as categorias padrão que já existiam fixas no código
INSERT INTO despesas_adm_categorias (nome) VALUES
  ('Pneus em Estoque'), ('Materiais de Escritório'), ('Equipamentos e Ferramentas'),
  ('Uniformes / EPIs'), ('Limpeza e Higiene'), ('Informática / Tecnologia'),
  ('Comunicação / Telefonia'), ('Manutenção Predial'), ('Energia Elétrica'),
  ('Água e Saneamento'), ('Aluguel / Locação'), ('Seguros Administrativos'),
  ('Taxas e Impostos'), ('Serviços Terceirizados'), ('Alimentação / Refeições'),
  ('Treinamento / Capacitação'), ('Marketing / Publicidade'), ('Viagens Administrativas'),
  ('Outros')
ON CONFLICT (lower(nome)) DO NOTHING;

ALTER TABLE despesas_adm_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_staff_despesas_adm_categorias"
  ON despesas_adm_categorias
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff', 'operador')
    )
  );

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT * FROM despesas_adm_categorias ORDER BY nome;
