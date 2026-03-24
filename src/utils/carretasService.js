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
    // Remove dependentes com FK para carretas_veiculos antes de excluir
    await supabase.from('carretas_checklists').delete().eq('veiculo_id', id);
    await supabase.from('carretas_ordens_servico').delete().eq('veiculo_id', id);
    await supabase.from('carretas_abastecimentos').delete().eq('veiculo_id', id);
    await supabase.from('carretas_despesas_extras').delete().eq('veiculo_id', id);
    // Desvincula viagens e carregamentos (mantém histórico, apenas remove referência)
    await supabase.from('carretas_viagens').update({ veiculo_id: null }).eq('veiculo_id', id);
    await supabase.from('carretas_carregamentos').update({ veiculo_id: null }).eq('veiculo_id', id);
    await supabase.from('carretas_registros_viagem').update({ veiculo_id: null }).eq('veiculo_id', id);
    const { error } = await supabase.from('carretas_veiculos').delete().eq('id', id);
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

export async function deleteChecklist(id) {
    const { error } = await supabase.from('carretas_checklists').delete().eq('id', id);
    if (error) throw error;
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

export async function updateEmpresa(id, empresa) {
    const { data, error } = await supabase
        .from('carretas_empresas')
        .update(empresa)
        .eq('id', id)
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

export async function deleteOrdemServico(id) {
    const { error } = await supabase.from('carretas_ordens_servico').delete().eq('id', id);
    if (error) throw error;
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
// Categorias padrão — usadas como fallback se a tabela ainda não existir
export const CATEGORIAS_DESPESA = [
    'Pneus', 'Peças', 'Acessórios', 'Oficina / Mão de obra',
    'Depreciação', 'Seguro', 'IPVA / Licenciamento', 'Lavagem', 'Outros',
];

// Busca categorias do banco (inclui as customizadas pelo admin)
export async function fetchCategoriasDespesa() {
    const { data, error } = await supabase
        .from('carretas_categorias_despesa')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome', { ascending: true });
    if (error) return CATEGORIAS_DESPESA; // fallback para lista estática
    return data?.map(c => c.nome) || CATEGORIAS_DESPESA;
}

// Admin cria nova categoria
export async function createCategoriaDespesa(nome) {
    const { data, error } = await supabase
        .from('carretas_categorias_despesa')
        .insert({ nome: nome.trim() })
        .select()
        .single();
    if (error) throw error;
    return data;
}

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
    // Extrai apenas os campos que existem na tabela — evita erro se alguma coluna
    // ainda não foi criada via migration (ex: fornecedor) ou se o form tem campos extras
    const payload = {
        veiculo_id:       despesa.veiculo_id       || null,
        categoria:        despesa.categoria        || 'Outros',
        descricao:        despesa.descricao        || null,
        valor:            Number(despesa.valor)    || 0,
        data_despesa:     despesa.data_despesa     || new Date().toISOString().split('T')[0],
        nota_fiscal:      despesa.nota_fiscal      || null,
        observacoes:      despesa.observacoes      || null,
        // Pagamento
        forma_pagamento:  despesa.forma_pagamento  || 'a_vista',
        tipo_pagamento:   despesa.tipo_pagamento   || 'pix',
        comprovante_url:  despesa.comprovante_url  || null,
        boletos:          despesa.boletos          || [],
        permuta_obs:      despesa.permuta_obs      || null,
        permuta_doc_url:  despesa.permuta_doc_url  || null,
        cheques:          despesa.cheques          || [],
        nf_itens:         despesa.nf_itens         || [],
    };

    // Tenta incluir fornecedor — se a coluna não existir ainda no banco, ignora silenciosamente
    if (despesa.fornecedor) payload.fornecedor = despesa.fornecedor;

    // Remove campos nulos para evitar conflito com NOT NULL constraints
    if (!payload.veiculo_id) delete payload.veiculo_id;

    const { data, error } = await supabase
        .from('carretas_despesas_extras')
        .insert(payload)
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .single();

    // Se erro for sobre coluna fornecedor não existir, tenta sem ela
    if (error && error.message?.includes('fornecedor')) {
        delete payload.fornecedor;
        const retry = await supabase
            .from('carretas_despesas_extras')
            .insert(payload)
            .select('*, veiculo:veiculo_id(id, placa, modelo)')
            .single();
        if (retry.error) throw retry.error;
        return retry.data;
    }

    if (error) throw error;
    return data;
}

export async function updateDespesaExtra(id, updates) {
    const payload = {
        veiculo_id:       updates.veiculo_id       || null,
        categoria:        updates.categoria        || 'Outros',
        descricao:        updates.descricao        || null,
        valor:            Number(updates.valor)    || 0,
        data_despesa:     updates.data_despesa     || null,
        nota_fiscal:      updates.nota_fiscal      || null,
        observacoes:      updates.observacoes      || null,
        forma_pagamento:  updates.forma_pagamento  || 'a_vista',
        tipo_pagamento:   updates.tipo_pagamento   || 'pix',
        comprovante_url:  updates.comprovante_url  || null,
        boletos:          updates.boletos          || [],
        permuta_obs:      updates.permuta_obs      || null,
        permuta_doc_url:  updates.permuta_doc_url  || null,
        cheques:          updates.cheques          || [],
        nf_itens:         updates.nf_itens         || [],
        updated_at:       new Date().toISOString(),
    };

    if (updates.fornecedor) payload.fornecedor = updates.fornecedor;
    if (!payload.veiculo_id) delete payload.veiculo_id;

    const { data, error } = await supabase
        .from('carretas_despesas_extras')
        .update(payload)
        .eq('id', id)
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .single();

    if (error && error.message?.includes('fornecedor')) {
        delete payload.fornecedor;
        const retry = await supabase
            .from('carretas_despesas_extras')
            .update(payload)
            .eq('id', id)
            .select('*, veiculo:veiculo_id(id, placa, modelo)')
            .single();
        if (retry.error) throw retry.error;
        return retry.data;
    }

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
export async function gerarNumeroRomaneioCarreta() {
    const ano = new Date().getFullYear();
    const { count } = await supabase
        .from('carretas_romaneios')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${ano}-01-01`);
    const seq = String((count || 0) + 1).padStart(4, '0');
    return `CROM-${ano}-${seq}`;
}

export async function fetchRomaneiosCarreta(filters = {}) {
    let q = supabase
        .from('carretas_romaneios')
        .select(`
            *,
            motorista:motorista_id(id, name),
            veiculo:veiculo_id(id, placa, modelo),
            aprovado_por_user:aprovado_por(id, name),
            carretas_romaneio_itens(
                id, quantidade, unidade, peso_total, descricao, observacoes,
                material:material_id(id, nome, unidade, peso)
            )
        `)
        .order('created_at', { ascending: false });

    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.veiculoId)   q = q.eq('veiculo_id',   filters.veiculoId);
    if (filters.status)      q = q.eq('status',        filters.status);
    if (filters.dataInicio)  q = q.gte('data_saida',   filters.dataInicio);
    if (filters.dataFim)     q = q.lte('data_saida',   filters.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createRomaneioCarreta(romaneio, itens = []) {
    const numero = await gerarNumeroRomaneioCarreta();
    const payload = { ...romaneio, numero };
    ['motorista_id','veiculo_id'].forEach(f => { if (payload[f] === '') payload[f] = null; });

    const { data: rom, error } = await supabase
        .from('carretas_romaneios')
        .insert(payload)
        .select('id, numero')
        .single();
    if (error) throw error;

    if (itens.length > 0) {
        const { error: ie } = await supabase
            .from('carretas_romaneio_itens')
            .insert(itens.map(it => ({
                romaneio_id:  rom.id,
                material_id:  it.material_id || null,
                descricao:    it.descricao || null,
                quantidade:   Number(it.quantidade) || 1,
                unidade:      it.unidade || 'ton',
                peso_total:   it.peso_total ? Number(it.peso_total) : null,
                observacoes:  it.observacoes || null,
            })));
        if (ie) throw ie;
    }

    // Retorna com joins
    const { data: full } = await supabase
        .from('carretas_romaneios')
        .select(`*, motorista:motorista_id(id, name), veiculo:veiculo_id(id, placa, modelo),
            carretas_romaneio_itens(id, quantidade, unidade, peso_total, descricao, material:material_id(id, nome, unidade, peso))`)
        .eq('id', rom.id)
        .single();
    return full;
}

export async function updateRomaneioCarreta(id, romaneio, itens) {
    const payload = { ...romaneio, updated_at: new Date().toISOString() };
    ['motorista_id','veiculo_id'].forEach(f => { if (payload[f] === '') payload[f] = null; });

    const { error } = await supabase.from('carretas_romaneios').update(payload).eq('id', id);
    if (error) throw error;

    if (itens !== undefined) {
        await supabase.from('carretas_romaneio_itens').delete().eq('romaneio_id', id);
        if (itens.length > 0) {
            await supabase.from('carretas_romaneio_itens').insert(
                itens.map(it => ({
                    romaneio_id: id,
                    material_id: it.material_id || null,
                    descricao:   it.descricao || null,
                    quantidade:  Number(it.quantidade) || 1,
                    unidade:     it.unidade || 'ton',
                    peso_total:  it.peso_total ? Number(it.peso_total) : null,
                    observacoes: it.observacoes || null,
                }))
            );
        }
    }

    const { data: full } = await supabase
        .from('carretas_romaneios')
        .select(`*, motorista:motorista_id(id, name), veiculo:veiculo_id(id, placa, modelo),
            carretas_romaneio_itens(id, quantidade, unidade, peso_total, descricao, material:material_id(id, nome, unidade, peso))`)
        .eq('id', id)
        .single();
    return full;
}

export async function aprovarRomaneioCarreta(id, adminId) {
    const { data, error } = await supabase
        .from('carretas_romaneios')
        .update({ aprovado: true, aprovado_por: adminId, aprovado_em: new Date().toISOString() })
        .eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteRomaneioCarreta(id) {
    const { error } = await supabase.from('carretas_romaneios').delete().eq('id', id);
    if (error) throw error;
}
