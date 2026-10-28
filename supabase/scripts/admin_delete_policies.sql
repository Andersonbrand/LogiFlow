-- ============================================================
-- Políticas RLS: Admin pode deletar registros de qualquer usuário
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- user_profiles
CREATE POLICY "admin_delete_profiles" ON user_profiles
FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- bonificacoes
CREATE POLICY "admin_delete_bonificacoes" ON bonificacoes
FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- notifications
CREATE POLICY "admin_delete_notifications" ON notifications
FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- vehicle_history
CREATE POLICY "admin_delete_vehicle_history" ON vehicle_history
FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- abastecimentos
CREATE POLICY "admin_delete_abastecimentos" ON abastecimentos
FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- checklists
CREATE POLICY "admin_delete_checklists" ON checklists
FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- diarias
CREATE POLICY "admin_delete_diarias" ON diarias
FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- carretas_romaneios: permite admin atualizar (desvincular motorista_id)
CREATE POLICY "admin_update_carretas_romaneios" ON carretas_romaneios
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
