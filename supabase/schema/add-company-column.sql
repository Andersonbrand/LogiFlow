-- ============================================================
-- Migration: adicionar coluna companies (array) na tabela products
-- Execute no Supabase SQL Editor ANTES de usar o filtro por empresa
-- ============================================================

-- Adicionar coluna companies como array de texto
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS companies TEXT[] NOT NULL DEFAULT ARRAY['araguaia'];

-- Migrar produtos existentes com base na categoria
-- Telhas, bobinas, colunas, treliças → Confiance Indústria
UPDATE products 
SET companies = ARRAY['confiance-industria']
WHERE category IN ('Telhas', 'Bobinas de Zinco', 'Colunas', 'Treliças', 'Colunas e Treliças', 'Telhas de Zinco');

-- Vergalhões, barras, chapas, arames → tanto Araguaia quanto Aços Confiance
UPDATE products 
SET companies = ARRAY['araguaia', 'acos-confiance']
WHERE category IN ('Vergalhões', 'Barras e Perfis', 'Chapas', 'Arames', 'Aços Planos', 'Tubos')
AND companies = ARRAY['araguaia'];

-- Índice GIN para busca eficiente em array
CREATE INDEX IF NOT EXISTS idx_products_companies ON products USING GIN(companies);

-- Comentário
COMMENT ON COLUMN products.companies IS 'Empresas do Grupo HC que vendem este produto. Array pode ter múltiplas empresas.';
