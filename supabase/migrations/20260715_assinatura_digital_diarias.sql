-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Assinatura Digital do Responsável (Diárias de Caminhões/Carretas)
-- Execute no Supabase SQL Editor
--
-- Só admins e operadores assinam digitalmente as diárias como responsáveis
-- (motoristas não têm essa função liberada; a assinatura do motorista, quando
-- cadastrada, já é incluída automaticamente ao imprimir/exportar).
--
-- Cobre os dois formatos de diária existentes no sistema:
--   1) carretas_diarias  → diárias avulsas e diárias vinculadas a uma viagem
--      (motoristas de carreta, e diárias avulsas de motoristas de caminhão)
--   2) romaneios         → diárias geradas automaticamente ao criar um
--      romaneio de caminhão (campos custo_motorista/dias_diaria/valor_diaria_dia)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Diárias avulsas / vinculadas a viagem (carretas_diarias)
ALTER TABLE carretas_diarias
    ADD COLUMN IF NOT EXISTS assinatura_admin text;

ALTER TABLE carretas_diarias
    ADD COLUMN IF NOT EXISTS assinatura_admin_at timestamptz;

ALTER TABLE carretas_diarias
    ADD COLUMN IF NOT EXISTS assinatura_admin_por uuid REFERENCES user_profiles(id) ON DELETE SET NULL;

-- 2) Diárias automáticas de romaneio (caminhões)
ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS assinatura_diaria_admin text;

ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS assinatura_diaria_admin_at timestamptz;

ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS assinatura_diaria_admin_por uuid REFERENCES user_profiles(id) ON DELETE SET NULL;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_diarias' AND column_name LIKE 'assinatura_admin%';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'romaneios' AND column_name LIKE 'assinatura_diaria%';
