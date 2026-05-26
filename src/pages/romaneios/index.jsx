import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import RomaneioFormModal from './components/RomaneioFormModal';
import RomaneioDetailModal from './components/RomaneioDetailModal';
import RomaneioImportModal  from './components/RomaneioImportModal';
import { exportRomaneiosToExcel } from 'utils/excelUtils';
import { fetchRomaneios, createRomaneio, updateRomaneio, updateRomaneioStatus, deleteRomaneio, duplicateRomaneio, sincronizarStatusVeiculo, fetchRascunhos, createRascunho, updateRascunho, deleteRascunho, promoverRascunho } from 'utils/romaneioService';
import { FRETE_CATEGORIAS, calcularFretePedido, getCategoriaConfig } from 'utils/freteConfig';
import { useRecarregarAoVoltar } from 'utils/useRecarregarAoVoltar';
import { fetchMaterials } from 'utils/materialService';
import { fetchVehicles } from 'utils/vehicleService';
import { useToast } from 'utils/useToast';
import { subscribeTabela } from 'utils/supabaseClient';

const STATUS_COLORS = {
    'Aguardando':  { bg: '#FEF9C3', text: '#B45309' },
    'Carregando':  { bg: '#DBEAFE', text: '#1D4ED8' },
    'Em Trânsito': { bg: '#D1FAE5', text: '#065F46' },
    'Finalizado':  { bg: '#F3F4F6', text: '#374151' },
    'Cancelado':   { bg: '#FEE2E2', text: '#991B1B' },
};

const ALL_STATUS = ['Todos', 'Aguardando', 'Carregando', 'Em Trânsito', 'Finalizado', 'Cancelado'];

