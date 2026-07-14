/**
 * carretasService.js
 * Serviços para o módulo Transporte - Carretas
 * Tabelas: carretas_viagens, carretas_veiculos, carretas_abastecimentos,
 *          carretas_checklists, carretas_carregamentos, carretas_empresas
 */
import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// BONIFICAÇÃO: Estoque, Urandi, Pindaí, Candiba e Pilões = R$60
//              Qualquer outro destino = R$120
// ─────────────────────────────────────────────────────────────────────────────
export const CIDADES_BONUS_BAIXO = [
    'estoque', 'urandi', 'pindai', 'pindaí', 'candiba', 'pilões', 'piloes',
];
export const BONUS_BAIXO  = 60;
export const BONUS_ALTO   = 120;

export function calcularBonusCarreteiro(destino, overrides = null) {
    if (!destino) return 0;
    const d = destino.toLowerCase().trim();
    const isBaixo = CIDADES_BONUS_BAIXO.some(c => d.includes(c));
    const bonusBaixo = Number(overrides?.bonusBaixo ?? BONUS_BAIXO);
    const bonusAlto  = Number(overrides?.bonusAlto  ?? BONUS_ALTO);
    return isBaixo ? bonusBaixo : bonusAlto;
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

export async function updateAbastecimento(id, abast) {
    const { data, error } = await supabase
        .from('carretas_abastecimentos')
        .update(abast)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
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
    if (filters.dataInicio)  q = q.gte('created_at', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('created_at', filters.dataFim + 'T23:59:59');

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

export async function updateChecklist(id, fields) {
    const { data, error } = await supabase
        .from('carretas_checklists')
        .update(fields)
        .eq('id', id)
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
            motorista:motorista_id(id, name, is_terceiro),
            veiculo:veiculo_id(id, placa),
            empresa:empresa_id(id, nome)
        `)
        .order('data_carregamento', { ascending: false });

    if (filters.motoristaId)               q = q.eq('motorista_id', filters.motoristaId);
    if (filters.empresaId)                 q = q.eq('empresa_id', filters.empresaId);
    if (filters.dataInicio)                q = q.gte('data_carregamento', filters.dataInicio);
    if (filters.dataFim)                   q = q.lte('data_carregamento', filters.dataFim);
    if (filters.is_terceiro !== undefined) q = q.eq('is_terceiro', filters.is_terceiro);
    if (filters.is_retira !== undefined)   q = q.eq('is_retira', filters.is_retira);
    else if (filters.is_terceiro === false) q = q.eq('is_retira', false); // por padrão, frota não inclui retira

    const { data, error } = await q;
    if (error) throw error;

    // Garante exclusão de registros de motoristas terceirizados mesmo que is_terceiro
    // esteja false/null no registro (dados legados antes da flag existir)
    if (filters.is_terceiro === false) {
        return (data || []).filter(c => !c.motorista?.is_terceiro);
    }

    return data || [];
}

function sanitizeUuids(obj) {
    // Converte strings vazias em campos UUID para null (evita erro do Postgres)
    const uuidFields = ['motorista_id', 'veiculo_id', 'empresa_id'];
    const out = { ...obj };
    uuidFields.forEach(f => { if (out[f] === '' || out[f] === undefined) out[f] = null; });
    return out;
}

// CIF: apenas volume, sem frete e sem bônus
function isCIF(empresa_origem) {
    const s = (empresa_origem || '').toUpperCase();
    return s.startsWith('CIF_') || s.includes('|CIF_');
}

// Extrai o nome da coluna de um erro de schema cache do PostgREST
// Ex: "Could not find the 'nome_cliente' column of 'carretas_carregamentos' in the schema cache"
function _missingColumnFromError(error) {
    const msg = error?.message || '';
    const m = msg.match(/Could not find the '([^']+)' column/);
    return m ? m[1] : null;
}

export async function createCarregamento(carregamento) {
    const payload = sanitizeUuids(carregamento);
    // CIF não gera frete calculado
    const valorFrete = isCIF(payload.empresa_origem) ? 0 : calcularFrete(
        payload.tipo_calculo_frete,
        payload.quantidade,
        payload.valor_base_frete,
        payload._consumoVeiculo
    );
    delete payload._consumoVeiculo;

    let insertPayload = { ...payload, valor_frete_calculado: valorFrete };
    for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await supabase
            .from('carretas_carregamentos')
            .insert(insertPayload)
            .select()
            .single();
        if (!error) return data;
        const missing = _missingColumnFromError(error);
        if (missing && missing in insertPayload) {
            // Coluna ainda não existe no banco (migração pendente) — remove e tenta novamente
            const { [missing]: _omit, ...rest } = insertPayload;
            insertPayload = rest;
            continue;
        }
        throw error;
    }
    throw new Error('Falha ao salvar carregamento após múltiplas tentativas.');
}

export async function updateCarregamento(id, updates) {
    const payload = sanitizeUuids(updates);
    // CIF não gera frete calculado
    const valorFrete = isCIF(payload.empresa_origem) ? 0 : calcularFrete(
        payload.tipo_calculo_frete,
        payload.quantidade,
        payload.valor_base_frete,
        payload._consumoVeiculo
    );
    delete payload._consumoVeiculo;

    let updatePayload = { ...payload, valor_frete_calculado: valorFrete, updated_at: new Date().toISOString() };
    for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await supabase
            .from('carretas_carregamentos')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();
        if (!error) return data;
        const missing = _missingColumnFromError(error);
        if (missing && missing in updatePayload) {
            const { [missing]: _omit, ...rest } = updatePayload;
            updatePayload = rest;
            continue;
        }
        throw error;
    }
    throw new Error('Falha ao atualizar carregamento após múltiplas tentativas.');
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
        .select('id, name, role, tipo_veiculo, is_terceiro')
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
    let q = supabase
        .from('carretas_registros_viagem')
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .order('data_carregamento', { ascending: false });
    if (motoristaId) q = q.eq('motorista_id', motoristaId);
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

export async function updateRegistroViagem(id, registro) {
    const { data, error } = await supabase
        .from('carretas_registros_viagem')
        .update(registro)
        .eq('id', id)
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .single();
    if (error) throw error;
    return data;
}

export async function deleteRegistroViagem(id) {
    const { error } = await supabase.from('carretas_registros_viagem').delete().eq('id', id);
    if (error) throw error;
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
        .filter(([, ok]) => !ok)
        .map(([id]) => CHECKLIST_ITENS.find(i => i.id === id)?.label || id);
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

// Dar baixa em boleto de despesa extra de carretas
export async function pagarBoletoCarreta(despesaId, boletoIdx) {
    const { data: current } = await supabase
        .from('carretas_despesas_extras')
        .select('boletos')
        .eq('id', despesaId)
        .single();
    const boletos = [...(current?.boletos || [])];
    if (boletos[boletoIdx]) boletos[boletoIdx] = { ...boletos[boletoIdx], pago: true, pago_em: new Date().toISOString() };
    const { data, error } = await supabase
        .from('carretas_despesas_extras')
        .update({ boletos, updated_at: new Date().toISOString() })
        .eq('id', despesaId).select().single();
    if (error) throw error;
    return data;
}

// Revogar baixa de boleto de despesa extra de carretas
export async function revogarBoletoCarreta(despesaId, boletoIdx) {
    const { data: current } = await supabase
        .from('carretas_despesas_extras')
        .select('boletos')
        .eq('id', despesaId)
        .single();
    const boletos = [...(current?.boletos || [])];
    if (boletos[boletoIdx]) {
        const { pago_em, ...rest } = boletos[boletoIdx];
        boletos[boletoIdx] = { ...rest, pago: false };
    }
    const { data, error } = await supabase
        .from('carretas_despesas_extras')
        .update({ boletos, updated_at: new Date().toISOString() })
        .eq('id', despesaId).select().single();
    if (error) throw error;
    return data;
}

// Dar baixa em parcela de cartão de despesa extra de carretas
export async function pagarParcelaCartaoCarreta(despesaId, parcelaIdx) {
    const { data: current } = await supabase
        .from('carretas_despesas_extras')
        .select('parcelas_cartao')
        .eq('id', despesaId)
        .single();
    const parcelas = [...(current?.parcelas_cartao || [])];
    if (parcelas[parcelaIdx]) parcelas[parcelaIdx] = { ...parcelas[parcelaIdx], pago: true, pago_em: new Date().toISOString() };
    const { data, error } = await supabase
        .from('carretas_despesas_extras')
        .update({ parcelas_cartao: parcelas, updated_at: new Date().toISOString() })
        .eq('id', despesaId).select().single();
    if (error) throw error;
    return data;
}

// Revogar baixa de parcela de cartão de despesa extra de carretas
export async function revogarParcelaCartaoCarreta(despesaId, parcelaIdx) {
    const { data: current } = await supabase
        .from('carretas_despesas_extras')
        .select('parcelas_cartao')
        .eq('id', despesaId)
        .single();
    const parcelas = [...(current?.parcelas_cartao || [])];
    if (parcelas[parcelaIdx]) {
        const { pago_em, ...rest } = parcelas[parcelaIdx];
        parcelas[parcelaIdx] = { ...rest, pago: false };
    }
    const { data, error } = await supabase
        .from('carretas_despesas_extras')
        .update({ parcelas_cartao: parcelas, updated_at: new Date().toISOString() })
        .eq('id', despesaId).select().single();
    if (error) throw error;
    return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIÁRIAS DE MOTORISTAS
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDiarias(filters = {}) {
    let q = supabase
        .from('carretas_diarias')
        .select('*, motorista:motorista_id(id, name, tipo_veiculo), viagem:viagem_id(id, numero, destino), veiculo:veiculo_id(id, placa, modelo)')
        .order('data_inicio', { ascending: false });
    if (filters.motoristaId)  q = q.eq('motorista_id', filters.motoristaId);
    if (filters.dataInicio)   q = q.gte('data_inicio', filters.dataInicio);
    if (filters.dataFim)      q = q.lte('data_inicio', filters.dataFim);
    // Filtro por lista de IDs de motoristas — separa carretas de caminhões
    if (Array.isArray(filters.motoristasIds) && filters.motoristasIds.length > 0)
        q = q.in('motorista_id', filters.motoristasIds);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

function sanitizeDiaria(obj) {
    // Campos UUID não podem ser string vazia — converte para null
    const uuidFields = ['motorista_id', 'viagem_id', 'veiculo_id'];
    const out = { ...obj };
    uuidFields.forEach(f => { if (out[f] === '' || out[f] === undefined) out[f] = null; });
    return out;
}

export async function createDiaria(diaria) {
    const payload = sanitizeDiaria(diaria);
    const valorTotal = Number(payload.quantidade_dias || 1) * Number(payload.valor_dia || 0);
    const { data, error } = await supabase
        .from('carretas_diarias')
        .insert({ ...payload, valor_total: valorTotal })
        .select('*, motorista:motorista_id(id, name)')
        .single();
    if (error) throw error;
    return data;
}

export async function updateDiaria(id, updates) {
    const payload = sanitizeDiaria(updates);
    const valorTotal = Number(payload.quantidade_dias || 1) * Number(payload.valor_dia || 0);
    const { data, error } = await supabase
        .from('carretas_diarias')
        .update({ ...payload, valor_total: valorTotal, updated_at: new Date().toISOString() })
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

/**
 * Busca um romaneio existente com mesmo motorista, destino e data_saida
 * em qualquer das duas tabelas (carretas_romaneios ou romaneios do admin).
 * Retorna o número existente, ou null se não encontrar.
 */
async function buscarNumeroExistente({ motorista_id, motoristaNome, destino, data_saida }) {
    if (!destino || !data_saida) return null;

    const destinoNorm = (destino || '').trim().toLowerCase();
    const dataStr     = (data_saida || '').substring(0, 10); // YYYY-MM-DD

    // ── Busca na tabela carretas_romaneios (motorista + admin carretas) ──
    {
        let q = supabase
            .from('carretas_romaneios')
            .select('numero, motorista_id, destino, data_saida')
            .not('numero', 'is', null);
        if (motorista_id) q = q.eq('motorista_id', motorista_id);
        const { data: rows } = await q;
        const match = (rows || []).find(r =>
            (r.destino || '').trim().toLowerCase() === destinoNorm &&
            (r.data_saida || '').substring(0, 10) === dataStr
        );
        if (match?.numero) return match.numero;
    }

    // ── Busca na tabela romaneios (admin — sistema principal) ──
    {
        let q = supabase
            .from('romaneios')
            .select('numero, motorista_id, motorista, destino, saida')
            .not('numero', 'is', null);
        if (motorista_id) q = q.eq('motorista_id', motorista_id);
        else if (motoristaNome) q = q.ilike('motorista', `%${motoristaNome.trim()}%`);
        const { data: rows } = await q;
        const match = (rows || []).find(r =>
            (r.destino || '').trim().toLowerCase() === destinoNorm &&
            (r.saida || '').substring(0, 10) === dataStr
        );
        if (match?.numero) return match.numero;
    }

    return null;
}

/**
 * Gera o próximo número sequencial considerando as duas tabelas,
 * garantindo que não haja colisão entre romaneios do admin e do motorista.
 */
async function nextRomaneioNumero() {
    // IMPORTANTE: filtra apenas números no formato ROM-XXXXX.
    // Sem esse filtro, números de pedido (ex: 8836898) ou timestamps gravados
    // no campo `numero` por registros de motoristas seriam tratados como parte
    // da sequência, gerando números absurdamente grandes.
    // item 5: sequência independente — considera apenas os romaneios do próprio
    // módulo de carretas (carretas_romaneios), sem misturar com a tabela `romaneios`.
    const isRomNum = (str) => typeof str === 'string' && /^ROM-/i.test(str.trim());
    const parseNum = (str) => isRomNum(str) ? (parseInt(str.replace(/\D/g, ''), 10) || 0) : 0;

    const { data: todosCarretas } = await supabase.from('carretas_romaneios').select('numero');
    const nums = (todosCarretas || []).map(r => parseNum(r.numero)).filter(n => n > 0);
    const maxN = nums.length > 0 ? Math.max(...nums) : 0;
    return `ROM-${String(maxN + 1).padStart(3, '0')}`;
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
    // Admin vê TODOS os romaneios — base para DRE e cálculos financeiros
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
    payload.lancado_por_motorista = false; // criado pelo admin
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
    // Não deletar veiculo_id quando é undefined — só quando explicitamente vazio
    if (payload.motorista_id === '') delete payload.motorista_id;
    if (payload.veiculo_id === '')   delete payload.veiculo_id;
    payload.updated_at = new Date().toISOString();
    const { data, error } = await supabase
        .from('carretas_romaneios')
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle(); // evita erro "Cannot coerce to single JSON object" quando RLS filtra
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

// ─────────────────────────────────────────────────────────────────────────────
// FORNECEDORES DE DESPESAS (Carretas)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchFornecedoresCarretas() {
    const { data, error } = await supabase
        .from('carretas_fornecedores')
        .select('*')
        .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createFornecedorCarretas(fornecedor) {
    const { data, error } = await supabase
        .from('carretas_fornecedores')
        .insert(fornecedor)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateFornecedorCarretas(id, updates) {
    const { data, error } = await supabase
        .from('carretas_fornecedores')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteFornecedorCarretas(id) {
    const { error } = await supabase.from('carretas_fornecedores').delete().eq('id', id);
    if (error) throw error;
}

// ─── BONIFICAÇÕES EXTRAS ──────────────────────────────────────────────────────
export async function fetchBonificacoesExtras(filters = {}) {
    let q = supabase
        .from('carretas_bonificacoes_extras')
        .select(`
            *,
            motorista:motorista_id(id, name),
            criador:criado_por(id, name)
        `)
        .order('data', { ascending: false });

    if (filters.motorista_id) q = q.eq('motorista_id', filters.motorista_id);
    if (filters.dataInicio)   q = q.gte('data', filters.dataInicio);
    if (filters.dataFim)      q = q.lte('data', filters.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createBonificacaoExtra(extra) {
    const { data, error } = await supabase
        .from('carretas_bonificacoes_extras')
        .insert(extra)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateBonificacaoExtra(id, updates) {
    const { data, error } = await supabase
        .from('carretas_bonificacoes_extras')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteBonificacaoExtra(id) {
    const { error } = await supabase
        .from('carretas_bonificacoes_extras')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
// PONTOS DE PARADA — registros de chegada/saída em locais
// ═══════════════════════════════════════════════════════════════

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
    const { error } = await supabase
        .from('carretas_pontos_parada')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
// ROMANEIOS DO CARRETEIRO — busca da tabela carretas_romaneios
// ═══════════════════════════════════════════════════════════════

export async function fetchRomaneiosCarreteiro(motoristaId) {
    if (!motoristaId) return [];
    const { data, error } = await supabase
        .from('carretas_romaneios')
        .select(`
            id, numero, status, tipo_carga, data_saida, data_chegada, destino,
            toneladas, empresa, valor_frete, aprovado, observacoes, numero_nf,
            lancado_por_motorista,
            veiculo:veiculo_id(id, placa, modelo),
            carretas_romaneio_itens(id, descricao, quantidade, unidade, peso_total)
        `)
        .eq('motorista_id', motoristaId)
        .order('data_saida', { ascending: false });
    if (error) throw error;
    return data || [];
}

// ═══════════════════════════════════════════════════════════════
// ROMANEIO DE FERRAGENS — registrado pelo próprio motorista
// ═══════════════════════════════════════════════════════════════

export async function createRomaneioFerragem(payload) {
    const {
        numero_romaneio, // número ROM informado pelo motorista (opcional)
        ...rest
    } = payload;

    // ── Caso 1: motorista informou um número de romaneio existente ────────────
    if (numero_romaneio?.trim()) {
        const numeroNorm = numero_romaneio.trim().toUpperCase();
        const { data: rowsExist } = await supabase
            .from('carretas_romaneios')
            .select('id, numero, tipo_carga, motorista_id')
            .eq('numero', numeroNorm)
            .limit(1);
        const existente = rowsExist?.[0] ?? null;

        if (existente) {
            // Romaneio já existe → vincula os dados do motorista a ele
            const { data, error } = await supabase
                .from('carretas_romaneios')
                .update({
                    numero_nf:   rest.numero_nf,
                    data_saida:  rest.data_saida,
                    veiculo_id:  rest.veiculo_id,
                    destino:     rest.destino     || existente.destino,
                    toneladas:   rest.toneladas   ?? null,
                    empresa:     rest.empresa     ?? null,
                    observacoes: rest.observacoes ?? null,
                    motorista_id: rest.motorista_id || existente.motorista_id,
                    tipo_carga:  'ferragem',
                    lancado_por_motorista: true,
                })
                .eq('id', existente.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        }

        // Número informado mas não existe → cria com esse número
        const { data, error } = await supabase
            .from('carretas_romaneios')
            .insert({
                ...rest,
                numero: numeroNorm,
                tipo_carga: 'ferragem',
                status: 'Aguardando',
                lancado_por_motorista: true,
            })
            .select()
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Registro bloqueado por política de acesso. Execute a migration fix_rls_motorista_ferragem.sql no Supabase.');
        return data;
    }

    // ── Caso 2: motorista não informou número → gera sequencial ──────────────
    let numero = await nextRomaneioNumero();
    // Garante unicidade contra race condition
    for (let t = 0; t < 5; t++) {
        const { data: existe } = await supabase
            .from('carretas_romaneios')
            .select('id')
            .eq('numero', numero)
            .limit(1)
            .maybeSingle();
        if (!existe) break;
        await new Promise(r => setTimeout(r, 120));
        numero = await nextRomaneioNumero();
    }

    const { data, error } = await supabase
        .from('carretas_romaneios')
        .insert({
            ...rest,
            numero,
            tipo_carga: 'ferragem',
            status: 'Aguardando',
            lancado_por_motorista: true,
        })
        .select()
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Registro bloqueado por política de acesso. Execute a migration fix_rls_motorista_ferragem.sql no Supabase.');
    return data;
}


export async function fetchRomaneiosFerragem(filters = {}) {
    // Filtra romaneios de tipo 'ferragem' ou lançados pelo motorista.
    // Problema de data: registros podem ter data_saida preenchida (motorista
    // escolheu a data) ou nula (não preenchida — cai no created_at).
    // Solução: quando há filtro de período, aplicamos o filtro na data_saida
    // apenas para registros que a possuem, e usamos created_at para os demais
    // via dois fetches paralelos, depois deduplicamos por id.
    const baseSelect = `
        *,
        motorista:motorista_id(id, name),
        veiculo:veiculo_id(id, placa, modelo),
        itens:carretas_romaneio_itens(
            id, quantidade, unidade, peso_total, descricao, observacoes,
            material:material_id(id, nome, peso, unidade, percentual_frete, categoria_frete)
        )
    `;
    const baseOr = 'tipo_carga.eq.ferragem,lancado_por_motorista.eq.true';

    if (!filters.dataInicio && !filters.dataFim) {
        // Sem filtro de data: busca tudo normalmente
        let q = supabase.from('carretas_romaneios').select(baseSelect)
            .or(baseOr).order('data_saida', { ascending: false, nullsFirst: false });
        if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
        if (filters.status)      q = q.eq('status', filters.status);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    }

    // Com filtro de data: busca por data_saida E por created_at separadamente,
    // então funde e deduplica — assim registros sem data_saida não "vazam" entre
    // meses e registros com data_saida são filtrados corretamente.
    const buildQ = (dateField) => {
        let q = supabase.from('carretas_romaneios').select(baseSelect).or(baseOr)
            .order('data_saida', { ascending: false, nullsFirst: false });
        if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
        if (filters.status)      q = q.eq('status', filters.status);
        if (filters.dataInicio)  q = q.gte(dateField, filters.dataInicio);
        if (filters.dataFim)     q = q.lte(dateField, dateField === 'data_saida' ? filters.dataFim : filters.dataFim + 'T23:59:59.999Z');
        return q;
    };

    const [r1, r2] = await Promise.all([buildQ('data_saida'), buildQ('created_at')]);
    if (r1.error) throw r1.error;
    if (r2.error) throw r2.error;

    // Deduplica: prioriza o registro de r1 (filtrado por data_saida) sobre r2
    const seen = new Set();
    const merged = [];
    for (const row of [...(r1.data || []), ...(r2.data || [])]) {
        if (!seen.has(row.id)) { seen.add(row.id); merged.push(row); }
    }
    merged.sort((a, b) => {
        const da = a.data_saida || a.created_at || '';
        const db = b.data_saida || b.created_at || '';
        return db.localeCompare(da);
    });
    return merged;
}

// ─── Tabela de Fretes por Cidade ─────────────────────────────────────────────
export async function fetchFretesCidades(tipo = 'frota') {
    const { data, error } = await supabase
        .from('carretas_fretes')
        .select('id, cidade, km, frete_por_saco')
        .eq('tipo', tipo)
        .order('cidade', { ascending: true });
    if (error) throw error;
    return data || [];
}

// ─── Helpers de frota separada ────────────────────────────────────────────────

// Veículos APENAS da frota própria (is_terceiro = false ou null)
// Veículos da frota própria (is_terceiro != true)
export async function fetchVeiculosProprios() {
    const { data, error } = await supabase
        .from('carretas_veiculos')
        .select('*')
        .neq('is_terceiro', true)
        .order('placa', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Veículos terceirizados (is_terceiro = true)
export async function fetchVeiculosTerceiros() {
    const { data, error } = await supabase
        .from('carretas_veiculos')
        .select('*')
        .eq('is_terceiro', true)
        .order('placa', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Motoristas da frota própria (is_terceiro != true)
export async function fetchMotoristasProprios() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo, is_terceiro')
        .eq('role', 'motorista')
        .neq('is_terceiro', true)
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Apenas carreteiros da frota própria (tipo_veiculo = 'carreta' e não terceirizado)
export async function fetchCarreteirosPropriosOnly() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo, is_terceiro')
        .eq('role', 'motorista')
        .eq('tipo_veiculo', 'carreta')
        .neq('is_terceiro', true)
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Motoristas terceirizados (is_terceiro = true)
export async function fetchMotoristasTerceiros() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo, is_terceiro')
        .eq('role', 'motorista')
        .eq('is_terceiro', true)
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// RODÍZIO DE ENVIOS DE AÇO
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchEnviosAco(filters = {}) {
    let q = supabase
        .from('carretas_envios_aco')
        .select('*, motorista:motorista_id(id, name)')
        .order('data_envio', { ascending: false });
    if (filters.dataInicio) q = q.gte('data_envio', filters.dataInicio);
    if (filters.dataFim)    q = q.lte('data_envio', filters.dataFim);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function registrarEnvioAco({ motoristaId, dataEnvio, destino, observacoes, registradoPor }) {
    const { data, error } = await supabase
        .from('carretas_envios_aco')
        .insert({
            motorista_id: motoristaId,
            data_envio: dataEnvio || new Date().toISOString().slice(0, 10),
            destino: destino || null,
            observacoes: observacoes || null,
            registrado_por: registradoPor || null,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function excluirEnvioAco(id) {
    const { error } = await supabase.from('carretas_envios_aco').delete().eq('id', id);
    if (error) throw error;
}