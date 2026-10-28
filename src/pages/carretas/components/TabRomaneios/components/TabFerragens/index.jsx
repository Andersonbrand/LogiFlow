import React from 'react';

import { AppIcon as Icon, PrettySelect, SearchInput } from 'components';
import { STATUS_ROMANEIO_COLORS, STATUS_ROMANEIO } from 'services/carretas';

import { inputStyle } from '../../utils/constants';
import { FMT_DATE } from '../../utils/helpers';

// ─── guia === 'ferragens' ───
export default function TabFerragens({ filtroDia, filtroMes, handleSetFiltroMes, handleStatusChange, isAdmin, loading, periodoCustom, pesquisa, romaneiosFerragemFiltrados, setFiltroDia, setPeriodoCustom, setPesquisa, setUsarPeriodo, usarPeriodo }) {
    return (
        <div>
                    <div className="flex items-center gap-2 p-3 rounded-xl border mb-4" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>
                        <Icon name="Info" size={14} color="#065F46" />
                        <p className="text-xs" style={{ color: '#065F46' }}>Viagens registradas diretamente pelos motoristas carreteiros no app deles. Use para conferência e acompanhamento.</p>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 mb-4">
                        <div>
                            <input type="month" value={filtroMes} onChange={e => { handleSetFiltroMes(e.target.value); setFiltroDia(''); setUsarPeriodo(false); }}
                                className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}
                                title="Filtrar por mês" />
                        </div>
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
                    {loading ? (
                        <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: '#059669', borderTopColor: 'transparent' }} /></div>
                    ) : romaneiosFerragemFiltrados.length === 0 ? (
                        <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
                                <Icon name="FileText" size={28} color="#059669" />
                            </div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum romaneio de ferragens'}</p>
                            <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>Quando um motorista registrar um romaneio de ferragens, ele aparecerá aqui.</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ backgroundColor: '#059669' }}>
                                        {['Nº ROM', 'Vínculo', 'Motorista', 'Placa', 'NF', 'Data Saída', 'Destino', 'Peso', 'Empresa', 'Status'].map(h => (
                                            <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-white whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {romaneiosFerragemFiltrados.map((r, idx) => {
                                        const sc = STATUS_ROMANEIO_COLORS[r.status] || { bg: '#F3F4F6', text: '#6B7280' };
                                        return (
                                            <tr key={r.id} className="border-t hover:bg-green-50/30 transition-colors"
                                                style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                                <td className="px-3 py-3 font-data font-semibold text-xs" style={{ color: '#059669' }}>{r.numero}</td>
                                                <td className="px-3 py-3 text-xs">
                                                    {r.lancado_por_motorista
                                                        ? <span className="px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#DCFCE7', color: '#166534', fontSize: '10px' }}>✓ Vinculado</span>
                                                        : <span className="px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#FEF9C3', color: '#92400E', fontSize: '10px' }}>⏳ Aguard. motorista</span>
                                                    }
                                                </td>
                                                <td className="px-3 py-3 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.motorista?.name || '—'}</td>
                                                <td className="px-3 py-3 font-data text-xs" style={{ color: 'var(--color-text-primary)' }}>{r.veiculo?.placa || '—'}</td>
                                                <td className="px-3 py-3 font-data font-semibold text-xs" style={{ color: '#1D4ED8' }}>{r.numero_nf || '—'}</td>
                                                <td className="px-3 py-3 font-data text-xs whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{r.data_saida ? FMT_DATE(r.data_saida) : '—'}</td>
                                                <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</td>
                                                <td className="px-3 py-3 font-data text-xs text-right" style={{ color: '#7C3AED' }}>
                                                    {r.toneladas ? `${Number(r.toneladas).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ton` : '—'}
                                                </td>
                                                <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.empresa || '—'}</td>
                                                <td className="px-3 py-3">
                                                    {isAdmin ? (
                                                        <PrettySelect
                                                            value={r.status}
                                                            onChange={e => handleStatusChange(r.id, e.target.value)}
                                                            className="text-xs font-semibold rounded-full px-2.5 py-1 border-0 cursor-pointer outline-none"
                                                            style={{ backgroundColor: sc.bg, color: sc.text }}
                                                            title="Clique para mudar o status">
                                                            {STATUS_ROMANEIO.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </PrettySelect>
                                                    ) : (
                                                        <span className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.status}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="px-4 py-2 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: '#F9FAFB' }}>
                                {romaneiosFerragemFiltrados.length} viagem{romaneiosFerragemFiltrados.length !== 1 ? 's' : ''} registrada{romaneiosFerragemFiltrados.length !== 1 ? 's' : ''} pelo motorista
                            </div>
                        </div>
                    )}
                </div>
    );
}
