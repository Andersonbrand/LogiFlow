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
    const payload = sanitizeUuids ? { ...viagem } : { ...viagem };
    ['motorista_id','veiculo_id'].forEach(f => { if (payload[f] === '') payload[f] = null; });
    const { data, error } = await supabase
        .from('carretas_viagens')
        .insert({ ...payload, numero, status: payload.status || 'Agendado' })
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
    // Apaga todos os registros dependentes antes (respeita foreign key constraints)
    await supabase.from('carretas_registros_viagem').delete().eq('veiculo_id', id);
    await supabase.from('carretas_checklists').delete().eq('veiculo_id', id);
    await supabase.from('carretas_abastecimentos').delete().eq('veiculo_id', id);
    await supabase.from('carretas_carregamentos').delete().eq('veiculo_id', id);
    const { error } = await supabase.from('carretas_veiculos').delete().eq('id', id);
    if (error) throw error;
}

export async function deleteChecklist(id) {
    const { error } = await supabase.from('carretas_checklists').delete().eq('id', id);
    if (error) throw error;
}

export async function deleteOrdemServico(id) {
    const { error } = await supabase.from('carretas_ordens_servico').delete().eq('id', id);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTOS DE COMBUSTÍVEL
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPostos() {
    const { data, error } = await supabase
        .from('carretas_postos')
        .select('*')
        .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createPosto(posto) {
    const { data, error } = await supabase
        .from('carretas_postos')
        .insert(posto)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updatePosto(id, updates) {
    const { data, error } = await supabase
        .from('carretas_postos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deletePosto(id) {
    const { error } = await supabase.from('carretas_postos').delete().eq('id', id);
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
    { value: 'por_saco',       label: 'Por saco' },
    { value: 'por_tonelada',   label: 'Por tonelada' },
    { value: 'por_carga',      label: 'Por carga (fixo)' },
    { value: 'percentual',     label: 'Percentual (%)' },
    { value: 'por_km',         label: 'Por KM (consumo do veículo)' },
];

// calcularFrete: para por_km, valorBase = preço do diesel (R$/L) e
// quantidade = distanciaKm; consumoVeiculo = km/L cadastrado no veículo
export function calcularFrete(tipoCalculo, quantidade, valorBase, consumoVeiculo) {
    if (!tipoCalculo || !valorBase) return 0;
    switch (tipoCalculo) {
        case 'percentual':   return (Number(quantidade) * Number(valorBase)) / 100;
        case 'por_saco':     return Number(quantidade) * Number(valorBase);
        case 'por_tonelada': return Number(quantidade) * Number(valorBase);
        case 'por_carga':    return Number(valorBase);
        case 'por_km': {
            // (distância / consumo) * preço diesel = custo combustível da viagem
            const consumo = Number(consumoVeiculo) || 1;
            return (Number(quantidade) / consumo) * Number(valorBase);
        }
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

function sanitizeUuids(obj) {
    // Converte strings vazias em campos UUID para null (evita erro do Postgres)
    const uuidFields = ['motorista_id', 'veiculo_id', 'empresa_id'];
    const out = { ...obj };
    uuidFields.forEach(f => { if (out[f] === '' || out[f] === undefined) out[f] = null; });
    return out;
}

export async function createCarregamento(carregamento) {
    const payload = sanitizeUuids(carregamento);
    const valorFrete = calcularFrete(
        payload.tipo_calculo_frete,
        payload.quantidade,
        payload.valor_base_frete,
        payload._consumoVeiculo
    );
    delete payload._consumoVeiculo;
    const { data, error } = await supabase
        .from('carretas_carregamentos')
        .insert({ ...payload, valor_frete_calculado: valorFrete })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateCarregamento(id, updates) {
    const payload = sanitizeUuids(updates);
    const valorFrete = calcularFrete(
        payload.tipo_calculo_frete,
        payload.quantidade,
        payload.valor_base_frete,
        payload._consumoVeiculo
    );
    delete payload._consumoVeiculo;
    const { data, error } = await supabase
        .from('carretas_carregamentos')
        .update({ ...payload, valor_frete_calculado: valorFrete, updated_at: new Date().toISOString() })
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
// CONFIGURAÇÃO DE PREÇOS DE ABASTECIMENTO (definido pelo admin)
// ─────────────────────────────────────────────────────────────────────────────
export const CONFIG_ABAST_KEY = 'carretas_config_abastecimento';

export async function fetchConfigAbastecimento() {
    const { data } = await supabase
        .from('carretas_config')
        .select('*')
        .eq('chave', CONFIG_ABAST_KEY)
        .single();
    return data ? JSON.parse(data.valor) : { preco_diesel: 0, preco_arla: 0 };
}

export async function saveConfigAbastecimento(config) {
    const { error } = await supabase
        .from('carretas_config')
        .upsert({ chave: CONFIG_ABAST_KEY, valor: JSON.stringify(config) }, { onConflict: 'chave' });
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTORISTAS CARRETEIROS (filtro por tipo)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchCarreteiros() {
    // Motoristas com tipo_veiculo = 'carreta' (role = 'motorista')
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: último dia do mês (evita erro com fevereiro, abril, etc)
function ultimoDiaMes(anoMes) {
    // anoMes = "2026-02"
    const [ano, mes] = anoMes.split('-').map(Number);
    return new Date(ano, mes, 0).getDate(); // dia 0 do mês seguinte = último dia do mês atual
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTROS DE VIAGEM (preenchido pelo carreteiro)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchRegistrosViagem(motoristaId) {
    const q = supabase
        .from('carretas_registros_viagem')
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .order('data_carregamento', { ascending: false });
    if (motoristaId) q.eq('motorista_id', motoristaId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createRegistroViagem(registro) {
    const { data, error } = await supabase
        .from('carretas_registros_viagem')
        .insert(registro)
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .single();
    if (error) throw error;
    return data;
}

export async function fetchAllRegistrosViagem(filters = {}) {
    let q = supabase
        .from('carretas_registros_viagem')
        .select('*, motorista:motorista_id(id, name), veiculo:veiculo_id(id, placa, modelo)')
        .order('data_carregamento', { ascending: false });
    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.dataInicio)  q = q.gte('data_carregamento', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('data_carregamento', filters.dataFim);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

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

// ─────────────────────────────────────────────────────────────────────────────
// ORDENS DE SERVIÇO (mecânico)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchOrdensServico(filters = {}) {
    let q = supabase
        .from('carretas_ordens_servico')
        .select('*, veiculo:veiculo_id(id, placa, modelo), mecanico:mecanico_id(id, name)')
        .order('created_at', { ascending: false });
    if (filters.mecanicoId) q = q.eq('mecanico_id', filters.mecanicoId);
    if (filters.status)     q = q.eq('status', filters.status);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createOrdemServico(ordem) {
    const { data, error } = await supabase
        .from('carretas_ordens_servico')
        .insert({ ...ordem, status: 'Pendente' })
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

export async function finalizarOrdemServico(id, mecanicoId, observacoes) {
    const { data, error } = await supabase
        .from('carretas_ordens_servico')
        .update({
            status: 'Finalizada',
            finalizada_por: mecanicoId,
            finalizada_em: new Date().toISOString(),
            obs_finalizacao: observacoes,
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
        .select('id, name, role')
        .eq('role', 'mecanico')
        .order('name');
    if (error) throw error;
    return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// DESPESAS EXTRAS (por veículo)
// ─────────────────────────────────────────────────────────────────────────────
export const CATEGORIAS_DESPESA = [
    'Pneus', 'Peças', 'Acessórios', 'Oficina / Mão de obra',
    'Depreciação', 'Seguro', 'IPVA / Licenciamento', 'Lavagem', 'Outros',
];

export async function fetchDespesasExtras(filters = {}) {
    let q = supabase
        .from('carretas_despesas_extras')
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .order('data_despesa', { ascending: false });
    if (filters.veiculoId)  q = q.eq('veiculo_id', filters.veiculoId);
    if (filters.categoria)  q = q.eq('categoria', filters.categoria);
    if (filters.dataInicio) q = q.gte('data_despesa', filters.dataInicio);
    if (filters.dataFim)    q = q.lte('data_despesa', filters.dataFim);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createDespesaExtra(despesa) {
    const { data, error } = await supabase
        .from('carretas_despesas_extras')
        .insert(despesa)
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .single();
    if (error) throw error;
    return data;
}

export async function updateDespesaExtra(id, updates) {
    const { data, error } = await supabase
        .from('carretas_despesas_extras')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteDespesaExtra(id) {
    const { error } = await supabase.from('carretas_despesas_extras').delete().eq('id', id);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIÁRIAS DE MOTORISTAS
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDiarias(filters = {}) {
    let q = supabase
        .from('carretas_diarias')
        .select('*, motorista:motorista_id(id, name), viagem:viagem_id(id, numero, destino)')
        .order('data_inicio', { ascending: false });
    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.dataInicio)  q = q.gte('data_inicio', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('data_inicio', filters.dataFim);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createDiaria(diaria) {
    // Calcula valor total: quantidade_dias × valor_dia
    const valorTotal = Number(diaria.quantidade_dias || 1) * Number(diaria.valor_dia || 0);
    const { data, error } = await supabase
        .from('carretas_diarias')
        .insert({ ...diaria, valor_total: valorTotal })
        .select('*, motorista:motorista_id(id, name)')
        .single();
    if (error) throw error;
    return data;
}

export async function updateDiaria(id, updates) {
    const valorTotal = Number(updates.quantidade_dias || 1) * Number(updates.valor_dia || 0);
    const { data, error } = await supabase
        .from('carretas_diarias')
        .update({ ...updates, valor_total: valorTotal, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteDiaria(id) {
    const { error } = await supabase.from('carretas_diarias').delete().eq('id', id);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTORISTAS DE CAMINHÃO (excluindo carreteiros)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchMotoristasCaminhao() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo')
        .eq('role', 'motorista')
        .or('tipo_veiculo.neq.carreta,tipo_veiculo.is.null')
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// ROMANEIOS DE CARRETA
// ─────────────────────────────────────────────────────────────────────────────

let _romaneioCounter = null;

async function nextRomaneioNumero() {
    const { data } = await supabase
        .from('carretas_romaneios')
        .select('numero')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    if (data?.numero) {
        const n = parseInt(data.numero.replace(/\D/g, ''), 10);
        return `ROM-${String((n || 0) + 1).padStart(5, '0')}`;
    }
    return 'ROM-00001';
}

export async function fetchRomaneios(filters = {}) {
    let q = supabase
        .from('carretas_romaneios')
        .select(`
            *,
            motorista:motorista_id(id, name),
            veiculo:veiculo_id(id, placa, modelo),
            itens:carretas_romaneio_itens(
                id, quantidade, unidade, peso_total, descricao, observacoes,
                material:material_id(id, nome, peso, unidade, percentual_frete, categoria_frete)
            )
        `)
        .order('created_at', { ascending: false });
    if (filters.status)      q = q.eq('status', filters.status);
    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.dataInicio)  q = q.gte('data_saida', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('data_saida', filters.dataFim);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createRomaneio(romaneio) {
    const { itens = [], ...payload } = romaneio;
    // Sanitize optional UUIDs
    if (!payload.motorista_id) delete payload.motorista_id;
    if (!payload.veiculo_id)   delete payload.veiculo_id;
    payload.numero = await nextRomaneioNumero();
    const { data, error } = await supabase
        .from('carretas_romaneios')
        .insert(payload)
        .select()
        .single();
    if (error) throw error;
    if (itens.length > 0) {
        const itensPay = itens.map(it => ({
            romaneio_id: data.id,
            material_id: it.material_id || null,
            descricao:   it.descricao   || null,
            quantidade:  Number(it.quantidade) || 1,
            unidade:     it.unidade     || 'ton',
            peso_total:  it.peso_total  ? Number(it.peso_total) : null,
            observacoes: it.observacoes || null,
        }));
        const { error: eItens } = await supabase.from('carretas_romaneio_itens').insert(itensPay);
        if (eItens) throw eItens;
    }
    return data;
}

export async function updateRomaneio(id, romaneio) {
    const { itens, ...payload } = romaneio;
    if (!payload.motorista_id) delete payload.motorista_id;
    if (!payload.veiculo_id)   delete payload.veiculo_id;
    payload.updated_at = new Date().toISOString();
    const { data, error } = await supabase
        .from('carretas_romaneios')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    if (itens !== undefined) {
        // Replace all itens
        await supabase.from('carretas_romaneio_itens').delete().eq('romaneio_id', id);
        if (itens.length > 0) {
            const itensPay = itens.map(it => ({
                romaneio_id: id,
                material_id: it.material_id || null,
                descricao:   it.descricao   || null,
                quantidade:  Number(it.quantidade) || 1,
                unidade:     it.unidade     || 'ton',
                peso_total:  it.peso_total  ? Number(it.peso_total) : null,
                observacoes: it.observacoes || null,
            }));
            const { error: eItens } = await supabase.from('carretas_romaneio_itens').insert(itensPay);
            if (eItens) throw eItens;
        }
    }
    return data;
}

export async function deleteRomaneio(id) {
    const { error } = await supabase.from('carretas_romaneios').delete().eq('id', id);
    if (error) throw error;
}

export const STATUS_ROMANEIO = ['Aguardando', 'Carregando', 'Em Trânsito', 'Entrega finalizada', 'Cancelado'];
export const STATUS_ROMANEIO_COLORS = {
    'Aguardando':          { bg: '#FEF9C3', text: '#B45309' },
    'Carregando':          { bg: '#DBEAFE', text: '#1D4ED8' },
    'Em Trânsito':         { bg: '#EDE9FE', text: '#7C3AED' },
    'Entrega finalizada':  { bg: '#D1FAE5', text: '#065F46' },
    'Cancelado':           { bg: '#F3F4F6', text: '#6B7280' },
};
