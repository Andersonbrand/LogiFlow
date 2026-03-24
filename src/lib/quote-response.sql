-- ============================================================
-- Novas tabelas: respostas de orçamento + perfil do usuário
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Respostas do admin para solicitações de orçamento
CREATE TABLE IF NOT EXISTS quote_responses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id    UUID NOT NULL,          -- id do pedido (orders) ou orçamento (quotes)
  request_type  TEXT NOT NULL CHECK (request_type IN ('cart', 'form')),
  customer_email TEXT NOT NULL,
  customer_name  TEXT NOT NULL,
  -- Conteúdo da resposta
  message        TEXT,                  -- texto do admin
  products_summary JSONB,               -- produtos/valores da resposta
  observations   TEXT,                  -- observações adicionais
  requirements   TEXT,                  -- requisitos para finalizar compra
  pdf_url        TEXT,                  -- URL do PDF no Storage
  pdf_name       TEXT,                  -- nome original do PDF
  -- Status
  status         TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'read')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Perfil do usuário (dados extras além do auth)
CREATE TABLE IF NOT EXISTS user_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  phone           TEXT,
  birth_date      DATE,
  -- Endereço
  address_street  TEXT,
  address_number  TEXT,
  address_comp    TEXT,
  address_city    TEXT,
  address_state   TEXT,
  address_zip     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: quote_responses
ALTER TABLE quote_responses ENABLE ROW LEVEL SECURITY;

-- Admin cria respostas
CREATE POLICY "admin_insert_quote_responses" ON quote_responses
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Admin lê tudo
CREATE POLICY "admin_read_quote_responses" ON quote_responses
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    -- Usuário lê suas próprias respostas pelo email
    OR customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Usuário marca como lida
CREATE POLICY "user_update_quote_responses" ON quote_responses
  FOR UPDATE USING (
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- RLS: user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profile" ON user_profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "admin_read_profiles" ON user_profiles
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Storage: bucket para PDFs de orçamento
INSERT INTO storage.buckets (id, name, public)
  VALUES ('quote-pdfs', 'quote-pdfs', false)
  ON CONFLICT (id) DO NOTHING;

-- Admin faz upload de PDFs
CREATE POLICY "admin_upload_pdfs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'quote-pdfs'
    AND (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

-- Usuário baixa PDF se o email bater
CREATE POLICY "user_read_pdfs" ON storage.objects
  FOR SELECT USING (bucket_id = 'quote-pdfs');
