import React from 'react';

import { PrettySelect, Button, Field, ModalHeader, ModalOverlay } from 'components';

import { inputCls, inputStyle } from '../../../../utils/constants';

// ─── modal ───
export default function Modal({ editingId, form, handleLitrosChange, handlePostoChange, handleSubmit, isAdmin, motoristas, postos, setEditingId, setForm, setModal, veiculos }) {
    return (
        <ModalOverlay onClose={() => { setModal(false); setEditingId(null); }}>
                    <ModalHeader title={editingId ? 'Editar Abastecimento' : 'Registrar Abastecimento'} icon="Fuel" onClose={() => { setModal(false); setEditingId(null); }} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                        {isAdmin && (
                            <Field label="Motorista" required>
                                <PrettySelect value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </PrettySelect>
                            </Field>
                        )}
                        <Field label="Veículo" required>
                            <PrettySelect value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Data" required><input type="date" value={form.data_abastecimento} onChange={e => setForm(f => ({ ...f, data_abastecimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="Horário"><input type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="N° do Cupom Fiscal" required>
                            <input
                                type="text"
                                value={form.cupom_fiscal}
                                onChange={e => setForm(f => ({ ...f, cupom_fiscal: e.target.value }))}
                                className={inputCls}
                                style={inputStyle}
                                placeholder="Ex: 000123456"
                                maxLength={50}
                            />
                        </Field>
                        <Field label="Posto" required>
                            <PrettySelect value={form.posto_id} onChange={e => handlePostoChange(e.target.value)} className={inputCls} style={inputStyle}>
                                <option value="">Selecione o posto...</option>
                                {postos.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.nome}{p.cidade ? ` — ${p.cidade}` : ''}
                                        {p.preco_diesel ? ` · D: R$${Number(p.preco_diesel).toFixed(3)}` : ''}
                                        {p.preco_arla ? ` · A: R$${Number(p.preco_arla).toFixed(3)}` : ''}
                                    </option>
                                ))}
                            </PrettySelect>
                            {postos.length === 0 && <p className="text-xs text-amber-600 mt-1">Nenhum posto cadastrado. Peça ao admin para cadastrar.</p>}
                            {/* Exibe preços do posto selecionado */}
                            {form.posto_id && postos.find(p => p.id === form.posto_id) && (() => {
                                const p = postos.find(px => px.id === form.posto_id);
                                return (p.preco_diesel || p.preco_arla) ? (
                                    <div className="flex gap-3 mt-1.5 text-xs">
                                        {p.preco_diesel && <span className="text-blue-600 font-medium">🛢️ Diesel: R$ {Number(p.preco_diesel).toFixed(3)}/L</span>}
                                        {p.preco_arla && <span className="text-emerald-600 font-medium">💧 Arla: R$ {Number(p.preco_arla).toFixed(3)}/L</span>}
                                    </div>
                                ) : null;
                            })()}
                        </Field>
                        <div />
                        <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                            <p className="text-xs font-semibold text-blue-700 mb-3">🛢️ Diesel</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Litros diesel">
                                    <input type="number" step="0.01" value={form.litros_diesel}
                                        onChange={e => handleLitrosChange('litros_diesel', e.target.value)}
                                        className={inputCls} style={inputStyle} placeholder="0,00" />
                                </Field>
                                <Field label="Valor R$">
                                    <input type="number" step="0.01" value={form.valor_diesel}
                                        onChange={e => setForm(f => ({ ...f, valor_diesel: e.target.value }))}
                                        className={inputCls} style={inputStyle} placeholder="0,00" />
                                </Field>
                            </div>
                        </div>
                        <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                            <p className="text-xs font-semibold text-emerald-700 mb-3">💧 ARLA 32</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Litros arla">
                                    <input type="number" step="0.01" value={form.litros_arla}
                                        onChange={e => handleLitrosChange('litros_arla', e.target.value)}
                                        className={inputCls} style={inputStyle} placeholder="0,00" />
                                </Field>
                                <Field label="Valor R$">
                                    <input type="number" step="0.01" value={form.valor_arla}
                                        onChange={e => setForm(f => ({ ...f, valor_arla: e.target.value }))}
                                        className={inputCls} style={inputStyle} placeholder="0,00" />
                                </Field>
                            </div>
                        </div>
                        <div className="sm:col-span-2">
                            <Field label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
    );
}
