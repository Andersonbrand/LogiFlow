import { supabase } from '../supabaseClient';

// Mapa de status do romaneio → status do veículo
export const STATUS_VEICULO = {
    'Em Trânsito': 'Em Trânsito',
    'Carregando':  'Em Trânsito',
    'Aguardando':  'Disponível',
    'Finalizado':  'Disponível',
    'Cancelado':   'Disponível',
};

// Helper: sincroniza status do veículo no banco
export async function sincronizarStatusVeiculo(vehicleId, placa, statusRomaneio) {
    const novoStatus = STATUS_VEICULO[statusRomaneio];
    if (!novoStatus) return;
    try {
        if (vehicleId) {
            await supabase.from('vehicles').update({ status: novoStatus }).eq('id', vehicleId);
        } else if (placa) {
            await supabase.from('vehicles').update({ status: novoStatus })
                .ilike('placa', placa.trim()); // ilike = case-insensitive
        }
    } catch (_) {}
}
