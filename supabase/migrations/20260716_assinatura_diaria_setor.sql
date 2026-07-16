-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Assinatura Digital da Diária: roteamento por setor (cargo)
-- Execute no Supabase SQL Editor
--
-- A ficha impressa/exportada de diária tem duas linhas de responsável:
--   "ASSINATURA DO SETOR DE TRANSPORTE"  e  "ASSINATURA DO SETOR DE LOGÍSTICA"
--
-- Regra:
--   • Diária (carreta ou caminhão) assinada digitalmente por um usuário Admin
--     → nome vai para "ASSINATURA DO SETOR DE TRANSPORTE".
--   • Diária de caminhão gerada dentro de um romaneio, assinada por um
--     usuário Operador → nome vai para "ASSINATURA DO SETOR DE LOGÍSTICA".
--
-- Para isso, guardamos o cargo (role) de quem assinou no momento da
-- assinatura — não basta guardar só o id do usuário, pois seu cargo pode
-- mudar depois e isso alteraria retroativamente onde o nome aparece.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE carretas_diarias
    ADD COLUMN IF NOT EXISTS assinatura_admin_role text;

ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS assinatura_diaria_admin_role text;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_diarias' AND column_name = 'assinatura_admin_role';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'romaneios' AND column_name = 'assinatura_diaria_admin_role';
