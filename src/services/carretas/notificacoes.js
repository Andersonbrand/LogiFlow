import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICAÇÕES DO CARRETEIRO (checklist aprovado/reprovado)
// ─────────────────────────────────────────────────────────────────────────────
export async function createNotificacaoCarreteiro(userId, tipo, titulo, mensagem) {
    // Usa tabela própria com RLS permissiva (admin pode inserir para qualquer user)
    const { error } = await supabase
        .from('carretas_notificacoes')
        .insert({ user_id: userId, tipo, titulo, mensagem, lida: false });
    if (error) throw error;
}

export async function fetchNotificacoesCarreteiro(userId) {
    const { data, error } = await supabase
        .from('carretas_notificacoes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) return [];
    return data || [];
}

export async function marcarNotificacaoLida(id) {
    await supabase.from('carretas_notificacoes').update({ lida: true }).eq('id', id);
}

export async function aprovarChecklistComNotificacao(id, adminId, motoristaId) {
    const { data, error } = await supabase
        .from('carretas_checklists')
        .update({ aprovado: true, aprovado_por: adminId, aprovado_em: new Date().toISOString() })
        .eq('id', id).select().single();
    if (error) throw error;
    // Envia notificação ao motorista
    if (motoristaId) {
        await createNotificacaoCarreteiro(motoristaId, 'checklist_aprovado',
            '✅ Checklist Aprovado',
            'Seu checklist semanal foi aprovado pelo administrador.');
    }
    return data;
}

// Alias com retorno explícito — compatível com versões mais novas do carretas/index.jsx
export async function aprovarChecklistComNotificacaoRetorno(id, adminId, motoristaId) {
    return aprovarChecklistComNotificacao(id, adminId, motoristaId);
}

export async function reprovarChecklistComNotificacao(id, adminId, motoristaId, motivo) {
    const { data, error } = await supabase
        .from('carretas_checklists')
        .update({ aprovado: false, manutencao_registrada: true, obs_manutencao: motivo })
        .eq('id', id).select().single();
    if (error) throw error;
    if (motoristaId) {
        await createNotificacaoCarreteiro(motoristaId, 'checklist_reprovado',
            '⚠️ Manutenção Necessária',
            motivo || 'O administrador registrou necessidade de manutenção no seu veículo.');
    }
    return data;
}
