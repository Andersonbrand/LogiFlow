import { supabase } from './supabaseClient';

const TAXA_FERRAGEM = 0.009; // R$ 0,009 por kg = 0,9% = R$ 9,00 por tonelada
const BONUS_CIMENTO = 40.00; // R$ fixo por romaneio com cimento

// Calcula bonificação de um romaneio com base nos itens
export function calcularBonificacao(romaneio) {
    if (!romaneio) return { toneladasFerragem: 0, valorFerragem: 0, temCimento: false, valorCimento: 0, valorTotal: 0 };
    const itens = romaneio.romaneio_itens || [];

    let kgFerragem = 0;
    let temCimento = false;

    for (const item of itens) {
        if (!item) continue;
        const categoria = item.materials?.categoria_frete || '';
        const pesoItem = Number(item.peso_total) || 0;

        if (categoria.toLowerCase().includes('cimento')) {
            temCimento = true;
        } else {
            kgFerragem += pesoItem;
        }
    }

    const toneladasFerragem = kgFerragem / 1000;
    const valorFerragem = kgFerragem * TAXA_FERRAGEM; // R$ 0,009 × kg
    const valorCimento = temCimento ? BONUS_CIMENTO : 0;
    const valorTotal = valorFerragem + valorCimento;

    return {
        toneladasFerragem: Number(toneladasFerragem.toFixed(3)),
        valorFerragem: Number(valorFerragem.toFixed(2)),
        temCimento,
        valorCimento,
        valorTotal: Number(valorTotal.toFixed(2)),
    };
}

// Salva bonificação no banco
export async function salvarBonificacao(motoristaId, romaneioId, romaneio) {
    const calc = calcularBonificacao(romaneio);
    const { data, error } = await supabase
        .from('bonificacoes')
        .upsert({
            motorista_id: motoristaId,
            romaneio_id: romaneioId,
            toneladas_ferragem: calc.toneladasFerragem,
            valor_ferragem: calc.valorFerragem,
            tem_cimento: calc.temCimento,
            valor_cimento: calc.valorCimento,
            valor_total: calc.valorTotal,
        }, { onConflict: 'romaneio_id' })
        .select().single();
    if (error) throw error;
    return data;
}

// Busca bonificações de um motorista
export async function fetchBonificacoes(motoristaId, periodo) {
    let query = supabase
        .from('bonificacoes')
        .select('*, romaneios(numero, destino, saida, status)')
        .order('created_at', { ascending: false });

    if (motoristaId) query = query.eq('motorista_id', motoristaId);

    if (periodo) {
        const cut = new Date();
        cut.setDate(cut.getDate() - periodo);
        query = query.gte('created_at', cut.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

// Busca bonificações consolidadas — calcula diretamente dos romaneios aprovados
// (não depende da tabela bonificacoes estar preenchida)
export async function fetchBonificacoesConsolidadas() {
    // Busca romaneios que foram aprovados OU finalizados (compatível com registros antigos)
    // Alguns têm aprovado=true, outros têm status_aprovacao='aprovado', outros apenas status='Finalizado'
    const { data: romaneios, error } = await supabase
        .from('romaneios')
        .select(`
            id, numero, motorista, motorista_id, destino, saida, status, aprovado, status_aprovacao,
            romaneio_itens(id, quantidade, peso_total, material_id,
                materials(id, nome, categoria_frete))
        `)
        .or('aprovado.eq.true,status_aprovacao.eq.aprovado,status.eq.Finalizado')
        .order('created_at', { ascending: false });

    if (error) throw error;
    if (!romaneios || romaneios.length === 0) return [];

    // Busca nomes dos motoristas cadastrados (role = motorista)
    const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name')
        .eq('role', 'motorista');
    const nomesMap = {};
    for (const p of (profiles || [])) nomesMap[p.id] = p.name;

    // Agrupa por motorista (pelo nome do campo texto, pois motorista_id pode ser null)
    const porMotorista = {};
    for (const rom of romaneios) {
        const bonif = calcularBonificacao(rom);
        // Chave: motorista_id se existir, senão nome do motorista
        const chave = rom.motorista_id || rom.motorista || 'desconhecido';
        const nome = (rom.motorista_id && nomesMap[rom.motorista_id]) || rom.motorista || 'Sem nome';
        const pesoRom = (rom.romaneio_itens || []).reduce((s, it) => s + (Number(it.peso_total) || 0), 0);
        if (!porMotorista[chave]) {
            porMotorista[chave] = {
                motoristaId: rom.motorista_id,
                // campos que o admin/motorista renderizam:
                motorista: nome,
                nome,
                total_viagens: 0,
                romaneios: 0,
                peso_total: 0,
                toneladasTotal: 0,
                bonificacao_total: 0,
                valorTotal: 0,
            };
        }
        porMotorista[chave].total_viagens++;
        porMotorista[chave].romaneios++;
        porMotorista[chave].peso_total      += pesoRom;
        porMotorista[chave].toneladasTotal  += bonif.toneladasFerragem;
        porMotorista[chave].bonificacao_total += bonif.valorTotal;
        porMotorista[chave].valorTotal      += bonif.valorTotal;
    }

    return Object.values(porMotorista).sort((a, b) => b.bonificacao_total - a.bonificacao_total);
}
