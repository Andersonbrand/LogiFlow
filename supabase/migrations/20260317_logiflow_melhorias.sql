-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Migração completa (execute no Supabase SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── PASSO 1: Postos de Combustível (NOVO) ──────────────────────────────────
-- ERRO "Could not find the table 'public.carretas_postos' in the schema cache"
-- significa que esta tabela ainda NÃO FOI criada. Execute esta migration!

CREATE TABLE IF NOT EXISTS carretas_postos (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nome         text NOT NULL,
    cidade       text,
    cnpj         text,
    preco_diesel numeric(10,3),   -- R$/L do Diesel (auto-preenche abastecimento)
    preco_arla   numeric(10,3),   -- R$/L do Arla 32
    ativo        boolean DEFAULT true,
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);

-- RLS postos
ALTER TABLE carretas_postos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "postos_select_all"    ON carretas_postos FOR SELECT USING (true);
CREATE POLICY "postos_insert_admin"  ON carretas_postos FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
);
CREATE POLICY "postos_update_admin"  ON carretas_postos FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
);
CREATE POLICY "postos_delete_admin"  ON carretas_postos FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
);

-- ─── PASSO 2: Colunas novas em tabelas existentes ───────────────────────────

-- Abastecimentos: vínculo com posto
ALTER TABLE carretas_abastecimentos
    ADD COLUMN IF NOT EXISTS posto_id uuid REFERENCES carretas_postos(id) ON DELETE SET NULL;

-- Checklists: foto enviada pelo motorista
ALTER TABLE carretas_checklists
    ADD COLUMN IF NOT EXISTS foto_url text;

-- Despesas: formas de pagamento completas
ALTER TABLE carretas_despesas_extras
    ADD COLUMN IF NOT EXISTS forma_pagamento  text    DEFAULT 'a_vista',
    ADD COLUMN IF NOT EXISTS tipo_pagamento   text    DEFAULT 'pix',
    ADD COLUMN IF NOT EXISTS comprovante_url  text,
    ADD COLUMN IF NOT EXISTS boletos          jsonb   DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS permuta_obs      text,
    ADD COLUMN IF NOT EXISTS permuta_doc_url  text,
    ADD COLUMN IF NOT EXISTS cheques          jsonb   DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS nf_itens         jsonb   DEFAULT '[]'::jsonb;

-- ─── PASSO 3: Índices ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_postos_nome       ON carretas_postos (nome);
CREATE INDEX IF NOT EXISTS idx_abast_posto_id    ON carretas_abastecimentos (posto_id);
CREATE INDEX IF NOT EXISTS idx_despesas_pgto     ON carretas_despesas_extras (forma_pagamento);

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- Após executar, rode estas queries para confirmar:
-- SELECT * FROM carretas_postos LIMIT 5;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_despesas_extras' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_checklists' ORDER BY ordinal_position;
