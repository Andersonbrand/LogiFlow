-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Remove assinatura digital de motoristas
-- Execute no Supabase SQL Editor
--
-- Motoristas (caminhão e carreta/carreteiro) não possuem a função de
-- assinatura digital liberada no sistema. Apenas admin, operador e mecânico
-- podem ter uma assinatura digital cadastrada (usada em Ordens de Serviço e
-- nos modelos de impressão/exportação de diárias, como responsável).
-- Esta migração limpa qualquer valor que tenha sido cadastrado por engano
-- no passado para esses papéis.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE user_profiles
   SET assinatura_digital = NULL
 WHERE role IN ('motorista', 'carreteiro')
   AND assinatura_digital IS NOT NULL;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT id, name, role, assinatura_digital FROM user_profiles WHERE role IN ('motorista','carreteiro') AND assinatura_digital IS NOT NULL;
