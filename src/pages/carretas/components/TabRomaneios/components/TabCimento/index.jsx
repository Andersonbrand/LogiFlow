import React from 'react';

import { PrettySelect, AppIcon as Icon, Button, ActionButtonsGroup, ViewButton, EditButton, DeleteButton, SearchInput } from 'components';
import { STATUS_ROMANEIO, STATUS_ROMANEIO_COLORS } from 'services/carretas';

import { inputStyle } from '../../utils/constants';
import { BRL, FMT_DATE } from '../../utils/helpers';
import RomaneioFormModal from '../RomaneioFormModal';
import RomaneioDetailModal from '../RomaneioDetailModal';

// ─── guia === 'cimento' ───
export default function TabCimento({ adminsFrete, detailModal, empresas, exportar, filtroDia, filtroMes, filtroStatus, fretesFretas, handleDelete, handleSetFiltroMes, handleStatusChange, isAdmin, kpis, load, loading, materiais, modal, motoristas, periodoCustom, pesquisa, romaneios, romaneiosFiltrados, setDetailModal, setFiltroDia, setFiltroStatus, setModal, setPeriodoCustom, setPesquisa, setUsarPeriodo, usarPeriodo, veiculos }) {
    return (
        <>

            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex flex-wrap gap-2 items-center">
                    <PrettySelect value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos os status</option>
                        {STATUS_ROMANEIO.map(s => <option key={s} value={s}>{s}</option>)}
                    </PrettySelect>
                    <input type="month" value={filtroMes} onChange={e => { handleSetFiltroMes(e.target.value); setFiltroDia(''); setUsarPeriodo(false); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}
                        title="Filtrar por mês" />
                    <input type="date" value={filtroDia} onChange={e => { setFiltroDia(e.target.value); handleSetFiltroMes(''); setUsarPeriodo(false); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}
                        title="Filtrar por dia específico" />
                    <button type="button" onClick={() => setUsarPeriodo(v => !v)}
                        className="px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap"
                        style={usarPeriodo
                            ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                            : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        {usarPeriodo ? '✓ Período ativo' : 'Usar período'}
                    </button>
                    {usarPeriodo && (
                        <>
                            <input type="date" value={periodoCustom.inicio} onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))}
                                className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data inicial" />
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>até</span>
                            <input type="date" value={periodoCustom.fim} onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))}
                                className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data final" />
                        </>
                    )}
                    {(filtroMes || filtroDia || usarPeriodo) && (
                        <button onClick={() => { handleSetFiltroMes(''); setFiltroDia(''); setUsarPeriodo(false); setPeriodoCustom({ inicio: '', fim: '' }); }}
                            className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            title="Limpar filtro de data">
                            ✕ Data
                        </button>
                    )}
                    <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Nº, motorista, placa, NF, destino..." />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={load}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
                        style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    {isAdmin && (
                        <>
                            <button onClick={exportar}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
                                style={{ borderColor: 'var(--color-border)' }}>
                                <Icon name="FileDown" size={14} /> Exportar
                            </button>
                            <Button onClick={() => setModal({ mode: 'create' })} iconName="Plus" size="sm">
                                Novo Romaneio
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                    { l: 'Total',       v: kpis.total,           c: '#1D4ED8', bg: '#EFF6FF', i: 'FileText'    },
                    { l: 'Em Trânsito', v: kpis.transito,        c: '#7C3AED', bg: '#EDE9FE', i: 'Truck'       },
                    { l: 'Finalizados', v: kpis.finalizados,     c: '#065F46', bg: '#D1FAE5', i: 'CheckCircle2' },
                    { l: 'Frete Total', v: BRL(kpis.freteTotal), c: '#B45309', bg: '#FEF9C3', i: 'DollarSign'  },
                ].map(k => (
                    <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}>
                                <Icon name={k.i} size={14} color={k.c} />
                            </div>
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                        </div>
                        <p className="text-lg font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                    </div>
                ))}
            </div>

            {/* ── Lista de Cards ── */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-7 w-7 rounded-full border-4"
                        style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : romaneiosFiltrados.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="FileText" size={40} color="var(--color-muted-foreground)" />
                    <p className="text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                        {pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum romaneio cadastrado'}
                    </p>
                    {isAdmin && !pesquisa && (
                        <button onClick={() => setModal({ mode: 'create' })}
                            className="mt-2 flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm font-medium text-white"
                            style={{ backgroundColor: 'var(--color-primary)' }}>
                            <Icon name="Plus" size={14} color="white" /> Criar primeiro romaneio
                        </button>
                    )}
                </div>
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
                                    <th className="px-3 py-3 text-right font-medium hidden tab:table-cell whitespace-nowrap">Peso</th>
                                    <th className="px-3 py-3 text-left font-medium hidden tab:table-cell">Saída</th>
                                    <th className="px-3 py-3 text-left font-medium hidden tab:table-cell">Chegada</th>
                                    <th className="px-3 py-3 text-right font-medium hidden lg:table-cell">Valor Carga</th>
                                    <th className="px-3 py-3 text-right font-medium hidden lg:table-cell">Frete</th>
                                    <th className="px-3 py-3 text-center font-medium">Vínculo</th>
                                    <th className="px-3 py-3 text-center font-medium">Status</th>
                                    <th className="px-3 py-3 text-center font-medium">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {romaneiosFiltrados.map((r, idx) => {
                                    const statusCfg = STATUS_ROMANEIO_COLORS[r.status] || STATUS_ROMANEIO_COLORS['Aguardando'];
                                    const isCancelado = r.status === 'Cancelado';
                                    const pesoItens = (r.itens || []).reduce((s, it) => s + Number(it.peso_total || 0), 0);
                                    return (
                                        <tr key={r.id} className="border-t transition-colors"
                                            style={{
                                                borderColor: 'var(--color-border)',
                                                borderLeft: isCancelado ? '3px solid #9CA3AF' : '3px solid transparent',
                                                backgroundColor: isCancelado ? '#F9FAFB' : (idx % 2 === 0 ? 'white' : '#F9FAFB'),
                                            }}>
                                            <td className="px-3 py-3">
                                                <button onClick={() => setDetailModal(r)}
                                                    className="font-data text-xs font-semibold hover:underline whitespace-nowrap"
                                                    style={{ color: isCancelado ? '#6B7280' : 'var(--color-primary)', textDecoration: isCancelado ? 'line-through' : 'none' }}>
                                                    {r.numero}
                                                </button>
                                                <p className="text-xs mt-0.5 sm:hidden" style={{ color: isCancelado ? '#9CA3AF' : '#64748b' }}>{r.motorista?.name || ''}</p>
                                            </td>
                                            <td className="px-3 py-3 hidden sm:table-cell" style={{ color: isCancelado ? '#9CA3AF' : 'var(--color-text-primary)' }}>{r.motorista?.name || '—'}</td>
                                            <td className="px-3 py-3 hidden md:table-cell" style={{ color: isCancelado ? '#9CA3AF' : 'var(--color-text-secondary)' }}>{r.destino || '—'}</td>
                                            <td className="px-3 py-3 hidden tab:table-cell font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.veiculo?.placa || '—'}</td>
                                            <td className="px-3 py-3 text-right hidden tab:table-cell font-data text-xs whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                                                {pesoItens > 0 ? `${pesoItens.toLocaleString('pt-BR')} kg` : '—'}
                                            </td>
                                            <td className="px-3 py-3 hidden tab:table-cell text-xs font-caption" style={{ color: 'var(--color-text-secondary)' }}>{FMT_DATE(r.data_saida)}</td>
                                            <td className="px-3 py-3 hidden tab:table-cell text-xs font-caption" style={{ color: 'var(--color-text-secondary)' }}>{FMT_DATE(r.data_chegada)}</td>
                                            <td className="px-3 py-3 text-right hidden lg:table-cell font-data text-xs font-semibold whitespace-nowrap" style={{ color: '#065F46' }}>{r.valor_carga ? BRL(r.valor_carga) : '—'}</td>
                                            <td className="px-3 py-3 text-right hidden lg:table-cell font-data text-xs font-semibold whitespace-nowrap" style={{ color: '#7C3AED' }}>{r.valor_frete ? BRL(r.valor_frete) : '—'}</td>
                                            <td className="px-3 py-3 text-center">
                                                <div className="flex items-center justify-center" title={r.motorista_id ? 'Vinculado a um motorista' : 'Pendente — sem motorista vinculado'}>
                                                    <Icon name={r.motorista_id ? 'CheckCircle2' : 'Clock'} size={20} color={r.motorista_id ? '#059669' : '#9CA3AF'} className="flex-shrink-0" />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <PrettySelect
                                                    value={r.status}
                                                    onChange={e => handleStatusChange(r.id, e.target.value)}
                                                    className="px-2 py-1 rounded-full text-xs font-medium border cursor-pointer font-caption focus:outline-none"
                                                    style={{ backgroundColor: statusCfg.bg, color: statusCfg.text, borderColor: statusCfg.bg }}>
                                                    {STATUS_ROMANEIO.map(s => <option key={s}>{s}</option>)}
                                                </PrettySelect>
                                            </td>
                                            <td className="px-4 py-3">
                                                <ActionButtonsGroup className="justify-center">
                                                    <ViewButton onClick={() => setDetailModal(r)} title="Ver detalhes" />
                                                    {isAdmin && (<>
                                                        <EditButton onClick={() => setModal({ mode: 'edit', data: r })} />
                                                        <DeleteButton onClick={() => handleDelete(r.id)} />
                                                    </>)}
                                                </ActionButtonsGroup>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 border-t text-xs font-caption text-right" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        Exibindo {romaneiosFiltrados.length} de {romaneios.length} romaneios
                    </div>
                </div>
            )}

            {modal && (
                <RomaneioFormModal
                    modal={modal}
                    onClose={() => setModal(null)}
                    onSaved={load}
                    motoristas={motoristas}
                    veiculos={veiculos}
                    empresas={empresas}
                    materiais={materiais}
                    fretesFretas={fretesFretas}
                    adminsFrete={adminsFrete}
                />
            )}

            {detailModal && (
                <RomaneioDetailModal
                    romaneio={detailModal}
                    onClose={() => setDetailModal(null)}
                />
            )}

            </>
    );
}
