-- ============================================================
-- SCHEMA — Araguaia E-Commerce
-- Execute este arquivo no SQL Editor do seu projeto Supabase
-- ============================================================

-- -------------------------------------------------------
-- TABELA: products
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit        TEXT NOT NULL DEFAULT 'unidade',
  stock       INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------
-- TABELA: orders
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  items           JSONB NOT NULL DEFAULT '[]',
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','delivered','cancelled')),
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- TABELA: quotes (formulário de orçamento)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  company     TEXT,
  email       TEXT NOT NULL,
  phone       TEXT NOT NULL,
  category    TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new','read','replied')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- -------------------------------------------------------

-- Products: leitura pública, escrita apenas para admins
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are viewable by everyone"
  ON products FOR SELECT USING (true);

CREATE POLICY "Products are editable by admins only"
  ON products FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Orders: usuário vê seus próprios pedidos; admin vê todos
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Anyone can create an order"
  ON orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Quotes: apenas admins podem ler; qualquer um pode criar
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a quote"
  ON quotes FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view and update quotes"
  ON quotes FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- -------------------------------------------------------
-- STORAGE — bucket para imagens dos produtos
-- -------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Product images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- -------------------------------------------------------
-- DADOS INICIAIS — produtos de exemplo
-- -------------------------------------------------------
INSERT INTO products (name, category, description, price, unit, stock, is_active) VALUES
('Cimento CP-II 50kg',       'Cimento',    'Cimento Portland Composto de alta resistência, ideal para estruturas e alvenaria.',  32.90, 'saco',          850,  true),
('Cimento CP-III 50kg',      'Cimento',    'Cimento de Alto-Forno, resistente a sulfatos. Indicado para obras em ambientes agressivos.', 34.50, 'saco', 420,  true),
('Argamassa AC-II 20kg',     'Cimento',    'Argamassa colante industrializada para assentamento de revestimentos cerâmicos.',     18.90, 'saco',          600,  true),
('Vergalhão CA-50 Ø10mm',    'Vergalhões', 'Barra de aço nervurada CA-50, bitola 10mm, 12 metros. Alta aderência ao concreto.',  45.00, 'barra 12m',     1200, true),
('Vergalhão CA-50 Ø12.5mm',  'Vergalhões', 'Barra de aço nervurada CA-50, bitola 12,5mm. Para estruturas de maior carga.',       68.00, 'barra 12m',     680,  true),
('Tela Soldada Q-92',        'Vergalhões', 'Tela soldada eletrosoldada Q-92 para lajes, pisos e contrapisos.',                   125.00,'painel 6x2,4m', 300,  true),
('Parafuso Sextavado M8x25', 'Ferragens',  'Parafuso sextavado zincado M8x25, resistente à corrosão. Cento com 100 unidades.',   28.00, 'cento',         340,  true),
('Prego com Cabeça 17x27',   'Ferragens',  'Prego com cabeça polido 17x27, embalagem por kg. Para madeiramento e acabamentos.',  12.50, 'kg',            500,  true),
('Tubo Quadrado 40x40x2mm',  'Serralheria','Tubo de aço quadrado 40x40x2mm, barra de 6 metros. Para grades, portões e estruturas.', 85.00,'barra 6m',   195,  true),
('Perfil U Enrijecido 100mm','Serralheria','Perfil U enrijecido galvanizado 100x40x2mm. Para drywall, steel frame e coberturas.', 62.00,'barra 6m',      240,  true);

-- -------------------------------------------------------
-- FUNÇÃO HELPER: promover usuário a admin
-- Rode no SQL Editor passando o email do admin:
--   SELECT promote_to_admin('seu@email.com');
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION promote_to_admin(user_email TEXT)
RETURNS VOID AS $$
DECLARE
  target_uid UUID;
BEGIN
  SELECT id INTO target_uid FROM auth.users WHERE email = user_email;
  IF target_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado: %', user_email;
  END IF;
  UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
    WHERE id = target_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
