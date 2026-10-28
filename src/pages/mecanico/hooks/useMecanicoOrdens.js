import { useState, useCallback } from 'react';
import { usePeriodRangeFilter } from 'components';
import { fetchOrdensServico, fetchPecasCatalogo, finalizarOrdemServico, reportarProblemaOS, updateOrdemServico } from 'services/carretas';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useMecanicoOrdens({ profile, showToast, user }) {
// 'os' | 'pneus'
    // Filtro de período — padrão: mês atual (igual à aba Pneus)
    const { preset: periodoPreset, periodo, setPeriodo, onPresetChange: setPeriodoPreset } = usePeriodRangeFilter('mes');

    const [ordens, setOrdens]                 = useState([]);

const [pecasCatalogo, setPecasCatalogo]   = useState([]);

const [loading, setLoading]               = useState(true);

const [filtro, setFiltro]                 = useState('');

const [modalFinalizar, setModalFinalizar] = useState(null);

const [modalProblema, setModalProblema]   = useState(null);

const [modalPeca, setModalPeca]           = useState(null);

const [pecaItem, setPecaItem]             = useState('');

const [pecaItemOutro, setPecaItemOutro]   = useState('');

const [pecaQtd, setPecaQtd]               = useState('1');

const [pecasParaSolicitar, setPecasParaSolicitar] = useState([]);

// itens já adicionados à requisição atual, antes de enviar
    const [obsFinalizar, setObsFinalizar]     = useState('');

const [descProblema, setDescProblema]     = useState('');

const [pdfUrl, setPdfUrl]                 = useState(null);

const [assinarFinalizacao, setAssinarFinalizacao] = useState(true);

const load = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const [data, pecas] = await Promise.all([
                fetchOrdensServico({ mecanicoId: user.id, status: filtro || undefined, dataInicio: periodo.inicio || undefined, dataFim: periodo.fim || undefined }),
                fetchPecasCatalogo().catch(() => []),
            ]);
            setOrdens(data);
            setPecasCatalogo(pecas || []);
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [user?.id, filtro, periodo.inicio, periodo.fim]);

const handleFinalizar = async () => {
        try {
            const assinatura = (assinarFinalizacao && profile?.assinatura_digital) ? profile.assinatura_digital : null;
            await finalizarOrdemServico(modalFinalizar.id, user.id, obsFinalizar, assinatura);
            showToast('Ordem de serviço finalizada!', 'success');
            setModalFinalizar(null); setObsFinalizar(''); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

const handleReportarProblema = async () => {
        if (!descProblema.trim()) { showToast('Descreva o problema encontrado', 'error'); return; }
        try {
            await reportarProblemaOS(modalProblema.id, descProblema);
            showToast('Problema reportado! Aguardando análise do admin.', 'success');
            setModalProblema(null); setDescProblema(''); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

const handleAdicionarPecaNaLista = () => {
        const nomeItem = pecaItem === '__outro__' ? pecaItemOutro.trim() : pecaItem;
        if (!nomeItem) { showToast('Selecione ou informe o nome da peça', 'error'); return; }
        const qtd = Number(pecaQtd) || 1;
        setPecasParaSolicitar(prev => [...prev, { key: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, item: nomeItem, quantidade: qtd }]);
        setPecaItem(''); setPecaItemOutro(''); setPecaQtd('1');
    };

const handleRemoverPecaDaLista = (key) => {
        setPecasParaSolicitar(prev => prev.filter(p => p.key !== key));
    };

const handleSolicitarPeca = async () => {
        // Se o mecânico ainda tem algo digitado nos campos e não clicou em
        // "Adicionar", inclui esse item também na hora de enviar — evita que
        // a última peça digitada se perca por esquecimento de clicar em Adicionar.
        const nomeItemAtual = pecaItem === '__outro__' ? pecaItemOutro.trim() : pecaItem;
        const itensFinais = [...pecasParaSolicitar];
        if (nomeItemAtual) itensFinais.push({ item: nomeItemAtual, quantidade: Number(pecaQtd) || 1 });
        if (itensFinais.length === 0) { showToast('Adicione ao menos uma peça à solicitação', 'error'); return; }
        try {
            const agora = new Date().toISOString();
            const novasPecas = itensFinais.map((p, i) => ({
                id: `${Date.now()}_${i}`, item: p.item, quantidade: p.quantidade, status: 'Pendente', solicitado_em: agora,
            }));
            const lista = [...(modalPeca.pecas_solicitadas || []), ...novasPecas];
            await updateOrdemServico(modalPeca.id, { pecas_solicitadas: lista });
            showToast(`${novasPecas.length} peça${novasPecas.length > 1 ? 's' : ''} solicitada${novasPecas.length > 1 ? 's' : ''}! Aguardando aprovação do admin.`, 'success');
            setModalPeca(null); setPecaItem(''); setPecaItemOutro(''); setPecaQtd('1'); setPecasParaSolicitar([]); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

const pendentes = ordens.filter(o => o.status === 'Pendente').length;

const andamento = ordens.filter(o => o.status === 'Em Andamento').length;

const problemas = ordens.filter(o => o.status === 'Problema Reportado').length;

    return { ordens, pecasCatalogo, loading, filtro, setFiltro, periodoPreset, periodo, setPeriodo, setPeriodoPreset, modalFinalizar, setModalFinalizar, modalProblema, setModalProblema, modalPeca, setModalPeca, pecaItem, setPecaItem, pecaItemOutro, setPecaItemOutro, pecaQtd, setPecaQtd, pecasParaSolicitar, setPecasParaSolicitar, obsFinalizar, setObsFinalizar, descProblema, setDescProblema, pdfUrl, setPdfUrl, assinarFinalizacao, setAssinarFinalizacao, load, handleFinalizar, handleReportarProblema, handleAdicionarPecaNaLista, handleRemoverPecaDaLista, handleSolicitarPeca, pendentes, andamento, problemas };
}
