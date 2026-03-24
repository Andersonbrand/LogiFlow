-- Tabela de configurações globais
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Leitura pública (para exibir/ocultar preços no front)
CREATE POLICY "settings_public_read" ON settings
  FOR SELECT USING (true);

-- Escrita apenas admin
CREATE POLICY "settings_admin_write" ON settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
        AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Valor padrão
INSERT INTO settings (key, value) VALUES ('show_prices', 'true')
  ON CONFLICT (key) DO NOTHING;
