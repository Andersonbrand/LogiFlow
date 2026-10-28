import React from 'react';

import { PrettySelect, Button, Field, ModalHeader, ModalOverlay } from 'components';

import { inputCls, inputStyle } from '../../../../utils/constants';
import { BRL } from '../../../../utils/helpers';

// ─── modal ───
export default function Modal({ form, handleSubmit, modal, motoristas, previewTotal, setForm, setModal, veiculos }) {
    return (
        <ModalOverlay onClose={() => setModal(null)}>
                    <ModalHeader title={modal.mode === 'create' ? 'Nova Diária' : 'Editar Diária'} icon="CalendarDays" onClose={() => setModal(null)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                        <Field label="Motorista" required>
                            <PrettySelect value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </PrettySelect>
                        </Field>
                        {/* item 2: select de placa — apenas placas das carretas (frota própria), sem vínculo, somente registro */}
                        <Field label="Placa do veículo">
                            <PrettySelect value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Sem placa...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </PrettySelect>
                        </Field>
                        {/* item 10: para carretas não é necessário vincular viagem */}
                        <div className="flex items-end">
                            <div className="w-full p-3 rounded-lg text-xs" style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                                <p className="text-indigo-700 font-medium">ℹ️ Módulo Carretas</p>
                                <p className="text-indigo-600 mt-0.5">Diárias deste módulo não precisam vínculo de viagem.</p>
                            </div>
                        </div>
                        <Field label="Data de início" required>
                            <input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Quantidade de dias" required>
                            <input type="number" step="0.5" min="0.5" value={form.quantidade_dias} onChange={e => setForm(f => ({ ...f, quantidade_dias: e.target.value }))} className={inputCls} style={inputStyle} placeholder="1" />
                        </Field>
                        <Field label="Valor por dia (R$)" required>
                            <input type="number" step="0.01" min="0" value={form.valor_dia} onChange={e => setForm(f => ({ ...f, valor_dia: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                        </Field>
                        <div className="flex items-end pb-0.5">
                            {previewTotal > 0 && (
                                <div className="w-full p-3 rounded-lg text-center" style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                                    <p className="text-xs text-indigo-600 font-medium mb-0.5">Total calculado</p>
                                    <p className="text-xl font-bold font-data text-indigo-700">{BRL(previewTotal)}</p>
                                </div>
                            )}
                        </div>
                        <div className="sm:col-span-2">
                            <Field label="Descrição / motivo">
                                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Viagem a Bom Jesus da Lapa — 2 diárias" />
                            </Field>
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
    );
}
