-- Envio de aço (Carretas → Distribuição de Viagens → Aço):
-- o registro deixa de ser só "motorista + texto" e passa a guardar placa, os pedidos
-- (cliente, nº do pedido, cidade, data de entrega) e a assinatura digital do admin
-- usada no comprovante impresso. Seguro rodar mais de uma vez.
ALTER TABLE carretas_envios_aco
    ADD COLUMN IF NOT EXISTS placa               text,
    ADD COLUMN IF NOT EXISTS pedidos             jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS assinatura_admin    text,
    ADD COLUMN IF NOT EXISTS assinatura_admin_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at          timestamptz;

-- A tabela só tinha política de INSERT/DELETE: sem esta, a edição seria bloqueada.
DROP POLICY IF EXISTS "envios_aco_update_admin" ON carretas_envios_aco;
CREATE POLICY "envios_aco_update_admin" ON carretas_envios_aco
    FOR UPDATE
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master','operador')))
    WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master','operador')));
