-- Opcional: permite que o sino de notificações atualize na hora via Realtime
-- (sem isso ele continua funcionando: atualiza a cada 3 min com a aba visível,
-- ao voltar para a aba e ao abrir o app). Seguro rodar mais de uma vez.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
