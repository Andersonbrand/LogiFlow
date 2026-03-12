import React, { useState, useEffect, useMemo, useCallback } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import RomaneioFormModal from './components/RomaneioFormModal';
import RomaneioDetailModal from './components/RomaneioDetailModal';
import RomaneioImportModal  from './components/RomaneioImportModal';
import { exportRomaneiosToExcel } from 'utils/excelUtils';
import { fetchRomaneios, createRomaneio, updateRomaneio, updateRomaneioStatus, deleteRomaneio, duplicateRomaneio } from 'utils/romaneioService';
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
    const [romaneios, setRomaneios] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [formModal, setFormModal] = useState({ open: false, romaneio: null });
    const [detailModal, setDetailModal] = useState({ open: false, romaneio: null });
    const { toast, showToast } = useToast();
    const [importModal, setImportModal] = useState(false);

    // Carrega APENAS romaneios (usado pelo Realtime — não recarrega veículos/materiais desnecessariamente)
    const loadRomaneios = useCallback(async () => {
        try {
            const rom = await fetchRomaneios();
            setRomaneios(rom);
        } catch (err) {
            console.warn('Erro ao recarregar romaneios:', err.message);
        }
    }, []);

    // Carregamento inicial completo (romaneios + materiais + veículos)
    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [rom, mat, veh] = await Promise.all([fetchRomaneios(), fetchMaterials(), fetchVehicles()]);
            setRomaneios(rom);
            setMaterials(mat);
            setVehicles(veh);
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
            const matchStatus = filterStatus === 'Todos' || r.status === filterStatus;
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
        try {
            const updated = await updateRomaneioStatus(id, status);
            setRomaneios(prev => prev.map(r => r.id === id ? { ...r, status: updated.status } : r));
            showToast(`Status atualizado para "${status}"`);
        } catch (err) {
            showToast('Erro ao atualizar status: ' + err.message, 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Tem certeza que deseja excluir este romaneio?')) return;
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
                <div className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-8 py-6">
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
                        <div className="flex gap-2">
                            <Button variant="outline" iconName="FileDown" iconSize={15}
                                onClick={() => { const aptos = romaneios.filter(r => r.status_aprovacao !== 'reprovado'); exportRomaneiosToExcel(aptos); showToast(`${aptos.length} romaneio(s) exportados. Reprovados excluídos.`); }}>
                                Excel
                            </Button>
                            <Button variant="outline" iconName="FileSpreadsheet" iconSize={15} onClick={() => setImportModal(true)}>
                                Importar Excel
                            </Button>
                            <Button variant="default" iconName="Plus" iconSize={16} onClick={() => setFormModal({ open: true, romaneio: null })}>
                                Novo Romaneio
                            </Button>
                        </div>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        {[
                            { label: 'Total', value: metrics.total, icon: 'FileText', color: '#1D4ED8', bg: '#DBEAFE' },
                            { label: 'Em Trânsito', value: metrics.emTransito, icon: 'Truck', color: '#065F46', bg: '#D1FAE5' },
                            { label: 'Carregando', value: metrics.carregando, icon: 'Package', color: '#1D4ED8', bg: '#DBEAFE' },
                            { label: 'Finalizados', value: metrics.finalizados, icon: 'CheckCircle2', color: '#374151', bg: '#F3F4F6' },
                        ].map(m => (
                            <div key={m.label} className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-card" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, backgroundColor: m.bg }}>
                                    <Icon name={m.icon} size={18} color={m.color} />
                                </div>
                                <div>
                                    <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>{m.label}</p>
                                    <p className="text-2xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{m.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="relative flex-1">
                            <Icon name="Search" size={15} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por número, motorista, destino ou placa..."
                                className="w-full h-10 pl-9 pr-4 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-white"
                                style={{ borderColor: 'var(--color-border)' }}
                            />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {ALL_STATUS.map(s => (
                                <button key={s}
                                    onClick={() => setFilterStatus(s)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium font-caption border transition-all"
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
                                            <th className="px-4 py-3 text-left font-medium">Número</th>
                                            <th className="px-4 py-3 text-left font-medium">Motorista</th>
                                            <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Destino</th>
                                            <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Placa</th>
                                            <th className="px-4 py-3 text-right font-medium hidden lg:table-cell">Peso</th>
                                            <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Saída</th>
                                            <th className="px-4 py-3 text-right font-medium hidden xl:table-cell">Frete</th>
                                            <th className="px-4 py-3 text-right font-medium hidden xl:table-cell">Margem</th>
                                            <th className="px-4 py-3 text-center font-medium hidden md:table-cell">Aprovação</th>
                                            <th className="px-4 py-3 text-center font-medium">Status</th>
                                            <th className="px-4 py-3 text-center font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(r => {
                                            const sc = STATUS_COLORS[r.status] || STATUS_COLORS['Aguardando'];
                                            const isReprovado = r.status_aprovacao === 'reprovado';
                                            return (
                                                <React.Fragment key={r.id}>
                                                {/* Linha principal do romaneio */}
                                                <tr className="border-t transition-colors"
                                                    style={{
                                                        borderColor: isReprovado ? '#FCA5A5' : 'var(--color-border)',
                                                        borderLeft: isReprovado ? '3px solid #EF4444' : '3px solid transparent',
                                                        borderBottom: isReprovado ? 'none' : undefined,
                                                        backgroundColor: isReprovado ? '#FFF8F8' : undefined,
                                                    }}
                                                    onMouseEnter={e => { if (!isReprovado) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = isReprovado ? '#FFF8F8' : ''; }}>
                                                    <td className="px-4 py-3">
                                                        <button onClick={() => setDetailModal({ open: true, romaneio: r })}
                                                            className="font-data text-xs font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>
                                                            {r.numero}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{r.motorista || '—'}</td>
                                                    <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--color-text-secondary)' }}>{r.destino || '—'}</td>
                                                    <td className="px-4 py-3 hidden lg:table-cell font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.placa || '—'}</td>
                                                    <td className="px-4 py-3 text-right hidden lg:table-cell font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {r.peso_total ? `${Number(r.peso_total).toLocaleString('pt-BR')} kg` : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 hidden md:table-cell text-xs font-caption" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {r.saida ? new Date(r.saida).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right hidden xl:table-cell font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {r.valor_frete ? Number(r.valor_frete).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right hidden xl:table-cell font-data text-xs font-semibold">
                                                        {r.margem_lucro != null ? (
                                                            <span style={{ color: r.margem_lucro >= 0 ? '#059669' : '#DC2626' }}>
                                                                {r.margem_lucro >= 0 ? '+' : ''}{Number(r.margem_lucro).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center hidden md:table-cell">
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
                                                        <td colSpan={10} style={{ padding: 0, borderBottom: '2px solid #FCA5A5', borderLeft: '3px solid #EF4444', borderTop: '1px solid #FEE2E2' }}>
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
                </div>
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
