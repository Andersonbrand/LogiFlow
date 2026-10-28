import React from 'react';

import { AppIcon as Icon, Button, PrettySelect } from 'components';

const STATUS_COLORS = {
    'Aguardando':  { bg: '#FEF9C3', text: '#B45309' },
    'Carregando':  { bg: '#DBEAFE', text: '#1D4ED8' },
    'Em Trânsito': { bg: '#D1FAE5', text: '#065F46' },
    'Finalizado':  { bg: '#F3F4F6', text: '#374151' },
    'Cancelado':   { bg: '#FEE2E2', text: '#991B1B' },
};

const ALL_STATUS = ['Todos', 'Aguardando', 'Carregando', 'Em Trânsito', 'Finalizado', 'Cancelado'];

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

// ─── guia === 'romaneios' ───
export default function TabRomaneios({ PAGE_SIZE, filterStatus, filtered, filtroMes, handleDelete, handleStatusChange, loading, metrics, paginaSegura, paginado, periodoCustom, romaneios, search, setDetailModal, setFilterStatus, setFiltroMes, setFormModal, setPage, setPeriodoCustom, setSearch, setUsarPeriodo, totalPaginas, usarPeriodo }) {
    return (
        <>
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
                        <div className="flex flex-wrap items-center gap-2">
                            <input type="month" value={filtroMes}
                                onChange={e => { setFiltroMes(e.target.value); setUsarPeriodo(false); }}
                                className="px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: 'var(--color-border)' }}
                                title="Filtrar por mês" />
                            <button type="button" onClick={() => setUsarPeriodo(v => !v)}
                                className="px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap"
                                style={usarPeriodo
                                    ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                                    : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                {usarPeriodo ? '✓ Período ativo' : 'Usar período'}
                            </button>
                            {usarPeriodo && (
                                <>
                                    <input type="date" value={periodoCustom.inicio}
                                        onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))}
                                        className="px-2.5 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: 'var(--color-border)' }}
                                        title="Data inicial" />
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>até</span>
                                    <input type="date" value={periodoCustom.fim}
                                        onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))}
                                        className="px-2.5 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: 'var(--color-border)' }}
                                        title="Data final" />
                                </>
                            )}
                            {(filtroMes || usarPeriodo) && (
                                <button onClick={() => { setFiltroMes(''); setUsarPeriodo(false); setPeriodoCustom({ inicio: '', fim: '' }); }}
                                    className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                                    title="Limpar data e ver todos os romaneios">✕ Data</button>
                            )}
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
                                            <th className="px-3 py-3 text-left font-medium hidden tab:table-cell">Chegada</th>
                                            <th className="px-3 py-3 text-right font-medium hidden lg:table-cell">Frete</th>
                                            <th className="px-3 py-3 text-right font-medium hidden lg:table-cell">Margem</th>
                                            <th className="px-3 py-3 text-center font-medium hidden tab:table-cell">Aprovação</th>
                                            <th className="px-3 py-3 text-center font-medium">Status</th>
                                            <th className="px-3 py-3 text-center font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginado.map(r => {
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
                                                    <td className="px-3 py-3 hidden tab:table-cell text-xs font-caption" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {r.chegada ? new Date(r.chegada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
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
                                                        <PrettySelect
                                                            value={r.status}
                                                            onChange={e => handleStatusChange(r.id, e.target.value)}
                                                            className="px-2 py-1 rounded-full text-xs font-medium border cursor-pointer font-caption focus:outline-none"
                                                            style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.bg }}>
                                                            {['Aguardando', 'Carregando', 'Em Trânsito', 'Finalizado', 'Cancelado'].map(s => <option key={s}>{s}</option>)}
                                                        </PrettySelect>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => setDetailModal({ open: true, romaneio: r })}
                                                                className="p-1.5 rounded hover:bg-blue-50 transition-colors flex-shrink-0" title="Ver detalhes">
                                                                <Icon name="Eye" size={16} color="var(--color-primary)" className="flex-shrink-0" />
                                                            </button>
                                                            <button onClick={() => setFormModal({ open: true, romaneio: r })}
                                                                className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Editar">
                                                                <Icon name="Pencil" size={16} color="var(--color-muted-foreground)" />
                                                            </button>
                                                            <button onClick={() => handleDelete(r.id)}
                                                                className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Excluir">
                                                                <Icon name="Trash2" size={16} color="var(--color-destructive)" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Painel de reprovação — aparece abaixo da linha, dentro do Fragment */}
                                                {isReprovado && (
                                                    <tr style={{ backgroundColor: '#FFF8F8' }}>
                                                        <td colSpan={12} style={{ padding: 0, borderBottom: '2px solid #FCA5A5', borderLeft: '3px solid #EF4444', borderRight: '1px solid #FCA5A5', borderTop: 'none' }}>
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
                                                                        <Icon name="Pencil" size={16} color="white" />
                                                                        Editar e reenviar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(r.id)}
                                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                                                                        style={{ backgroundColor: 'white', color: '#DC2626', border: '1px solid #FCA5A5', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                                        <Icon name="Trash2" size={16} color="#DC2626" />
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
                            <div className="px-4 py-3 border-t text-xs font-caption" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                {filtered.length > PAGE_SIZE ? (
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <p>Página {paginaSegura} de {totalPaginas} · {filtered.length} romaneio{filtered.length !== 1 ? 's' : ''}</p>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => setPage(1)} disabled={paginaSegura === 1}
                                                className="px-2 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50"
                                                style={{ borderColor: 'var(--color-border)' }}>«</button>
                                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={paginaSegura === 1}
                                                className="px-3 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50"
                                                style={{ borderColor: 'var(--color-border)' }}>Anterior</button>
                                            {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                                                const start = Math.max(1, Math.min(paginaSegura - 2, totalPaginas - 4));
                                                const p = start + i;
                                                if (p > totalPaginas) return null;
                                                return (
                                                    <button key={p} onClick={() => setPage(p)}
                                                        className="px-3 py-1 rounded text-xs border font-medium"
                                                        style={p === paginaSegura
                                                            ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                                                            : { borderColor: 'var(--color-border)' }
                                                        }>{p}</button>
                                                );
                                            })}
                                            <button onClick={() => setPage(p => Math.min(totalPaginas, p + 1))} disabled={paginaSegura === totalPaginas}
                                                className="px-3 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50"
                                                style={{ borderColor: 'var(--color-border)' }}>Próxima</button>
                                            <button onClick={() => setPage(totalPaginas)} disabled={paginaSegura === totalPaginas}
                                                className="px-2 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50"
                                                style={{ borderColor: 'var(--color-border)' }}>»</button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-right">Exibindo {filtered.length} de {romaneios.length} romaneios</p>
                                )}
                            </div>
                        </div>
                    )}
                    </>
    );
}
