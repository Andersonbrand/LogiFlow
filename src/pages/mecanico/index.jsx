import React, { useState, useEffect, useCallback } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import Button from 'components/ui/Button';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {children}
            </div>
        </div>
    );
}

export default function MecanicoPage() {
    const { user, profile } = useAuth();
    const { toast, showToast } = useToast();
    const [ordens, setOrdens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('Pendente');
    const [modalFinalizar, setModalFinalizar] = useState(null);
    const [modalProblema, setModalProblema] = useState(null);
    const [obsFinalizar, setObsFinalizar] = useState('');
    const [descProblema, setDescProblema] = useState('');
    const [pdfUrl, setPdfUrl] = useState(null);

    const load = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await fetchOrdensServico({ mecanicoId: user.id, status: filtro || undefined });
            setOrdens(data);
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [user?.id, filtro]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

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

    const pendentes  = ordens.filter(o => o.status === 'Pendente').length;
    const andamento  = ordens.filter(o => o.status === 'Em Andamento').length;
    const problemas  = ordens.filter(o => o.status === 'Problema Reportado').length;

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-lg mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: '#059669' }}>
                            {(profile?.name || 'M')[0].toUpperCase()}
                        </div>
                        <div>
                            <h1 className="font-heading font-bold text-xl" style={{ color: 'var(--color-text-primary)' }}>
                                Olá, {profile?.name || 'Mecânico'}
                            </h1>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Ordens de serviço da oficina</p>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                        {[
                            { l: 'Pendentes',  v: pendentes, c: '#B45309', bg: '#FEF9C3', i: 'Clock' },
                            { l: 'Andamento',  v: andamento, c: '#1D4ED8', bg: '#DBEAFE', i: 'Wrench' },
                            { l: 'Problemas',  v: problemas, c: '#DC2626', bg: '#FEE2E2', i: 'AlertTriangle' },
                        ].map(k => (
                            <div key={k.l} className="bg-white rounded-xl border p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="rounded-lg flex items-center justify-center" style={{ width: 24, height: 24, backgroundColor: k.bg }}>
                                        <Icon name={k.i} size={12} color={k.c} />
                                    </div>
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                </div>
                                <p className="text-xl font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filtro de status */}
                    <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
                        {['', 'Pendente', 'Em Andamento', 'Problema Reportado', 'Finalizada'].map(s => (
                            <button key={s} onClick={() => setFiltro(s)}
                                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border"
                                style={filtro === s
                                    ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                                    : { backgroundColor: 'white', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}>
                                {s || 'Todas'}
                            </button>
                        ))}
                    </div>

                    {/* Lista de ordens */}
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: '#059669', borderTopColor: 'transparent' }} />
                        </div>
                    ) : ordens.length === 0 ? (
                        <div className="bg-white rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="Wrench" size={36} color="var(--color-muted-foreground)" />
                            <p className="text-sm mt-3" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma ordem de serviço{filtro ? ` com status "${filtro}"` : ''}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {ordens.map(o => {
                                const cfg = STATUS_CFG[o.status] || STATUS_CFG['Pendente'];
                                return (
                                    <div key={o.id} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="p-4">
                                            {/* Header da OS */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold font-data text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                            OS #{o.id?.slice(0, 8).toUpperCase()}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                                                            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                                                            <Icon name={cfg.icon} size={10} />
                                                            {o.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        {FMT_DATE(o.created_at)} · {o.veiculo?.placa || '—'} {o.veiculo?.modelo ? `— ${o.veiculo.modelo}` : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Descrição */}
                                            <div className="p-3 rounded-lg mb-3 text-sm" style={{ backgroundColor: '#F8FAFC' }}>
                                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Serviço solicitado:</p>
                                                <p style={{ color: 'var(--color-text-primary)' }}>{o.descricao || '—'}</p>
                                            </div>

                                            {/* Problema reportado pelo mecânico */}
                                            {o.problema_encontrado && (
                                                <div className="p-3 rounded-lg mb-3 text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                                                    <p className="text-xs font-medium text-red-600 mb-1">⚠️ Problema reportado:</p>
                                                    <p className="text-red-700">{o.problema_encontrado}</p>
                                                </div>
                                            )}

                                            {/* Obs de finalização */}
                                            {o.obs_finalizacao && (
                                                <div className="p-3 rounded-lg mb-3 text-sm" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                                    <p className="text-xs font-medium text-green-600 mb-1">✅ Obs de finalização:</p>
                                                    <p className="text-green-700">{o.obs_finalizacao}</p>
                                                </div>
                                            )}

                                            {/* PDF da OS */}
                                            {o.pdf_url && (
                                                <button
                                                    onClick={() => setPdfUrl(o.pdf_url)}
                                                    className="flex items-center gap-2 text-xs text-blue-600 hover:underline mb-3">
                                                    <Icon name="FileText" size={14} color="#1D4ED8" />
                                                    Ver ordem de serviço (PDF)
                                                </button>
                                            )}

                                            {/* Ações */}
                                            {(o.status === 'Pendente' || o.status === 'Em Andamento') && (
                                                <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                    <button
                                                        onClick={() => { setModalFinalizar(o); setObsFinalizar(''); }}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
                                                        style={{ backgroundColor: '#059669' }}>
                                                        <Icon name="CheckCircle2" size={14} color="#fff" />
                                                        Finalizar OS
                                                    </button>
                                                    <button
                                                        onClick={() => { setModalProblema(o); setDescProblema(''); }}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors hover:bg-red-50"
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

            {/* Modal Finalizar OS */}
            {modalFinalizar && (
                <ModalOverlay onClose={() => setModalFinalizar(null)}>
                    <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                                <Icon name="CheckCircle2" size={18} color="#059669" />
                            </div>
                            <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>Finalizar Ordem de Serviço</h2>
                        </div>
                        <button onClick={() => setModalFinalizar(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#F8FAFC' }}>
                            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                OS #{modalFinalizar.id?.slice(0, 8).toUpperCase()} · {modalFinalizar.veiculo?.placa}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{modalFinalizar.descricao}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Observações de conclusão (opcional)
                            </label>
                            <textarea value={obsFinalizar} onChange={e => setObsFinalizar(e.target.value)}
                                className={inputCls} style={inputStyle} rows={4}
                                placeholder="Descreva o que foi feito, peças trocadas, etc..." />
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModalFinalizar(null)}
                            className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleFinalizar} iconName="CheckCircle2" size="sm">Confirmar Finalização</Button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Reportar Problema */}
            {modalProblema && (
                <ModalOverlay onClose={() => setModalProblema(null)}>
                    <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                                <Icon name="AlertTriangle" size={18} color="#DC2626" />
                            </div>
                            <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>Reportar Problema</h2>
                        </div>
                        <button onClick={() => setModalProblema(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#F8FAFC' }}>
                            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                OS #{modalProblema.id?.slice(0, 8).toUpperCase()} · {modalProblema.veiculo?.placa}
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Descreva o problema encontrado <span className="text-red-500">*</span>
                            </label>
                            <textarea value={descProblema} onChange={e => setDescProblema(e.target.value)}
                                className={inputCls} style={inputStyle} rows={5}
                                placeholder="Ex: Verificado desgaste excessivo nas pastilhas de freio dianteiras, necessário substituição imediata..." />
                        </div>
                        <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE68A' }}>
                            <p className="text-amber-700">⚠️ O problema será enviado ao administrador para aprovação antes de prosseguir.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModalProblema(null)}
                            className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <button onClick={handleReportarProblema}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                            style={{ backgroundColor: '#DC2626' }}>
                            <Icon name="Send" size={14} color="#fff" />
                            Enviar para Admin
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Viewer de PDF — header fixo ACIMA do iframe, sempre visível */}
            {pdfUrl && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
                    {/* Barra superior — sempre visível, z-index máximo */}
                    <div style={{
                        position: 'relative', zIndex: 10000,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', backgroundColor: '#111827',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        flexShrink: 0,
                    }}>
                        <button
                            onClick={() => setPdfUrl(null)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 16px', borderRadius: 8,
                                backgroundColor: '#2563EB', color: 'white',
                                border: 'none', cursor: 'pointer',
                                fontSize: 14, fontWeight: 600,
                            }}>
                            ← Voltar às Ordens de Serviço
                        </button>
                        <span style={{ color: '#9CA3AF', fontSize: 13 }}>Ordem de Serviço — PDF</span>
                        <button
                            onClick={() => setPdfUrl(null)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 32, borderRadius: 6,
                                backgroundColor: '#374151', color: 'white',
                                border: 'none', cursor: 'pointer', fontSize: 18,
                            }}>
                            ✕
                        </button>
                    </div>
                    {/* iframe ocupa o restante */}
                    <iframe
                        src={pdfUrl}
                        title="Ordem de Serviço"
                        style={{ flex: 1, border: 'none', width: '100%', backgroundColor: '#1a1a1a' }}
                    />
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}
