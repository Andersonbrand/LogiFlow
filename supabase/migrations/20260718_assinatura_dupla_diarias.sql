-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Assinatura dupla nas Diárias (Logística + Transporte)
--
-- Hoje existe um único campo de assinatura por diária (o último que assinar
-- sobrescreve o anterior). Passa a existir um campo para cada setor, cada um
-- assinado de forma independente — igual acontece nas OS (mecânico + admin).
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Diárias avulsas (carretas_diarias)
ALTER TABLE carretas_diarias
    ADD COLUMN IF NOT EXISTS assinatura_logistica     text,
    ADD COLUMN IF NOT EXISTS assinatura_logistica_at   timestamptz,
    ADD COLUMN IF NOT EXISTS assinatura_logistica_por  uuid,
    ADD COLUMN IF NOT EXISTS assinatura_transporte     text,
    ADD COLUMN IF NOT EXISTS assinatura_transporte_at  timestamptz,
    ADD COLUMN IF NOT EXISTS assinatura_transporte_por uuid;

-- Migra assinaturas antigas (campo único) para o novo campo correspondente,
-- de acordo com o cargo (role) de quem assinou.
UPDATE carretas_diarias
SET assinatura_logistica = assinatura_admin,
    assinatura_logistica_at = assinatura_admin_at,
    assinatura_logistica_por = assinatura_admin_por
WHERE assinatura_admin_role = 'operador' AND assinatura_admin IS NOT NULL;

UPDATE carretas_diarias
SET assinatura_transporte = assinatura_admin,
    assinatura_transporte_at = assinatura_admin_at,
    assinatura_transporte_por = assinatura_admin_por
WHERE assinatura_admin_role = 'admin' AND assinatura_admin IS NOT NULL;

-- 2. Diárias geradas automaticamente a partir de romaneios (romaneios)
ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS assinatura_diaria_logistica     text,
    ADD COLUMN IF NOT EXISTS assinatura_diaria_logistica_at   timestamptz,
    ADD COLUMN IF NOT EXISTS assinatura_diaria_logistica_por  uuid,
    ADD COLUMN IF NOT EXISTS assinatura_diaria_transporte     text,
    ADD COLUMN IF NOT EXISTS assinatura_diaria_transporte_at  timestamptz,
    ADD COLUMN IF NOT EXISTS assinatura_diaria_transporte_por uuid;

UPDATE romaneios
SET assinatura_diaria_logistica = assinatura_diaria_admin,
    assinatura_diaria_logistica_at = assinatura_diaria_admin_at,
    assinatura_diaria_logistica_por = assinatura_diaria_admin_por
WHERE assinatura_diaria_admin_role = 'operador' AND assinatura_diaria_admin IS NOT NULL;

UPDATE romaneios
SET assinatura_diaria_transporte = assinatura_diaria_admin,
    assinatura_diaria_transporte_at = assinatura_diaria_admin_at,
    assinatura_diaria_transporte_por = assinatura_diaria_admin_por
WHERE assinatura_diaria_admin_role = 'admin' AND assinatura_diaria_admin IS NOT NULL;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_diarias' AND column_name LIKE 'assinatura%';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'romaneios' AND column_name LIKE 'assinatura_diaria%';
