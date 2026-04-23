-- =============================================================================
-- LOGIFLOW — E-mails dos usuários para o admin (versão corrigida)
-- Remova a view com problema e use apenas a função RPC.
-- Execute no SQL Editor do Supabase.
-- =============================================================================

-- 1. Remove a view problemática caso tenha sido criada parcialmente
DROP VIEW IF EXISTS public.user_profiles_with_email;

-- 2. Função RPC com SECURITY DEFINER
--    Acessa auth.users com permissão elevada, mas só retorna dados
--    se quem chamou for admin — verificado internamente.
CREATE OR REPLACE FUNCTION public.get_users_with_email()
RETURNS TABLE (
    id           uuid,
    name         text,
    role         text,
    tipo_veiculo text,
    email        text,
    updated_at   timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Apenas admins podem listar e-mails
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.role,
        p.tipo_veiculo,
        u.email::text,
        p.updated_at
    FROM public.user_profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ORDER BY p.name;
END;
$$;

-- 3. Permite que usuários autenticados chamem a função
--    (o SECURITY DEFINER + verificação interna garante que só admins conseguem dados)
GRANT EXECUTE ON FUNCTION public.get_users_with_email() TO authenticated;