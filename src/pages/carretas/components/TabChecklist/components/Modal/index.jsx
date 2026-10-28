import React from 'react';

import { PrettySelect, ChecklistItemsField, MultiFotoField, Button, Field, ModalHeader, ModalOverlay } from 'components';

import { inputCls, inputStyle } from '../../../../utils/constants';

// ─── modal ───
export default function Modal({ caminhoes, checklistItens, form, handleSubmit, modal, setForm, setModal, showToast, veiculos }) {
    return (
        <ModalOverlay onClose={() => setModal(null)}>
                    <ModalHeader title={modal.mode === 'edit' ? 'Editar Checklist' : 'Checklist Semanal'} icon="ClipboardCheck" onClose={() => setModal(null)} />
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
                        <Field label="Veículo" required>
                            <PrettySelect value={form.veiculo_id ? `cv:${form.veiculo_id}` : form.veiculo_caminhao_id ? `vh:${form.veiculo_caminhao_id}` : ''}
                                onChange={e => {
                                    const val = e.target.value;
                                    if (!val) { setForm(f => ({ ...f, veiculo_id: '', veiculo_caminhao_id: '' })); return; }
                                    const [tipo, id] = val.split(':');
                                    setForm(f => tipo === 'cv'
                                        ? { ...f, veiculo_id: id, veiculo_caminhao_id: '' }
                                        : { ...f, veiculo_id: '', veiculo_caminhao_id: id });
                                }}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {veiculos.length > 0 && (
                                    <optgroup label="Frota Carretas">
                                        {veiculos.map(v => <option key={`cv:${v.id}`} value={`cv:${v.id}`}>{v.placa} — {v.modelo}</option>)}
                                    </optgroup>
                                )}
                                {caminhoes.length > 0 && (
                                    <optgroup label="Caminhões (Veículos)">
                                        {caminhoes.map(v => <option key={`vh:${v.id}`} value={`vh:${v.id}`}>{v.placa} — {v.modelo}</option>)}
                                    </optgroup>
                                )}
                            </PrettySelect>
                        </Field>
                        <Field label="Odômetro (km)" required>
                            <input type="number" inputMode="decimal" min="0" value={form.odometro}
                                onChange={e => setForm(f => ({ ...f, odometro: e.target.value }))}
                                placeholder="Ex: 152340" className={inputCls} style={inputStyle} />
                        </Field>
                        <div>
                            <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>Itens verificados</p>
                            <ChecklistItemsField itens={checklistItens} value={form.itens} onChange={itens => setForm(f => ({ ...f, itens }))} />
                        </div>
                        <Field label="Problemas identificados"><textarea value={form.problemas} onChange={e => setForm(f => ({ ...f, problemas: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Descreva problemas encontrados..." /></Field>
                        <Field label="Necessidades / peças">
                            <textarea value={form.necessidades} onChange={e => setForm(f => ({ ...f, necessidades: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Pneus, cintas, etc..." />
                        </Field>
                        <MultiFotoField fotos={form.fotos_urls} onChange={fotos_urls => setForm(f => ({ ...f, fotos_urls }))} showToast={showToast} />
                        <Field label="Observações livres"><textarea value={form.observacoes_livres} onChange={e => setForm(f => ({ ...f, observacoes_livres: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName={modal.mode === 'edit' ? 'Check' : 'Send'}>{modal.mode === 'edit' ? 'Salvar Alterações' : 'Enviar Checklist'}</Button>
                    </div>
                </ModalOverlay>
    );
}
