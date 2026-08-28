import React, { useState, useEffect, useCallback } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { subscribeTabela } from 'utils/supabaseClient';
import { fetchOrdensServico, finalizarOrdemServico, reportarProblemaOS, updateOrdemServico, fetchPecasCatalogo, fetchVeiculosProprios, fetchMotoristasProprios } from 'utils/carretasService';
import { fetchCaminhoesPlacas } from 'utils/vehicleService';
import { fetchCatalogoPneus, createPneu, updatePneu, deletePneu, deleteLotePneus, gerarNumeroSequencialPneu, fetchPneus, agruparPneusPorLote } from 'utils/pneusService';
import { CONFIGURACOES_OPTIONS, getConfiguracao } from 'utils/pneuDiagramaConfig';
import DiagramaPneuVeiculo from 'components/ui/DiagramaPneuVeiculo';
import { useConfirm } from 'components/ui/ConfirmDialog';
import { printOrdemServico } from 'utils/excelUtils';
import PrettySelect from 'components/ui/PrettySelect';
import SearchableSelect from 'components/ui/SearchableSelect';

const BANDAGEM_OPTIONS = [
    { value: 'mista', label: 'Mista' },
    { value: 'borrachudo', label: 'Borrachudo' },
    { value: 'liso', label: 'Liso' },
];

const FMT_DATE = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

// Identifica o tipo de um anexo a partir do data URL (PDF, imagem, Word ou outro)
function getAnexoTipo(dataUrl) {
    if (!dataUrl) return null;
    const m = /^data:([^;]+);/.exec(dataUrl);
    const mime = m ? m[1] : '';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('image/')) return 'imagem';
    if (mime === 'application/msword' || mime.includes('wordprocessingml')) return 'word';
    return 'outro';
}

function downloadAnexo(url, nomeArquivo) {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo || 'anexo';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

const STATUS_CFG = {
    'Pendente':           { bg: '#FEF9C3', text: '#B45309', icon: 'Clock' },
    'Em Andamento':       { bg: '#DBEAFE', text: '#1D4ED8', icon: 'Wrench' },
    'Finalizada':         { bg: '#D1FAE5', text: '#065F46', icon: 'CheckCircle2' },
    'Problema Reportado': { bg: '#FEE2E2', text: '#B91C1C', icon: 'AlertTriangle' },
};

const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500";
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

// Uma linha de registro de pneu na lista "Meus Últimos Registros". `indent`
// é usado quando ela aparece dentro de um lote expandido (troca em várias
// posições registrada de uma vez).
function RegistroPneuRow({ p, editando, onVer, onEditar, onExcluir, indent = false }) {
    return (
        <div className={`px-4 py-3 flex items-start gap-3 ${indent ? 'pl-9' : ''}`}
            style={editando ? { backgroundColor: '#EFF6FF' } : undefined}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: p.tipo_pneu === 'recapado' ? '#FEF3C7' : '#D1FAE5' }}>
                <Icon name="CircleDot" size={14} color={p.tipo_pneu === 'recapado' ? '#B45309' : '#059669'} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold font-data" style={{ color: 'var(--color-text-primary)' }}>
                    {p.numero_sequencial || '—'} · {p.veiculo?.placa || p.veiculo_caminhao_placa || 'Sem placa'}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                    {p.marca} {p.medida} — {p.eixo_trocado || '—'}
                </p>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                style={{ backgroundColor: p.tipo_pneu === 'recapado' ? '#FEF3C7' : '#D1FAE5', color: p.tipo_pneu === 'recapado' ? '#B45309' : '#059669' }}>
                {p.tipo_pneu === 'recapado' ? 'Recapado' : 'Novo'}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onVer(p)} title="Ver detalhes"
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-slate-100">
                    <Icon name="Eye" size={13} color="var(--color-muted-foreground)" />
                </button>
                <button onClick={() => onEditar(p)} title="Editar"
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-blue-50">
                    <Icon name="Pencil" size={13} color="#1D4ED8" />
                </button>
                <button onClick={() => onExcluir(p)} title="Excluir"
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-50">
                    <Icon name="Trash2" size={13} color="#DC2626" />
                </button>
            </div>
        </div>
    );
}

