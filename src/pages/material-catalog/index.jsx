import React, { useState, useMemo, useEffect } from 'react';
import { fetchMaterials, createMaterial, updateMaterial, deleteMaterial } from 'utils/materialService';
import { useRecarregarAoVoltar } from 'utils/useRecarregarAoVoltar';
import { exportMaterialsToExcel, parseMaterialsFromFile } from 'utils/excelUtils';
import { useAuth } from 'utils/AuthContext';
import AccessDeniedModal from 'components/ui/AccessDeniedModal';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import QuickActionPanel from 'components/ui/QuickActionPanel';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';

import MaterialTable from './components/MaterialTable';
import MaterialCardMobile from './components/MaterialCardMobile';
import FilterPanel from './components/FilterPanel';
import MaterialFormModal from './components/MaterialFormModal';
import DeleteConfirmDialog from './components/DeleteConfirmDialog.jsx';
import BulkActionsBar from './components/BulkActionsBar';


const DEFAULT_FILTERS = { categoria: 'Todas', unidade: 'Todas', pesoMax: 50000 };
const DEFAULT_SORT = { key: 'nome', dir: 'asc' };

export default function MaterialCatalog() {
    const { isAdmin } = useAuth();
    const [materials, setMaterials] = useState([]);
    const [dbLoading, setDbLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [sortConfig, setSortConfig] = useState(DEFAULT_SORT);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [deletingMaterial, setDeletingMaterial] = useState(null);
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const [page, setPage] = useState(1);
    const [accessDenied, setAccessDenied] = useState(false);
    const PAGE_SIZE = 30;

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadMaterials = React.useCallback(async () => {
        try {
            setDbLoading(true);
            const data = await fetchMaterials();
            setMaterials(data);
            } catch (err) {
                showToast('Erro ao carregar materiais: ' + err.message, 'warning');
            } finally {
                setDbLoading(false);
            }
    }, [setDbLoading, setMaterials]);

    useEffect(() => { loadMaterials(); }, [loadMaterials]);
    useRecarregarAoVoltar(loadMaterials);

    const handleSort = (key) => {
        setSortConfig((prev) =>
            prev?.key === key ? { key, dir: prev?.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
        );
    };

    // Categorias dinâmicas extraídas dos materiais cadastrados no banco
    const categoriasDinamicas = useMemo(() => {
        const set = new Set(materials.map(m => m.categoria).filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [materials]);

    // Reset para página 1 ao mudar busca ou filtros
    const prevFiltersRef = React.useRef({ search, filters });
    React.useEffect(() => {
        if (prevFiltersRef.current.search !== search ||
            prevFiltersRef.current.filters !== filters) {
            setPage(1);
            prevFiltersRef.current = { search, filters };
        }
    }, [search, filters]);

    const filteredMaterials = useMemo(() => {
        let list = [...materials];
        if (search?.trim()) {
            const q = search?.toLowerCase();
            list = list?.filter((m) => m?.nome?.toLowerCase()?.includes(q) || m?.categoria?.toLowerCase()?.includes(q));
        }
        if (filters?.categoria !== 'Todas') list = list?.filter((m) => m?.categoria === filters?.categoria);
        if (filters?.unidade !== 'Todas') list = list?.filter((m) => m?.unidade === filters?.unidade);
        list = list?.filter((m) => m?.peso <= filters?.pesoMax);
        list?.sort((a, b) => {
            let av = a?.[sortConfig?.key], bv = b?.[sortConfig?.key];
            if (typeof av === 'string') av = av?.toLowerCase();
            if (typeof bv === 'string') bv = bv?.toLowerCase();
            if (av < bv) return sortConfig?.dir === 'asc' ? -1 : 1;
            if (av > bv) return sortConfig?.dir === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [materials, search, filters, sortConfig]);

    const totalPages = Math.ceil(filteredMaterials.length / PAGE_SIZE);
    const pagedMaterials = useMemo(() => {
        // Se há busca ativa, mostra todos os resultados sem paginar
        if (search?.trim() || filters?.categoria !== 'Todas' || filters?.unidade !== 'Todas' || filters?.pesoMax < 50000) {
            return filteredMaterials;
        }
        return filteredMaterials.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    }, [filteredMaterials, page, search, filters]);

    const isPaginated = !search?.trim() && filters?.categoria === 'Todas' && filters?.unidade === 'Todas' && filters?.pesoMax >= 50000;

    const handleSave = async (data) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        try {
            if (data?.id) {
                const updated = await updateMaterial(data.id, data);
                setMaterials((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
                showToast(`Material "${updated?.nome}" atualizado com sucesso!`);
            } else {
                const created = await createMaterial(data);
                setMaterials((prev) => [...prev, created]);
                showToast(`Material "${created?.nome}" cadastrado com sucesso!`);
            }
        } catch (err) {
            showToast('Erro ao salvar material: ' + err.message, 'warning');
        }
    };

    const handleDelete = async (id) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        try {
            const mat = materials?.find((m) => m?.id === id);
            await deleteMaterial(id);
            setMaterials((prev) => prev.filter((m) => m.id !== id));
            setDeletingMaterial(null);
            showToast(`Material "${mat?.nome}" excluído.`, 'warning');
        } catch (err) {
            showToast('Erro ao excluir material: ' + err.message, 'warning');
        }
    };

    const handleExportExcel = () => {
        exportMaterialsToExcel(materials);
        showToast('Catálogo exportado como Excel!');
    };

    const handleImportExcel = async (file) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        try {
            const parsed = await parseMaterialsFromFile(file);
            if (!parsed.length) { showToast('Nenhum material válido encontrado no arquivo.', 'warning'); return; }

            // Inserção em lotes de 50 para evitar timeout e rate limit do Supabase
            const BATCH = 50;
            let created = 0, errors = 0;
            for (let i = 0; i < parsed.length; i += BATCH) {
                const lote = parsed.slice(i, i + BATCH).map(({ id, ...m }) => m);
                try {
                    const { data, error } = await import('./../../utils/supabaseClient')
                        .then(({ supabase }) => supabase.from('materials').insert(lote).select());
                    if (error) { errors += lote.length; console.error('Erro lote:', error.message); }
                    else created += (data?.length || lote.length);
                } catch (e) { errors += lote.length; }
            }

            const data = await fetchMaterials();
            setMaterials(data);
            showToast(`${created} material(is) importado(s)${errors ? ` · ${errors} erro(s)` : ''}!`, errors ? 'warning' : 'success');
        } catch (err) {
            showToast('Erro na importação: ' + err.message, 'warning');
        }
    };

    const openAdd  = () => { if (!isAdmin()) { setAccessDenied(true); return; } setEditingMaterial(null); setModalOpen(true); };
    const openEdit = (m) => { if (!isAdmin()) { setAccessDenied(true); return; } setEditingMaterial(m); setModalOpen(true); };

    return (
        <div className="min-h-screen bg-[var(--color-background)]">
            <AccessDeniedModal show={accessDenied} onClose={() => setAccessDenied(false)} />
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-2xl mx-auto px-4 tab:px-6 lg:px-8 py-4 md:py-6">

                    {/* Breadcrumb */}
                    <BreadcrumbTrail className="mb-4" />

                    {/* Page Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                        <div>
                            <h1 className="font-heading font-bold text-2xl md:text-3xl text-[var(--color-text-primary)] flex items-center gap-2">
                                <Icon name="Package" size={28} color="var(--color-primary)" />
                                Catálogo de Materiais
                            </h1>
                            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                                Gerencie o inventário de materiais transportáveis com especificações de peso
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <BulkActionsBar onExportExcel={handleExportExcel} onImportExcel={handleImportExcel} totalCount={materials?.length} />
                            <Button
                                variant="default"
                                iconName="Plus"
                                iconPosition="left"
                                iconSize={16}
                                onClick={openAdd}
                            >
                                Cadastrar Material
                            </Button>
                        </div>
                    </div>

                    {/* Search + Mobile Filter Toggle */}
                    <div className="flex gap-2 mb-4">
                        <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <Icon name="Search" size={16} color="var(--color-muted-foreground)" />
                            </span>
                            <input
                                type="text"
                                placeholder="Buscar por nome ou categoria..."
                                value={search}
                                onChange={(e) => setSearch(e?.target?.value)}
                                className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-[var(--color-card)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] placeholder:text-[var(--color-muted-foreground)]"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)] hover:text-[var(--color-text-primary)]"
                                >
                                    <Icon name="X" size={14} color="currentColor" />
                                </button>
                            )}
                        </div>
                        {/* Mobile filter button */}
                        <button
                            className="lg:hidden flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg bg-[var(--color-card)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-colors"
                            onClick={() => setMobileFilterOpen(true)}
                        >
                            <Icon name="SlidersHorizontal" size={16} color="currentColor" />
                            <span className="hidden sm:inline">Filtros</span>
                            {(filters?.categoria !== 'Todas' || filters?.unidade !== 'Todas' || filters?.pesoMax < 50000) && (
                                <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                            )}
                        </button>
                    </div>

                    {/* Main Layout: Filters sidebar + Table */}
                    <div className="flex gap-5">
                        {/* Desktop Filters */}
                        <aside className="hidden lg:block w-64 flex-shrink-0">
                            <FilterPanel
                                filters={filters}
                                onChange={setFilters}
                                onReset={() => setFilters(DEFAULT_FILTERS)}
                                totalCount={materials?.length}
                                filteredCount={filteredMaterials?.length}
                                categorias={categoriasDinamicas}
                            />
                        </aside>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            {/* Stats row */}
                            <div className="flex flex-wrap gap-3 mb-4">
                                {[
                                    { label: 'Total', value: materials?.length, icon: 'Package', color: 'var(--color-primary)' },
                                    { label: 'Filtrados', value: filteredMaterials?.length, icon: 'Filter', color: 'var(--color-secondary)' },
                                    { label: 'Categorias', value: [...new Set(materials.map((m) => m.categoria))]?.length, icon: 'Tag', color: 'var(--color-accent)' },
                                ]?.map((s) => (
                                    <div key={s?.label} className="flex items-center gap-2 bg-[var(--color-card)] border border-border rounded-lg px-3 py-2 shadow-card">
                                        <Icon name={s?.icon} size={16} color={s?.color} />
                                        <span className="text-xs text-[var(--color-text-secondary)]">{s?.label}:</span>
                                        <span className="font-data font-semibold text-sm text-[var(--color-text-primary)]">{s?.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table */}
                            <div className="hidden md:block">
                                <MaterialTable
                                    materials={pagedMaterials}
                                    sortConfig={sortConfig}
                                    onSort={handleSort}
                                    onEdit={openEdit}
                                    onDelete={setDeletingMaterial}
                                    loading={false}
                                />
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden space-y-2">
                                {pagedMaterials?.length === 0 ? (
                                    <div className="text-center py-12 text-[var(--color-muted-foreground)] bg-[var(--color-card)] rounded-lg border border-border">
                                        <Icon name="PackageSearch" size={36} color="var(--color-muted-foreground)" />
                                        <p className="mt-2 font-medium">Nenhum material encontrado</p>
                                        <p className="text-xs mt-1">Ajuste os filtros ou cadastre um novo material</p>
                                    </div>
                                ) : (
                                    pagedMaterials?.map((m) => (
                                        <MaterialCardMobile
                                            key={m?.id}
                                            material={m}
                                            onEdit={openEdit}
                                            onDelete={setDeletingMaterial}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Pagination info */}
                            {/* Paginação */}
                            {isPaginated && filteredMaterials.length > PAGE_SIZE ? (
                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                        Página {page} de {totalPages} · {filteredMaterials.length} materiais
                                    </p>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setPage(1)} disabled={page === 1}
                                            className="px-2 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50"
                                            style={{ borderColor: 'var(--color-border)' }}>«</button>
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                            className="px-3 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50"
                                            style={{ borderColor: 'var(--color-border)' }}>Anterior</button>
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                                            const p = start + i;
                                            if (p > totalPages) return null;
                                            return (
                                                <button key={p} onClick={() => setPage(p)}
                                                    className="px-3 py-1 rounded text-xs border font-medium"
                                                    style={p === page
                                                        ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                                                        : { borderColor: 'var(--color-border)' }
                                                    }>{p}</button>
                                            );
                                        })}
                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                            className="px-3 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50"
                                            style={{ borderColor: 'var(--color-border)' }}>Próxima</button>
                                        <button
                                            onClick={() => setPage(totalPages)} disabled={page === totalPages}
                                            className="px-2 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50"
                                            style={{ borderColor: 'var(--color-border)' }}>»</button>
                                    </div>
                                </div>
                            ) : filteredMaterials?.length > 0 ? (
                                <p className="text-xs text-[var(--color-text-secondary)] mt-3 text-right">
                                    {search?.trim() ? `${filteredMaterials.length} resultado(s) encontrado(s)` : `Exibindo ${filteredMaterials.length} de ${materials.length} materiais`}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>
            </main>
            {/* Mobile Filter Panel */}
            <FilterPanel
                filters={filters}
                onChange={setFilters}
                onReset={() => setFilters(DEFAULT_FILTERS)}
                totalCount={materials?.length}
                filteredCount={filteredMaterials?.length}
                mobileOpen={mobileFilterOpen}
                onMobileClose={() => setMobileFilterOpen(false)}
                categorias={categoriasDinamicas}
            />
            {/* Form Modal */}
            <MaterialFormModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                editingMaterial={editingMaterial}
            />
            {/* Delete Confirm */}
            <DeleteConfirmDialog
                material={deletingMaterial}
                onConfirm={handleDelete}
                onCancel={() => setDeletingMaterial(null)}
            />
            {/* Quick Action Panel (desktop) */}
            <div className="hidden">
                <QuickActionPanel />
            </div>
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-6 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-5 py-3 rounded-xl shadow-modal text-white text-sm font-medium transition-all duration-300 ${toast?.type === 'warning' ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]'
                        }`}
                    style={{ minWidth: 240, maxWidth: 'calc(100vw - 32px)' }}
                >
                    <Icon name={toast?.type === 'warning' ? 'AlertTriangle' : 'CheckCircle2'} size={18} color="#FFFFFF" />
                    {toast?.msg}
                </div>
            )}
        </div>
    );
}