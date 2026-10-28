import React, { useState, useCallback, useEffect } from 'react';
import { useConfirm, usePagination, usePeriodRangeFilter } from 'components';
import { fetchVeiculosProprios, fetchMotoristasProprios } from 'services/carretas';
import { fetchCaminhoesPlacas } from 'services/vehicleService';
import { fetchCatalogoPneus, fetchPneus, agruparPneusPorLote, deletePneu, deleteLotePneus, updatePneu, gerarNumeroSequencialPneu, createPneu } from 'services/pneusService';
import { getConfiguracao } from 'config/pneuDiagramaConfig';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useMecanicoPneus({ pageTab, showToast, user }) {
// ── Aba Pneus (troca de pneu registrada pelo mecânico) ─────────────────
    const [veiculosCarretas, setVeiculosCarretas] = useState([]);

const [caminhoes, setCaminhoes]               = useState([]);

const [motoristasPneu, setMotoristasPneu]     = useState([]);

const [catalogoPneus, setCatalogoPneus]       = useState({ marca: [], modelo: [], medida: [] });

const [pneusRegistrados, setPneusRegistrados] = useState([]);

const [loadingPneus, setLoadingPneus]         = useState(false);

const [savingPneu, setSavingPneu]             = useState(false);

const emptyFormPneu = () => ({
        veiculo_id: '', configuracao_veiculo: '', posicoes_diagrama: [],
        tipo_pneu: 'novo', marca: '', modelo: '', medida: '', categoria_bandagem: 'mista',
        motorista_id: '', km_atual: '', observacoes: '',
    });

const [formPneu, setFormPneu] = useState(emptyFormPneu());

const [editandoPneuId, setEditandoPneuId] = useState(null);

const { confirm: confirmPneu, ConfirmDialog: ConfirmDialogPneu } = useConfirm();

const veiculoOptionsPneu = React.useMemo(() => ([
        ...veiculosCarretas.map(v => ({ value: `cv:${v.id}`, label: v.placa, sublabel: v.modelo ? `${v.modelo} · Carreta` : 'Carreta' })),
        ...caminhoes.map(v => ({ value: `vh:${v.id}`, label: v.placa, sublabel: v.modelo ? `${v.modelo} · Caminhão` : 'Caminhão' })),
    ]), [veiculosCarretas, caminhoes]);

// Posições já em uso no veículo selecionado (pra sinalizar no diagrama)
    const posicoesOcupadas = React.useMemo(() => {
        if (!formPneu.veiculo_id) return [];
        const [tipo, id] = formPneu.veiculo_id.split(':');
        return pneusRegistrados
            .filter(p => p.status === 'em_uso' && (tipo === 'cv' ? String(p.veiculo_id) === id : String(p.veiculo_caminhao_id) === id))
            .map(p => p.posicao_diagrama)
            .filter(Boolean);
    }, [pneusRegistrados, formPneu.veiculo_id]);

const loadDadosPneus = useCallback(async () => {
        setLoadingPneus(true);
        try {
            const [vc, cam, mot, cat, pneus] = await Promise.all([
                fetchVeiculosProprios().catch(() => []),
                fetchCaminhoesPlacas().catch(() => []),
                fetchMotoristasProprios().catch(() => []),
                fetchCatalogoPneus().catch(() => ({ marca: [], modelo: [], medida: [] })),
                fetchPneus().catch(() => []),
            ]);
            setVeiculosCarretas(vc || []);
            setCaminhoes(cam || []);
            setMotoristasPneu(mot || []);
            setCatalogoPneus(cat || { marca: [], modelo: [], medida: [] });
            setPneusRegistrados(pneus || []);
        } catch (e) { showToast('Erro ao carregar dados de pneus: ' + e.message, 'error'); }
        finally { setLoadingPneus(false); }
    }, []);

// eslint-disable-line

    useEffect(() => { if (pageTab === 'pneus') loadDadosPneus(); }, [pageTab, loadDadosPneus]);

// Mesma lista, mas agrupando trocas registradas em lote (várias posições
    // marcadas de uma vez) num único item expansível.
    // Filtro de período — padrão: mês atual (mesmo componente das outras telas).
    const { preset: periodoPreset, periodo, setPeriodo, onPresetChange: setPeriodoPreset } = usePeriodRangeFilter('mes');

    const meusPneusAgrupados = React.useMemo(() =>
        agruparPneusPorLote(pneusRegistrados.filter(p => {
            if (p.registrado_por !== user?.id) return false;
            const d = (p.data_instalacao || '').slice(0, 10);
            if (periodo.inicio && d < periodo.inicio) return false;
            if (periodo.fim && d > periodo.fim) return false;
            return true;
        })),
    [pneusRegistrados, user?.id, periodo.inicio, periodo.fim]);

    // Paginação da lista (um lote de vários pneus conta como 1 item).
    const paginaPneus = usePagination(meusPneusAgrupados, 8, [periodo.inicio, periodo.fim]);

const [lotesExpandidos, setLotesExpandidos] = useState({});

const toggleLote = (loteId) => setLotesExpandidos(s => ({ ...s, [loteId]: !s[loteId] }));

const [verPneu, setVerPneu] = useState(null);

// registro sendo visualizado (somente leitura)

    const handleEditarPneu = (p) => {
        const veiculoId = p.veiculo_id ? `cv:${p.veiculo_id}` : (p.veiculo_caminhao_id ? `vh:${p.veiculo_caminhao_id}` : '');
        setFormPneu({
            veiculo_id: veiculoId, configuracao_veiculo: p.configuracao_veiculo || '',
            posicoes_diagrama: p.posicao_diagrama ? [p.posicao_diagrama] : [],
            tipo_pneu: p.tipo_pneu || 'novo', marca: p.marca || '', modelo: p.modelo || '', medida: p.medida || '',
            categoria_bandagem: p.categoria_bandagem || 'mista', motorista_id: p.motorista_id || '',
            km_atual: p.km_atual ?? '', observacoes: p.observacoes || '',
        });
        setEditandoPneuId(p.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

const handleCancelarEdicaoPneu = () => { setFormPneu(emptyFormPneu()); setEditandoPneuId(null); };

const handleExcluirPneu = async (p) => {
        const ok = await confirmPneu({ title: 'Excluir registro de pneu?', message: `Remove o registro ${p.numero_sequencial || ''} — esta ação não pode ser desfeita.`, confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try {
            await deletePneu(p.id);
            showToast('Registro de pneu excluído.', 'success');
            if (editandoPneuId === p.id) handleCancelarEdicaoPneu();
            loadDadosPneus();
        } catch (e) { showToast('Erro ao excluir: ' + e.message, 'error'); }
    };

// Exclui de uma vez todos os registros de um lote (troca em várias
    // posições feita numa única ação) — antes só dava pra excluir pneu por
    // pneu, um de cada vez.
    const handleExcluirLote = async (item) => {
        const ok = await confirmPneu({
            title: 'Excluir lote inteiro?',
            message: `Remove os ${item.itens.length} registros deste lote (${item.itens[0].veiculo?.placa || item.itens[0].veiculo_caminhao_placa || 'veículo'}) — esta ação não pode ser desfeita.`,
            confirmLabel: 'Excluir tudo', variant: 'danger',
        });
        if (!ok) return;
        try {
            const qtd = await deleteLotePneus(item.lote_id);
            showToast(`${qtd} registro(s) excluído(s).`, 'success');
            if (item.itens.some(p => p.id === editandoPneuId)) handleCancelarEdicaoPneu();
            loadDadosPneus();
        } catch (e) { showToast('Erro ao excluir lote: ' + e.message, 'error'); }
    };

const handleSalvarPneu = async () => {
        if (!formPneu.veiculo_id) { showToast('Selecione a placa do veículo', 'error'); return; }
        if (!formPneu.configuracao_veiculo) { showToast('Selecione a configuração do veículo', 'error'); return; }
        if (formPneu.posicoes_diagrama.length === 0) { showToast('Marque no diagrama ao menos uma posição do pneu trocado', 'error'); return; }
        if (!formPneu.marca) { showToast('Selecione a marca do pneu', 'error'); return; }
        if (!formPneu.medida) { showToast('Selecione a medida do pneu', 'error'); return; }
        if (formPneu.km_atual === '' || formPneu.km_atual == null) { showToast('Informe o km atual do veículo', 'error'); return; }
        setSavingPneu(true);
        try {
            const [tipo, id] = formPneu.veiculo_id.split(':');
            const caminhaoSel = tipo === 'vh' ? caminhoes.find(c => String(c.id) === id) : null;
            const cfgDiagrama = getConfiguracao(formPneu.configuracao_veiculo);
            const dadosComuns = {
                marca: formPneu.marca, modelo: formPneu.modelo || null, medida: formPneu.medida,
                categoria_bandagem: formPneu.categoria_bandagem || null,
                veiculo_id: tipo === 'cv' ? id : null,
                veiculo_caminhao_id: tipo === 'vh' ? id : null,
                veiculo_caminhao_placa: caminhaoSel?.placa || null,
                veiculo_caminhao_modelo: caminhaoSel?.modelo || null,
                motorista_id: formPneu.motorista_id || null,
                configuracao_veiculo: formPneu.configuracao_veiculo,
                tipo_pneu: formPneu.tipo_pneu,
                km_atual: Number(formPneu.km_atual),
                observacoes: formPneu.observacoes || null,
            };
            if (editandoPneuId) {
                // Edição: sempre um único registro — a posição é a primeira (e única) marcada.
                const posId = formPneu.posicoes_diagrama[0];
                await updatePneu(editandoPneuId, {
                    ...dadosComuns,
                    posicao_diagrama: posId,
                    eixo_trocado: cfgDiagrama?.posicoes.find(p => p.id === posId)?.label || null,
                });
                showToast('Registro de pneu atualizado!', 'success');
            } else {
                // Cadastro novo: uma posição = um registro de pneu; pode marcar várias
                // posições no diagrama (ex.: todos os pneus do veículo) e registrar
                // todas de uma vez, cada uma com seu próprio número sequencial. Quando
                // é mais de uma posição, todas ganham o mesmo lote_id, pra aparecerem
                // agrupadas (um único item expansível) na lista de registros.
                const loteId = formPneu.posicoes_diagrama.length > 1
                    ? (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
                    : null;
                const numerosGerados = [];
                for (const posId of formPneu.posicoes_diagrama) {
                    const numeroSequencial = await gerarNumeroSequencialPneu(formPneu.tipo_pneu);
                    await createPneu({
                        ...dadosComuns,
                        posicao_diagrama: posId,
                        eixo_trocado: cfgDiagrama?.posicoes.find(p => p.id === posId)?.label || null,
                        numero_sequencial: numeroSequencial,
                        registrado_por: user.id,
                        data_instalacao: new Date().toISOString().slice(0, 10),
                        status: 'em_uso',
                        lote_id: loteId,
                    });
                    numerosGerados.push(numeroSequencial);
                }
                showToast(numerosGerados.length > 1
                    ? `${numerosGerados.length} pneus registrados! (${numerosGerados.join(', ')})`
                    : `Pneu ${numerosGerados[0]} registrado!`, 'success');
            }
            handleCancelarEdicaoPneu();
            loadDadosPneus();
        } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error'); }
        finally { setSavingPneu(false); }
    };

    return { motoristasPneu, catalogoPneus, loadingPneus, savingPneu, formPneu, setFormPneu, editandoPneuId, ConfirmDialogPneu, veiculoOptionsPneu, posicoesOcupadas, meusPneusAgrupados, paginaPneus, periodoPreset, periodo, setPeriodo, setPeriodoPreset, lotesExpandidos, toggleLote, verPneu, setVerPneu, handleEditarPneu, handleCancelarEdicaoPneu, handleExcluirPneu, handleExcluirLote, handleSalvarPneu };
}
