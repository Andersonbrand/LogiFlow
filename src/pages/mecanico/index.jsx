import React, { useState, useEffect, useCallback } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { subscribeTabela } from 'utils/supabaseClient';
import { fetchOrdensServico, finalizarOrdemServico, reportarProblemaOS } from 'utils/carretasService';

const FMT_DATE = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const STATUS_CFG = {
    'Pendente':           { bg: '#FEF9C3', text: '#B45309', icon: 'Clock' },
    'Em Andamento':       { bg: '#DBEAFE', text: '#1D4ED8', icon: 'Wrench' },
    'Finalizada':         { bg: '#D1FAE5', text: '#065F46', icon: 'CheckCircle2' },
    'Problema Reportado': { bg: '#FEE2E2', text: '#B91C1C', icon: 'AlertTriangle' },
};

const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500";
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

function ModalOverlay({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
                {children}
            </div>
        </div>
    );
}

export default function MecanicoPage() {
    const { user, profile } = useAuth();
    const { toast, showToast } = useToast();
    const [ordens, setOrdens]                 = useState([]);
    const [loading, setLoading]               = useState(true);
    const [filtro, setFiltro]                 = useState('Pendente');
    const [modalFinalizar, setModalFinalizar] = useState(null);
    const [modalProblema, setModalProblema]   = useState(null);
    const [obsFinalizar, setObsFinalizar]     = useState('');
    const [descProblema, setDescProblema]     = useState('');
    const [pdfUrl, setPdfUrl]                 = useState(null);

    const load = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await fetchOrdensServico({ mecanicoId: user.id, status: filtro || undefined });
            setOrdens(data);
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
            await finalizarOrdemServico(modalFinalizar.id, user.id, obsFinalizar);
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
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    position: 'relative', zIndex: 10000, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px', backgroundColor: '#111827',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}>
                    <span style={{ color: '#9CA3AF', fontSize: 13 }}>Ordem de Serviço — PDF</span>
                    <button onClick={() => setPdfUrl(null)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, borderRadius: 6,
                        backgroundColor: '#374151', color: '#D1D5DB',
                        border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1,
                    }} title="Fechar">✕</button>
                </div>
                <iframe src={pdfUrl} title="OS" style={{ flex: 1, border: 'none', width: '100%', backgroundColor: '#1a1a1a', display: 'block' }} />
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
                        <div className="min-w-0">
                            <h1 className="font-heading font-bold text-lg sm:text-xl truncate" style={{ color: 'var(--color-text-primary)' }}>
                                Olá, {profile?.name || 'Mecânico'}
                            </h1>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Ordens de serviço da oficina</p>
                        </div>
                    </div>

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
                        <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="Wrench" size={32} color="var(--color-muted-foreground)" />
                            <p className="text-sm mt-3" style={{ color: 'var(--color-muted-foreground)' }}>
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
                                                    </div>
                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        {FMT_DATE(o.created_at)}
                                                        {o.veiculo?.placa && <> · <span className="font-data font-medium">{o.veiculo.placa}</span></>}
                                                        {o.veiculo?.modelo && <span className="hidden sm:inline"> — {o.veiculo.modelo}</span>}
                                                    </p>
                                                </div>
                                                {o.pdf_url && (
                                                    <button onClick={() => setPdfUrl(o.pdf_url)}
                                                        className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
                                                        style={{ paddingTop: 2 }}>
                                                        <Icon name="FileText" size={14} color="#1D4ED8" />
                                                        <span className="hidden sm:inline">Ver PDF</span>
                                                        <span className="sm:hidden">PDF</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Descrição */}
                                            <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: '#F8FAFC' }}>
                                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Serviço solicitado:</p>
                                                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{o.descricao || '—'}</p>
                                            </div>

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
                                                    <button onClick={() => { setModalFinalizar(o); setObsFinalizar(''); }}
                                                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-white w-full sm:w-auto"
                                                        style={{ backgroundColor: '#059669' }}>
                                                        <Icon name="CheckCircle2" size={14} color="#fff" />
                                                        Finalizar OS
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
                </div>
            </main>

            {/* Modal Finalizar */}
            {modalFinalizar && (
                <ModalOverlay onClose={() => setModalFinalizar(null)}>
                    <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                    <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
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
                                {modalFinalizar.veiculo?.placa && <span className="font-data"> · {modalFinalizar.veiculo.placa}</span>}
                            </p>
                            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-muted-foreground)' }}>{modalFinalizar.descricao}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Observações de conclusão (opcional)</label>
                            <textarea value={obsFinalizar} onChange={e => setObsFinalizar(e.target.value)}
                                className={inputCls} style={inputStyle} rows={4}
                                placeholder="Descreva o que foi feito, peças trocadas, etc..." />
                        </div>
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
                    <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
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
                                {modalProblema.veiculo?.placa && <span className="font-data"> · {modalProblema.veiculo.placa}</span>}
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

            <Toast toast={toast} />
        </div>
    );
}
