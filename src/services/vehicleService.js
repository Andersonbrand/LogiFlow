import { supabase } from './supabaseClient';

// Converte snake_case do banco → camelCase do frontend
function toFront(v) {
    if (!v) return v;
    return {
        ...v,
        capacidadePeso: v.capacidade_peso,
        ultimaUtilizacao: v.ultima_utilizacao,
        historico: [],
    };
}

// Converte camelCase do frontend → snake_case do banco
function toDb(v) {
    const { capacidadePeso, capacidadeVolume, ultimaUtilizacao, historico, id, ...rest } = v;
    return {
        ...rest,
        ...(capacidadePeso !== undefined && { capacidade_peso: capacidadePeso }),
        ...(ultimaUtilizacao !== undefined && { ultima_utilizacao: ultimaUtilizacao }),
    };
}

export async function fetchVehicles() {
    const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('placa', { ascending: true });
    if (error) throw error;
    return data.map(toFront);
}

// Apenas os caminhões cadastrados na página de Veículos (tipo = 'Caminhão').
// Usado em outros módulos (Ordens de Serviço, motoristas de caminhão) que
// precisam do filtro/seleção de placas de caminhão vindas do cadastro central
// de veículos, e não do cadastro específico de frota de carretas.
export async function fetchCaminhoesPlacas() {
    const all = await fetchVehicles();
    return all.filter(v => v.tipo === 'Caminhão');
}

export async function createVehicle(vehicle) {
    const payload = toDb(vehicle);
    const { data, error } = await supabase
        .from('vehicles')
        .insert(payload)
        .select()
        .single();
    if (error) throw error;
    return toFront(data);
}

export async function updateVehicle(id, vehicle) {
    const payload = toDb(vehicle);
    const { data, error } = await supabase
        .from('vehicles')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return toFront(data);
}

export async function deleteVehicle(id) {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) throw error;
}

export async function fetchVehicleHistory(vehicleId) {
    const { data, error } = await supabase
        .from('vehicle_history')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('data', { ascending: false });
    if (error) throw error;
    return data;
}

export async function addVehicleHistory(vehicleId, entry) {
    const { data, error } = await supabase
        .from('vehicle_history')
        .insert({ ...entry, vehicle_id: vehicleId })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ── Cálculo de consumo estimado ───────────────────────────────────────────────
export function calcularConsumoEstimado(distanciaKm, consumoKmL) {
    if (!distanciaKm || !consumoKmL || consumoKmL <= 0) return null;
    return Number((distanciaKm / consumoKmL).toFixed(2)); // litros
}

// Intervalo [início, início do mês seguinte) para um valor "YYYY-MM"
function intervaloDoMes(mes) {
    const [y, m] = mes.split('-').map(Number);
    const prox = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    return { ini: `${mes}-01`, fim: `${prox}-01` };
}

/**
 * Romaneios de um veículo (por vehicle_id; se vazio, tenta pela placa).
 * `mes` = 'YYYY-MM' ou '' (todos, limitado a 200).
 */
export async function fetchRomaneiosDoVeiculo(vehicle, mes) {
    const cols = 'id, numero, motorista, destino, status, saida, peso_total, valor_frete';
    const aplicaMes = (q) => {
        if (!mes) return q.limit(200);
        const { ini, fim } = intervaloDoMes(mes);
        return q.gte('saida', ini).lt('saida', fim);
    };
    if (vehicle.id) {
        const { data: byId } = await aplicaMes(
            supabase.from('romaneios').select(cols).eq('vehicle_id', vehicle.id)
        ).order('saida', { ascending: false });
        if (byId && byId.length > 0) return byId;
    }
    if (vehicle.placa) {
        const { data: byPlaca } = await aplicaMes(
            supabase.from('romaneios').select(cols).ilike('placa', vehicle.placa.trim())
        ).order('saida', { ascending: false });
        return byPlaca || [];
    }
    return [];
}
