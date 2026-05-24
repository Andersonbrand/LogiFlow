-- ═══════════════════════════════════════════════════════════════════════════════
-- LogiFlow — Fix RLS: Motorista pode INSERT e UPDATE de romaneios de ferragem
-- Execute no Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Garante colunas necessárias ──────────────────────────────────────────
ALTER TABLE carretas_romaneios
    ADD COLUMN IF NOT EXISTS numero_nf          text,
    ADD COLUMN IF NOT EXISTS lancado_por_motorista boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS tipo_carga         text;

-- ── 2. Remove policies antigas que possam conflitar ─────────────────────────
DROP POLICY IF EXISTS "motorista_insert_romaneio_ferragem"  ON carretas_romaneios;
DROP POLICY IF EXISTS "motorista_select_proprio_romaneio"   ON carretas_romaneios;
DROP POLICY IF EXISTS "motorista_update_romaneio_ferragem"  ON carretas_romaneios;

-- ── 3. SELECT: motorista vê seus próprios + todos os do admin (para dropdown) ─
-- A policy crom_select_all já existe com USING (true) — mantém aberta para todos.
-- Confirma que existe, caso contrário recria:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'carretas_romaneios' AND policyname = 'crom_select_all'
    ) THEN
        EXECUTE 'CREATE POLICY "crom_select_all" ON carretas_romaneios FOR SELECT USING (true)';
    END IF;
END $$;

-- ── 4. INSERT: motorista pode criar romaneio de ferragem com seu próprio id ──
CREATE POLICY "motorista_insert_romaneio_ferragem"
ON carretas_romaneios
FOR INSERT
TO authenticated
WITH CHECK (
    tipo_carga = 'ferragem'
    AND lancado_por_motorista = true
    AND motorista_id = auth.uid()
);

-- ── 5. UPDATE: motorista pode atualizar romaneios de ferragem onde é o motorista
--      OU romaneios sem motorista atribuído (vinculação ao ROM do admin)
CREATE POLICY "motorista_update_romaneio_ferragem"
ON carretas_romaneios
FOR UPDATE
TO authenticated
USING (
    -- É o motorista dono do registro
    motorista_id = auth.uid()
    OR
    -- É um romaneio do admin sem motorista ainda (para vincular)
    (
        motorista_id IS NULL
        AND EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'motorista'
        )
    )
)
WITH CHECK (
    -- Após o update, motorista_id deve ser o próprio
    motorista_id = auth.uid()
);

-- ── 6. Verifica resultado ────────────────────────────────────────────────────
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'carretas_romaneios'
ORDER BY cmd, policyname;
