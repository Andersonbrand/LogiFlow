-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Pontos de Parada: cupom fiscal + tipo de local reformulado
--
-- Reorganiza os tipos de local para: Empresa, Fábrica, Entrega, Posto, Outro.
--   • Empresa -> nomes cadastrados em carretas_empresas
--   • Fábrica  -> catálogo próprio (ex: CSN, Liz), editável pelo admin
--   • Entrega -> cidades cadastradas em carretas_fretes
--   • Posto    -> nomes cadastrados em carretas_postos
--   • Outro    -> catálogo próprio (ex: Oficina), editável pelo admin
--
-- "Fábrica" e "Outro" usam um catálogo simples (carretas_locais_parada) que
-- o admin pode editar/excluir livremente, sem duplicar os cadastros já
-- existentes de Empresas, Postos e Cidades de Frete.
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Cupom fiscal vinculado ao ponto de parada (já existia na tabela — mantém
--    apenas por segurança, caso o ambiente ainda não tenha a coluna).
ALTER TABLE carretas_pontos_parada
    ADD COLUMN IF NOT EXISTS cupom_fiscal text;

-- 2. Amplia o CHECK de tipo_local para aceitar 'Empresa' (a UI já oferecia
--    essa opção, mas o constraint original não permitia gravá-la) e mantém
--    compatibilidade com registros antigos ('Estoque','Oficina').
ALTER TABLE carretas_pontos_parada DROP CONSTRAINT IF EXISTS carretas_pontos_parada_tipo_local_check;
ALTER TABLE carretas_pontos_parada
    ADD CONSTRAINT carretas_pontos_parada_tipo_local_check
    CHECK (tipo_local IN ('Empresa','Fábrica','Estoque','Entrega','Posto','Oficina','Outro'));

-- Mesmo ajuste nos horários extras, se a coluna existir como jsonb (fica livre,
-- pois é validado apenas em aplicação — nenhuma ação de schema necessária).

-- 3. Catálogo simples de locais para os tipos "Fábrica" e "Outro"
CREATE TABLE IF NOT EXISTS carretas_locais_parada (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo_local  text NOT NULL CHECK (tipo_local IN ('Fábrica','Outro')),
    nome        text NOT NULL,
    ativo       boolean DEFAULT true,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locais_parada_tipo ON carretas_locais_parada (tipo_local);

ALTER TABLE carretas_locais_parada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locais_parada_select_all" ON carretas_locais_parada
    FOR SELECT USING (true);

CREATE POLICY "locais_parada_write_admin" ON carretas_locais_parada
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
    );

-- 4. Seed inicial (só insere se a tabela estiver vazia)
INSERT INTO carretas_locais_parada (tipo_local, nome)
SELECT * FROM (VALUES ('Fábrica','CSN'), ('Fábrica','Liz'), ('Outro','Oficina')) AS seed(tipo_local, nome)
WHERE NOT EXISTS (SELECT 1 FROM carretas_locais_parada);

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT * FROM carretas_locais_parada ORDER BY tipo_local, nome;
