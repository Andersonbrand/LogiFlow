import React from 'react';

import { AppIcon as Icon } from 'components';
import paths from 'constants/paths';

// ─── tab === 'aprovacoes' ───
export default function TabAprovacoes({ handleAprovar, handleReprovar, navigate, romaneios }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                                <Icon name="CheckSquare" size={18} color="#1D4ED8" />
                                <h2 className="text-base font-semibold text-slate-800">Romaneios Pendentes de Aprovação</h2>
                                <span className="ml-auto text-xs text-slate-400">{romaneios.length} pendentes</span>
                            </div>
                            {romaneios.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                                    <Icon name="CheckCircle2" size={36} color="#86EFAC" />
                                    <p className="text-sm">Nenhum romaneio pendente de aprovação</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Número</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Motorista</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Destino</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Peso</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Status</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {romaneios.map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <p className="font-mono font-semibold text-slate-800 text-xs">{r.numero}</p>
                                                        <p className="text-xs text-slate-400 sm:hidden">{r.status}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700 text-xs">
                                                        <p>{r.motorista || '—'}</p>
                                                        <p className="text-slate-400 md:hidden text-xs">{r.destino || ''}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{r.destino || '—'}</td>
                                                    <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{Number(r.peso_total||0).toLocaleString('pt-BR')} kg</td>
                                                    <td className="px-4 py-3 hidden sm:table-cell">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                                            {r.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <button onClick={() => handleAprovar(r)}
                                                                className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 transition-colors font-semibold">
                                                                ✓ Aprovar
                                                            </button>
                                                            <button onClick={() => handleReprovar(r)}
                                                                className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-lg hover:bg-red-600 transition-colors font-semibold">
                                                                ✕ Reprovar
                                                            </button>
                                                            <button onClick={() => navigate(paths.Romaneios)}
                                                                className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors hidden sm:inline-flex items-center justify-center"
                                                                title="Ver romaneio">
                                                                <Icon name="Eye" size={14} color="currentColor" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
    );
}
