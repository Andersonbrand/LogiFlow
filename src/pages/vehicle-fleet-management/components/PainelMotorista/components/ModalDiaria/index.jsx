import React from 'react';

import { AppIcon as Icon, PrettySelect, Field } from 'components';

import { inputStyle } from '../../../../utils/constants';
import { inputCls } from '../../utils/constants';
import { BRL } from '../../utils/helpers';

// ─── modalDiaria ───
export default function ModalDiaria({ formDiaria, handleSaveDiaria, modalDiaria, previewDiaria, setFormDiaria, setModalDiaria, veiculosCaminhao }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-50"><Icon name="CalendarDays" size={18} color="#4F46E5" /></div>
                                <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
                                    {modalDiaria.mode === 'create' ? 'Nova Diária' : 'Editar Diária'}
                                </h3>
                            </div>
                            <button onClick={() => setModalDiaria(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-4">
                            <Field label="Data de início" required>
                                <input type="date" value={formDiaria.data_inicio} onChange={e => setFormDiaria(f => ({ ...f, data_inicio: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Quantidade de dias" required>
                                <input type="number" step="0.5" min="0.5" value={formDiaria.quantidade_dias} onChange={e => setFormDiaria(f => ({ ...f, quantidade_dias: e.target.value }))} className={inputCls} style={inputStyle} placeholder="1" />
                            </Field>
                            <Field label="Valor por dia (R$)" required>
                                <input type="number" step="0.01" min="0" value={formDiaria.valor_dia} onChange={e => setFormDiaria(f => ({ ...f, valor_dia: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                            </Field>
                            {previewDiaria > 0 && (
                                <div className="flex flex-col justify-center p-3 rounded-xl text-center" style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                                    <p className="text-xs text-indigo-600 font-medium">Total</p>
                                    <p className="text-xl font-bold font-data text-indigo-700">{BRL(previewDiaria)}</p>
                                </div>
                            )}
                            <div className="col-span-2">
                                <Field label="Placa do veículo">
                                    <PrettySelect value={formDiaria.placa} onChange={e => setFormDiaria(f => ({ ...f, placa: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Sem placa...</option>
                                        {veiculosCaminhao.map(v => <option key={v.id} value={v.placa}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
                                    </PrettySelect>
                                </Field>
                            </div>
                            <div className="col-span-2">
                                <Field label="Descrição / motivo">
                                    <input value={formDiaria.descricao} onChange={e => setFormDiaria(f => ({ ...f, descricao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Viagem a Ibotirama — 2 diárias" />
                                </Field>
                            </div>
                        </div>
                        <div className="flex gap-3 p-5 pt-0 justify-end">
                            <button onClick={() => setModalDiaria(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleSaveDiaria} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                                <Icon name="Check" size={14} color="white" /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
    );
}
