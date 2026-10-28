import React, { useMemo, useCallback } from 'react';
import { PrettySelect } from 'components';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useCarreteiroFiltros({ abast, carregamentos, checklists, filtroPlaca, period, periodoCustom, pontosParada, registros, romaneiosCarreteiro, romaneiosFerragem, setFiltroPlaca, totalBonusExtras, totalBonusViagens, veiculos, viagens }) {
// ── Faixa de datas do filtro de período (padrão: mês atual) ─────────────
    // Aplicada a TODAS as abas (viagens lançadas pelo admin e pelo motorista,
    // registros, pontos de parada, abastecimentos e checklists).
    const ymd = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];

const faixaPeriodo = useMemo(() => {
        if (periodoCustom?.inicio && periodoCustom?.fim) return { inicio: periodoCustom.inicio, fim: periodoCustom.fim };
        const hoje = new Date();
        if (period === 'mes') return { inicio: ymd(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: null };
        const cut = new Date(); cut.setDate(cut.getDate() - period);
        return { inicio: ymd(cut), fim: null };
    }, [period, periodoCustom]);

const dentroDoPeriodo = useCallback((data) => {
        if (!data) return true; // sem data: não esconde o registro
        const str = String(data);
        // timestamps (ex.: created_at em UTC) são convertidos para o dia local do motorista
        const d = str.includes('T') ? ymd(new Date(str)) : str.slice(0, 10);
        return d >= faixaPeriodo.inicio && (!faixaPeriodo.fim || d <= faixaPeriodo.fim);
    }, [faixaPeriodo]);

// eslint-disable-line

    // ── Filtro por placa (motoristas com mais de um veículo) ────────────────
    const registrosFiltrados = useMemo(() =>
        registros.filter(r => dentroDoPeriodo(r.data_carregamento) && (!filtroPlaca || r.veiculo_id === filtroPlaca))
    , [registros, filtroPlaca, dentroDoPeriodo]);

const romaneiosFerragemFiltrados = useMemo(() =>
        romaneiosFerragem.filter(r => dentroDoPeriodo(r.data_saida) && (!filtroPlaca || r.veiculo_id === filtroPlaca))
    , [romaneiosFerragem, filtroPlaca, dentroDoPeriodo]);

const romaneiosCarreteiroFiltrados = useMemo(() =>
        romaneiosCarreteiro.filter(r => dentroDoPeriodo(r.data_saida))
    , [romaneiosCarreteiro, dentroDoPeriodo]);

const pontosParadaFiltrados = useMemo(() =>
        pontosParada.filter(p => dentroDoPeriodo(p.data_saida))
    , [pontosParada, dentroDoPeriodo]);

const abastFiltrados = useMemo(() =>
        abast.filter(a => dentroDoPeriodo(a.data_abastecimento) && (!filtroPlaca || a.veiculo_id === filtroPlaca))
    , [abast, filtroPlaca, dentroDoPeriodo]);

const checklistsFiltrados = useMemo(() =>
        checklists.filter(c => dentroDoPeriodo(c.created_at) && (!filtroPlaca || c.veiculo_id === filtroPlaca))
    , [checklists, filtroPlaca, dentroDoPeriodo]);

// Placas do próprio motorista, extraídas dos registros (não a frota toda) —
    // relevante para motoristas que dirigem mais de um veículo
    const minhasPlacas = useMemo(() => {
        const terceiros = new Set(veiculos.filter(v => v.is_terceiro).map(v => v.id));
        const map = new Map();
        [...registros, ...romaneiosFerragem, ...abast, ...checklists].forEach(r => {
            if (r.veiculo_id && r.veiculo?.placa && !terceiros.has(r.veiculo_id)) map.set(r.veiculo_id, r.veiculo.placa);
        });
        return Array.from(map, ([id, placa]) => ({ id, placa })).sort((a, b) => a.placa.localeCompare(b.placa));
    }, [registros, romaneiosFerragem, abast, checklists, veiculos]);

// Seletor de placa — frota própria apenas (exclui veículos de terceiros), só
    // aparece quando o motorista tem mais de um veículo próprio no histórico
    const seletorPlaca = minhasPlacas.length > 1 && (
        <PrettySelect value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)}
            className="px-3 py-2 rounded-lg border text-xs font-medium outline-none" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
            <option value="">Todas as placas</option>
            {minhasPlacas.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
        </PrettySelect>
    );

const totais = useMemo(() => ({
        viagens:     carregamentos.length,
        finalizadas: carregamentos.length, // todos os carregamentos são considerados finalizados
        emTransito:  viagens.filter(v => v.status === 'Em trânsito').length,
        totalBonus:  totalBonusViagens + totalBonusExtras,
        totalBonusViagens,
        totalBonusExtras,
        litrosDiesel: abastFiltrados.reduce((s, a) => s + Number(a.litros_diesel || 0), 0),
        gastoTotal:   abastFiltrados.reduce((s, a) => s + Number(a.valor_total || 0), 0),
    }), [carregamentos, viagens, totalBonusViagens, totalBonusExtras, abastFiltrados]);

    return { registrosFiltrados, romaneiosFerragemFiltrados, romaneiosCarreteiroFiltrados, pontosParadaFiltrados, abastFiltrados, checklistsFiltrados, seletorPlaca, totais };
}
