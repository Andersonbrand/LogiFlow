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
