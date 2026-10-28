import { useState, useCallback, useEffect, useMemo } from 'react';
import { usePagination } from 'components';
import { fetchRomaneiosDoMotorista } from 'services/romaneio';
import { fetchAbastecimentos, fetchChecklists, fetchPostos, fetchConfigAbastecimento, fetchChecklistItens } from 'services/carretas';
import { fetchCaminhoesPlacas } from 'services/vehicleService';
import { subscribeTabela } from 'services/supabaseClient';
import { calcularBonificacao, fetchBonificacoesExtrasCaminhao } from 'services/bonificacaoService';
import { useBonusCaminhaoConfig } from 'services/settingsService';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useMotoristaDados({ period, periodoCustom, profile, showToast, user }) {
// { inicio, fim } | null
    const [loading, setLoading]       = useState(true);

const [romaneios, setRomaneios]   = useState([]);

const [abast, setAbast]           = useState([]);

const [checklists, setChecklists] = useState([]);

const [veiculos, setVeiculos]     = useState([]);

// caminhões da página de Veículos (item 7)
    const [postos, setPostos]         = useState([]);

const [configAbast, setConfigAbast] = useState({ preco_diesel: 0, preco_arla: 0 });

const [checklistItens, setChecklistItens] = useState([]);

// Bônus extras lançados pelo gestor para este motorista (no período) + valores padrão vigentes
    const [bonusExtras, setBonusExtras] = useState([]);
    const { bonusCaminhaoConfig } = useBonusCaminhaoConfig();

// { atual, total } | null

    // ── Load ─────────────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        if (!user?.id || !profile?.name) return;
        setLoading(true);
        try {
            let dateStr, dateFimStr = null;
            if (periodoCustom?.inicio && periodoCustom?.fim) {
                dateStr = periodoCustom.inicio;
                dateFimStr = periodoCustom.fim;
            } else if (period === 'mes') {
                const hoje = new Date();
                dateStr = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
            } else {
                const cut = new Date(); cut.setDate(cut.getDate() - period);
                dateStr = cut.toISOString().split('T')[0];
            }

            const [roms, a, c, ve, p, cfg, itensCheck, extras] = await Promise.all([
                fetchRomaneiosDoMotorista({ userId: user.id, nome: profile.name, dateStr, dateFimStr }),
                fetchAbastecimentos({ motoristaId: user.id, dataInicio: dateStr, ...(dateFimStr ? { dataFim: dateFimStr } : {}) }),
                fetchChecklists({ motoristaId: user.id, dataInicio: dateStr, ...(dateFimStr ? { dataFim: dateFimStr } : {}) }),
                fetchCaminhoesPlacas(),
                fetchPostos().catch(() => []),
                fetchConfigAbastecimento().catch(() => ({ preco_diesel: 0, preco_arla: 0 })),
                fetchChecklistItens(true).catch(() => []),
                fetchBonificacoesExtrasCaminhao({ motorista_id: user.id, dataInicio: dateStr, ...(dateFimStr ? { dataFim: dateFimStr } : {}) }).catch(() => []),
            ]);

            setRomaneios(roms);
            setAbast(a); setChecklists(c);
            setVeiculos(ve); setPostos(p);
            setConfigAbast(cfg || { preco_diesel: 0, preco_arla: 0 });
            setChecklistItens(itensCheck);
            setBonusExtras(extras || []);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [user?.id, profile?.name, period, periodoCustom]);

// eslint-disable-line

    useEffect(() => {
        load();
        // Realtime: atualiza automaticamente quando admin excluir romaneio, checklist ou abastecimento
        const unsubRom   = subscribeTabela('romaneios', load);
        const unsubCheck = subscribeTabela('carretas_checklists', load);
        const unsubAbast = subscribeTabela('carretas_abastecimentos', load);
        const unsubExtras = subscribeTabela('caminhoes_bonificacoes_extras', load);
        return () => { unsubRom(); unsubCheck(); unsubAbast(); unsubExtras(); };
    }, [load]);

// publica a faixa do aparelho (data-tier) para o CSS mobile global

    // ── Computed ─────────────────────────────────────────────────────────────
    const bonificacoes = useMemo(() =>
        romaneios.map(r => ({ ...r, bonif: calcularBonificacao(r, bonusCaminhaoConfig) }))
    , [romaneios, bonusCaminhaoConfig]);

const bonificacoesComValor = useMemo(() =>
        bonificacoes.filter(r => r.bonif?.valorTotal > 0)
    , [bonificacoes]);

const bonificacoesPag = usePagination(bonificacoesComValor, 10, [bonificacoesComValor.length, period, periodoCustom]);

const totalBonusExtras = useMemo(() => bonusExtras.reduce((s, e) => s + Number(e.valor || 0), 0), [bonusExtras]);

const totais = useMemo(() => ({
        viagens:      romaneios.length,
        finalizadas:  romaneios.filter(r => r.status === 'Finalizado').length,
        emTransito:   romaneios.filter(r => r.status === 'Em Trânsito').length,
        totalBonusRomaneios: bonificacoes.reduce((s, r) => s + (r.bonif?.valorTotal || 0), 0),
        totalBonusExtras,
        totalBonus:   bonificacoes.reduce((s, r) => s + (r.bonif?.valorTotal || 0), 0) + totalBonusExtras,
        litrosDiesel: abast.reduce((s, a) => s + Number(a.litros_diesel || 0), 0),
        gastoTotal:   abast.reduce((s, a) => s + Number(a.valor_total || 0), 0),
    }), [romaneios, bonificacoes, abast, totalBonusExtras]);

    return { loading, romaneios, abast, checklists, veiculos, postos, configAbast, checklistItens, load, bonificacoes, bonificacoesComValor, bonificacoesPag, bonusExtras, bonusCaminhaoConfig, totais };
}
