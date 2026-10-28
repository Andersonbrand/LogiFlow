-- ============================================================
-- MIGRATION: Adicionar suporte a empresas do Grupo HC
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar campo company em products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS company TEXT NOT NULL DEFAULT 'araguaia'
  CHECK (company IN ('araguaia', 'confiance-industria', 'acos-confiance'));

-- 2. Adicionar campo company em orders (carrinho)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS company TEXT;

-- 3. Índice para filtrar por empresa
CREATE INDEX IF NOT EXISTS idx_products_company ON products (company);
CREATE INDEX IF NOT EXISTS idx_orders_company   ON orders   (company);

-- 4. Atualizar produtos existentes com base na categoria
UPDATE products SET company = 'confiance-industria'
  WHERE category IN ('Telhas', 'Bobinas de Zinco', 'Colunas e Treliças', 'Colunas', 'Treliças');

UPDATE products SET company = 'acos-confiance'
  WHERE category IN ('Vergalhões', 'Barras e Perfis', 'Tubos', 'Chapas', 'Arames', 'Aços Planos')
  AND company = 'araguaia';
-- (Araguaia também tem esses, então fica araguaia como default — admin ajusta via painel)
