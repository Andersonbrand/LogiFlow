import React from 'react';

import { Button, ModalHeader } from 'components';

import SearchSelect from '../SearchSelect';
import { inputCls, inputStyle } from '../../utils/constants';
import ModalOverlay from '../ModalOverlay';

function Field({ label, children, required }) {
    return (
        <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

// ─── modal ───
export default function Modal({ form, itensDisponiveis, modal, motoristas, placasSugeridas, salvar, saving, setForm, setModal }) {
    return (
        <ModalOverlay onClose={() => setModal(null)} sm>
                    <ModalHeader title={modal.mode === 'create' ? 'Nova Entrega' : 'Editar Entrega'} icon="Package" onClose={() => setModal(null)} />
                    <div className="p-5 overflow-y-auto flex-1 space-y-4">
                        <Field label="Motorista" required>
                            <SearchSelect
                                value={form.motorista_id}
                                onChange={v => setForm(f => ({ ...f, motorista_id: v }))}
                                options={motoristas.map(m => ({ value: m.id, label: m.name }))}
                                placeholder="Selecione o motorista..."
                                emptyLabel="Nenhum motorista encontrado"
                            />
                        </Field>
                        <Field label="Placa" required>
                            <SearchSelect
                                value={form.placa}
                                onChange={v => setForm(f => ({ ...f, placa: v.toUpperCase() }))}
                                options={placasSugeridas.map(p => ({ value: p, label: p }))}
                                placeholder="Ex: ABC1D23"
                                freeText
                                emptyLabel="Nenhuma placa cadastrada com esse texto — pode digitar mesmo assim"
                            />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Item" required>
                                <SearchSelect
                                    value={form.item}
                                    onChange={v => setForm(f => ({ ...f, item: v }))}
                                    options={itensDisponiveis.map(i => ({ value: i, label: i }))}
                                    placeholder="Selecione o item..."
                                    emptyLabel="Nenhum item encontrado — gerencie em “Gerenciar itens”"
                                />
                            </Field>
                            <Field label="Quantidade" required>
                                <input type="number" min="1" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                        </div>
                        <Field label="Data da entrega" required>
                            <input type="date" value={form.data_entrega} onChange={e => setForm(f => ({ ...f, data_entrega: e.target.value }))} className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Observações">
                            <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                        </Field>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={salvar} size="sm" iconName={saving ? 'Loader' : 'Check'} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
                    </div>
                </ModalOverlay>
    );
}
