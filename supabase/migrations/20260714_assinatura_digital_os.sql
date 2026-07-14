-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Assinatura Digital (Ordens de Serviço)
-- Execute no Supabase SQL Editor
--
-- O admin cadastra previamente uma "assinatura" (texto — normalmente o nome
-- completo) para cada mecânico e para si mesmo. Essa assinatura pode então
-- ser usada para autenticar a OS: pelo mecânico ao finalizar o serviço, e
-- pelo admin como responsável — sem precisar de assinatura manuscrita.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Assinatura digital cadastrada no perfil do usuário (mecânico ou admin)
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS assinatura_digital text;

-- 2. Assinatura aplicada na própria OS (fica registrada mesmo se a assinatura
--    cadastrada do usuário for alterada depois)
ALTER TABLE carretas_ordens_servico
    ADD COLUMN IF NOT EXISTS assinatura_mecanico text;

ALTER TABLE carretas_ordens_servico
    ADD COLUMN IF NOT EXISTS assinatura_admin text;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'assinatura_digital';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_ordens_servico' AND column_name LIKE 'assinatura%';
