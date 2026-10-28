import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePagination, useConfirm } from 'components';
import { fetchMotoristasCaminhao } from 'services/carretas';
import { subscribeTabela } from 'services/supabaseClient';
import {
    fetchBonificacoesConsolidadas, fetchBonificacoesExtrasCaminhao,
    createBonificacaoExtraCaminhao, updateBonificacaoExtraCaminhao, deleteBonificacaoExtraCaminhao,
} from 'services/bonificacaoService';
import { useBonusCaminhaoConfig, saveBonusCaminhaoConfig } from 'services/settingsService';

const hoje = () => new Date().toISOString().split('T')[0];
const FORM_VAZIO = () => ({ motorista_id: '', valor: '', data: hoje(), observacao: '' });

/** Estado e ações da aba Bônus (motoristas de caminhão): resumo por motorista, extras e valores padrão. */
export function useBonificacoesCaminhao({ showToast, profile }) {
    const { confirm, ConfirmDialog } = useConfirm();
    const { bonusCaminhaoConfig, reloadBonusCaminhaoConfig } = useBonusCaminhaoConfig();
    // Filtro padrão do LogiFlow: seletor de mês (padrão = mês atual) + "Usar período" quando necessário
    const [filtroMes, setFiltroMes] = useState(() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; });
    const [usarPeriodo, setUsarPeriodo] = useState(false);
    const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' });
    const [pesquisa, setPesquisa] = useState('');
    const periodo = useMemo(() => {
        if (usarPeriodo) return { inicio: periodoCustom.inicio, fim: periodoCustom.fim };
        if (filtroMes) {
            const [a, m] = filtroMes.split('-').map(Number);
            return { inicio: `${filtroMes}-01`, fim: `${filtroMes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}` };
        }
        return { inicio: '', fim: '' };
    }, [filtroMes, usarPeriodo, periodoCustom]);

    const [subTab, setSubTab] = useState('resumo'); // 'resumo' | 'extras'
    const [loading, setLoading] = useState(true);
    const [bonifs, setBonifs] = useState([]);
    const [extras, setExtras] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [filtroMotorista, setFiltroMotorista] = useState('');

    // silent = atualização em segundo plano (após salvar/excluir ou aviso do realtime): mantém a
    // tela como está, sem o spinner de carregamento.
    const load = useCallback(async (silent = false) => {
        if (silent !== true) setLoading(true);
        try {
            const f = {};
            if (periodo.inicio) f.dataInicio = periodo.inicio;
            if (periodo.fim) f.dataFim = periodo.fim;
            const [b, e, m] = await Promise.all([
                fetchBonificacoesConsolidadas(f),
                fetchBonificacoesExtrasCaminhao(f),
                fetchMotoristasCaminhao(),
            ]);
            setBonifs(b || []); setExtras(e || []); setMotoristas(m || []);
        } catch (err) { showToast('Erro ao carregar bônus: ' + err.message, 'error'); }
        finally { setLoading(false); }
    }, [periodo.inicio, periodo.fim]); // eslint-disable-line

    // Depois de uma gravação feita AQUI, a tela já busca os dados uma vez (recarregar). O aviso do
    // Realtime sobre essa mesma gravação chega ~2,5 s depois e causaria uma segunda busca — por
    // isso eventos que chegam logo após uma gravação própria são ignorados.
    const timerRef = useRef(null);
    const ultimaGravacaoRef = useRef(0);
    const recarregar = useCallback(() => {
        ultimaGravacaoRef.current = Date.now();
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => load(true), 300);
    }, [load]);
    const aoMudarRealtime = useCallback(() => {
        if (Date.now() - ultimaGravacaoRef.current < 8000) return;
        load(true);
    }, [load]);

    useEffect(() => {
        load();
        const u1 = subscribeTabela('romaneios', aoMudarRealtime);
        const u2 = subscribeTabela('caminhoes_bonificacoes_extras', aoMudarRealtime);
        return () => { u1 && u1(); u2 && u2(); clearTimeout(timerRef.current); };
    }, [load, aoMudarRealtime]);

    // Filtro por motorista (resumo e extras)
    const q = pesquisa.trim().toLowerCase();
    const bonifsFiltrados = useMemo(() => bonifs.filter(b =>
        (!filtroMotorista || b.motoristaId === filtroMotorista) &&
        (!q || String(b.motorista || '').toLowerCase().includes(q))
    ), [bonifs, filtroMotorista, q]);
    const extrasFiltrados = useMemo(() => extras.filter(e =>
        (!filtroMotorista || e.motorista_id === filtroMotorista) &&
        (!q || [e.motorista?.name, e.observacao, e.criador?.name, e.valor, e.data].some(v => String(v ?? '').toLowerCase().includes(q)))
    ), [extras, filtroMotorista, q]);
    const extrasPag = usePagination(extrasFiltrados, 15, [extrasFiltrados.length, periodo.inicio, periodo.fim, filtroMotorista, q]);

    const totais = useMemo(() => ({
        motoristas: bonifsFiltrados.length,
        viagens: bonifsFiltrados.reduce((s, b) => s + Number(b.total_viagens || 0), 0),
        romaneios: bonifsFiltrados.reduce((s, b) => s + Number(b.bonificacao_romaneios || 0), 0),
        extras: bonifsFiltrados.reduce((s, b) => s + Number(b.bonificacao_extras || 0), 0),
        total: bonifsFiltrados.reduce((s, b) => s + Number(b.bonificacao_total || 0), 0),
    }), [bonifsFiltrados]);

    // ── Extras (CRUD) ──
    const [modalExtra, setModalExtra] = useState(null); // null | { mode, data? }
    const [formExtra, setFormExtra] = useState(FORM_VAZIO());
    const [savingExtra, setSavingExtra] = useState(false);

    const abrirNovaExtra = (motoristaId = '') => {
        setFormExtra({ ...FORM_VAZIO(), motorista_id: typeof motoristaId === 'string' ? motoristaId : '' });
        setModalExtra({ mode: 'create' });
    };
    const abrirEditExtra = (e) => {
        setFormExtra({ motorista_id: e.motorista_id, valor: String(e.valor), data: e.data, observacao: e.observacao || '' });
        setModalExtra({ mode: 'edit', data: e });
    };
    const salvarExtra = async () => {
        if (savingExtra) return;
        if (!formExtra.motorista_id) { showToast('Selecione o motorista', 'error'); return; }
        if (!formExtra.valor || isNaN(+formExtra.valor) || +formExtra.valor <= 0) { showToast('Informe um valor válido', 'error'); return; }
        if (!formExtra.observacao?.trim()) { showToast('Observação é obrigatória', 'error'); return; }
        setSavingExtra(true);
        try {
            const payload = { ...formExtra, valor: Number(formExtra.valor), observacao: formExtra.observacao.trim() };
            if (modalExtra.mode === 'create') await createBonificacaoExtraCaminhao({ ...payload, criado_por: profile?.id || null });
            else await updateBonificacaoExtraCaminhao(modalExtra.data.id, payload);
            showToast('Bônus extra salvo!', 'success');
            setModalExtra(null); recarregar();
        } catch (err) { showToast('Erro ao salvar: ' + err.message, 'error'); }
        finally { setSavingExtra(false); }
    };
    const excluirExtra = async (id) => {
        const ok = await confirm({ title: 'Excluir bônus extra?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteBonificacaoExtraCaminhao(id); showToast('Excluído!', 'success'); recarregar(); }
        catch (err) { showToast('Erro ao excluir: ' + err.message, 'error'); }
    };

    // ── Valores padrão pagos (ferragem R$/kg e cimento R$/romaneio) ──
    const [modalValores, setModalValores] = useState(false);
    const [formValores, setFormValores] = useState({ taxaFerragemTon: '', valorCimento: '' });
    const [savingValores, setSavingValores] = useState(false);

    const abrirValores = () => {
        setFormValores({
            taxaFerragemTon: String(Number((bonusCaminhaoConfig.taxaFerragemKg * 1000).toFixed(4))),
            valorCimento: String(bonusCaminhaoConfig.valorCimento),
        });
        setModalValores(true);
    };
    const salvarValores = async () => {
        const ton = Number(String(formValores.taxaFerragemTon).replace(',', '.'));
        const cim = Number(String(formValores.valorCimento).replace(',', '.'));
        if (isNaN(ton) || ton < 0 || isNaN(cim) || cim < 0) { showToast('Digite valores válidos (maiores ou iguais a zero)', 'error'); return; }
        setSavingValores(true);
        try {
            await saveBonusCaminhaoConfig({ taxaFerragemKg: ton / 1000, valorCimento: cim }, profile?.id || null);
            showToast('Valores padrão atualizados! Já valem para todos os motoristas.', 'success');
            setModalValores(false);
            await reloadBonusCaminhaoConfig(); recarregar();
        } catch (err) { showToast('Erro ao salvar: ' + err.message, 'error'); }
        finally { setSavingValores(false); }
    };

    return {
        subTab, setSubTab, loading, bonifsFiltrados, extrasFiltrados, extrasPag, motoristas, filtroMotorista, setFiltroMotorista,
        filtroMes, setFiltroMes, usarPeriodo, setUsarPeriodo, periodoCustom, setPeriodoCustom, pesquisa, setPesquisa, periodo, totais, bonusCaminhaoConfig,
        modalExtra, setModalExtra, formExtra, setFormExtra, savingExtra, abrirNovaExtra, abrirEditExtra, salvarExtra, excluirExtra,
        modalValores, setModalValores, formValores, setFormValores, savingValores, abrirValores, salvarValores,
        ConfirmDialog,
    };
}
