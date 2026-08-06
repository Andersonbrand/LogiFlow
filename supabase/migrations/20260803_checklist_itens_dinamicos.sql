-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Checklist: itens configuráveis pelo admin + observação por item
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Tabela de itens do checklist (antes era uma lista fixa no código-fonte).
--    Agora o admin pode adicionar, editar, reordenar e excluir itens pelo painel.
CREATE TABLE IF NOT EXISTS carretas_checklist_itens (
    id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    label      text NOT NULL,
    ordem      integer NOT NULL DEFAULT 0,
    ativo      boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE carretas_checklist_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_itens_select_all"   ON carretas_checklist_itens FOR SELECT USING (true);
CREATE POLICY "checklist_itens_insert_admin" ON carretas_checklist_itens FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
);
CREATE POLICY "checklist_itens_update_admin" ON carretas_checklist_itens FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
);
CREATE POLICY "checklist_itens_delete_admin" ON carretas_checklist_itens FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
);

CREATE INDEX IF NOT EXISTS idx_checklist_itens_ordem ON carretas_checklist_itens (ordem);

-- Semeia a tabela com os itens que hoje estão fixos no código (só roda se a
-- tabela estiver vazia — não duplica se a migration for executada 2x).
INSERT INTO carretas_checklist_itens (label, ordem)
SELECT * FROM (VALUES
    ('Pneus em bom estado', 1),
    ('Iluminação funcionando', 2),
    ('Cintas de amarração', 3),
    ('Freios em ordem', 4),
    ('Documentos do veículo', 5),
    ('Extintor de incêndio', 6),
    ('Triângulo de segurança', 7),
    ('Macaco e chave de roda', 8),
    ('Espelhos retrovisores', 9),
    ('Sem vazamentos (óleo/combustível)', 10)
) AS seed(label, ordem)
WHERE NOT EXISTS (SELECT 1 FROM carretas_checklist_itens);

-- 2. Nada a mudar na coluna `itens` (jsonb) nem em `fotos_urls` (jsonb, já
--    criada em 20260319_checklist_multiplas_fotos.sql) — o novo formato por
--    item ({ ok, obs, label }) e múltiplas fotos usam as colunas existentes,
--    só muda o que o front-end grava dentro do jsonb.

-- SELECT * FROM carretas_checklist_itens ORDER BY ordem;
