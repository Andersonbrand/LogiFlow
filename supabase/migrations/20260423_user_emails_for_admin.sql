-- =============================================================================
-- LOGIFLOW — Expor e-mails dos usuários para o admin
-- Execute no SQL Editor do Supabase (requer acesso ao schema auth)
-- =============================================================================

-- 1. View que une user_profiles com auth.users para expor o e-mail
--    Só é lida por quem é admin (verificado via RLS na view).
CREATE OR REPLACE VIEW public.user_profiles_with_email AS
SELECT
    p.id,
    p.name,
    p.role,
    p.tipo_veiculo,
    p.cnh_numero,
    p.cnh_categoria,
    p.cnh_vencimento,
    p.data_nascimento,
    p.cnh_foto_url,
    p.updated_at,
    p.created_at,
    u.email
FROM public.user_profiles p
LEFT JOIN auth.users u ON u.id = p.id;

-- 2. Permissão de leitura apenas para usuários autenticados
--    (o RLS abaixo garante que só admins veem todos; usuários comuns
--     só veem a si mesmos)
GRANT SELECT ON public.user_profiles_with_email TO authenticated;

-- 3. Habilitar RLS na view
ALTER VIEW public.user_profiles_with_email SET (security_invoker = true);

-- 4. Policy: admin vê todos; usuário comum vê apenas o próprio registro
CREATE POLICY "admin_ve_todos_emails"
    ON public.user_profiles_with_email
    FOR SELECT
    USING (
        -- Admin vê todos
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR
        -- Usuário comum só vê a si mesmo
        id = auth.uid()
    );

-- Nota: Se o Supabase retornar erro de "cannot apply RLS on view",
-- use a alternativa abaixo (Função RPC segura) em vez da view:
-- Veja o bloco comentado no final deste arquivo.


-- =============================================================================
-- ALTERNATIVA: Se a view com RLS não funcionar no seu plano do Supabase,
-- use esta função RPC com SECURITY DEFINER (acessa auth.users com permissão
-- elevada mas retorna apenas o que o admin pode ver).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_users_with_email()
RETURNS TABLE (
    id          uuid,
    name        text,
    role        text,
    tipo_veiculo text,
    email       text,
    updated_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Só admins podem chamar esta função
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar e-mails.';
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

-- Permissão para usuários autenticados chamarem a função
-- (o SECURITY DEFINER + verificação interna garante que só admins conseguem)
GRANT EXECUTE ON FUNCTION public.get_users_with_email() TO authenticated;