// Modal somente-leitura com todos os dados de um registro de pneu — pra
// consultar rapidamente sem precisar entrar no modo de edição.
function ModalVerPneu({ p, onClose }) {
    if (!p) return null;
    const linha = (label, valor) => (
        <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{label}</span>
            <span className="text-xs font-medium text-right" style={{ color: 'var(--color-text-primary)' }}>{valor || '—'}</span>
        </div>
    );
    return (
        <ModalOverlay onClose={onClose}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2">
                    <Icon name="Eye" size={18} color="var(--color-primary)" />
                    <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Detalhes do Registro</h3>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
                    <Icon name="X" size={16} color="var(--color-muted-foreground)" />
                </button>
            </div>
            <div className="p-5 divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {linha('Nº do registro', p.numero_sequencial)}
                {linha('Veículo / Placa', p.veiculo?.placa || p.veiculo_caminhao_placa)}
                {linha('Eixo / Posição', p.eixo_trocado)}
                {linha('Tipo do pneu', p.tipo_pneu === 'recapado' ? 'Recapado' : 'Novo')}
                {linha('Marca', p.marca)}
                {linha('Medida', p.medida)}
                {linha('Bandagem', p.categoria_bandagem)}
                {linha('Motorista que solicitou', p.motorista?.name)}
                {linha('Km do veículo no momento', p.km_atual != null ? Number(p.km_atual).toLocaleString('pt-BR') : null)}
                {linha('Data da instalação', p.data_instalacao ? new Date(p.data_instalacao + 'T00:00:00').toLocaleDateString('pt-BR') : null)}
                {linha('Observações', p.observacoes)}
            </div>
            <div className="flex justify-end px-5 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Fechar</button>
            </div>
        </ModalOverlay>
    );
}

function ModalOverlay({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 sm:pt-16"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 rounded-t-2xl shadow-2xl max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
                {children}
            </div>
        </div>
    );
}

