import React from 'react';

import { useAuth } from 'context/AuthContext';
import { useToast } from 'hooks/useToast';
import { AppIcon as Icon, Button, Toast, PrettySelect, PeriodRangeFilter, PaginationBar, Field, ModalHeader, ModalOverlay } from 'components';
import { exportBonificacoesAdminExcel } from 'utils/excel';

import { inputStyle, inputCls } from '../../utils/constants';
import { BRL, FMT_DATE } from '../../utils/helpers';
import { useBonificacoesCaminhao } from './hooks';

// ─── Aba Bônus — controle de bonificação dos motoristas de caminhão ───────────
// Antes ficava no painel Admin. Aqui: resumo por motorista (romaneios + extras),
// lançamento de bônus extras e edição dos valores padrão pagos.
export default function TabBonificacoes() {
    const { isAdmin, profile } = useAuth();
    const { toast, showToast } = useToast();
    const admin = isAdmin();
    const b = useBonificacoesCaminhao({ showToast, profile });
    const cfg = b.bonusCaminhaoConfig;

    return (
        <div className="space-y-4">
            {/* Valores padrão pagos */}
            <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
                        <Icon name="Award" size={18} color="#D97706" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Valores padrão do bônus</p>
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                            Ferragem: <strong>{BRL(cfg.taxaFerragemKg * 1000)}</strong> por tonelada · Cimento: <strong>{BRL(cfg.valorCimento)}</strong> por romaneio
                        </p>
                    </div>
                </div>
                {admin && <Button onClick={b.abrirValores} iconName="Pencil" size="sm" variant="outline">Alterar valores</Button>}
            </div>

            {/* Filtros */}
            <div className="flex items-end gap-3 flex-wrap">
                <PeriodRangeFilter preset={b.preset} onPresetChange={b.onPresetChange} periodo={b.periodo} onPeriodoChange={b.setPeriodo}
                    presets={['mes', 'mes_passado', 'todos', 'personalizado']} />
                <div className="min-w-[200px]">
                    <PrettySelect value={b.filtroMotorista} onChange={e => b.setFiltroMotorista(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none" style={inputStyle}>
                        <option value="">Todos os motoristas</option>
                        {b.motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </PrettySelect>
                </div>
                <div className="flex-1" />
                {admin && <Button onClick={() => b.abrirNovaExtra()} iconName="PlusCircle" size="sm">Lançar bônus extra</Button>}
                <button onClick={() => exportBonificacoesAdminExcel(b.bonifsFiltrados)} disabled={b.bonifsFiltrados.length === 0}
                    className="h-8 px-3 rounded-lg border text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                    <Icon name="Download" size={14} /> Exportar
                </button>
            </div>

            {/* Totais */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { l: 'Motoristas', v: b.totais.motoristas, c: '#1D4ED8' },
                    { l: 'Bônus dos romaneios', v: BRL(b.totais.romaneios), c: '#7C3AED' },
                    { l: 'Bônus extras', v: BRL(b.totais.extras), c: '#D97706' },
                    { l: 'Total a pagar', v: BRL(b.totais.total), c: '#059669' },
                ].map(({ l, v, c }) => (
                    <div key={l} className="p-3 rounded-xl bg-white border" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{l}</p>
                        <p className="text-sm font-bold font-data" style={{ color: c }}>{v}</p>
                    </div>
                ))}
            </div>

            {/* Sub-abas */}
            <div className="flex gap-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
                {[{ id: 'resumo', label: 'Resumo por motorista', icon: 'Users' }, { id: 'extras', label: 'Bônus extras', icon: 'PlusCircle' }].map(t => (
                    <button key={t.id} onClick={() => b.setSubTab(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 ${b.subTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <Icon name={t.icon} size={14} color="currentColor" /> {t.label}
                    </button>
                ))}
            </div>

            {b.loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
            ) : b.subTab === 'resumo' ? (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    {b.bonifsFiltrados.length === 0 ? (
                        <div className="py-12 flex flex-col items-center gap-1.5 text-slate-400">
                            <Icon name="Award" size={36} color="#CBD5E1" />
                            <p className="text-sm">Nenhuma bonificação neste período</p>
                            <p className="text-xs text-slate-300">Aprove romaneios ou lance bônus extras para que apareçam aqui</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm min-w-[700px]">
                            <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                <tr>{['Motorista', 'Viagens', 'Peso total', 'Romaneios', 'Extras', 'Total', ''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {b.bonifsFiltrados.map((m, i) => (
                                    <tr key={m.motoristaId || m.motorista + i} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                        <td className="px-4 py-3 font-medium">{m.motorista}</td>
                                        <td className="px-4 py-3">{m.total_viagens}</td>
                                        <td className="px-4 py-3">{Number(m.peso_total || 0).toLocaleString('pt-BR')} kg</td>
                                        <td className="px-4 py-3 font-data text-purple-700">{BRL(m.bonificacao_romaneios)}</td>
                                        <td className="px-4 py-3 font-data text-amber-600">{BRL(m.bonificacao_extras)}</td>
                                        <td className="px-4 py-3 font-data font-bold text-green-700">{BRL(m.bonificacao_total)}</td>
                                        <td className="px-4 py-3 text-right">
                                            {admin && m.motoristaId && (
                                                <button onClick={() => b.abrirNovaExtra(m.motoristaId)} title="Lançar bônus extra para este motorista"
                                                    className="p-2 rounded hover:bg-amber-50"><Icon name="PlusCircle" size={16} color="#D97706" /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : (
                <div>
                    <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>Bônus avulsos lançados pelo gestor para cada motorista</p>
                    <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                        <table className="w-full text-sm min-w-[600px]">
                            <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                <tr>{['Motorista', 'Data', 'Valor', 'Observação', 'Criado por', ''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {b.extrasFiltrados.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum bônus extra no período</td></tr>
                                ) : b.extrasPag.pageItems.map(e => (
                                    <tr key={e.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                        <td className="px-4 py-3 font-medium">{e.motorista?.name || '—'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{FMT_DATE(e.data)}</td>
                                        <td className="px-4 py-3 font-data font-bold text-amber-600">{BRL(e.valor)}</td>
                                        <td className="px-4 py-3 max-w-[220px]"><p className="text-sm line-clamp-2">{e.observacao || '—'}</p></td>
                                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{e.criador?.name || '—'}</td>
                                        <td className="px-4 py-3">
                                            {admin && (
                                                <div className="flex gap-1">
                                                    <button onClick={() => b.abrirEditExtra(e)} className="p-2 rounded hover:bg-blue-50"><Icon name="Pencil" size={16} color="#1D4ED8" /></button>
                                                    <button onClick={() => b.excluirExtra(e.id)} className="p-2 rounded hover:bg-red-50"><Icon name="Trash2" size={16} color="#DC2626" /></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <PaginationBar {...b.extrasPag} itemLabel="bônus" itemLabelPlural="bônus" />
                    </div>
                </div>
            )}

            {/* Modal: bônus extra */}
            {b.modalExtra && admin && (
                <ModalOverlay onClose={() => b.setModalExtra(null)}>
                    <ModalHeader title={b.modalExtra.mode === 'create' ? 'Novo bônus extra' : 'Editar bônus extra'} icon="PlusCircle" onClose={() => b.setModalExtra(null)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                        <Field label="Motorista" required>
                            <PrettySelect value={b.formExtra.motorista_id} onChange={e => b.setFormExtra(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {b.motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Data" required>
                            <input type="date" value={b.formExtra.data} onChange={e => b.setFormExtra(f => ({ ...f, data: e.target.value }))} className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Valor (R$)" required>
                            <input type="number" step="0.01" min="0" value={b.formExtra.valor} onChange={e => b.setFormExtra(f => ({ ...f, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 150,00" />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Observação" required>
                                <textarea value={b.formExtra.observacao} onChange={e => b.setFormExtra(f => ({ ...f, observacao: e.target.value }))} className={inputCls} style={inputStyle} rows={3} placeholder="Motivo do bônus (ex: viagem extra em feriado...)" />
                            </Field>
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => b.setModalExtra(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={b.salvarExtra} size="sm" iconName="Check" loading={b.savingExtra} disabled={b.savingExtra}>Salvar</Button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal: valores padrão */}
            {b.modalValores && admin && (
                <ModalOverlay sm onClose={() => b.setModalValores(false)}>
                    <ModalHeader title="Valores padrão do bônus" icon="Award" onClose={() => b.setModalValores(false)} />
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
                        <Field label="Ferragem — R$ por tonelada" required>
                            <input value={b.formValores.taxaFerragemTon} inputMode="decimal" onChange={e => b.setFormValores(f => ({ ...f, taxaFerragemTon: e.target.value }))} className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Cimento — R$ por romaneio com cimento" required>
                            <input value={b.formValores.valorCimento} inputMode="decimal" onChange={e => b.setFormValores(f => ({ ...f, valorCimento: e.target.value }))} className={inputCls} style={inputStyle} />
                        </Field>
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                            Vale para todos os romaneios, inclusive os já lançados — os bônus são recalculados com o valor novo.
                        </p>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => b.setModalValores(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={b.salvarValores} size="sm" iconName="Check" loading={b.savingValores} disabled={b.savingValores}>Salvar</Button>
                    </div>
                </ModalOverlay>
            )}

            <Toast toast={toast} />
            {b.ConfirmDialog}
        </div>
    );
}
