import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, usePagination, PrettySelect, AppIcon as Icon, Button, PaginationBar, Toast, SearchInput } from 'components';
import { fetchOrdensServico, fetchVeiculosProprios, fetchMecanicos, updateOrdemServico, createOrdemServico, deleteOrdemServico } from 'services/carretas';
import { fetchCaminhoesPlacas } from 'services/vehicleService';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import { printOrdemServico } from 'utils/excel';

import { inputStyle } from '../../utils/constants';
import { downloadImagem } from '../../utils/helpers';
import GerenciarPecasModal from '../GerenciarPecasModal';
import { getAnexoTipo } from './utils/helpers';
import Modal from './components/Modal';
import ViewPdf from './components/ViewPdf';

// ─── TAB: Ordens de Serviço ───────────────────────────────────────────────────
export default function TabOrdensServico({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [ordens, setOrdens]     = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [caminhoes, setCaminhoes] = useState([]); // caminhões da página de Veículos (item 1)
    const [mecanicos, setMecanicos] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [filtroStatus, setFiltroStatus] = useState('');
    const mesAtualOS = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; })();
    const [filtroMes, setFiltroMes] = useState(() => {
        try { return sessionStorage.getItem('carretas_os_filtroMes') ?? mesAtualOS; } catch { return mesAtualOS; }
    });
    const handleSetFiltroMes = (v) => {
        setFiltroMes(v);
        try { sessionStorage.setItem('carretas_os_filtroMes', v); } catch {}
    };
    const [modal, setModal]       = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editingStatus, setEditingStatus] = useState(null);
    const [pdfFile, setPdfFile]   = useState(null);
    const [uploading, setUploading] = useState(false);
    const [viewPdf, setViewPdf]   = useState(null);
    const FORM_VAZIO = { veiculo_id: '', veiculo_caminhao_id: '', mecanico_id: '', descricao: '', prioridade: 'Normal', pdf_url: '', assinatura_admin: '', km_atual: '', observacoes: '', tipo_manutencao: 'Corretiva' };
    const [form, setForm] = useState(FORM_VAZIO);
    const [assinarComoAdmin, setAssinarComoAdmin] = useState(false);
    const [gerenciarPecasModal, setGerenciarPecasModal] = useState(false);

    // Fix 4: Quando abre o PDF, empurra um estado no histórico para que o botão
    // Voltar do navegador feche o viewer em vez de sair da página.
    useEffect(() => {
        if (viewPdf) {
            window.history.pushState({ pdfOpen: true }, '');
            const onPop = () => setViewPdf(null);
            window.addEventListener('popstate', onPop);
            return () => window.removeEventListener('popstate', onPop);
        }
    }, [viewPdf]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = filtroStatus ? { status: filtroStatus } : {};
            if (filtroMes) {
                const [yr, mo] = filtroMes.split('-');
                const lastDay = new Date(Number(yr), Number(mo), 0).getDate();
                f.dataInicio = `${filtroMes}-01`;
                f.dataFim    = `${filtroMes}-${String(lastDay).padStart(2, '0')}`;
            }
            const [o, v, c, m] = await Promise.all([
                fetchOrdensServico(f),
                fetchVeiculosProprios(),
                fetchCaminhoesPlacas(),
                fetchMecanicos(),
            ]);
            setOrdens(o); setVeiculos(v); setCaminhoes(c); setMecanicos(m);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtroStatus, filtroMes]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const [pesquisa, setPesquisa] = useState('');
    const [filtroPlacaOS, setFiltroPlacaOS] = useState('');
    const ordensFiltradas = useMemo(() => {
        let base = ordens;
        if (filtroPlacaOS) {
            const [tipo, id] = filtroPlacaOS.split(':');
            base = base.filter(o => tipo === 'cv' ? o.veiculo_id === id : String(o.veiculo_caminhao_id) === id);
        }
        if (!pesquisa.trim()) return base;
        const q = pesquisa.toLowerCase();
        return base.filter(o =>
            (o.veiculo?.placa || '').toLowerCase().includes(q) ||
            (o.veiculo_caminhao_placa || '').toLowerCase().includes(q) ||
            (o.descricao || '').toLowerCase().includes(q) ||
            (o.mecanico?.name || '').toLowerCase().includes(q) ||
            (o.prioridade || '').toLowerCase().includes(q)
        );
    }, [ordens, pesquisa, filtroPlacaOS]);

    const ordensPag = usePagination(ordensFiltradas, 10, [pesquisa, filtroPlacaOS]);

    const TIPOS_ANEXO_OS = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const EXT_ANEXO_OS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp', '.heic'];
    const handlePdfChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
        const tipoValido = TIPOS_ANEXO_OS.includes(file.type) || EXT_ANEXO_OS.includes(ext);
        if (!tipoValido) { showToast('Formato não aceito. Use PDF, Word (.doc/.docx) ou imagem (JPG, PNG, WEBP).', 'error'); return; }
        if (file.size > 8 * 1024 * 1024) { showToast('Arquivo deve ter menos de 8MB', 'error'); return; }
        setPdfFile(file);
        // Convert to base64 data URL for storage
        const reader = new FileReader();
        reader.onload = (ev) => setForm(f => ({ ...f, pdf_url: ev.target.result }));
        reader.readAsDataURL(file);
    };

    const abrirNovaOS = () => {
        setForm(FORM_VAZIO); setPdfFile(null); setEditingId(null); setEditingStatus(null); setAssinarComoAdmin(false); setModal(true);
    };

    const abrirEdicaoOS = (o) => {
        setForm({
            veiculo_id: o.veiculo_id || '',
            veiculo_caminhao_id: o.veiculo_caminhao_id != null ? String(o.veiculo_caminhao_id) : '',
            mecanico_id: o.mecanico_id || '',
            descricao: o.descricao || '',
            prioridade: o.prioridade || 'Normal',
            pdf_url: o.pdf_url || '',
            assinatura_admin: o.assinatura_admin || '',
            km_atual: o.km_atual ?? '',
            observacoes: o.observacoes || '',
            tipo_manutencao: o.tipo_manutencao || 'Corretiva',
        });
        setPdfFile(null);
        setEditingId(o.id);
        setEditingStatus(o.status);
        setAssinarComoAdmin(!!o.assinatura_admin);
        setModal(true);
    };

    // Salva as edições. Quando `enviar` é true e a OS era um rascunho, o status
    // passa para "Pendente" (visível ao mecânico); caso contrário mantém o status atual.
    const handleSalvar = async (enviar = false) => {
        if ((!form.veiculo_id && !form.veiculo_caminhao_id) || !form.descricao) { showToast('Veículo e descrição são obrigatórios', 'error'); return; }
        setUploading(true);
        try {
            const caminhaoSel = form.veiculo_caminhao_id ? caminhoes.find(c => String(c.id) === String(form.veiculo_caminhao_id)) : null;
            const osOriginal = editingId ? ordens.find(o => o.id === editingId) : null;
            const payload = {
                ...form,
                veiculo_id: form.veiculo_id || null,
                veiculo_caminhao_id: form.veiculo_caminhao_id || null,
                veiculo_caminhao_placa: caminhaoSel?.placa || osOriginal?.veiculo_caminhao_placa || null,
                veiculo_caminhao_modelo: caminhaoSel?.modelo || osOriginal?.veiculo_caminhao_modelo || null,
                km_atual: form.km_atual === '' ? null : Number(form.km_atual),
                assinatura_admin: assinarComoAdmin ? (profile?.assinatura_digital || '') : null,
            };
            if (editingId) {
                const updates = { ...payload };
                if (enviar && editingStatus === 'Rascunho') updates.status = 'Pendente';
                await updateOrdemServico(editingId, updates);
                showToast(enviar ? 'OS enviada!' : 'Ordem de serviço atualizada!', 'success');
            } else {
                await createOrdemServico(payload);
                showToast('Ordem de serviço criada!', 'success');
            }
            setModal(false); setPdfFile(null); setEditingId(null); setEditingStatus(null);
            setForm(FORM_VAZIO); setAssinarComoAdmin(false);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setUploading(false); }
    };

    const handleEnviarRascunho = async (o) => {
        try {
            await updateOrdemServico(o.id, { status: 'Pendente' });
            showToast('OS enviada para o mecânico!', 'success');
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDeleteOS = async (id) => {
        const ok = await confirm({ title: 'Excluir Ordem de Serviço?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteOrdemServico(id); showToast('OS excluída!', 'warning'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const STATUS_OS = ['Rascunho', 'Pendente', 'Em Andamento', 'Problema Reportado', 'Finalizada'];
    const STATUS_COLORS_OS = {
        'Rascunho':           { bg: '#F1F5F9', text: '#475569' },
        'Pendente':           { bg: '#FEF9C3', text: '#B45309' },
        'Em Andamento':       { bg: '#DBEAFE', text: '#1D4ED8' },
        'Finalizada':         { bg: '#D1FAE5', text: '#065F46' },
        'Problema Reportado': { bg: '#FEE2E2', text: '#B91C1C' },
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <PrettySelect value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos os status</option>
                        {STATUS_OS.map(s => <option key={s} value={s}>{s}</option>)}
                    </PrettySelect>
                    <input type="month" value={filtroMes} onChange={e => handleSetFiltroMes(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por mês" />
                    {filtroMes && (
                        <button onClick={() => handleSetFiltroMes('')}
                            className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            title="Limpar mês">✕ Mês</button>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <PrettySelect value={filtroPlacaOS} onChange={e => setFiltroPlacaOS(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por placa">
                        <option value="">Todas as placas</option>
                        {veiculos.length > 0 && (
                            <optgroup label="Frota Carretas">
                                {veiculos.map(v => <option key={`cv:${v.id}`} value={`cv:${v.id}`}>{v.placa} — {v.modelo}</option>)}
                            </optgroup>
                        )}
                        {caminhoes.length > 0 && (
                            <optgroup label="Caminhões (Veículos)">
                                {caminhoes.map(v => <option key={`vh:${v.id}`} value={`vh:${v.id}`}>{v.placa} — {v.modelo}</option>)}
                            </optgroup>
                        )}
                    </PrettySelect>
                    <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Placa, tipo, descrição..." width="210px" />
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    {isAdmin && (
                        <button onClick={() => setGerenciarPecasModal(true)}
                            className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Gerenciar catálogo de peças">
                            <Icon name="Package" size={14} color="var(--color-muted-foreground)" />
                        </button>
                    )}
                    {isAdmin && <Button onClick={abrirNovaOS} iconName="Plus" size="sm">Nova OS</Button>}
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="flex flex-col gap-3">
                    {ordensFiltradas.length === 0 && (
                        <div className="bg-white rounded-xl border flex flex-col items-center justify-center p-10 gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <Icon name="Wrench" size={32} color="var(--color-muted-foreground)" />
                            <span className="text-sm">{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhuma ordem de serviço'}</span>
                        </div>
                    )}
                    {ordensPag.pageItems.map(o => {
                        const sc = STATUS_COLORS_OS[o.status] || STATUS_COLORS_OS['Pendente'];
                        const isRascunho = o.status === 'Rascunho';
                        return (
                            <div key={o.id} className="bg-white rounded-xl border p-4 shadow-sm" style={isRascunho ? { borderColor: '#CBD5E1', borderStyle: 'dashed', backgroundColor: '#F8FAFC' } : { borderColor: 'var(--color-border)' }}>
                                <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-bold font-data text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                OS #{o.id?.slice(0, 8).toUpperCase()}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{o.status}</span>
                                            {o.prioridade === 'Urgente' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">URGENTE</span>}
                                            {o.tipo_manutencao && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: o.tipo_manutencao === 'Preventiva' ? '#DBEAFE' : '#FEF3C7', color: o.tipo_manutencao === 'Preventiva' ? '#1D4ED8' : '#92400E' }}>
                                                    {o.tipo_manutencao}
                                                </span>
                                            )}
                                            {o.checklist_id && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700" title="Gerada automaticamente a partir de um checklist">
                                                    <Icon name="ClipboardCheck" size={10} />Do checklist
                                                </span>
                                            )}
                                            {o.assinatura_mecanico && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700" title={`Assinado digitalmente por ${o.assinatura_mecanico}`}>
                                                    <Icon name="PenTool" size={10} />Assinado (mecânico)
                                                </span>
                                            )}
                                            {o.assinatura_admin && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700" title={`Assinado digitalmente por ${o.assinatura_admin}`}>
                                                    <Icon name="PenTool" size={10} />Assinado (admin)
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                            {o.veiculo?.placa || o.veiculo_caminhao_placa || '—'} {(o.veiculo?.modelo || o.veiculo_caminhao_modelo) ? `— ${o.veiculo?.modelo || o.veiculo_caminhao_modelo}` : ''} · Mecânico: {o.mecanico?.name || '—'}
                                            {o.km_atual != null && ` · KM: ${Number(o.km_atual).toLocaleString('pt-BR')}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {o.pdf_url && (() => {
                                            const tipoAnexo = getAnexoTipo(o.pdf_url);
                                            if (tipoAnexo === 'word') {
                                                return (
                                                    <button onClick={() => downloadImagem(o.pdf_url, `OS_${o.id?.slice(0,8)}.docx`)}
                                                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline px-1.5 py-1">
                                                        <Icon name="FileText" size={13} color="#1D4ED8" />Baixar anexo (Word)
                                                    </button>
                                                );
                                            }
                                            return (
                                                <button onClick={() => setViewPdf(o.pdf_url)}
                                                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline px-1.5 py-1">
                                                    <Icon name={tipoAnexo === 'imagem' ? 'Image' : 'FileText'} size={13} color="#1D4ED8" />
                                                    {tipoAnexo === 'imagem' ? 'Ver imagem' : 'Ver PDF'}
                                                </button>
                                            );
                                        })()}
                                        <button onClick={() => printOrdemServico(o)} title="Imprimir OS"
                                            className="p-1.5 rounded hover:bg-gray-100 transition-colors">
                                            <Icon name="Printer" size={14} color="var(--color-muted-foreground)" />
                                        </button>
                                        {isAdmin && (
                                            <button onClick={() => abrirEdicaoOS(o)} title="Editar OS"
                                                className="p-1.5 rounded hover:bg-blue-50 transition-colors">
                                                <Icon name="Pencil" size={16} color="#1D4ED8" />
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button onClick={() => handleDeleteOS(o.id)}
                                                className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Excluir OS">
                                                <Icon name="Trash2" size={16} color="#DC2626" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg text-sm mb-2 whitespace-pre-line" style={{ backgroundColor: '#F8FAFC' }}>
                                    <p style={{ color: 'var(--color-text-primary)' }}>{o.descricao}</p>
                                </div>
                                {o.observacoes && (
                                    <div className="p-3 rounded-lg text-sm mb-2 whitespace-pre-line" style={{ backgroundColor: '#F1F5F9' }}>
                                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Observações do serviço</p>
                                        <p style={{ color: 'var(--color-text-primary)' }}>{o.observacoes}</p>
                                    </div>
                                )}
                                {(o.pecas_solicitadas || []).length > 0 && (
                                    <div className="p-3 rounded-lg text-xs mb-2 space-y-2" style={{ backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF' }}>
                                        <p className="font-semibold flex items-center gap-1" style={{ color: '#6D28D9' }}>
                                            <Icon name="Package" size={13} color="#6D28D9" />Peças solicitadas pelo mecânico
                                        </p>
                                        {(o.pecas_solicitadas || []).map((p, idx) => {
                                            const statusCor = p.status === 'Aprovado' ? { bg: '#D1FAE5', text: '#065F46' } : p.status === 'Reprovado' ? { bg: '#FEE2E2', text: '#991B1B' } : { bg: '#FEF9C3', text: '#B45309' };
                                            const responderPeca = async (novoStatus) => {
                                                const lista = (o.pecas_solicitadas || []).map((pp, i) => i === idx ? { ...pp, status: novoStatus, respondido_em: new Date().toISOString() } : pp);
                                                try { await updateOrdemServico(o.id, { pecas_solicitadas: lista }); showToast(`Peça ${novoStatus.toLowerCase()}!`, 'success'); load(); }
                                                catch (e) { showToast('Erro: ' + e.message, 'error'); }
                                            };
                                            return (
                                                <div key={p.id || idx} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white border" style={{ borderColor: '#E9D5FF' }}>
                                                    <div className="min-w-0">
                                                        <p className="font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{p.item} <span style={{ color: 'var(--color-muted-foreground)' }}>× {p.quantidade}</span></p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        <span className="px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: statusCor.bg, color: statusCor.text }}>{p.status || 'Pendente'}</span>
                                                        {isAdmin && (p.status === 'Pendente' || !p.status) && (
                                                            <>
                                                                <button onClick={() => responderPeca('Aprovado')} title="Aprovar" className="p-1 rounded hover:bg-green-100"><Icon name="Check" size={14} color="#059669" /></button>
                                                                <button onClick={() => responderPeca('Reprovado')} title="Reprovar" className="p-1 rounded hover:bg-red-100"><Icon name="X" size={14} color="#DC2626" /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {o.problema_encontrado && (
                                    <div className="p-3 rounded-lg text-xs mb-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                                        <p className="font-medium text-red-600 mb-1">⚠️ Problema reportado pelo mecânico:</p>
                                        <p className="text-red-700">{o.problema_encontrado}</p>
                                        {isAdmin && o.status === 'Problema Reportado' && (
                                            <div className="flex gap-2 mt-2">
                                                <button onClick={async () => { await updateOrdemServico(o.id, { status: 'Em Andamento', problema_encontrado: o.problema_encontrado }); showToast('Retomado!', 'success'); load(); }}
                                                    className="px-2 py-1 rounded text-xs font-medium bg-blue-600 text-white">Autorizar continuação</button>
                                                <button onClick={async () => { await updateOrdemServico(o.id, { status: 'Pendente' }); showToast('Devolvida para pendente!', 'success'); load(); }}
                                                    className="px-2 py-1 rounded text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">Devolver para fila</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {o.obs_finalizacao && (
                                    <div className="p-3 rounded-lg text-xs" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                        <p className="font-medium text-green-600 mb-1">✅ Finalizada pelo mecânico:</p>
                                        <p className="text-green-700">{o.obs_finalizacao}</p>
                                    </div>
                                )}
                                {isAdmin && isRascunho && (
                                    <div className="flex flex-wrap gap-2 pt-3 mt-2 border-t" style={{ borderColor: '#CBD5E1' }}>
                                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                            <Icon name="Info" size={12} />Rascunho gerado automaticamente — confira e envie ao mecânico.
                                        </span>
                                        <div className="flex gap-2 ml-auto">
                                            <button onClick={() => abrirEdicaoOS(o)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">
                                                <Icon name="Pencil" size={16} />Conferir e Editar
                                            </button>
                                            <button onClick={() => handleEnviarRascunho(o)} disabled={!o.mecanico_id} title={!o.mecanico_id ? 'Defina um mecânico responsável antes de enviar' : ''} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                <Icon name="Send" size={13} />Enviar OS
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <PaginationBar page={ordensPag.page} setPage={ordensPag.setPage} totalPages={ordensPag.totalPages}
                        totalItems={ordensPag.totalItems} pageSize={ordensPag.pageSize} itemLabel="ordem de serviço" itemLabelPlural="ordens de serviço" className="rounded-xl border bg-white" />
                </div>
            )}

            {modal && (
                <Modal
                    assinarComoAdmin={assinarComoAdmin}
                    caminhoes={caminhoes}
                    editingId={editingId}
                    editingStatus={editingStatus}
                    form={form}
                    handlePdfChange={handlePdfChange}
                    handleSalvar={handleSalvar}
                    mecanicos={mecanicos}
                    pdfFile={pdfFile}
                    profile={profile}
                    setAssinarComoAdmin={setAssinarComoAdmin}
                    setEditingId={setEditingId}
                    setEditingStatus={setEditingStatus}
                    setForm={setForm}
                    setModal={setModal}
                    uploading={uploading}
                    veiculos={veiculos}
                />
            )}
            {/* Viewer de PDF in-app — header fixo sempre visível */}
            {viewPdf && (
                <ViewPdf setViewPdf={setViewPdf} viewPdf={viewPdf} />
            )}
            {gerenciarPecasModal && (
                <GerenciarPecasModal onClose={() => setGerenciarPecasModal(false)} showToast={showToast} />
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