export default function MecanicoPage() {
    const { user, profile } = useAuth();
    const { toast, showToast } = useToast();
    const [pageTab, setPageTab]               = useState('os'); // 'os' | 'pneus'
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
    const [pecasParaSolicitar, setPecasParaSolicitar] = useState([]); // itens já adicionados à requisição atual, antes de enviar
    const [obsFinalizar, setObsFinalizar]     = useState('');
    const [descProblema, setDescProblema]     = useState('');
    const [pdfUrl, setPdfUrl]                 = useState(null);
    const [assinarFinalizacao, setAssinarFinalizacao] = useState(true);

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
    }, []); // eslint-disable-line

    useEffect(() => { if (pageTab === 'pneus') loadDadosPneus(); }, [pageTab, loadDadosPneus]);

    // Mesma lista, mas agrupando trocas registradas em lote (várias posições
    // marcadas de uma vez) num único item expansível.
    const meusPneusAgrupados = React.useMemo(() =>
        agruparPneusPorLote(pneusRegistrados.filter(p => p.registrado_por === user?.id)).slice(0, 15),
    [pneusRegistrados, user?.id]);
    const [lotesExpandidos, setLotesExpandidos] = useState({});
    const toggleLote = (loteId) => setLotesExpandidos(s => ({ ...s, [loteId]: !s[loteId] }));
    const [verPneu, setVerPneu] = useState(null); // registro sendo visualizado (somente leitura)

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

    const load = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const [data, pecas] = await Promise.all([
                fetchOrdensServico({ mecanicoId: user.id, status: filtro || undefined }),
                fetchPecasCatalogo().catch(() => []),
            ]);
            setOrdens(data);
            setPecasCatalogo(pecas || []);
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [user?.id, filtro]); // eslint-disable-line

    useEffect(() => {
        load();
        // Realtime: atualiza automaticamente quando admin excluir ou modificar uma OS
        const unsub = subscribeTabela('carretas_ordens_servico', load);
        return () => unsub();
    }, [load]); // eslint-disable-line

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

    // PDF viewer: usa browser back para fechar (igual ao módulo de carretas)
    useEffect(() => {
        if (pdfUrl) {
            window.history.pushState({ pdfOpen: true }, '');
            const onPop = () => setPdfUrl(null);
            window.addEventListener('popstate', onPop);
            return () => window.removeEventListener('popstate', onPop);
        }
    }, [pdfUrl]);

    if (pdfUrl) {
        const tipoAnexo = getAnexoTipo(pdfUrl);
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    position: 'relative', zIndex: 10000, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px', backgroundColor: '#111827',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}>
                    <span style={{ color: '#9CA3AF', fontSize: 13 }}>Ordem de Serviço — Anexo</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => downloadAnexo(pdfUrl, `OS_anexo_${Date.now()}`)} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '0 12px', height: 32, borderRadius: 6,
                            backgroundColor: '#374151', color: '#D1D5DB',
                            border: 'none', cursor: 'pointer', fontSize: 12,
                        }} title="Baixar"><Icon name="Download" size={14} color="#D1D5DB" /> Baixar</button>
                        <button onClick={() => setPdfUrl(null)} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: 6,
                            backgroundColor: '#374151', color: '#D1D5DB',
                            border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1,
                        }} title="Fechar">✕</button>
                    </div>
                </div>
                {tipoAnexo === 'imagem' ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a', overflow: 'auto', padding: 16 }}>
                        <img src={pdfUrl} alt="Anexo da OS" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6 }} />
                    </div>
                ) : (
                    <iframe src={pdfUrl} title="OS" style={{ flex: 1, border: 'none', width: '100%', backgroundColor: '#1a1a1a', display: 'block' }} />
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-lg mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0" style={{ backgroundColor: '#059669' }}>
                            {(profile?.name || 'M')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="font-heading font-bold text-lg sm:text-xl truncate" style={{ color: 'var(--color-text-primary)' }}>
                                Olá, {profile?.name || 'Mecânico'}
                            </h1>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Ordens de serviço da oficina</p>
                        </div>
                        <button onClick={load} disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors flex-shrink-0 disabled:opacity-50"
                            style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                            <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {/* Abas */}
                    <div className="flex gap-1.5 mb-4 p-1 rounded-xl bg-gray-100 w-fit">
                        {[
                            { id: 'os', label: 'Ordens de Serviço', icon: 'Wrench' },
                            { id: 'pneus', label: 'Pneus', icon: 'CircleDot' },
                        ].map(t => (
                            <button key={t.id} onClick={() => setPageTab(t.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={pageTab === t.id
                                    ? { backgroundColor: '#fff', color: 'var(--color-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                                    : { color: 'var(--color-muted-foreground)' }}>
                                <Icon name={t.icon} size={14} color={pageTab === t.id ? 'var(--color-primary)' : 'var(--color-muted-foreground)'} />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {pageTab === 'os' && (
                    <>
                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
                        {[
                            { l: 'Pendentes', v: pendentes, c: '#B45309', bg: '#FEF9C3', i: 'Clock' },
                            { l: 'Andamento', v: andamento, c: '#1D4ED8', bg: '#DBEAFE', i: 'Wrench' },
                            { l: 'Problemas', v: problemas, c: '#DC2626', bg: '#FEE2E2', i: 'AlertTriangle' },
                        ].map(k => (
                            <div key={k.l} className="bg-white rounded-xl border p-2.5 sm:p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center gap-1 sm:gap-1.5 mb-1">
                                    <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, backgroundColor: k.bg }}>
                                        <Icon name={k.i} size={11} color={k.c} />
                                    </div>
                                    <span className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                </div>
                                <p className="text-xl font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filtros scroll horizontal */}
                    <div className="flex gap-2 mb-4 sm:mb-5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
                        {['', 'Pendente', 'Em Andamento', 'Problema Reportado', 'Finalizada'].map(s => (
                            <button key={s} onClick={() => setFiltro(s)}
                                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border flex-shrink-0"
                                style={filtro === s
                                    ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                                    : { backgroundColor: 'white', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}>
                                {s || 'Todas'}
                            </button>
                        ))}
                    </div>

                    {/* Lista */}
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: '#059669', borderTopColor: 'transparent' }} />
                        </div>
                    ) : ordens.length === 0 ? (
                        <div className="bg-white rounded-xl border p-8 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="Wrench" size={32} color="var(--color-muted-foreground)" />
                            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                Nenhuma ordem{filtro ? ` com status "${filtro}"` : ' de serviço encontrada'}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {ordens.map(o => {
                                const cfg = STATUS_CFG[o.status] || STATUS_CFG['Pendente'];
                                return (
                                    <div key={o.id} className="bg-white rounded-xl border shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="p-3 sm:p-4">

                                            {/* Header da OS */}
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                        <span className="font-bold font-data text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                            OS #{o.id?.slice(0, 8).toUpperCase()}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                                                            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                                                            <Icon name={cfg.icon} size={10} />
                                                            {o.status}
                                                        </span>
                                                        {o.prioridade === 'Urgente' && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">URGENTE</span>
                                                        )}
                                                        {o.tipo_manutencao && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: o.tipo_manutencao === 'Preventiva' ? '#DBEAFE' : '#FEF3C7', color: o.tipo_manutencao === 'Preventiva' ? '#1D4ED8' : '#92400E' }}>
                                                                {o.tipo_manutencao}
                                                            </span>
                                                        )}
                                                        {o.assinatura_mecanico && (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700" title={`Assinado por ${o.assinatura_mecanico}`}>
                                                                <Icon name="PenTool" size={10} />Assinado
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        {FMT_DATE(o.created_at)}
                                                        {(o.veiculo?.placa || o.veiculo_caminhao_placa) && <> · <span className="font-data font-medium">{o.veiculo?.placa || o.veiculo_caminhao_placa}</span></>}
                                                        {(o.veiculo?.modelo || o.veiculo_caminhao_modelo) && <span className="hidden sm:inline"> — {o.veiculo?.modelo || o.veiculo_caminhao_modelo}</span>}
                                                        {o.km_atual != null && <> · KM: <span className="font-data font-medium">{Number(o.km_atual).toLocaleString('pt-BR')}</span></>}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                    <button onClick={() => printOrdemServico(o)}
                                                        className="flex items-center gap-1 text-xs text-gray-500 font-medium hover:underline">
                                                        <Icon name="Printer" size={14} color="var(--color-muted-foreground)" />
                                                        <span className="hidden sm:inline">Imprimir</span>
                                                    </button>
                                                    {o.pdf_url && (() => {
                                                    const tipoAnexo = getAnexoTipo(o.pdf_url);
                                                    if (tipoAnexo === 'word') {
                                                        return (
                                                            <button onClick={() => downloadAnexo(o.pdf_url, `OS_${o.id?.slice(0,8)}.docx`)}
                                                                className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
                                                                style={{ paddingTop: 2 }}>
                                                                <Icon name="FileText" size={14} color="#1D4ED8" />
                                                                <span className="hidden sm:inline">Baixar anexo</span>
                                                                <span className="sm:hidden">Word</span>
                                                            </button>
                                                        );
                                                    }
                                                    return (
                                                        <button onClick={() => setPdfUrl(o.pdf_url)}
                                                            className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
                                                            style={{ paddingTop: 2 }}>
                                                            <Icon name={tipoAnexo === 'imagem' ? 'Image' : 'FileText'} size={14} color="#1D4ED8" />
                                                            <span className="hidden sm:inline">{tipoAnexo === 'imagem' ? 'Ver imagem' : 'Ver PDF'}</span>
                                                            <span className="sm:hidden">{tipoAnexo === 'imagem' ? 'Imagem' : 'PDF'}</span>
                                                        </button>
                                                    );
                                                })()}
                                                </div>
                                            </div>

                                            {/* Descrição */}
                                            <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: '#F8FAFC' }}>
                                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Serviço solicitado:</p>
                                                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{o.descricao || '—'}</p>
                                            </div>

                                            {o.observacoes && (
                                                <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: '#F1F5F9' }}>
                                                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Observações do serviço:</p>
                                                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{o.observacoes}</p>
                                                </div>
                                            )}

                                            {(o.pecas_solicitadas || []).length > 0 && (
                                                <div className="p-3 rounded-lg mb-3 space-y-1.5" style={{ backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF' }}>
                                                    <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#6D28D9' }}>
                                                        <Icon name="Package" size={13} color="#6D28D9" />Peças solicitadas
                                                    </p>
                                                    {(o.pecas_solicitadas || []).map((p, idx) => {
                                                        const statusCor = p.status === 'Aprovado' ? { bg: '#D1FAE5', text: '#065F46' } : p.status === 'Reprovado' ? { bg: '#FEE2E2', text: '#991B1B' } : { bg: '#FEF9C3', text: '#B45309' };
                                                        return (
                                                            <div key={p.id || idx} className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded-lg bg-white">
                                                                <span style={{ color: 'var(--color-text-primary)' }}>{p.item} × {p.quantidade}</span>
                                                                <span className="px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ backgroundColor: statusCor.bg, color: statusCor.text }}>{p.status || 'Pendente'}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {o.problema_encontrado && (
                                                <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                                                    <p className="text-xs font-medium text-red-600 mb-1">⚠️ Problema reportado:</p>
                                                    <p className="text-sm text-red-700 leading-relaxed">{o.problema_encontrado}</p>
                                                </div>
                                            )}

                                            {o.obs_finalizacao && (
                                                <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                                    <p className="text-xs font-medium text-green-600 mb-1">✅ Obs de finalização:</p>
                                                    <p className="text-sm text-green-700 leading-relaxed">{o.obs_finalizacao}</p>
                                                </div>
                                            )}

                                            {/* Ações — full width no mobile */}
                                            {(o.status === 'Pendente' || o.status === 'Em Andamento') && (
                                                <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                    <button onClick={() => { setModalFinalizar(o); setObsFinalizar(''); setAssinarFinalizacao(true); }}
                                                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-white w-full sm:w-auto"
                                                        style={{ backgroundColor: '#059669' }}>
                                                        <Icon name="CheckCircle2" size={14} color="#fff" />
                                                        Finalizar OS
                                                    </button>
                                                    <button onClick={() => { setModalPeca(o); setPecaItem(''); setPecaItemOutro(''); setPecaQtd('1'); setPecasParaSolicitar([]); }}
                                                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold border w-full sm:w-auto"
                                                        style={{ borderColor: '#DDD6FE', color: '#6D28D9' }}>
                                                        <Icon name="Package" size={14} color="#6D28D9" />
                                                        Solicitar Peça
                                                    </button>
                                                    <button onClick={() => { setModalProblema(o); setDescProblema(''); }}
                                                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold border w-full sm:w-auto"
                                                        style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                                                        <Icon name="AlertTriangle" size={14} color="#DC2626" />
                                                        Reportar Problema
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    </>
                    )}

                    {pageTab === 'pneus' && (
                        <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Formulário de registro */}
                            <div className="bg-white rounded-xl border p-4 sm:p-5 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Icon name={editandoPneuId ? 'Pencil' : 'CircleDot'} size={16} color="var(--color-primary)" />
                                        <h2 className="font-heading font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                            {editandoPneuId ? 'Editar Registro de Pneu' : 'Registrar Troca de Pneu'}
                                        </h2>
                                    </div>
                                    {editandoPneuId && (
                                        <button onClick={handleCancelarEdicaoPneu} className="text-xs font-medium px-2 py-1 rounded-lg border hover:bg-gray-50"
                                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                            Cancelar edição
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Placa do veículo <span className="text-red-500">*</span></label>
                                    <SearchableSelect
                                        value={formPneu.veiculo_id}
                                        onChange={v => setFormPneu(f => ({ ...f, veiculo_id: v }))}
                                        options={veiculoOptionsPneu}
                                        placeholder="Selecione a placa..." emptyLabel="Nenhum veículo encontrado" />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Motorista que realizou/solicitou a troca</label>
                                    <SearchableSelect
                                        value={formPneu.motorista_id}
                                        onChange={v => setFormPneu(f => ({ ...f, motorista_id: v }))}
                                        options={motoristasPneu.map(m => ({ value: m.id, label: m.name }))}
                                        placeholder="Selecione (opcional)..." emptyLabel="Nenhum motorista encontrado" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Km atual do veículo <span className="text-red-500">*</span></label>
                                        <input type="number" inputMode="decimal" min="0" value={formPneu.km_atual}
                                            onChange={e => setFormPneu(f => ({ ...f, km_atual: e.target.value }))}
                                            className={inputCls} style={inputStyle} placeholder="Ex: 245000" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Tipo do pneu usado <span className="text-red-500">*</span></label>
                                        <div className="flex gap-1.5">
                                            {[{ v: 'novo', l: 'Novo', c: '#059669' }, { v: 'recapado', l: 'Recapado', c: '#B45309' }].map(op => (
                                                <button key={op.v} type="button" onClick={() => setFormPneu(f => ({ ...f, tipo_pneu: op.v }))}
                                                    className="flex-1 px-2 py-2 rounded-lg border text-xs font-semibold transition-colors"
                                                    style={formPneu.tipo_pneu === op.v
                                                        ? { backgroundColor: `${op.c}1A`, borderColor: op.c, color: op.c }
                                                        : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                                    {op.l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Marca <span className="text-red-500">*</span></label>
                                        <PrettySelect value={formPneu.marca} onChange={e => setFormPneu(f => ({ ...f, marca: e.target.value }))} className={inputCls} style={inputStyle}>
                                            <option value="">Selecione...</option>
                                            {catalogoPneus.marca.map(m => <option key={m} value={m}>{m}</option>)}
                                        </PrettySelect>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Medida <span className="text-red-500">*</span></label>
                                        <PrettySelect value={formPneu.medida} onChange={e => setFormPneu(f => ({ ...f, medida: e.target.value }))} className={inputCls} style={inputStyle}>
                                            <option value="">Selecione...</option>
                                            {catalogoPneus.medida.map(m => <option key={m} value={m}>{m}</option>)}
                                        </PrettySelect>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Bandagem</label>
                                        <PrettySelect value={formPneu.categoria_bandagem} onChange={e => setFormPneu(f => ({ ...f, categoria_bandagem: e.target.value }))} className={inputCls} style={inputStyle}>
                                            {BANDAGEM_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                                        </PrettySelect>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Configuração do veículo (nº de eixos) <span className="text-red-500">*</span></label>
                                    <PrettySelect value={formPneu.configuracao_veiculo}
                                        onChange={e => setFormPneu(f => ({ ...f, configuracao_veiculo: e.target.value, posicoes_diagrama: [] }))}
                                        className={inputCls} style={inputStyle}>
                                        <option value="">Selecione...</option>
                                        {CONFIGURACOES_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </PrettySelect>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                        Posição(ões) do pneu trocado <span className="text-red-500">*</span>
                                        {!editandoPneuId && (
                                            <span className="ml-1 font-normal" style={{ color: 'var(--color-muted-foreground)' }}>
                                                — marque quantas trocou de uma vez
                                            </span>
                                        )}
                                    </label>
                                    <DiagramaPneuVeiculo
                                        configuracao={formPneu.configuracao_veiculo}
                                        value={formPneu.posicoes_diagrama}
                                        onChange={ids => setFormPneu(f => ({ ...f, posicoes_diagrama: ids }))}
                                        ocupadas={posicoesOcupadas}
                                        multi={!editandoPneuId}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Observações</label>
                                    <textarea value={formPneu.observacoes} onChange={e => setFormPneu(f => ({ ...f, observacoes: e.target.value }))}
                                        className={inputCls} style={inputStyle} rows={2} placeholder="Detalhes adicionais (opcional)" />
                                </div>

                                <button onClick={handleSalvarPneu} disabled={savingPneu}
                                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                                    style={{ backgroundColor: editandoPneuId ? '#1D4ED8' : '#059669' }}>
                                    <Icon name="Check" size={15} color="#fff" />
                                    {savingPneu
                                        ? 'Salvando...'
                                        : editandoPneuId
                                            ? 'Salvar Alterações'
                                            : formPneu.posicoes_diagrama.length > 1
                                                ? `Registrar ${formPneu.posicoes_diagrama.length} Trocas de Pneu`
                                                : 'Registrar Troca de Pneu'}
                                </button>
                            </div>

                            {/* Últimos registros feitos por este mecânico */}
                            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                                    <h2 className="font-heading font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>Meus Últimos Registros</h2>
                                    {loadingPneus && <Icon name="RefreshCw" size={13} color="var(--color-muted-foreground)" className="animate-spin" />}
                                </div>
                                {meusPneusAgrupados.length === 0 ? (
                                    <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                                        <Icon name="CircleDot" size={28} color="#CBD5E1" />
                                        <p className="text-xs">Nenhum pneu registrado ainda</p>
                                    </div>
                                ) : (
                                    <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                        {meusPneusAgrupados.map(item => item.grupo ? (
                                            <div key={item.lote_id}>
                                                <div className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-50">
                                                    <button type="button" onClick={() => toggleLote(item.lote_id)} className="flex items-start gap-3 flex-1 min-w-0 text-left">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                                                            <Icon name="Layers" size={14} color="#1D4ED8" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                                {item.itens.length} pneus trocados · {item.itens[0].veiculo?.placa || item.itens[0].veiculo_caminhao_placa || 'Sem placa'}
                                                            </p>
                                                            <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                {item.itens[0].marca} {item.itens[0].medida} · {new Date(item.itens[0].data_instalacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                            </p>
                                                        </div>
                                                    </button>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <button onClick={() => handleExcluirLote(item)} title="Excluir lote inteiro"
                                                            className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-50">
                                                            <Icon name="Trash2" size={13} color="#DC2626" />
                                                        </button>
                                                        <button onClick={() => toggleLote(item.lote_id)} className="w-6 h-6 rounded-md flex items-center justify-center">
                                                            <Icon name={lotesExpandidos[item.lote_id] ? 'ChevronUp' : 'ChevronDown'} size={16} color="var(--color-muted-foreground)" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {lotesExpandidos[item.lote_id] && (
                                                    <div className="divide-y bg-slate-50/60" style={{ borderColor: 'var(--color-border)' }}>
                                                        {item.itens.map(p => (
                                                            <RegistroPneuRow key={p.id} p={p} editando={editandoPneuId === p.id}
                                                                onVer={setVerPneu} onEditar={handleEditarPneu} onExcluir={handleExcluirPneu} indent />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <RegistroPneuRow key={item.pneu.id} p={item.pneu} editando={editandoPneuId === item.pneu.id}
                                                onVer={setVerPneu} onEditar={handleEditarPneu} onExcluir={handleExcluirPneu} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {verPneu && <ModalVerPneu p={verPneu} onClose={() => setVerPneu(null)} />}
                        {ConfirmDialogPneu}
                        </>
                    )}
                </div>
            </main>

            {/* Modal Finalizar */}
            {modalFinalizar && (
                <ModalOverlay onClose={() => setModalFinalizar(null)}>
                    <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                    <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b sticky top-0 bg-white z-10" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#D1FAE5' }}>
                                <Icon name="CheckCircle2" size={18} color="#059669" />
                            </div>
                            <h2 className="font-heading font-bold text-base sm:text-lg truncate" style={{ color: 'var(--color-text-primary)' }}>Finalizar OS</h2>
                        </div>
                        <button onClick={() => setModalFinalizar(null)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
                            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                    <div className="px-4 sm:px-5 py-4 space-y-4">
                        <div className="p-3 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                            <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                OS #{modalFinalizar.id?.slice(0, 8).toUpperCase()}
                                {(modalFinalizar.veiculo?.placa || modalFinalizar.veiculo_caminhao_placa) && <span className="font-data"> · {modalFinalizar.veiculo?.placa || modalFinalizar.veiculo_caminhao_placa}</span>}
                            </p>
                            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-muted-foreground)' }}>{modalFinalizar.descricao}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Observações de conclusão (opcional)</label>
                            <textarea value={obsFinalizar} onChange={e => setObsFinalizar(e.target.value)}
                                className={inputCls} style={inputStyle} rows={4}
                                placeholder="Descreva o que foi feito, peças trocadas, etc..." />
                        </div>
                        {profile?.assinatura_digital ? (
                            <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer" style={{ backgroundColor: assinarFinalizacao ? '#EFF6FF' : 'var(--color-muted)', border: `1px solid ${assinarFinalizacao ? '#93C5FD' : 'var(--color-border)'}` }}>
                                <input type="checkbox" checked={assinarFinalizacao} onChange={e => setAssinarFinalizacao(e.target.checked)} className="w-4 h-4" />
                                <Icon name="PenTool" size={14} color={assinarFinalizacao ? '#1D4ED8' : 'var(--color-muted-foreground)'} />
                                <span className="text-xs font-medium" style={{ color: assinarFinalizacao ? '#1D4ED8' : 'var(--color-text-secondary)' }}>
                                    Autenticar com minha assinatura digital ({profile.assinatura_digital})
                                </span>
                            </label>
                        ) : (
                            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                <Icon name="Info" size={12} />
                                Você ainda não tem uma assinatura digital cadastrada. Peça ao administrador para cadastrar.
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 px-4 sm:px-5 pb-5 sm:justify-end">
                        <button onClick={() => setModalFinalizar(null)}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center"
                            style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <button onClick={handleFinalizar}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                            style={{ backgroundColor: '#059669' }}>
                            <Icon name="CheckCircle2" size={15} color="#fff" />
                            Confirmar Finalização
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Reportar Problema */}
            {modalProblema && (
                <ModalOverlay onClose={() => setModalProblema(null)}>
                    <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                    <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b sticky top-0 bg-white z-10" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEE2E2' }}>
                                <Icon name="AlertTriangle" size={18} color="#DC2626" />
                            </div>
                            <h2 className="font-heading font-bold text-base sm:text-lg truncate" style={{ color: 'var(--color-text-primary)' }}>Reportar Problema</h2>
                        </div>
                        <button onClick={() => setModalProblema(null)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
                            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                    <div className="px-4 sm:px-5 py-4 space-y-4">
                        <div className="p-3 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                            <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                OS #{modalProblema.id?.slice(0, 8).toUpperCase()}
                                {(modalProblema.veiculo?.placa || modalProblema.veiculo_caminhao_placa) && <span className="font-data"> · {modalProblema.veiculo?.placa || modalProblema.veiculo_caminhao_placa}</span>}
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Descreva o problema encontrado <span className="text-red-500">*</span>
                            </label>
                            <textarea value={descProblema} onChange={e => setDescProblema(e.target.value)}
                                className={inputCls} style={inputStyle} rows={5}
                                placeholder="Ex: Desgaste excessivo nas pastilhas de freio, necessário substituição imediata..." />
                        </div>
                        <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE68A' }}>
                            <p className="text-amber-700">⚠️ O problema será enviado ao administrador para aprovação antes de prosseguir.</p>
                        </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 px-4 sm:px-5 pb-5 sm:justify-end">
                        <button onClick={() => setModalProblema(null)}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center"
                            style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <button onClick={handleReportarProblema}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                            style={{ backgroundColor: '#DC2626' }}>
                            <Icon name="Send" size={14} color="#fff" />
                            Enviar para Admin
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Solicitar Peça */}
            {modalPeca && (
                <ModalOverlay onClose={() => setModalPeca(null)}>
                    <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                    <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b sticky top-0 bg-white z-10" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EDE9FE' }}>
                                <Icon name="Package" size={18} color="#6D28D9" />
                            </div>
                            <h2 className="font-heading font-bold text-base sm:text-lg truncate" style={{ color: 'var(--color-text-primary)' }}>Solicitar Peça{pecasParaSolicitar.length > 0 ? `s (${pecasParaSolicitar.length})` : ''}</h2>
                        </div>
                        <button onClick={() => setModalPeca(null)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
                            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                    <div className="px-4 sm:px-5 py-4 space-y-4">
                        <div className="p-3 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                            <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                OS #{modalPeca.id?.slice(0, 8).toUpperCase()}
                                {(modalPeca.veiculo?.placa || modalPeca.veiculo_caminhao_placa) && <span className="font-data"> · {modalPeca.veiculo?.placa || modalPeca.veiculo_caminhao_placa}</span>}
                            </p>
                        </div>

                        {/* Peças já adicionadas nesta requisição — "carrinho" antes de enviar tudo junto */}
                        {pecasParaSolicitar.length > 0 && (
                            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#DDD6FE' }}>
                                <div className="px-3 py-2 text-xs font-semibold" style={{ backgroundColor: '#F5F3FF', color: '#6D28D9' }}>
                                    Peças nesta solicitação ({pecasParaSolicitar.length})
                                </div>
                                <ul className="divide-y" style={{ borderColor: '#EDE9FE' }}>
                                    {pecasParaSolicitar.map(p => (
                                        <li key={p.key} className="flex items-center justify-between px-3 py-2 text-sm">
                                            <span className="truncate min-w-0">{p.item} <span className="font-data" style={{ color: 'var(--color-muted-foreground)' }}>× {p.quantidade}</span></span>
                                            <button onClick={() => handleRemoverPecaDaLista(p.key)} className="p-1 rounded-md hover:bg-red-50 flex-shrink-0" title="Remover">
                                                <Icon name="X" size={13} color="var(--color-destructive)" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Item / peça{pecasParaSolicitar.length === 0 && <span className="text-red-500"> *</span>}
                            </label>
                            <PrettySelect value={pecaItem} onChange={e => setPecaItem(e.target.value)}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione a peça...</option>
                                {pecasCatalogo
                                    .filter(p => !modalPeca.veiculo?.tipo || p.categoria === 'Ambos' || p.categoria === modalPeca.veiculo.tipo)
                                    .map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                <option value="__outro__">Outro (especificar)...</option>
                            </PrettySelect>
                            {pecaItem === '__outro__' && (
                                <input value={pecaItemOutro} onChange={e => setPecaItemOutro(e.target.value)}
                                    className={`${inputCls} mt-2`} style={inputStyle}
                                    placeholder="Digite o nome da peça" autoFocus />
                            )}
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Quantidade</label>
                                <input type="number" min="1" value={pecaQtd} onChange={e => setPecaQtd(e.target.value)}
                                    className={inputCls} style={inputStyle} />
                            </div>
                            <button type="button" onClick={handleAdicionarPecaNaLista}
                                className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-1.5 flex-shrink-0"
                                style={{ backgroundColor: '#EDE9FE', color: '#6D28D9' }}>
                                <Icon name="Plus" size={15} color="#6D28D9" /> Adicionar
                            </button>
                        </div>
                        <p className="text-xs -mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
                            Precisa de mais de uma peça? Clique em "Adicionar" pra cada uma e envie tudo junto numa só solicitação.
                        </p>
                        <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE68A' }}>
                            <p className="text-amber-700">⚠️ A solicitação será enviada ao administrador, que poderá aprovar ou reprovar a compra.</p>
                        </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 px-4 sm:px-5 pb-5 sm:justify-end">
                        <button onClick={() => setModalPeca(null)}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center"
                            style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <button onClick={handleSolicitarPeca}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                            style={{ backgroundColor: '#6D28D9' }}>
                            <Icon name="Send" size={14} color="#fff" />
                            Enviar Solicitação{(pecasParaSolicitar.length > 1 || (pecasParaSolicitar.length === 1 && (pecaItem === '__outro__' ? pecaItemOutro.trim() : pecaItem))) ? ` (${pecasParaSolicitar.length + ((pecaItem === '__outro__' ? pecaItemOutro.trim() : pecaItem) ? 1 : 0)})` : ''}
                        </button>
                    </div>
                </ModalOverlay>
            )}

            <Toast toast={toast} />
        </div>
    );
}
