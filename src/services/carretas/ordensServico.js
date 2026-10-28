import { supabase } from '../supabaseClient';
import { itemIsOk, itemLabelOf, itemObsOf } from './checklists';

// ─────────────────────────────────────────────────────────────────────────────
// ORDENS DE SERVIÇO (mecânico)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchOrdensServico(filters = {}) {
    let q = supabase
        .from('carretas_ordens_servico')
        .select('*, veiculo:veiculo_id(id, placa, modelo, tipo_composicao, is_terceiro), mecanico:mecanico_id(id, name)')
        .order('created_at', { ascending: false });
    if (filters.mecanicoId) q = q.eq('mecanico_id', filters.mecanicoId);
    if (filters.status)     q = q.eq('status', filters.status);
    // Rascunhos são visíveis apenas para o admin (tela de Ordens de Serviço).
    // Quando a consulta é feita no contexto do mecânico (mecanicoId) sem um
    // status explícito, os rascunhos ainda não enviados ficam ocultos.
    else if (filters.mecanicoId) q = q.neq('status', 'Rascunho');
    if (filters.dataInicio) q = q.gte('created_at', filters.dataInicio);
    if (filters.dataFim)    q = q.lte('created_at', filters.dataFim + 'T23:59:59');
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createOrdemServico(ordem) {
    const { data, error } = await supabase
        .from('carretas_ordens_servico')
        .insert({ ...ordem, status: ordem.status || 'Pendente' })
        .select().single();
    if (error) throw error;
    return data;
}

// Cria automaticamente um RASCUNHO de OS a partir de um checklist quando o
// admin registra manutenção. O rascunho fica visível apenas na aba de Ordens
// de Serviço (não aparece para o mecânico) até que o admin confira, complete
// os dados (mecânico responsável, prioridade, PDF) e envie a OS.
export async function criarRascunhoOSDeChecklist(checklist, adminId) {
    const partes = [];
    if (checklist.problemas)          partes.push(`Problemas relatados: ${checklist.problemas}`);
    if (checklist.necessidades)       partes.push(`Necessidades: ${checklist.necessidades}`);
    if (checklist.observacoes_livres) partes.push(`Observações do motorista: ${checklist.observacoes_livres}`);
    const itensReprovados = Object.entries(checklist.itens || {})
        .filter(([, v]) => !itemIsOk(v))
        .map(([id, v]) => {
            const label = itemLabelOf(v, id);
            const obs = itemObsOf(v);
            return obs ? `${label} (${obs})` : label;
        });
    if (itensReprovados.length) partes.push(`Itens reprovados no checklist: ${itensReprovados.join(', ')}`);

    const descricao = partes.length
        ? partes.join('\n')
        : 'Manutenção solicitada a partir do checklist semanal. Revise e complete a descrição do serviço.';

    const { data, error } = await supabase
        .from('carretas_ordens_servico')
        .insert({
            veiculo_id: checklist.veiculo_id,
            mecanico_id: null,
            descricao,
            prioridade: itensReprovados.length ? 'Urgente' : 'Normal',
            status: 'Rascunho',
            checklist_id: checklist.id,
            criada_por: adminId || null,
        })
        .select().single();
    if (error) throw error;
    return data;
}

export async function updateOrdemServico(id, updates) {
    const { data, error } = await supabase
        .from('carretas_ordens_servico')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function finalizarOrdemServico(id, mecanicoId, observacoes, assinaturaDigital = null) {
    const { data, error } = await supabase
        .from('carretas_ordens_servico')
        .update({
            status: 'Finalizada',
            finalizada_por: mecanicoId,
            finalizada_em: new Date().toISOString(),
            obs_finalizacao: observacoes,
            ...(assinaturaDigital ? { assinatura_mecanico: assinaturaDigital } : {}),
            updated_at: new Date().toISOString(),
        })
        .eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function reportarProblemaOS(id, problema) {
    const { data, error } = await supabase
        .from('carretas_ordens_servico')
        .update({
            status: 'Problema Reportado',
            problema_encontrado: problema,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function fetchMecanicos() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, assinatura_digital')
        .eq('role', 'mecanico')
        .order('name');
    if (error) throw error;
    return data || [];
}

export async function createPecaCatalogo(peca) {
    const { data, error } = await supabase.from('carretas_pecas_catalogo').insert(peca).select().single();
    if (error) throw error;
    return data;
}

export async function updatePecaCatalogo(id, updates) {
    const { data, error } = await supabase
        .from('carretas_pecas_catalogo')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deletePecaCatalogo(id) {
    const { error } = await supabase.from('carretas_pecas_catalogo').delete().eq('id', id);
    if (error) throw error;
}

export async function fetchLocaisParada(tipoLocal) {
    let q = supabase.from('carretas_locais_parada').select('*').order('nome', { ascending: true });
    if (tipoLocal) q = q.eq('tipo_local', tipoLocal);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createLocalParada(local) {
    const { data, error } = await supabase.from('carretas_locais_parada').insert(local).select().single();
    if (error) throw error;
    return data;
}

export async function updateLocalParada(id, updates) {
    const { data, error } = await supabase
        .from('carretas_locais_parada')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteLocalParada(id) {
    const { error } = await supabase.from('carretas_locais_parada').delete().eq('id', id);
    if (error) throw error;
}

export async function fetchPontosParada(motoristaId) {
    const q = supabase
        .from('carretas_pontos_parada')
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .order('data_saida', { ascending: false })
        .order('created_at', { ascending: false });
    if (motoristaId) q.eq('motorista_id', motoristaId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

// Busca de todos os motoristas (visão admin), com nome do motorista e filtro
// de período — usada no painel de desempenho (KM rodado / horas / consumo).
export async function fetchPontosParadaAdmin({ dataInicio, dataFim } = {}) {
    let q = supabase
        .from('carretas_pontos_parada')
        .select('*, motorista:motorista_id(id, name), veiculo:veiculo_id(id, placa, modelo)')
        .order('data_saida', { ascending: false });
    if (dataInicio) q = q.gte('data_saida', dataInicio);
    if (dataFim)    q = q.lte('data_saida', dataFim);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createPontoParada(ponto) {
    const { data, error } = await supabase
        .from('carretas_pontos_parada')
        .insert(ponto)
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .single();
    if (error) throw error;
    return data;
}

export async function updatePontoParada(id, ponto) {
    const { data, error } = await supabase
        .from('carretas_pontos_parada')
        .update(ponto)
        .eq('id', id)
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .single();
    if (error) throw error;
    return data;
}

export async function deletePontoParada(id) {
    // .select() após o delete permite detectar quando o RLS bloqueia
    // silenciosamente a exclusão (0 linhas afetadas, sem erro) — sem isso,
    // a UI mostrava "excluído com sucesso" mesmo com o registro intacto no banco.
    const { data, error } = await supabase
        .from('carretas_pontos_parada')
        .delete()
        .eq('id', id)
        .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error('Nenhum registro foi excluído — verifique as permissões de acesso.');
    }
}

/** Catálogo completo de peças (tela de gerenciamento). Retorna { data, error }. */
export function fetchPecasCatalogoCompleto() {
    return supabase.from('carretas_pecas_catalogo').select('*').order('nome', { ascending: true });
}
