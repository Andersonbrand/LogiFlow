-- ============================================================
-- RLS FIX COMPLETO — Execute no SQL Editor do Supabase
-- Dropa todas as policies existentes e recria do zero
-- ============================================================

-- ── PRODUCTS ──────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Remover todas as policies existentes
DROP POLICY IF EXISTS "products_public_read"     ON products;
DROP POLICY IF EXISTS "admin_insert_products"    ON products;
DROP POLICY IF EXISTS "admin_update_products"    ON products;
DROP POLICY IF EXISTS "admin_delete_products"    ON products;
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON products;

-- Leitura pública
CREATE POLICY "products_public_read" ON products
  FOR SELECT USING (true);

-- Admin: insert
CREATE POLICY "admin_insert_products" ON products
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Admin: update
CREATE POLICY "admin_update_products" ON products
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Admin: delete
CREATE POLICY "admin_delete_products" ON products
  FOR DELETE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ── ORDERS ────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_own_read"      ON orders;
DROP POLICY IF EXISTS "orders_insert"        ON orders;
DROP POLICY IF EXISTS "admin_read_orders"    ON orders;
DROP POLICY IF EXISTS "admin_update_orders"  ON orders;

-- Usuário vê seus próprios pedidos
CREATE POLICY "orders_own_read" ON orders
  FOR SELECT USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Qualquer autenticado pode criar pedido
CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admin atualiza status
CREATE POLICY "admin_update_orders" ON orders
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ── QUOTES ────────────────────────────────────────────────
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_insert"        ON quotes;
DROP POLICY IF EXISTS "admin_read_quotes"    ON quotes;
DROP POLICY IF EXISTS "admin_update_quotes"  ON quotes;

-- Qualquer pessoa pode enviar orçamento (sem autenticação)
CREATE POLICY "quotes_insert" ON quotes
  FOR INSERT WITH CHECK (true);

-- Admin lê e atualiza
CREATE POLICY "admin_read_quotes" ON quotes
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_update_quotes" ON quotes
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ── SETTINGS ──────────────────────────────────────────────
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_public_read"  ON settings;
DROP POLICY IF EXISTS "settings_admin_write"  ON settings;

-- Qualquer pessoa lê (necessário para o toggle de preços funcionar no front)
CREATE POLICY "settings_public_read" ON settings
  FOR SELECT USING (true);

-- Admin escreve
CREATE POLICY "settings_admin_write" ON settings
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ── STORAGE: product-images ───────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('product-images', 'product-images', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "product_images_upload"      ON storage.objects;
DROP POLICY IF EXISTS "product_images_update"      ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete"      ON storage.objects;

CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "product_images_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images'
    AND (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

CREATE POLICY "product_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images'
    AND (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

CREATE POLICY "product_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-images'
    AND (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

-- ── VERIFICAR ROLE DO ADMIN ───────────────────────────────
-- Se ainda der erro, execute também isso com o e-mail do admin:
-- SELECT promote_to_admin('seu@email.com');
--
-- E verifique se a função existe:
-- \df promote_to_admin

-- ── CORRIGIR função promote_to_admin ─────────────────────
-- Grava role em app_metadata E user_metadata para garantir compatibilidade
CREATE OR REPLACE FUNCTION promote_to_admin(user_email TEXT)
RETURNS VOID AS $$
DECLARE
  target_uid UUID;
BEGIN
  SELECT id INTO target_uid FROM auth.users WHERE email = user_email;
  IF target_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado: %', user_email;
  END IF;
  -- Grava em app_metadata (verificado pelo middleware/JWT)
  UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
    WHERE id = target_uid;
  -- Grava em user_metadata (verificado pelo client-side)
  UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
    WHERE id = target_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
