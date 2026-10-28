import React from 'react';

import { AppIcon as Icon, PrettySelect, Field, Button } from 'components';

import { inputCls, inputStyle } from '../../utils/constants';

// ─── modalAbast ───
export default function ModalAbast({ configAbast, editingAbastId, formAbast, handleAbast, handleLitros, handlePostoChange, postos, precoArlaEfetivo, precoDieselEfetivo, savingAbast, setEditingAbastId, setFormAbast, setModalAbast, veiculos }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
                   >
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-xl sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50">
                                    <Icon name="Fuel" size={18} color="#059669" />
                                </div>
                                <h2 className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{editingAbastId ? 'Editar Abastecimento' : 'Registrar Abastecimento'}</h2>
                            </div>
                            <button onClick={() => { setModalAbast(false); setEditingAbastId(null); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                            </button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                            <Field label="Veículo" required>
                                <PrettySelect value={formAbast.veiculo_caminhao_id} onChange={e => setFormAbast(f => ({ ...f, veiculo_caminhao_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </PrettySelect>
                            </Field>
                            <Field label="Data" required>
                                <input type="date" value={formAbast.data_abastecimento} onChange={e => setFormAbast(f => ({ ...f, data_abastecimento: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Horário">
                                <input type="time" value={formAbast.horario} onChange={e => setFormAbast(f => ({ ...f, horario: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="N° do Cupom Fiscal" required>
                                <input
                                    type="text"
                                    value={formAbast.cupom_fiscal}
                                    onChange={e => setFormAbast(f => ({ ...f, cupom_fiscal: e.target.value }))}
                                    className={inputCls}
                                    style={inputStyle}
                                    placeholder="Ex: 000123456"
                                    maxLength={50}
                                />
                            </Field>
                            <Field label="Posto" required>
                                <PrettySelect value={formAbast.posto_id} onChange={e => handlePostoChange(e.target.value)} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione o posto...</option>
                                    {postos.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.nome}{p.cidade ? ` — ${p.cidade}` : ''}
                                        </option>
                                    ))}
                                </PrettySelect>
                                {/* Mostra preço efetivo (posto ou config global) */}
                                <div className="flex gap-3 mt-1 text-xs">
                                    {precoDieselEfetivo > 0 && (
                                        <span className="text-blue-600 font-medium">
                                            🛢️ R${precoDieselEfetivo.toFixed(3)}/L
                                            {!postos.find(p => p.id === formAbast.posto_id)?.preco_diesel && configAbast?.preco_diesel > 0 && (
                                                <span className="text-gray-400 ml-1">(padrão)</span>
                                            )}
                                        </span>
                                    )}
                                    {precoArlaEfetivo > 0 && (
                                        <span className="text-emerald-600 font-medium">
                                            💧 R${precoArlaEfetivo.toFixed(3)}/L
                                            {!postos.find(p => p.id === formAbast.posto_id)?.preco_arla && configAbast?.preco_arla > 0 && (
                                                <span className="text-gray-400 ml-1">(padrão)</span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </Field>
                            <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                <p className="text-xs font-semibold text-blue-700 mb-2">🛢️ Diesel</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros">
                                        <input type="number" step="0.01" value={formAbast.litros_diesel} onChange={e => handleLitros('litros_diesel', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" />
                                    </Field>
                                    <Field label="Valor calculado">
                                        <div className="px-3 py-2 rounded-lg border text-sm font-semibold" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F0F9FF', color: '#1D4ED8' }}>
                                            {formAbast.valor_diesel
                                                ? Number(formAbast.valor_diesel).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                : 'R$ 0,00'}
                                        </div>
                                    </Field>
                                </div>
                            </div>
                            <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                                <p className="text-xs font-semibold text-emerald-700 mb-2">💧 ARLA 32</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros">
                                        <input type="number" step="0.01" value={formAbast.litros_arla} onChange={e => handleLitros('litros_arla', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" />
                                    </Field>
                                    <Field label="Valor calculado">
                                        <div className="px-3 py-2 rounded-lg border text-sm font-semibold" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F0FDF4', color: '#059669' }}>
                                            {formAbast.valor_arla
                                                ? Number(formAbast.valor_arla).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                : 'R$ 0,00'}
                                        </div>
                                    </Field>
                                </div>
                            </div>
                            <div className="sm:col-span-2 p-2 rounded-lg text-sm font-bold flex items-center justify-between" style={{ backgroundColor: '#7C3AED', color: 'white' }}>
                                <span>Total do abastecimento:</span>
                                <span>{(Number(formAbast.valor_diesel || 0) + Number(formAbast.valor_arla || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="sm:col-span-2">
                                <Field label="Observações">
                                    <textarea value={formAbast.observacoes} onChange={e => setFormAbast(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                                </Field>
                            </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 p-5 border-t flex-shrink-0 sm:justify-end" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => { setModalAbast(false); setEditingAbastId(null); }} disabled={savingAbast} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center disabled:opacity-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleAbast} disabled={savingAbast} loading={savingAbast} size="sm" iconName="Check" className="w-full sm:w-auto">{savingAbast ? 'Salvando...' : (editingAbastId ? 'Salvar alterações' : 'Salvar')}</Button>
                        </div>
                    </div>
                </div>
    );
}
