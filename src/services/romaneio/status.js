import { supabase } from '../supabaseClient';
import { STATUS_VEICULO } from './veiculo';

// ── Status update ─────────────────────────────────────────────────────────────
export async function updateRomaneioStatus(id, status) {
    const { data, error } = await supabase.from('romaneios')
        .update({ status }).eq('id', id).select('id, status, vehicle_id, placa').single();
    if (error) throw error;

    // Sincronizar status do veículo automaticamente
    const novoStatusVeiculo = STATUS_VEICULO[status];
    if (novoStatusVeiculo) {
        try {
            if (data.vehicle_id) {
                await supabase.from('vehicles')
                    .update({ status: novoStatusVeiculo })
                    .eq('id', data.vehicle_id);
            } else if (data.placa) {
                await supabase.from('vehicles')
                    .update({ status: novoStatusVeiculo })
                    .ilike('placa', data.placa.trim()); // ilike = case-insensitive
            }
        } catch (_) {}
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('notifications').insert({
            user_id: user.id, tipo:'status_change',
            titulo:'Status atualizado',
            mensagem:`Romaneio atualizado para "${status}"`,
            romaneio_id: id,
        });
    } catch (_) {}
    return data;
}

// Assina digitalmente a diária gerada automaticamente pelo romaneio (caminhões)
// como responsável (admin ou operador).
// `assinanteRole` (role do usuário no momento da assinatura: 'admin' | 'operador')
// define em qual campo da ficha impressa o nome aparece — Transporte (admin) ou
// Logística (operador). É guardado à parte do id porque o cargo do usuário pode
// mudar depois, e isso não deve alterar retroativamente uma diária já assinada.
export async function assinarDiariaRomaneio(id, campo, assinaturaTexto, assinanteId = null) {
    if (!['logistica', 'transporte'].includes(campo)) throw new Error('Campo de assinatura inválido');
    const { data, error } = await supabase
        .from('romaneios')
        .update({
            [`assinatura_diaria_${campo}`]: assinaturaTexto,
            [`assinatura_diaria_${campo}_at`]: new Date().toISOString(),
            [`assinatura_diaria_${campo}_por`]: assinanteId,
        })
        .eq('id', id)
        .select('id, numero, assinatura_diaria_logistica, assinatura_diaria_logistica_at, assinatura_diaria_transporte, assinatura_diaria_transporte_at')
        .single();
    if (error) throw error;
    return data;
}

// Remove a assinatura digital da diária gerada pelo romaneio, voltando ao
// estado "sem assinatura" (ação reservada a administradores na UI).
export async function desassinarDiariaRomaneio(id, campo) {
    if (!['logistica', 'transporte'].includes(campo)) throw new Error('Campo de assinatura inválido');
    const { data, error } = await supabase
        .from('romaneios')
        .update({
            [`assinatura_diaria_${campo}`]: null,
            [`assinatura_diaria_${campo}_at`]: null,
            [`assinatura_diaria_${campo}_por`]: null,
        })
        .eq('id', id)
        .select('id, numero, assinatura_diaria_logistica, assinatura_diaria_logistica_at, assinatura_diaria_transporte, assinatura_diaria_transporte_at')
        .single();
    if (error) throw error;
    return data;
}
