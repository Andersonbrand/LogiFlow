-- Permite que cada usuário exclua as PRÓPRIAS notificações (botão "Limpar" do sino).
-- Execute no SQL Editor do Supabase.
DROP POLICY IF EXISTS "users_delete_own_notifications" ON public.notifications;
CREATE POLICY "users_delete_own_notifications" ON public.notifications
FOR DELETE USING (user_id = auth.uid());
