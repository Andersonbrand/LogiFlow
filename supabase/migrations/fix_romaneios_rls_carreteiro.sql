-- ═══════════════════════════════════════════════════════════════════════
-- FIX: Políticas RLS para tabela 'romaneios'
-- Permite que carreteiros leiam seus próprios romaneios
-- e que admins/operadores leiam todos.
-- Execute no SQL Editor do Supabase Dashboard.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Garante que RLS está habilitado
ALTER TABLE romaneios ENABLE ROW LEVEL SECURITY;
ALTER TABLE romaneio_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE romaneio_itens ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas antigas que possam existir (evita conflito)
DROP POLICY IF EXISTS "romaneios_select_admin"      ON romaneios;
DROP POLICY IF EXISTS "romaneios_select_motorista"  ON romaneios;
DROP POLICY IF EXISTS "romaneios_select_carreteiro" ON romaneios;
DROP POLICY IF EXISTS "romaneios_select_all"        ON romaneios;
DROP POLICY IF EXISTS "romaneio_pedidos_select"     ON romaneio_pedidos;
DROP POLICY IF EXISTS "romaneio_itens_select"       ON romaneio_itens;

-- 3. Admin e operador: lê TODOS os romaneios
CREATE POLICY "romaneios_select_admin" ON romaneios
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'operador', 'master')
    )
);

-- 4. Motorista/carreteiro: lê APENAS os seus próprios
--    (por UUID do motorista_id OU por nome no campo motorista)
CREATE POLICY "romaneios_select_motorista" ON romaneios
FOR SELECT USING (
    motorista_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
          AND (
            role IN ('motorista', 'carreteiro')
            AND (
                romaneios.motorista_id = auth.uid()
                OR lower(romaneios.motorista) = lower(user_profiles.name)
            )
          )
    )
);

-- 5. romaneio_pedidos: herda acesso via romaneio pai
CREATE POLICY "romaneio_pedidos_select" ON romaneio_pedidos
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM romaneios r
        WHERE r.id = romaneio_pedidos.romaneio_id
          AND (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operador', 'master'))
            OR r.motorista_id = auth.uid()
            OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND lower(r.motorista) = lower(user_profiles.name))
          )
    )
);

-- 6. romaneio_itens: herda acesso via romaneio pai
CREATE POLICY "romaneio_itens_select" ON romaneio_itens
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM romaneios r
        WHERE r.id = romaneio_itens.romaneio_id
          AND (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operador', 'master'))
            OR r.motorista_id = auth.uid()
            OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND lower(r.motorista) = lower(user_profiles.name))
          )
    )
);

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO: rode após executar para confirmar
-- SELECT schemaname, tablename, policyname, roles, cmd, qual
-- FROM pg_policies WHERE tablename IN ('romaneios','romaneio_pedidos','romaneio_itens');
-- ═══════════════════════════════════════════════════════════════════════
