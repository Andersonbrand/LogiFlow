import React from 'react';

import { PrettySelect, AppIcon as Icon } from 'components';

import { inputStyle } from '../../utils/constants';
import { BRL, FMT } from '../../utils/helpers';

// ─── tab === 'abastecimentos' ───
export default function TabAbastecimentos({ abast, abrirEdicaoAbast, excluirAbast, filtroPlaca, postos, setFiltroPlaca, totais, veiculos }) {
    return (
        <div className="flex flex-col gap-3">
                                            {veiculos.length > 0 && (
                                                <PrettySelect value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)}
                                                    className="px-3 py-2 rounded-lg border text-sm self-start" style={inputStyle}>
                                                    <option value="">Todas as placas</option>
                                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                                </PrettySelect>
                                            )}
                                            <div className="grid grid-cols-2 gap-3 mb-2">
                                                {[
                                                    { l: 'Diesel (L)', v: totais.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#1D4ED8', bg: '#EFF6FF', i: 'Fuel' },
                                                    { l: 'Total Gasto', v: BRL(totais.gastoTotal), c: '#7C3AED', bg: '#EDE9FE', i: 'Receipt' },
                                                ].map(k => (
                                                    <div key={k.l} className="bg-white rounded-xl border p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="rounded-lg flex items-center justify-center" style={{ width: 26, height: 26, backgroundColor: k.bg }}><Icon name={k.i} size={13} color={k.c} /></div>
                                                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                                        </div>
                                                        <p className="text-base font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            {abast.filter(a => !filtroPlaca || String(a.veiculo_caminhao_id) === filtroPlaca).length === 0
                                                ? <div className="bg-white rounded-xl border p-8 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="Fuel" size={28} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum abastecimento no período</span></div>
                                                : abast.filter(a => !filtroPlaca || String(a.veiculo_caminhao_id) === filtroPlaca).map(a => (
                                                    <div key={a.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                        <div className="flex items-start justify-between mb-2 gap-2">
                                                            <div>
                                                                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{a.posto || postos.find(p => p.id === a.posto_id)?.nome || '—'}</p>
                                                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{FMT(a.data_abastecimento)}{a.horario ? ` · ${a.horario}` : ''} · {a.veiculo?.placa || a.veiculo_caminhao_placa || '—'}</p>
                                                            </div>
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                <p className="text-base font-bold font-data text-purple-600">{BRL(a.valor_total)}</p>
                                                                <button onClick={() => abrirEdicaoAbast(a)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Editar">
                                                                    <Icon name="Pencil" size={14} color="var(--color-muted-foreground)" />
                                                                </button>
                                                                <button onClick={() => excluirAbast(a)} className="p-1.5 rounded-lg hover:bg-red-50" title="Excluir">
                                                                    <Icon name="Trash2" size={14} color="#DC2626" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            {Number(a.litros_diesel||0) > 0 && (
                                                                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-blue-50">
                                                                    <span className="text-blue-700">🛢️ {Number(a.litros_diesel).toLocaleString('pt-BR',{maximumFractionDigits:1})}L · {BRL(a.valor_diesel)}</span>
                                                                </div>
                                                            )}
                                                            {Number(a.litros_arla||0) > 0 && (
                                                                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50">
                                                                    <span className="text-emerald-700">💧 {Number(a.litros_arla).toLocaleString('pt-BR',{maximumFractionDigits:1})}L · {BRL(a.valor_arla)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </div>
    );
}
