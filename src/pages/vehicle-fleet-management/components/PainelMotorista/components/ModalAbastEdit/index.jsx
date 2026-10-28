import React from 'react';

import { AppIcon as Icon, PrettySelect, Field } from 'components';

import { inputStyle } from '../../../../utils/constants';
import { inputCls } from '../../utils/constants';

// ─── modalAbastEdit ───
export default function ModalAbastEdit({ configAbast, formAbastEdit, getPrecoAbast, handleLitrosAbast, handlePostoAbastChange, handleSaveAbastecimento, modalAbastEdit, postos, savingAbastEdit, setFormAbastEdit, setModalAbastEdit, veiculosCaminhao }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50"><Icon name="Fuel" size={18} color="#1D4ED8" /></div>
                                <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
                                    {modalAbastEdit.id ? 'Editar Abastecimento' : 'Novo Abastecimento'}
                                </h3>
                            </div>
                            <button onClick={() => setModalAbastEdit(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-4">
                            <Field label="Data" required>
                                <input type="date" value={formAbastEdit.data_abastecimento} onChange={e => setFormAbastEdit(f => ({ ...f, data_abastecimento: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Placa do veículo">
                                <PrettySelect value={formAbastEdit.veiculo_caminhao_id} onChange={e => setFormAbastEdit(f => ({ ...f, veiculo_caminhao_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Sem placa...</option>
                                    {veiculosCaminhao.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                                </PrettySelect>
                            </Field>
                            <Field label="N° do Cupom Fiscal" required>
                                <input value={formAbastEdit.cupom_fiscal} onChange={e => setFormAbastEdit(f => ({ ...f, cupom_fiscal: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 000123456" maxLength={50} />
                            </Field>
                            <div className="col-span-2">
                                <Field label="Posto" required>
                                    <PrettySelect value={formAbastEdit.posto_id} onChange={e => handlePostoAbastChange(e.target.value)} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione o posto...</option>
                                        {postos.map(p => <option key={p.id} value={p.id}>{p.nome}{p.cidade ? ` — ${p.cidade}` : ''}</option>)}
                                    </PrettySelect>
                                    <div className="flex gap-3 mt-1 text-xs">
                                        {getPrecoAbast(formAbastEdit.posto_id, 'diesel') > 0 && (
                                            <span className="text-blue-600 font-medium">
                                                🛢️ R${getPrecoAbast(formAbastEdit.posto_id, 'diesel').toFixed(3)}/L
                                                {!postos.find(p => p.id === formAbastEdit.posto_id)?.preco_diesel && configAbast?.preco_diesel > 0 && (
                                                    <span className="text-gray-400 ml-1">(padrão)</span>
                                                )}
                                            </span>
                                        )}
                                        {getPrecoAbast(formAbastEdit.posto_id, 'arla') > 0 && (
                                            <span className="text-emerald-600 font-medium">
                                                💧 R${getPrecoAbast(formAbastEdit.posto_id, 'arla').toFixed(3)}/L
                                                {!postos.find(p => p.id === formAbastEdit.posto_id)?.preco_arla && configAbast?.preco_arla > 0 && (
                                                    <span className="text-gray-400 ml-1">(padrão)</span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </Field>
                            </div>
                            <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-blue-700">🛢️ Diesel</p>
                                    {getPrecoAbast(formAbastEdit.posto_id, 'diesel') > 0 && (
                                        <span className="text-xs text-blue-600">R$ {getPrecoAbast(formAbastEdit.posto_id, 'diesel').toFixed(3)}/L</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros">
                                        <input type="number" step="0.1" min="0" value={formAbastEdit.litros_diesel} onChange={e => handleLitrosAbast('litros_diesel', e.target.value)} className={inputCls} style={inputStyle} placeholder="0" />
                                    </Field>
                                    <Field label="Valor calculado">
                                        <div className="px-3 py-2 rounded-lg border text-sm font-semibold" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F0F9FF', color: '#1D4ED8' }}>
                                            {formAbastEdit.valor_diesel
                                                ? Number(formAbastEdit.valor_diesel).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                : 'R$ 0,00'}
                                        </div>
                                    </Field>
                                </div>
                            </div>
                            <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-emerald-700">💧 ARLA 32</p>
                                    {getPrecoAbast(formAbastEdit.posto_id, 'arla') > 0 && (
                                        <span className="text-xs text-emerald-600">R$ {getPrecoAbast(formAbastEdit.posto_id, 'arla').toFixed(3)}/L</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros">
                                        <input type="number" step="0.1" min="0" value={formAbastEdit.litros_arla} onChange={e => handleLitrosAbast('litros_arla', e.target.value)} className={inputCls} style={inputStyle} placeholder="0" />
                                    </Field>
                                    <Field label="Valor calculado">
                                        <div className="px-3 py-2 rounded-lg border text-sm font-semibold" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F0FDF4', color: '#059669' }}>
                                            {formAbastEdit.valor_arla
                                                ? Number(formAbastEdit.valor_arla).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                : 'R$ 0,00'}
                                        </div>
                                    </Field>
                                </div>
                            </div>
                            <div className="sm:col-span-2 p-2 rounded-lg text-sm font-bold flex items-center justify-between" style={{ backgroundColor: '#7C3AED', color: 'white' }}>
                                <span>Total do abastecimento:</span>
                                <span>{(Number(formAbastEdit.valor_diesel || 0) + Number(formAbastEdit.valor_arla || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>
                        <div className="flex gap-3 p-5 pt-0 justify-end">
                            <button onClick={() => setModalAbastEdit(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleSaveAbastecimento} disabled={savingAbastEdit} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-primary)' }}>
                                <Icon name="Check" size={14} color="white" /> {savingAbastEdit ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
    );
}
