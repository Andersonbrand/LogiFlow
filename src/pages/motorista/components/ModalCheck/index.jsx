import React from 'react';

import { AppIcon as Icon, PrettySelect, MultiFotoField, ChecklistItemsField, Field, Button } from 'components';

import { inputCls, inputStyle } from '../../utils/constants';

// ─── modalCheck ───
export default function ModalCheck({ checklistItens, editingCheckId, formCheck, handleCheck, progressoFotosCheck, savingCheck, setEditingCheckId, setFormCheck, setModalCheck, showToast, veiculos }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
                   >
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-xl sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '95dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        {/* Header fixo no topo */}
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
                                    <Icon name="ClipboardCheck" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{editingCheckId ? 'Editar Checklist' : 'Checklist Semanal'}</h2>
                            </div>
                            <button onClick={() => { setModalCheck(false); setEditingCheckId(null); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            <Field label="Veículo" required>
                                <PrettySelect value={formCheck.veiculo_caminhao_id} onChange={e => setFormCheck(f => ({ ...f, veiculo_caminhao_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </PrettySelect>
                            </Field>
                            <Field label="Odômetro (km)" required>
                                <input type="number" inputMode="decimal" min="0" value={formCheck.odometro}
                                    onChange={e => setFormCheck(f => ({ ...f, odometro: e.target.value }))}
                                    placeholder="Ex: 152340" className={inputCls} style={inputStyle} />
                            </Field>

                            {/* Fotos — logo no topo, destaque visual, antes dos campos de texto */}
                            <div className="rounded-xl border-2 border-dashed p-4"
                                style={{ borderColor: formCheck.fotos_urls.length ? '#059669' : '#93C5FD', backgroundColor: formCheck.fotos_urls.length ? '#F0FDF4' : '#EFF6FF' }}>
                                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"
                                    style={{ color: formCheck.fotos_urls.length ? '#065F46' : '#1D4ED8' }}>
                                    <Icon name="Camera" size={14} color={formCheck.fotos_urls.length ? '#059669' : '#1D4ED8'} />
                                    {formCheck.fotos_urls.length ? `✅ ${formCheck.fotos_urls.length} foto(s) anexada(s)` : '📷 Fotos do problema (opcional)'}
                                </p>
                                <MultiFotoField fotos={formCheck.fotos_urls} onChange={fotos_urls => setFormCheck(f => ({ ...f, fotos_urls }))} showToast={showToast} max={8} />
                            </div>

                            <div>
                                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Itens verificados</p>
                                <ChecklistItemsField itens={checklistItens} value={formCheck.itens} onChange={itens => setFormCheck(f => ({ ...f, itens }))} />
                            </div>
                            <Field label="Problemas identificados">
                                <textarea value={formCheck.problemas} onChange={e => setFormCheck(f => ({ ...f, problemas: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Descreva problemas..." />
                            </Field>
                            <Field label="Necessidades / peças">
                                <textarea value={formCheck.necessidades} onChange={e => setFormCheck(f => ({ ...f, necessidades: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Pneus, peças, etc..." />
                            </Field>
                            <Field label="Observações livres">
                                <textarea value={formCheck.observacoes_livres} onChange={e => setFormCheck(f => ({ ...f, observacoes_livres: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                            </Field>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 p-5 border-t flex-shrink-0 sm:justify-end" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => { setModalCheck(false); setEditingCheckId(null); }} disabled={savingCheck} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center disabled:opacity-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleCheck} disabled={savingCheck} loading={savingCheck} size="sm" iconName={editingCheckId ? 'Check' : 'Send'} className="w-full sm:w-auto">{savingCheck ? (progressoFotosCheck ? `Foto ${progressoFotosCheck.atual}/${progressoFotosCheck.total}...` : 'Enviando...') : (editingCheckId ? 'Salvar alterações' : 'Enviar')}</Button>
                        </div>
                    </div>
                </div>
    );
}
