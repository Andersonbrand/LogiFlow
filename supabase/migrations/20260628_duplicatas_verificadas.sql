-- ═══════════════════════════════════════════════════════════════════════════════
-- EXECUTE NO SUPABASE DASHBOARD → SQL EDITOR
-- Cria tabela para armazenar alertas de "possíveis duplicatas" que o admin
-- inspecionou e confirmou que NÃO são duplicatas reais (ex.: dois produtos
-- diferentes carregados com o mesmo número de pedido intencionalmente).
--
-- O campo `assinatura` é uma string derivada dos IDs dos registros envolvidos
-- (ordenados e concatenados) — uma impressão digital do grupo. Se o grupo
-- ainda existir em pesquisas futuras, o sistema consulta esta tabela e omite
-- automaticamente os grupos já verificados.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS duplicatas_verificadas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assinatura      text NOT NULL UNIQUE,  -- IDs dos registros, ordenados e concatenados com ','
    tipo            text,                  -- 'Pedido XXXXX' ou 'NF XXXXX'
    verificado_por  uuid REFERENCES auth.users(id),
    verificado_em   timestamptz NOT NULL DEFAULT now(),
    observacao      text                   -- nota do admin explicando por quê não é duplicata
);

ALTER TABLE duplicatas_verificadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duplicatas_verificadas_select" ON duplicatas_verificadas
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "duplicatas_verificadas_insert" ON duplicatas_verificadas
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "duplicatas_verificadas_delete" ON duplicatas_verificadas
    FOR DELETE TO authenticated USING (true);

-- Índice para lookup rápido por assinatura
CREATE INDEX IF NOT EXISTS idx_duplicatas_verificadas_assinatura
    ON duplicatas_verificadas (assinatura);

-- VERIFICAÇÃO FINAL:
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'duplicatas_verificadas'
ORDER BY ordinal_position;
