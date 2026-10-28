import React from 'react';

import { TabelaLancamentosPaginada } from 'components';

import { inputStyle } from '../../../../utils/constants';
import { BRL } from '../../../../utils/helpers';

// ─── guiaDespesas === 'relatorio' ───
export default function TabRelatorio({ relatorioPeriodo, relatorioStatus, setRelatorioPeriodo }) {
    return (
        <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                        <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Período — início</label>
                            <input type="date" value={relatorioPeriodo.inicio} onChange={e => setRelatorioPeriodo(p => ({ ...p, inicio: e.target.value }))}
                                className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Período — fim</label>
                            <input type="date" value={relatorioPeriodo.fim} onChange={e => setRelatorioPeriodo(p => ({ ...p, fim: e.target.value }))}
                                className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                        </div>
                        <p className="text-xs mt-4" style={{ color: 'var(--color-muted-foreground)' }}>
                            O relatório considera o vencimento de cada parcela, e a data da despesa para pagamentos à vista.
                        </p>
                    </div>
                    {relatorioStatus && (<>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border p-4 shadow-sm" style={{ borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' }}>
                                <p className="text-xs mb-1 font-medium text-green-700">✅ Total Pago</p>
                                <p className="text-2xl font-bold font-data text-green-700">{BRL(relatorioStatus.totalPago)}</p>
                                <p className="text-xs mt-0.5 text-green-600">{relatorioStatus.pagos.length} lançamento{relatorioStatus.pagos.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="rounded-xl border p-4 shadow-sm" style={{ borderColor: '#FCA5A5', backgroundColor: '#FFF1F2' }}>
                                <p className="text-xs mb-1 font-medium text-red-700">🔴 Total em Aberto</p>
                                <p className="text-2xl font-bold font-data text-red-700">{BRL(relatorioStatus.totalAberto)}</p>
                                <p className="text-xs mt-0.5 text-red-600">{relatorioStatus.abertos.length} lançamento{relatorioStatus.abertos.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        {[
                            { lista: relatorioStatus.abertos, titulo: 'Em Aberto', cor: '#DC2626', bg: '#FFF1F2', border: '#FCA5A5', total: relatorioStatus.totalAberto },
                            { lista: relatorioStatus.pagos,   titulo: 'Pagos',     cor: '#059669', bg: '#F0FDF4', border: '#A7F3D0', total: relatorioStatus.totalPago },
                        ].map(({ lista, titulo, cor, bg, border, total }) => (
                            <TabelaLancamentosPaginada key={titulo} lista={lista} titulo={titulo} cor={cor} bg={bg} border={border} totalGeral={total} />
                        ))}
                    </>)}
                </div>
    );
}
