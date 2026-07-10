-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Configurações do sistema (chave/valor)
-- Usada, por enquanto, para os valores de bônus do carreteiro (antes fixos em
-- R$120/R$60 no código). Dá pra reaproveitar essa tabela pra outras
-- configurações no futuro. Execute no Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL,
    updated_by  uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
    updated_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Todo usuário autenticado pode ler as configurações (necessário pro app do
-- motorista/carreteiro calcular o bônus corretamente)
CREATE POLICY "app_settings_select_all" ON app_settings
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Apenas admin/master pode alterar
CREATE POLICY "app_settings_upsert_admin" ON app_settings
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
    );

CREATE POLICY "app_settings_update_admin" ON app_settings
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
    );

-- Seed com os valores atuais (R$60 cidades de rodízio / estoque, R$120 demais)
INSERT INTO app_settings (key, value)
VALUES ('bonus_carreteiro', '{"bonusBaixo": 60, "bonusAlto": 120}'::jsonb)
ON CONFLICT (key) DO NOTHING;
