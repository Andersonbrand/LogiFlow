-- ============================================================
-- Função para excluir motorista com cascade delete completo
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

CREATE OR REPLACE FUNCTION delete_driver_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- executa com privilégios do owner (bypassa RLS)
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Verifica que o chamador é admin
  SELECT role INTO caller_role
  FROM user_profiles
  WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- Tabelas com motorista_id (nomes reais do projeto)
  DELETE FROM carretas_abastecimentos WHERE motorista_id = target_user_id;
  DELETE FROM carretas_checklists     WHERE motorista_id = target_user_id;
  DELETE FROM carretas_diarias        WHERE motorista_id = target_user_id;

  -- Romaneios: preserva histórico, apenas desvincula o motorista
  UPDATE carretas_romaneios
  SET motorista_id = NULL
  WHERE motorista_id = target_user_id;

  -- Tabelas com user_id
  DELETE FROM bonificacoes  WHERE user_id = target_user_id;
  DELETE FROM notifications WHERE user_id = target_user_id;

  -- Remove o perfil (SECURITY DEFINER bypassa RLS)
  DELETE FROM user_profiles WHERE id = target_user_id;

END;
$$;

-- Revoga execução pública e permite apenas usuários autenticados
REVOKE ALL ON FUNCTION delete_driver_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_driver_user(UUID) TO authenticated;