export default function Romaneios() {
    const [guia, setGuia]             = useState('romaneios'); // 'romaneios' | 'rascunhos'
    const [romaneios, setRomaneios]   = useState([]);
    const [rascunhos, setRascunhos]   = useState([]);
    const [materials, setMaterials]   = useState([]);
    const [vehicles, setVehicles]     = useState([]);
    const [rascunhoModal, setRascunhoModal] = useState({ open: false, rascunho: null });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [formModal, setFormModal] = useState({ open: false, romaneio: null });
    const [detailModal, setDetailModal] = useState({ open: false, romaneio: null });
    const { toast, showToast } = useToast();
    const [importModal, setImportModal] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();
    // Ref para rastrear IDs cujo status está sendo atualizado
    // Evita que o realtime sobrescreva o status durante uma atualização em andamento
    const updatingIdsRef = useRef(new Set());

    // Carrega APENAS romaneios (usado pelo Realtime — não recarrega veículos/materiais desnecessariamente)
    const loadRomaneios = useCallback(async () => {
        try {
            const rom = await fetchRomaneios();
            // Preserva o status dos romaneios que estão sendo atualizados no momento
            setRomaneios(prev => rom.map(r =>
                updatingIdsRef.current.has(r.id)
                    ? { ...r, status: prev.find(p => p.id === r.id)?.status ?? r.status }
                    : r
            ));
        } catch (err) {
            console.warn('Erro ao recarregar romaneios:', err.message);
        }
    }, []);

    // Carregamento inicial completo (romaneios + materiais + veículos)
    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [rom, mat, veh, rasc] = await Promise.all([fetchRomaneios(), fetchMaterials(), fetchVehicles(), fetchRascunhos().catch(() => [])]);
            setRomaneios(rom);
            setMaterials(mat);
            setVehicles(veh);
            setRascunhos(rasc);
        } catch (err) {
            showToast('Erro ao carregar dados: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []); // eslint-disable-line

    useEffect(() => {
        load();
        // Realtime: só atualiza a lista de romaneios (não recarrega vehicles/materials)
        const unsub = subscribeTabela('romaneios', loadRomaneios);
        return () => unsub();
    }, []);
    useRecarregarAoVoltar(load);

    const filtered = useMemo(() => {
        return romaneios.filter(r => {
            const q = search.toLowerCase();
            const matchSearch = !q || r.numero?.toLowerCase().includes(q) || r.motorista?.toLowerCase().includes(q) || r.destino?.toLowerCase().includes(q) || r.placa?.toLowerCase().includes(q);
            // Comparação case-insensitive para garantir que "Cancelado" == "cancelado"
            const matchStatus = filterStatus === 'Todos' || (r.status || '').toLowerCase() === filterStatus.toLowerCase();
            return matchSearch && matchStatus;
        });
    }, [romaneios, search, filterStatus]);

    const handleSave = async (payload, itens) => {
        try {
            if (formModal.romaneio) {
                const updated = await updateRomaneio(formModal.romaneio.id, payload, itens);
                setRomaneios(prev => prev.map(r => r.id === updated.id ? updated : r));
                showToast(`Romaneio ${updated.numero} atualizado!`);
            } else {
                const created = await createRomaneio(payload, itens);
                setRomaneios(prev => [created, ...prev]);
                showToast(`Romaneio ${created.numero} criado com sucesso!`);
            }
            setFormModal({ open: false, romaneio: null });
        } catch (err) {
            showToast('Erro ao salvar: ' + err.message, 'error');
        }
    };

    const handleStatusChange = async (id, status) => {
        // Marca o ID como "em atualização" para evitar que o realtime sobrescreva o status
        updatingIdsRef.current.add(id);
        // Atualiza otimisticamente na UI imediatamente
        setRomaneios(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        try {
            await updateRomaneioStatus(id, status);
            showToast(`Status atualizado para "${status}"`);
        } catch (err) {
            // Reverte em caso de erro
            showToast('Erro ao atualizar status: ' + err.message, 'error');
            const rom = await fetchRomaneios().catch(() => null);
            if (rom) setRomaneios(rom);
        } finally {
            // Libera o lock após 2 segundos (tempo suficiente para o realtime não sobrescrever)
            setTimeout(() => updatingIdsRef.current.delete(id), 2000);
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Excluir romaneio?',
            message: 'Esta ação não pode ser desfeita. O romaneio e todos os seus itens serão removidos permanentemente.',
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await deleteRomaneio(id);
            setRomaneios(prev => prev.filter(r => r.id !== id));
            showToast('Romaneio excluído.', 'warning');
        } catch (err) {
            showToast('Erro ao excluir: ' + err.message, 'error');
        }
    };

    const handleDuplicate = async (romaneio) => {
        try {
            const dup = await duplicateRomaneio(romaneio);
            setRomaneios(prev => [dup, ...prev]);
            showToast(`Romaneio duplicado: ${dup.numero}!`);
        } catch (err) {
            showToast('Erro ao duplicar: ' + err.message, 'error');
        }
    };

    // Metrics
    const metrics = useMemo(() => ({
        total: romaneios.length,
        emTransito: romaneios.filter(r => r.status === 'Em Trânsito').length,
        carregando: romaneios.filter(r => r.status === 'Carregando').length,
        finalizados: romaneios.filter(r => r.status === 'Finalizado').length,
    }), [romaneios]);

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-2xl mx-auto px-4 tab:px-6 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="font-heading font-bold text-2xl md:text-3xl flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <Icon name="FileText" size={28} color="var(--color-primary)" /> Romaneios
                            </h1>
                            <p className="text-sm mt-0.5 font-caption" style={{ color: 'var(--color-text-secondary)' }}>
                                Gerencie as ordens de transporte e alocação de cargas
                            </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {guia === 'romaneios' && (<>
                                <Button variant="outline" iconName="FileDown" iconSize={15}
                                    onClick={() => { const aptos = romaneios.filter(r => r.status_aprovacao !== 'reprovado'); exportRomaneiosToExcel(aptos); showToast(`${aptos.length} romaneio(s) exportados. Reprovados excluídos.`); }}>
                                    <span className="hidden sm:inline">Exportar </span>Excel
                                </Button>
                                <Button variant="outline" iconName="FileSpreadsheet" iconSize={15} onClick={() => setImportModal(true)}>
                                    <span className="hidden sm:inline">Importar </span>Excel
                                </Button>
                                <Button variant="default" iconName="Plus" iconSize={16} onClick={() => setFormModal({ open: true, romaneio: null })}>
                                    <span className="hidden xs:inline sm:inline">Novo </span>Romaneio
                                </Button>
                            </>)}
                            {guia === 'rascunhos' && (
                                <Button variant="default" iconName="Plus" iconSize={16}
                                    onClick={() => setRascunhoModal({ open: true, rascunho: null })}
                                    style={{ backgroundColor: '#D97706' }}>
                                    Novo Rascunho
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Sub-abas Romaneios / Rascunhos */}
                    <div className="flex gap-1 mb-5 p-1 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB', width: 'fit-content' }}>
                        {[
                            { id: 'romaneios', label: 'Romaneios',  icon: 'FileText',      color: 'var(--color-primary)', bg: '#DBEAFE', count: romaneios.length },
                            { id: 'rascunhos', label: 'Rascunhos',  icon: 'ClipboardList', color: '#D97706',              bg: '#FFFBEB', count: rascunhos.length },
                        ].map(g => (
                            <button key={g.id} onClick={() => setGuia(g.id)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                style={guia === g.id
                                    ? { backgroundColor: 'white', color: g.color, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: 600 }
                                    : { color: 'var(--color-muted-foreground)' }}>
                                <Icon name={g.icon} size={14} color={guia === g.id ? g.color : 'var(--color-muted-foreground)'} />
                                {g.label}
                                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold"
                                    style={guia === g.id
                                        ? { backgroundColor: g.bg, color: g.color }
                                        : { backgroundColor: '#F3F4F6', color: 'var(--color-muted-foreground)' }}>
                                    {g.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {guia === 'romaneios' && (<>
                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 tab:grid-cols-4 gap-3 mb-6">
                        {[
                            { label: 'Total', value: metrics.total, icon: 'FileText', color: '#1D4ED8', bg: '#DBEAFE' },
                            { label: 'Em Trânsito', value: metrics.emTransito, icon: 'Truck', color: '#065F46', bg: '#D1FAE5' },
                            { label: 'Carregando', value: metrics.carregando, icon: 'Package', color: '#1D4ED8', bg: '#DBEAFE' },
                            { label: 'Finalizados', value: metrics.finalizados, icon: 'CheckCircle2', color: '#374151', bg: '#F3F4F6' },
                        ].map(m => (
                            <div key={m.label} className="bg-white rounded-xl border p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-card" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, backgroundColor: m.bg }}>
                                    <Icon name={m.icon} size={16} color={m.color} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-caption leading-tight" style={{ color: 'var(--color-muted-foreground)' }}>{m.label}</p>
                                    <p className="text-xl font-bold font-data leading-tight" style={{ color: 'var(--color-text-primary)' }}>{m.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col gap-3 mb-4">
                        <div className="relative">
                            <Icon name="Search" size={15} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por número, motorista, destino ou placa..."
                                className="w-full h-10 pl-9 pr-4 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-white"
                                style={{ borderColor: 'var(--color-border)' }}
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {ALL_STATUS.map(s => (
                                <button key={s}
                                    onClick={() => setFilterStatus(s)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium font-caption border transition-all flex-shrink-0 whitespace-nowrap"
                                    style={filterStatus === s
                                        ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                                        : { backgroundColor: 'white', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }
                                    }
                                >{s}</button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <EmptyState onNew={() => setFormModal({ open: true, romaneio: null })} />
                    ) : (
                        <div className="bg-white rounded-xl border shadow-card overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                        <tr>
                                            <th className="px-3 py-3 text-left font-medium">Número</th>
                                            <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Motorista</th>
                                            <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Destino</th>
                                            <th className="px-3 py-3 text-left font-medium hidden tab:table-cell">Placa</th>
                                            <th className="px-3 py-3 text-right font-medium hidden tab:table-cell">Peso</th>
                                            <th className="px-3 py-3 text-left font-medium hidden tab:table-cell">Saída</th>
                                            <th className="px-3 py-3 text-right font-medium hidden lg:table-cell">Frete</th>
                                            <th className="px-3 py-3 text-right font-medium hidden lg:table-cell">Margem</th>
                                            <th className="px-3 py-3 text-center font-medium hidden tab:table-cell">Aprovação</th>
                                            <th className="px-3 py-3 text-center font-medium">Status</th>
                                            <th className="px-3 py-3 text-center font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(r => {
                                            const sc = STATUS_COLORS[r.status] || STATUS_COLORS['Aguardando'];
                                            const isReprovado = r.status_aprovacao === 'reprovado';
                                            const isCancelado = r.status === 'Cancelado';
                                            return (
                                                <React.Fragment key={r.id}>
                                                {/* Linha principal do romaneio */}
                                                <tr className="border-t transition-colors"
                                                    style={{
                                                        borderColor: isReprovado ? '#FCA5A5' : 'var(--color-border)',
                                                        borderLeft: isReprovado ? '3px solid #EF4444' : isCancelado ? '3px solid #9CA3AF' : '3px solid transparent',
                                                        borderRight: isReprovado ? '1px solid #FCA5A5' : undefined,
                                                        borderTop: isReprovado ? '2px solid #FCA5A5' : undefined,
                                                        borderBottom: isReprovado ? 'none' : undefined,
                                                        backgroundColor: isReprovado ? '#FFF8F8' : isCancelado ? '#F9FAFB' : undefined,
                                                    }}
                                                    onMouseEnter={e => { if (!isReprovado && !isCancelado) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = isReprovado ? '#FFF8F8' : isCancelado ? '#F9FAFB' : ''; }}>
                                                    <td className="px-3 py-3">
                                                        <button onClick={() => setDetailModal({ open: true, romaneio: r })}
                                                            className="font-data text-xs font-semibold hover:underline whitespace-nowrap"
                                                            style={{ color: isCancelado ? '#6B7280' : 'var(--color-primary)', textDecoration: isCancelado ? 'line-through' : 'none' }}>
                                                            {r.numero}
                                                        </button>
                                                        <p className="text-xs mt-0.5 sm:hidden" style={{ color: isCancelado ? '#9CA3AF' : '#64748b' }}>{r.motorista || ''}</p>
                                                    </td>
                                                    <td className="px-3 py-3 hidden sm:table-cell" style={{ color: isCancelado ? '#9CA3AF' : 'var(--color-text-primary)' }}>{r.motorista || '—'}</td>
                                                    <td className="px-3 py-3 hidden md:table-cell" style={{ color: isCancelado ? '#9CA3AF' : 'var(--color-text-secondary)' }}>{r.destino || '—'}</td>
                                                    <td className="px-3 py-3 hidden tab:table-cell font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.placa || '—'}</td>
                                                    <td className="px-3 py-3 text-right hidden tab:table-cell font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {r.peso_total ? `${Number(r.peso_total).toLocaleString('pt-BR')} kg` : '—'}
                                                    </td>
                                                    <td className="px-3 py-3 hidden tab:table-cell text-xs font-caption" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {r.saida ? new Date(r.saida).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </td>
                                                    <td className="px-3 py-3 text-right hidden lg:table-cell font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {r.valor_frete ? Number(r.valor_frete).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                                                    </td>
                                                    <td className="px-3 py-3 text-right hidden lg:table-cell font-data text-xs font-semibold">
                                                        {r.margem_lucro != null ? (
                                                            <span style={{ color: r.margem_lucro >= 0 ? '#059669' : '#DC2626' }}>
                                                                {r.margem_lucro >= 0 ? '+' : ''}{Number(r.margem_lucro).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-3 py-3 text-center hidden tab:table-cell">
                                                        {r.aprovado ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                                Aprovado
                                                            </span>
                                                        ) : r.status_aprovacao === 'reprovado' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }} title={r.motivo_reprovacao || ''}>
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                                Reprovado
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#FEF9C3', color: '#B45309' }}>
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                                Pendente
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <select
                                                            value={r.status}
                                                            onChange={e => handleStatusChange(r.id, e.target.value)}
                                                            className="px-2 py-1 rounded-full text-xs font-medium border cursor-pointer font-caption focus:outline-none"
                                                            style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.bg }}>
                                                            {['Aguardando', 'Carregando', 'Em Trânsito', 'Finalizado', 'Cancelado'].map(s => <option key={s}>{s}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => setDetailModal({ open: true, romaneio: r })}
                                                                className="p-1.5 rounded hover:bg-blue-50 transition-colors" title="Ver detalhes">
                                                                <Icon name="Eye" size={14} color="var(--color-primary)" />
                                                            </button>
                                                            <button onClick={() => setFormModal({ open: true, romaneio: r })}
                                                                className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Editar">
                                                                <Icon name="Pencil" size={14} color="var(--color-muted-foreground)" />
                                                            </button>
                                                            <button onClick={() => handleDelete(r.id)}
                                                                className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Excluir">
                                                                <Icon name="Trash2" size={14} color="var(--color-destructive)" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Painel de reprovação — aparece abaixo da linha, dentro do Fragment */}
                                                {isReprovado && (
                                                    <tr style={{ backgroundColor: '#FFF8F8' }}>
                                                        <td colSpan={11} style={{ padding: 0, borderBottom: '2px solid #FCA5A5', borderLeft: '3px solid #EF4444', borderRight: '1px solid #FCA5A5', borderTop: 'none' }}>
                                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3" style={{ backgroundColor: '#FEF2F2' }}>
                                                                {/* Ícone + texto */}
                                                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                                                    <Icon name="AlertCircle" size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-bold" style={{ color: '#DC2626' }}>
                                                                            Reprovado pelo admin
                                                                        </p>
                                                                        {r.motivo_reprovacao && (
                                                                            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#7F1D1D' }}>
                                                                                {r.motivo_reprovacao}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {/* Ações */}
                                                                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                                                                    <button
                                                                        onClick={() => setFormModal({ open: true, romaneio: r })}
                                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                                                                        style={{ backgroundColor: '#1D4ED8', color: 'white', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                                        <Icon name="Pencil" size={11} color="white" />
                                                                        Editar e reenviar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(r.id)}
                                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                                                                        style={{ backgroundColor: 'white', color: '#DC2626', border: '1px solid #FCA5A5', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                                        <Icon name="Trash2" size={11} color="#DC2626" />
                                                                        Excluir
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-4 py-3 border-t text-xs font-caption text-right" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                Exibindo {filtered.length} de {romaneios.length} romaneios
                            </div>
                        </div>
                    )}
                    </>)} {/* fim guia romaneios */}

                    {/* ═══ GUIA RASCUNHOS ═══ */}
                    {guia === 'rascunhos' && (
                        <GuiaRascunhos
                            rascunhos={rascunhos}
                            loading={loading}
                            vehicles={vehicles}
                            onNew={() => setRascunhoModal({ open: true, rascunho: null })}
                            onEdit={r => setRascunhoModal({ open: true, rascunho: r })}
                            onDelete={async id => {
                                const ok = await confirm({ title: 'Excluir rascunho?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
                                if (!ok) return;
                                try { await deleteRascunho(id); showToast('Rascunho excluído', 'warning'); load(); }
                                catch (e) { showToast('Erro: ' + e.message, 'error'); }
                            }}
                            onPromover={async id => {
                                const ok = await confirm({
                                    title: 'Promover para Romaneio oficial?',
                                    message: 'O rascunho receberá um número sequencial e ficará disponível como romaneio em "Aguardando". Todos os pedidos e itens já lançados serão mantidos.',
                                    confirmLabel: 'Promover',
                                    variant: 'primary',
                                });
                                if (!ok) return;
                                try {
                                    const rom = await promoverRascunho(id);
                                    showToast(`Romaneio ${rom.numero} criado!`, 'success');
                                    load();
                                    setGuia('romaneios');
                                } catch (e) { showToast('Erro ao promover: ' + e.message, 'error'); }
                            }}
                        />
                    )}

                    {rascunhoModal.open && (
                        <RascunhoFormModal
                            isOpen={rascunhoModal.open}
                            rascunho={rascunhoModal.rascunho}
                            vehicles={vehicles}
                            materials={materials}
                            onClose={() => setRascunhoModal({ open: false, rascunho: null })}
                            onSave={async (payload, itens) => {
                                try {
                                    if (rascunhoModal.rascunho) {
                                        await updateRascunho(rascunhoModal.rascunho.id, payload, itens);
                                        showToast('Rascunho atualizado!');
                                    } else {
                                        await createRascunho(payload, itens);
                                        showToast('Rascunho criado!');
                                    }
                                    setRascunhoModal({ open: false, rascunho: null });
                                    load();
                                } catch (err) { showToast('Erro: ' + err.message, 'error'); }
                            }}
                        />
                    )}
                </div>{/* fim max-w-screen-2xl */}
            </main>

            <RomaneioFormModal
                isOpen={formModal.open}
                onClose={() => setFormModal({ open: false, romaneio: null })}
                onSave={handleSave}
                editingRomaneio={formModal.romaneio}
                vehicles={vehicles}
                materials={materials}
            />
            <RomaneioDetailModal
                isOpen={detailModal.open}
                onClose={() => setDetailModal({ open: false, romaneio: null })}
                romaneio={detailModal.romaneio}
                onEdit={r => setFormModal({ open: true, romaneio: r })}
                onDelete={handleDelete}
            />
            <RomaneioImportModal
                isOpen={importModal}
                onClose={() => setImportModal(false)}
                onImported={() => { load(); showToast('Romaneios importados com sucesso!'); }}
            />
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}

function LoadingState() {
    return (
        <div className="bg-white rounded-xl border shadow-card p-12 flex flex-col items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
            <svg className="animate-spin h-8 w-8" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Carregando romaneios...</span>
        </div>
    );
}

function EmptyState({ onNew }) {
    return (
        <div className="bg-white rounded-xl border shadow-card p-12 flex flex-col items-center gap-3 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <Icon name="FileSearch" size={40} color="var(--color-muted-foreground)" />
            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum romaneio encontrado</p>
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Ajuste os filtros ou crie um novo romaneio</p>
            <Button variant="default" iconName="Plus" iconSize={15} onClick={onNew} size="sm">Criar Romaneio</Button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUIA RASCUNHOS — lista com cards, badges de resumo, botão promover
// ═══════════════════════════════════════════════════════════════════════════════
function GuiaRascunhos({ rascunhos, loading, onNew, onEdit, onDelete, onPromover }) {
    if (loading) return (
        <div className="flex justify-center py-12">
            <svg className="animate-spin h-8 w-8" style={{ color: '#D97706' }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
        </div>
    );

    return (
        <div>
            <div className="flex items-start gap-3 p-3 rounded-xl border mb-5" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                <Icon name="Info" size={14} color="#92400E" style={{ marginTop: 2 }} />
                <p className="text-xs" style={{ color: '#92400E' }}>
                    Rascunhos são romaneios em formação. Adicione pedidos cumulativos com seus materiais, valores e fretes calculados automaticamente. Quando a carga estiver pronta, clique em <strong>Promover</strong> — o romaneio oficial é criado com número sequencial e todos os dados já lançados são aproveitados.
                </p>
            </div>

            {rascunhos.length === 0 ? (
                <div className="bg-white rounded-xl border shadow-card p-12 flex flex-col items-center gap-3 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
                        <Icon name="ClipboardList" size={28} color="#D97706" />
                    </div>
                    <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum rascunho criado</p>
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Crie um rascunho para planejar a carga antes de emitir o romaneio oficial.</p>
                    <button onClick={onNew} className="mt-1 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#D97706' }}>
                        Criar primeiro rascunho
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {rascunhos.map(r => <RascunhoCard key={r.id} r={r} onEdit={onEdit} onDelete={onDelete} onPromover={onPromover} />)}
                </div>
            )}
        </div>
    );
}

const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function RascunhoCard({ r, onEdit, onDelete, onPromover }) {
    const pedidos = r.romaneio_pedidos || [];
    const itens   = r.romaneio_itens   || [];
    const pesoTotal    = itens.reduce((s, i) => s + (Number(i.peso_total) || 0), 0);
    const freteTotal   = Number(r.valor_frete_calculado || r.valor_frete || 0);
    const valorCarga   = Number(r.valor_total_carga || 0);
    const nPedidos     = pedidos.length;

    return (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: '#FDE68A' }}>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF3C7' }}>
                        <Icon name="ClipboardList" size={16} color="#D97706" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold" style={{ color: '#92400E' }}>Rascunho</p>
                        <p className="text-xs truncate" style={{ color: '#B45309' }}>
                            {r.destino || 'Destino não definido'}{r.motorista ? ` · ${r.motorista}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => onEdit(r)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-amber-50 transition-colors"
                        style={{ borderColor: '#FDE68A', color: '#92400E' }}>
                        <Icon name="Pencil" size={12} color="#92400E" /> Editar
                    </button>
                    <button onClick={() => onDelete(r.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-red-50 transition-colors"
                        style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                        <Icon name="Trash2" size={12} color="#DC2626" /> Excluir
                    </button>
                    <button onClick={() => onPromover(r.id)}
                        className="flex items-center gap-1 px-4 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: '#059669' }}>
                        <Icon name="ArrowRightCircle" size={12} color="white" /> Promover para Romaneio
                    </button>
                </div>
            </div>

            {/* Badges de resumo */}
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { icon: 'FileText',   label: 'Pedidos',      value: nPedidos > 0 ? `${nPedidos} pedido${nPedidos > 1 ? 's' : ''}` : '—',   color: '#D97706', bg: '#FFFBEB' },
                    { icon: 'Scale',      label: 'Peso Total',   value: pesoTotal > 0 ? `${pesoTotal.toLocaleString('pt-BR')} kg` : '—',         color: '#7C3AED', bg: '#FAF5FF' },
                    { icon: 'DollarSign', label: 'Frete Total',  value: freteTotal > 0 ? brl(freteTotal) : '—',                                  color: '#059669', bg: '#ECFDF5' },
                    { icon: 'BarChart2',  label: 'Valor Carga',  value: valorCarga > 0 ? brl(valorCarga) : '—',                                  color: '#1D4ED8', bg: '#EFF6FF' },
                ].map(b => (
                    <div key={b.label} className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: b.bg }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: b.color + '22' }}>
                            <Icon name={b.icon} size={13} color={b.color} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{b.label}</p>
                            <p className="text-xs font-bold truncate" style={{ color: b.color }}>{b.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Chips de pedidos */}
            {pedidos.length > 0 && (
                <div className="px-5 pb-4">
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>PEDIDOS VINCULADOS</p>
                    <div className="flex flex-wrap gap-2">
                        {pedidos.map((p, i) => {
                            const pct = FRETE_CATEGORIAS.find(f => f.categoria === p.categoria_frete)?.percentual || 0;
                            const frete = Number(p.valor_pedido || 0) * pct;
                            return (
                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs"
                                    style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
                                    {p.numero_pedido && <span className="font-semibold" style={{ color: '#92400E' }}>#{p.numero_pedido}</span>}
                                    {p.empresa && <span style={{ color: '#B45309' }}>{p.empresa}</span>}
                                    {p.categoria_frete && <span style={{ color: '#6B7280' }}>{p.categoria_frete}</span>}
                                    {frete > 0 && <span className="font-medium" style={{ color: '#059669' }}>{brl(frete)}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Sugestão IA */}
            {r.sugestao_veiculo && (
                <div className="mx-5 mb-4 p-3 rounded-xl border flex items-start gap-2" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <Icon name="Cpu" size={14} color="#059669" />
                    <div>
                        <p className="text-xs font-semibold mb-0.5" style={{ color: '#065F46' }}>Sugestão de veículo (IA)</p>
                        <p className="text-xs leading-relaxed" style={{ color: '#059669' }}>{r.sugestao_veiculo}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL DE RASCUNHO — reutiliza a mesma lógica de pedidos do RomaneioFormModal
// ═══════════════════════════════════════════════════════════════════════════════
function RascunhoFormModal({ isOpen, rascunho, vehicles, materials, onClose, onSave }) {
    const isEdit = !!rascunho;
    const { toast, showToast: show } = useToast();

    const EMPTY_FORM = { motorista: '', motorista_id: '', placa: '', destino: '', saida: '', vehicle_id: '', observacoes: '' };
    const EMPTY_PEDIDO = { numero_pedido: '', cidade_destino: '', valor_pedido: '', categoria_frete: 'Ferragens', empresa: 'Comercial Araguaia', itens: [] };

    const [form, setForm]       = useState(EMPTY_FORM);
    const [pedidos, setPedidos] = useState([{ ...EMPTY_PEDIDO }]);
    const [tab, setTab]         = useState('dados');
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSugestao, setAiSugestao] = useState('');
    const [motoristas, setMotoristas] = useState([]);

    useEffect(() => {
        import('utils/romaneioService').then(m => m.fetchMotoristas().then(setMotoristas));
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        if (isEdit && rascunho) {
            setForm({
                motorista:    rascunho.motorista    || '',
                motorista_id: rascunho.motorista_id || '',
                placa:        rascunho.placa        || '',
                destino:      rascunho.destino      || '',
                saida:        rascunho.saida        || '',
                vehicle_id:   rascunho.vehicle_id   || '',
                observacoes:  rascunho.observacoes  || '',
            });
            const peds = rascunho.romaneio_pedidos || [];
            setPedidos(peds.length > 0 ? peds.map(p => ({ ...p, itens: [] })) : [{ ...EMPTY_PEDIDO }]);
            setAiSugestao(rascunho.sugestao_veiculo || '');
        } else {
            setForm(EMPTY_FORM);
            setPedidos([{ ...EMPTY_PEDIDO }]);
            setAiSugestao('');
        }
        setTab('dados');
    }, [isOpen, rascunho]); // eslint-disable-line

    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const updatePedido = (idx, k, v) => setPedidos(prev => prev.map((p, i) => i !== idx ? p : { ...p, [k]: v }));
    const addPedido    = () => setPedidos(p => [...p, { ...EMPTY_PEDIDO }]);
    const removePedido = (idx) => setPedidos(p => p.filter((_, i) => i !== idx));

    const totais = React.useMemo(() => {
        const valorTotalCarga = pedidos.reduce((a, p) => a + Number(p.valor_pedido || 0), 0);
        const freteCalculado  = pedidos.reduce((a, p) => {
            const pct = FRETE_CATEGORIAS.find(f => f.categoria === p.categoria_frete)?.percentual || 0.05;
            return a + Number(p.valor_pedido || 0) * pct;
        }, 0);
        const pesoTotal = pedidos.flatMap(p => p.itens || []).reduce((a, i) => a + Number(i.peso_total || 0), 0);
        return { valorTotalCarga, freteCalculado, pesoTotal };
    }, [pedidos]);

    const sugerirVeiculo = async () => {
        if (totais.pesoTotal <= 0 && totais.valorTotalCarga <= 0) { show('Adicione pedidos com valor para obter sugestão', 'error'); return; }
        setAiLoading(true);
        try {
            const veiculosInfo = vehicles.filter(v => v.status !== 'Em Manutenção').map(v =>
                `${v.placa} (${v.modelo || ''}, cap: ${v.capacidade_peso || v.capacidade_carga || '?'} kg, status: ${v.status || 'Disponível'})`
            ).join('; ');

            const resp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1000,
                    messages: [{
                        role: 'user',
                        content: `Você é especialista em logística de transporte rodoviário. Com base nos dados abaixo, sugira o MELHOR veículo DISPONÍVEL para essa viagem, justificando brevemente em 2-3 frases em português.

Peso total estimado: ${totais.pesoTotal > 0 ? totais.pesoTotal.toLocaleString('pt-BR') + ' kg' : 'não informado'}
Valor total da carga: ${brl(totais.valorTotalCarga)}
Destino: ${form.destino || 'não informado'}
Pedidos: ${pedidos.filter(p => p.numero_pedido).map(p => `#${p.numero_pedido} (${p.categoria_frete}, ${brl(p.valor_pedido)})`).join(', ') || 'não numerados'}

Veículos disponíveis: ${veiculosInfo || 'nenhum cadastrado'}

Considere: capacidade de carga vs peso real, tipo de composição, disponibilidade. Se nenhum for adequado, informe.`
                    }],
                }),
            });
            const data = await resp.json();
            const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
            setAiSugestao(text || 'Não foi possível gerar sugestão.');
        } catch (e) { setAiSugestao('Erro ao consultar IA: ' + e.message); }
        finally { setAiLoading(false); }
    };

    const handleSave = async () => {
        if (!form.destino.trim()) { show('Destino é obrigatório', 'error'); setTab('dados'); return; }
        setLoading(true);
        try {
            const allItens = pedidos.flatMap((p, pIdx) =>
                (p.itens || []).map(i => ({ material_id: i.material_id, quantidade: i.quantidade, peso_total: i.peso_total, pedido_index: pIdx }))
            );
            await onSave({
                ...form,
                peso_total:            totais.pesoTotal,
                valor_frete:           totais.freteCalculado,
                valor_frete_calculado: totais.freteCalculado,
                valor_total_carga:     totais.valorTotalCarga,
                sugestao_veiculo:      aiSugestao || null,
                _pedidos: pedidos.map(p => ({
                    numero_pedido:    p.numero_pedido   || '',
                    cidade_destino:   p.cidade_destino  || form.destino,
                    valor_pedido:     Number(p.valor_pedido || 0),
                    categoria_frete:  p.categoria_frete || 'Outros',
                    empresa:          p.empresa         || 'Comercial Araguaia',
                    percentual_frete: FRETE_CATEGORIAS.find(f => f.categoria === p.categoria_frete)?.percentual || 0.05,
                    frete_calculado:  Number(p.valor_pedido || 0) * (FRETE_CATEGORIAS.find(f => f.categoria === p.categoria_frete)?.percentual || 0.05),
                })),
            }, allItens);
        } finally { setLoading(false); }
    };

    if (!isOpen) return null;

    const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
    const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl" style={{ maxHeight: 'calc(100vh - 32px)' }}>

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
                            <Icon name="ClipboardList" size={18} color="#D97706" />
                        </div>
                        <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                            {isEdit ? 'Editar Rascunho' : 'Novo Rascunho de Romaneio'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b flex-shrink-0 px-5 pt-3 gap-1" style={{ borderColor: 'var(--color-border)' }}>
                    {[
                        { id: 'dados',    label: 'Identificação', icon: 'FileText' },
                        { id: 'pedidos',  label: `Pedidos (${pedidos.length})`, icon: 'ShoppingCart' },
                        { id: 'veiculo',  label: 'Sugestão IA', icon: 'Cpu' },
                    ].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors"
                            style={tab === t.id
                                ? { borderColor: '#D97706', color: '#D97706' }
                                : { borderColor: 'transparent', color: 'var(--color-muted-foreground)' }}>
                            <Icon name={t.icon} size={13} color={tab === t.id ? '#D97706' : 'var(--color-muted-foreground)'} />
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-5 overflow-y-auto flex-1">

                    {/* Tab: Identificação */}
                    {tab === 'dados' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Motorista</label>
                                    <select value={form.motorista_id} onChange={e => {
                                        const m = motoristas.find(x => x.id === e.target.value);
                                        setF('motorista_id', e.target.value);
                                        setF('motorista', m?.name || '');
                                    }} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione ou preencha abaixo...</option>
                                        {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Motorista (texto livre)</label>
                                    <input value={form.motorista} onChange={e => setF('motorista', e.target.value)} className={inputCls} style={inputStyle} placeholder="Nome do motorista" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Destino <span className="text-red-500">*</span></label>
                                    <input value={form.destino} onChange={e => setF('destino', e.target.value)} className={inputCls} style={inputStyle} placeholder="Cidade / Endereço de entrega" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Placa do Veículo</label>
                                    <select value={form.vehicle_id} onChange={e => {
                                        const v = vehicles.find(x => x.id === e.target.value || String(x.id) === e.target.value);
                                        setF('vehicle_id', e.target.value);
                                        setF('placa', v?.placa || '');
                                    }} className={inputCls} style={inputStyle}>
                                        <option value="">A definir...</option>
                                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo || ''}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Data de Saída</label>
                                    <input type="datetime-local" value={form.saida} onChange={e => setF('saida', e.target.value)} className={inputCls} style={inputStyle} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Observações</label>
                                <textarea value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} rows={2} className={inputCls} style={inputStyle} placeholder="Informações adicionais..." />
                            </div>
                        </div>
                    )}

                    {/* Tab: Pedidos */}
                    {tab === 'pedidos' && (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button onClick={addPedido} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#D97706' }}>
                                    <Icon name="Plus" size={12} color="white" /> Adicionar pedido
                                </button>
                            </div>

                            {pedidos.map((p, idx) => {
                                const pct = FRETE_CATEGORIAS.find(f => f.categoria === p.categoria_frete)?.percentual || 0;
                                const fretePedido = Number(p.valor_pedido || 0) * pct;
                                const cfg = getCategoriaConfig(p.categoria_frete);
                                return (
                                    <div key={idx} className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg?.bg || '#F3F4F6', color: cfg?.cor || '#374151' }}>
                                                    Pedido #{idx + 1}
                                                </span>
                                                {p.numero_pedido && <span className="text-xs font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>#{p.numero_pedido}</span>}
                                                {fretePedido > 0 && (
                                                    <span className="text-xs font-semibold" style={{ color: '#059669' }}>
                                                        Frete: {brl(fretePedido)} ({(pct * 100).toFixed(0)}%)
                                                    </span>
                                                )}
                                            </div>
                                            {pedidos.length > 1 && (
                                                <button onClick={() => removePedido(idx)} className="text-xs flex items-center gap-1" style={{ color: '#DC2626' }}>
                                                    <Icon name="X" size={12} color="#DC2626" /> Remover
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Nº do Pedido</label>
                                                <input value={p.numero_pedido} onChange={e => updatePedido(idx, 'numero_pedido', e.target.value)} className={inputCls} style={inputStyle} placeholder="Ex: 37443" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Empresa</label>
                                                <select value={p.empresa} onChange={e => updatePedido(idx, 'empresa', e.target.value)} className={inputCls} style={inputStyle}>
                                                    {['Comercial Araguaia', 'Aços Confiance', 'Confiance'].map(e => <option key={e} value={e}>{e}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Valor do Pedido (R$)</label>
                                                <input type="number" step="0.01" min="0" value={p.valor_pedido} onChange={e => updatePedido(idx, 'valor_pedido', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Categoria de Frete</label>
                                                <select value={p.categoria_frete} onChange={e => updatePedido(idx, 'categoria_frete', e.target.value)} className={inputCls} style={inputStyle}>
                                                    {FRETE_CATEGORIAS.map(f => <option key={f.categoria} value={f.categoria}>{f.label} ({(f.percentual * 100).toFixed(0)}%)</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Cidade Destino do Pedido</label>
                                                <input value={p.cidade_destino} onChange={e => updatePedido(idx, 'cidade_destino', e.target.value)} className={inputCls} style={inputStyle} placeholder={form.destino || 'Cidade'} />
                                            </div>
                                            <div className="flex items-end">
                                                <div className="w-full p-2.5 rounded-lg border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                                    <p className="text-xs" style={{ color: '#065F46' }}>Frete calculado</p>
                                                    <p className="text-sm font-bold" style={{ color: '#059669' }}>{brl(fretePedido)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Resumo total */}
                            <div className="grid grid-cols-3 gap-3 mt-2">
                                {[
                                    { label: 'Frete Total', value: brl(totais.freteCalculado), color: '#059669', bg: '#ECFDF5' },
                                    { label: 'Valor Total Carga', value: brl(totais.valorTotalCarga), color: '#1D4ED8', bg: '#EFF6FF' },
                                    { label: `${pedidos.filter(p => p.numero_pedido).length} pedido(s)`, value: pedidos.filter(p => p.numero_pedido).map(p => `#${p.numero_pedido}`).join(', ') || '—', color: '#D97706', bg: '#FFFBEB' },
                                ].map(s => (
                                    <div key={s.label} className="p-3 rounded-xl border text-center" style={{ backgroundColor: s.bg, borderColor: s.color + '44' }}>
                                        <p className="text-xs mb-1" style={{ color: s.color }}>{s.label}</p>
                                        <p className="text-sm font-bold truncate" style={{ color: s.color }}>{s.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tab: Sugestão IA */}
                    {tab === 'veiculo' && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: '#065F46' }}>🤖 Sugestão de Veículo via IA</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#059669' }}>
                                            A IA analisa o peso total da carga, os pedidos e os veículos disponíveis para recomendar o melhor para a viagem.
                                        </p>
                                    </div>
                                    <button onClick={sugerirVeiculo} disabled={aiLoading}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60 flex-shrink-0 ml-3"
                                        style={{ backgroundColor: '#059669' }}>
                                        {aiLoading
                                            ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Consultando...</>
                                            : <><Icon name="Cpu" size={13} color="white" /> Sugerir veículo</>
                                        }
                                    </button>
                                </div>
                                {aiSugestao ? (
                                    <div className="p-3 rounded-xl bg-white border" style={{ borderColor: '#BBF7D0' }}>
                                        <p className="text-xs leading-relaxed" style={{ color: '#065F46' }}>{aiSugestao}</p>
                                    </div>
                                ) : (
                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                        Adicione pedidos na aba anterior e clique em "Sugerir veículo".
                                    </p>
                                )}
                            </div>

                            {/* Resumo para decisão */}
                            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB' }}>
                                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>RESUMO DA CARGA</p>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Peso total:</span> <strong>{totais.pesoTotal > 0 ? `${totais.pesoTotal.toLocaleString('pt-BR')} kg` : '—'}</strong></div>
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Frete total:</span> <strong style={{ color: '#059669' }}>{brl(totais.freteCalculado)}</strong></div>
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Valor carga:</span> <strong>{brl(totais.valorTotalCarga)}</strong></div>
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Nº pedidos:</span> <strong>{pedidos.filter(p => p.numero_pedido).length}</strong></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-5 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: '#D97706' }}>
                        {loading
                            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                            : <><Icon name="Save" size={14} color="white" /> {isEdit ? 'Salvar Alterações' : 'Criar Rascunho'}</>
                        }
                    </button>
                </div>
            </div>
            <Toast toast={toast} />
        </div>
    );
}
