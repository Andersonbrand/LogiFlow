import React from 'react';

import { AppIcon as Icon, PrettySelect, Button, Field } from 'components';

import { inputCls, inputStyle } from '../../utils/constants';

// ─── modalAbast ───
export default function ModalAbast({ editandoAbastId, formAbast, getPrecoCarreteiro, handleAbast, handleLitrosCarreteiro, handlePostoChangeCarreteiro, postos, salvandoAbast, setEditandoAbastId, setFormAbast, setModalAbast, veiculosProprios }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
                   >
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-xl sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="Fuel" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{editandoAbastId ? 'Editar Abastecimento' : 'Registrar Abastecimento'}</h2>
                            </div>
                            <button onClick={() => setModalAbast(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                            <Field label="Veículo" required>
                                <PrettySelect value={formAbast.veiculo_id} onChange={e => setFormAbast(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculosProprios.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </PrettySelect>
                            </Field>
                            <Field label="Data" required><input type="date" value={formAbast.data_abastecimento} onChange={e => setFormAbast(f => ({ ...f, data_abastecimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                            <Field label="Horário"><input type="time" value={formAbast.horario} onChange={e => setFormAbast(f => ({ ...f, horario: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
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
                                <PrettySelect value={formAbast.posto_id} onChange={e => handlePostoChangeCarreteiro(e.target.value)} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione o posto...</option>
                                    {postos.map(p => (
                                        <option key={p.id} value={p.id}>{p.nome}{p.cidade ? ` — ${p.cidade}` : ''}</option>
                                    ))}
                                </PrettySelect>
                                {/* Preços efetivos do posto selecionado (ou padrão) */}
                                {(getPrecoCarreteiro(formAbast.posto_id, 'diesel') > 0 || getPrecoCarreteiro(formAbast.posto_id, 'arla') > 0) && (
                                    <div className="flex gap-3 mt-1 text-xs">
                                        {getPrecoCarreteiro(formAbast.posto_id, 'diesel') > 0 && (
                                            <span className="text-blue-600 font-medium">🛢️ R${getPrecoCarreteiro(formAbast.posto_id, 'diesel').toFixed(3)}/L</span>
                                        )}
                                        {getPrecoCarreteiro(formAbast.posto_id, 'arla') > 0 && (
                                            <span className="text-emerald-600 font-medium">💧 R${getPrecoCarreteiro(formAbast.posto_id, 'arla').toFixed(3)}/L</span>
                                        )}
                                    </div>
                                )}
                            </Field>
                            <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-blue-700">🛢️ Diesel</p>
                                    {getPrecoCarreteiro(formAbast.posto_id, 'diesel') > 0 && (
                                        <span className="text-xs text-blue-600">R$ {getPrecoCarreteiro(formAbast.posto_id, 'diesel').toFixed(3)}/L</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros"><input type="number" step="0.01" value={formAbast.litros_diesel} onChange={e => handleLitrosCarreteiro('litros_diesel', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
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
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-emerald-700">💧 ARLA 32</p>
                                    {getPrecoCarreteiro(formAbast.posto_id, 'arla') > 0 && (
                                        <span className="text-xs text-emerald-600">R$ {getPrecoCarreteiro(formAbast.posto_id, 'arla').toFixed(3)}/L</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros"><input type="number" step="0.01" value={formAbast.litros_arla} onChange={e => handleLitrosCarreteiro('litros_arla', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
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
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 p-5 border-t flex-shrink-0 sm:justify-end" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => { setModalAbast(false); setEditandoAbastId(null); }} disabled={salvandoAbast} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center disabled:opacity-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleAbast} disabled={salvandoAbast} loading={salvandoAbast} size="sm" iconName="Check" className="w-full sm:w-auto">{editandoAbastId ? 'Salvar' : 'Registrar'}</Button>
                        </div>
                    </div>
                </div>
    );
}
