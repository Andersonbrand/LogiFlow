/**
 * rotaGeo.js — Lógica de corredores geográficos a partir de Guanambi, BA
 * Os corredores agora são carregados do Supabase (editáveis pelo admin).
 * Fallback para CORREDORES_PADRAO se banco indisponível.
 */
import { fetchCorredores, CORREDORES_PADRAO } from './corredoresService';

// Cache local de corredores carregados
let _corredores = null;

export async function carregarCorredores() {
    _corredores = await fetchCorredores();
    return _corredores;
}

function getCorredores() {
    return _corredores || CORREDORES_PADRAO;
}

function normalizarCidade(cidade) {
    if (!cidade) return '';
    return cidade
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

export function getCorredorDaCidade(destino) {
    if (!destino) return null;
    const cidade = normalizarCidade(destino.split(',')[0]);
    for (const corredor of getCorredores()) {
        const cidades = corredor.cidades || [];
        if (cidades.some(c => {
            const cn = normalizarCidade(c);
            return cn === cidade || cidade.includes(cn) || cn.includes(cidade);
        })) {
            return corredor.nome;
        }
    }
    return null;
}

export function getLabelCorredor(nome) {
    const c = getCorredores().find(c => c.nome === nome);
    return c?.label || nome;
}

export function getIconeCorredor(nome) {
    const c = getCorredores().find(c => c.nome === nome);
    return c?.icone || 'MapPin';
}

export function getAllCorredores() {
    return getCorredores();
}

export const LABEL_CORREDOR = new Proxy({}, {
    get(_, nome) {
        return getLabelCorredor(nome);
    }
});

/**
 * Calcula grupos de consolidação:
 * - Mesmo corredor geográfico
 * - Pelo menos 1 romaneio com veículo < 40% de capacidade
 */
export function calcularGruposConsolidacao(romaneios, vehicles) {
    if (!romaneios?.length) return [];

    const utilizacaoVeiculo = {};
    vehicles.forEach(v => {
        const cap = Number(v.capacidade_peso || v.capacidadePeso || 0);
        if (!cap) return;
        const romAtivo = romaneios.find(r =>
            (r.vehicle_id && String(r.vehicle_id) === String(v.id)) ||
            (r.placa && v.placa && r.placa.trim().toUpperCase() === v.placa.trim().toUpperCase())
        );
        if (!romAtivo) return;
        const peso = Number(romAtivo.peso_total || 0);
        utilizacaoVeiculo[v.id] = Math.min(100, Math.round((peso / cap) * 100));
    });

    const temBaixaUtilizacao = (rom) => {
        if (!rom.vehicle_id) return false;
        const util = utilizacaoVeiculo[rom.vehicle_id];
        return util !== undefined && util < 40;
    };

    const porCorreedor = {};
    romaneios.forEach(r => {
        const corredor = getCorredorDaCidade(r.destino);
        if (!corredor) return;
        if (!porCorreedor[corredor]) porCorreedor[corredor] = [];
        porCorreedor[corredor].push(r);
    });

    const grupos = [];
    Object.entries(porCorreedor).forEach(([corredor, roms]) => {
        if (roms.length < 2) return;
        if (!roms.some(r => temBaixaUtilizacao(r))) return;

        const pesoCombinado = roms.reduce((s, r) => s + Number(r.peso_total || 0), 0);
        const nomesDestinos = [...new Set(roms.map(r => r.destino?.split(',')[0]?.trim()).filter(Boolean))];

        grupos.push({
            corredor,
            label: getLabelCorredor(corredor),
            icone: getIconeCorredor(corredor),
            items: roms,
            pesoCombinado,
            destinos: nomesDestinos,
        });
    });

    return grupos.sort((a, b) => b.items.length - a.items.length);
}
