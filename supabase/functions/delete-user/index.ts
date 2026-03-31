import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verifica que o chamador é um admin autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey         = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verifica se o chamador é admin (usando a sessão dele)
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerProfile } = await caller
      .from('user_profiles')
      .select('role')
      .single();

    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem excluir usuários' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cliente com service_role — bypassa RLS
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. Tabelas com motorista_id ──────────────────────────────────────────
    await admin.from('abastecimentos').delete().eq('motorista_id', userId);
    await admin.from('checklists').delete().eq('motorista_id', userId);
    await admin.from('diarias').delete().eq('motorista_id', userId);

    // Romaneios: preserva histórico, apenas desvincula o motorista
    await admin
      .from('carretas_romaneios')
      .update({ motorista_id: null })
      .eq('motorista_id', userId);

    // ── 2. Tabelas com user_id ───────────────────────────────────────────────
    await admin.from('bonificacoes').delete().eq('user_id', userId);
    await admin.from('notifications').delete().eq('user_id', userId);
    await admin.from('vehicle_history').delete().eq('user_id', userId);

    // ── 3. Perfil do usuário ─────────────────────────────────────────────────
    const { error: profileErr } = await admin
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileErr) {
      return new Response(JSON.stringify({ error: 'Erro ao remover perfil: ' + profileErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Remove do auth.users ──────────────────────────────────────────────
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      return new Response(JSON.stringify({ error: 'Erro ao remover autenticação: ' + authErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
