/**
 * carretasService.js
 * Serviços para o módulo Transporte - Carretas
 * Tabelas: carretas_viagens, carretas_veiculos, carretas_abastecimentos,
 *          carretas_checklists, carretas_carregamentos, carretas_empresas
 */
import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CIDADES COM BONIFICAÇÃO REDUZIDA (R$60) — demais = R$120
// ─────────────────────────────────────────────────────────────────────────────
export const CIDADES_BONUS_BAIXO = [
    'urandi', 'pindai', 'pindaí', 'candiba', 'pilões', 'piloes', 'guanambi'
];
export const BONUS_BAIXO  = 60;
export const BONUS_ALTO   = 120;

export function calcularBonusCarreteiro(destino) {
    if (!destino) return 0;
    const d = destino.toLowerCase().trim();
    const isBaixo = CIDADES_BONUS_BAIXO.some(c => d.includes(c));
    return isBaixo ? BONUS_BAIXO : BONUS_ALTO;
}

// ─────────────────────────────────────────────────────────────────────────────
// GERAÇÃO DE NÚMERO DE VIAGEM  ANO-SEQUÊNCIA
// ─────────────────────────────────────────────────────────────────────────────
export async function gerarNumeroViagem() {
    const ano = new Date().getFullYear();
    const { count } = await supabase
        .from('carretas_viagens')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${ano}-01-01`);
    const seq = String((count || 0) + 1).padStart(4, '0');
    return `${ano}-${seq}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIAGENS
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchViagens(filters = {}) {
    let q = supabase
        .from('carretas_viagens')
        .select(`
            *,
            motorista:motorista_id(id, name),
            veiculo:veiculo_id(id, placa, modelo, tipo_composicao)
        `)
        .order('created_at', { ascending: false });

    if (filters.status)      q = q.eq('status', filters.status);
    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.veiculoId)   q = q.eq('veiculo_id', filters.veiculoId);
    if (filters.dataInicio)  q = q.gte('data_saida', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('data_saida', filters.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createViagem(viagem) {
    const numero = await gerarNumeroViagem();
    const { data, error } = await supabase
        .from('carretas_viagens')
        .insert({ ...viagem, numero, status: viagem.status || 'Agendado' })
        .select(`*, motorista:motorista_id(id, name), veiculo:veiculo_id(id, placa, modelo)`)
        .single();
    if (error) throw error;
    return data;
}

export async function updateViagem(id, updates) {
    const { data, error } = await supabase
        .from('carretas_viagens')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(`*, motorista:motorista_id(id, name), veiculo:veiculo_id(id, placa, modelo)`)
        .single();
    if (error) throw error;
    return data;
}

export async function deleteViagem(id) {
    const { error } = await supabase.from('carretas_viagens').delete().eq('id', id);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// VEÍCULOS (CARRETAS)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchCarretasVeiculos() {
    const { data, error } = await supabase
        .from('carretas_veiculos')
        .select('*')
        .order('placa', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createCarretaVeiculo(veiculo) {
    const { data, error } = await supabase
        .from('carretas_veiculos')
        .insert(veiculo)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateCarretaVeiculo(id, updates) {
    const { data, error } = await supabase
        .from('carretas_veiculos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteCarretaVeiculo(id) {
    const { error } = await supabase.from('carretas_veiculos').delete().eq('id', id);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// ABASTECIMENTOS
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchAbastecimentos(filters = {}) {
    let q = supabase
        .from('carretas_abastecimentos')
        .select(`
            *,
            motorista:motorista_id(id, name),
            veiculo:veiculo_id(id, placa)
        `)
        .order('data_abastecimento', { ascending: false });

    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.veiculoId)   q = q.eq('veiculo_id', filters.veiculoId);
    if (filters.dataInicio)  q = q.gte('data_abastecimento', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('data_abastecimento', filters.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createAbastecimento(abast) {
    const { data, error } = await supabase
        .from('carretas_abastecimentos')
        .insert(abast)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteAbastecimento(id) {
    const { error } = await supabase.from('carretas_abastecimentos').delete().eq('id', id);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKLISTS
// ─────────────────────────────────────────────────────────────────────────────
export const CHECKLIST_ITENS = [
    { id: 'pneus',       label: 'Pneus em bom estado' },
    { id: 'iluminacao',  label: 'Iluminação funcionando' },
    { id: 'cintas',      label: 'Cintas de amarração' },
    { id: 'freios',      label: 'Freios em ordem' },
    { id: 'documentos',  label: 'Documentos do veículo' },
    { id: 'extintor',    label: 'Extintor de incêndio' },
    { id: 'triangulo',   label: 'Triângulo de segurança' },
    { id: 'macaco',      label: 'Macaco e chave de roda' },
    { id: 'espelhos',    label: 'Espelhos retrovisores' },
    { id: 'vazamentos',  label: 'Sem vazamentos (óleo/combustível)' },
];

export async function fetchChecklists(filters = {}) {
    let q = supabase
        .from('carretas_checklists')
        .select(`
            *,
            motorista:motorista_id(id, name),
            veiculo:veiculo_id(id, placa)
        `)
        .order('created_at', { ascending: false });

    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.pendente)    q = q.eq('aprovado', false);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createChecklist(checklist) {
    const { data, error } = await supabase
        .from('carretas_checklists')
        .insert({ ...checklist, aprovado: false })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function aprovarChecklist(id, adminId) {
    const { data, error } = await supabase
        .from('carretas_checklists')
        .update({ aprovado: true, aprovado_por: adminId, aprovado_em: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function registrarManutencaoChecklist(id, observacao) {
    const { data, error } = await supabase
        .from('carretas_checklists')
        .update({ manutencao_registrada: true, obs_manutencao: observacao })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// CARREGAMENTOS / FRETES
// ─────────────────────────────────────────────────────────────────────────────
export const TIPOS_CALCULO_FRETE = [
    { value: 'percentual',  label: 'Percentual (%)' },
    { value: 'por_saca',    label: 'Por saca' },
    { value: 'por_tonelada',label: 'Por tonelada' },
    { value: 'por_carga',   label: 'Por carga (fixo)' },
];

export function calcularFrete(tipoCalculo, quantidade, valorBase) {
    if (!tipoCalculo || !valorBase) return 0;
    switch (tipoCalculo) {
        case 'percentual':   return (Number(quantidade) * Number(valorBase)) / 100;
        case 'por_saca':     return Number(quantidade) * Number(valorBase);
        case 'por_tonelada': return Number(quantidade) * Number(valorBase);
        case 'por_carga':    return Number(valorBase);
        default: return 0;
    }
}

export async function fetchCarregamentos(filters = {}) {
    let q = supabase
        .from('carretas_carregamentos')
        .select(`
            *,
            motorista:motorista_id(id, name),
            veiculo:veiculo_id(id, placa),
            empresa:empresa_id(id, nome)
        `)
        .order('data_carregamento', { ascending: false });

    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.empresaId)   q = q.eq('empresa_id', filters.empresaId);
    if (filters.dataInicio)  q = q.gte('data_carregamento', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('data_carregamento', filters.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createCarregamento(carregamento) {
    const valorFrete = calcularFrete(
        carregamento.tipo_calculo_frete,
        carregamento.quantidade,
        carregamento.valor_base_frete
    );
    const { data, error } = await supabase
        .from('carretas_carregamentos')
        .insert({ ...carregamento, valor_frete_calculado: valorFrete })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateCarregamento(id, updates) {
    const valorFrete = calcularFrete(
        updates.tipo_calculo_frete,
        updates.quantidade,
        updates.valor_base_frete
    );
    const { data, error } = await supabase
        .from('carretas_carregamentos')
        .update({ ...updates, valor_frete_calculado: valorFrete, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteCarregamento(id) {
    const { error } = await supabase.from('carretas_carregamentos').delete().eq('id', id);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPRESAS
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchEmpresas() {
    const { data, error } = await supabase
        .from('carretas_empresas')
        .select('*')
        .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createEmpresa(empresa) {
    const { data, error } = await supabase
        .from('carretas_empresas')
        .insert(empresa)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteEmpresa(id) {
    const { error } = await supabase.from('carretas_empresas').delete().eq('id', id);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTORISTAS CARRETEIROS (filtro por tipo)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchCarreteiros() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo')
        .eq('role', 'motorista')
        .eq('tipo_veiculo', 'carreta')
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function fetchTodosMotoristas() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo')
        .eq('role', 'motorista')
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}
