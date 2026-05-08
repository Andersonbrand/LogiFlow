-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Romaneio de Ferragens (registrado pelo motorista)
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Adicionar colunas necessárias (idempotente)
ALTER TABLE carretas_romaneios ADD COLUMN IF NOT EXISTS numero_nf  text;
ALTER TABLE carretas_romaneios ADD COLUMN IF NOT EXISTS tipo_carga text DEFAULT 'cimento';

-- Remover policies antigas se existirem (para rodar sem erro em re-execução)
DROP POLICY IF EXISTS "crom_insert_carreteiro" ON carretas_romaneios;
DROP POLICY IF EXISTS "crom_select_carreteiro" ON carretas_romaneios;
DROP POLICY IF EXISTS "crom_select_all"        ON carretas_romaneios;

-- Policy geral de leitura (todos veem todos os romaneios)
CREATE POLICY "crom_select_all" ON carretas_romaneios
    FOR SELECT USING (true);

-- Motorista carreteiro pode inserir apenas romaneios de ferragem vinculados a si
CREATE POLICY "crom_insert_carreteiro" ON carretas_romaneios
    FOR INSERT WITH CHECK (
        motorista_id = auth.uid()
        AND tipo_carga = 'ferragem'
        AND EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'carreteiro'
        )
    );