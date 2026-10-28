import React from 'react';

import { AppIcon as Icon, PrettySelect, Button } from 'components';

// ─── editModal ───
export default function EditModal({ destinosParaTipo, formEdit, handleSave, inputCls, inputStyle, saving, setEditModal, setFormEdit, setGerenciarLocaisModal, veiculosRef }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-2">
                                <Icon name="Navigation2" size={18} color="var(--color-primary)" />
                                <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Editar Ponto de Parada</h3>
                            </div>
                            <button onClick={() => setEditModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <Icon name="X" size={16} color="var(--color-muted-foreground)" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 flex items-center justify-end -mt-1">
                                    <button type="button" onClick={() => setGerenciarLocaisModal(true)} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                                        <Icon name="Settings" size={12} color="var(--color-primary)" />Gerenciar locais de Fábrica/Outro
                                    </button>
                                </div>
                                <div className="col-span-2 flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Veículo / Placa <span className="text-red-500">*</span></label>
                                    <PrettySelect value={formEdit.veiculo_id} onChange={e => setFormEdit(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione...</option>
                                        {veiculosRef.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                    </PrettySelect>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Cupom Fiscal / NF</label>
                                    <input value={formEdit.cupom_fiscal} onChange={e => setFormEdit(f => ({ ...f, cupom_fiscal: e.target.value }))} className={inputCls} style={inputStyle} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Observações</label>
                                    <input value={formEdit.observacoes} onChange={e => setFormEdit(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} />
                                </div>
                            </div>

                            {/* Bloco SAÍDA — de onde saiu */}
                            <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#1D4ED8' }}>
                                    <Icon name="LogOut" size={14} color="#1D4ED8" />SAÍDA
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Tipo</label>
                                        <PrettySelect value={formEdit.tipo_local} onChange={e => setFormEdit(f => ({ ...f, tipo_local: e.target.value, local: '' }))} className={inputCls} style={inputStyle}>
                                            {['Empresa','Fábrica','Entrega','Posto','Outro'].map(t => <option key={t}>{t}</option>)}
                                        </PrettySelect>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Destino / Local</label>
                                        <PrettySelect value={formEdit.local} onChange={e => setFormEdit(f => ({ ...f, local: e.target.value }))} className={inputCls} style={inputStyle}>
                                            <option value="">Selecione...</option>
                                            {formEdit.local && !destinosParaTipo(formEdit.tipo_local).includes(formEdit.local) && (
                                                <option value={formEdit.local}>{formEdit.local} (atual)</option>
                                            )}
                                            {destinosParaTipo(formEdit.tipo_local).map(nome => <option key={nome} value={nome}>{nome}</option>)}
                                        </PrettySelect>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Data Saída</label>
                                        <input type="date" value={formEdit.data_saida} onChange={e => setFormEdit(f => ({ ...f, data_saida: e.target.value }))} className={inputCls} style={inputStyle} />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Horário Saída</label>
                                        <input type="time" value={formEdit.horario_saida} onChange={e => setFormEdit(f => ({ ...f, horario_saida: e.target.value }))} className={inputCls} style={inputStyle} />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>KM Saída</label>
                                        <input type="number" value={formEdit.km_saida} onChange={e => setFormEdit(f => ({ ...f, km_saida: e.target.value }))} className={inputCls} style={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            {/* Bloco CHEGADA — para onde foi */}
                            <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                                <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#065F46' }}>
                                    <Icon name="LogIn" size={14} color="#065F46" />CHEGADA
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Tipo</label>
                                        <PrettySelect value={formEdit.tipo_local_chegada} onChange={e => setFormEdit(f => ({ ...f, tipo_local_chegada: e.target.value, local_chegada: '' }))} className={inputCls} style={inputStyle}>
                                            {['Empresa','Fábrica','Entrega','Posto','Outro'].map(t => <option key={t}>{t}</option>)}
                                        </PrettySelect>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Destino / Local</label>
                                        <PrettySelect value={formEdit.local_chegada} onChange={e => setFormEdit(f => ({ ...f, local_chegada: e.target.value }))} className={inputCls} style={inputStyle}>
                                            <option value="">Selecione...</option>
                                            {formEdit.local_chegada && !destinosParaTipo(formEdit.tipo_local_chegada).includes(formEdit.local_chegada) && (
                                                <option value={formEdit.local_chegada}>{formEdit.local_chegada} (atual)</option>
                                            )}
                                            {destinosParaTipo(formEdit.tipo_local_chegada).map(nome => <option key={nome} value={nome}>{nome}</option>)}
                                        </PrettySelect>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Data Chegada</label>
                                        <input type="date" value={formEdit.data_chegada} onChange={e => setFormEdit(f => ({ ...f, data_chegada: e.target.value }))} className={inputCls} style={inputStyle} />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Horário Chegada</label>
                                        <input type="time" value={formEdit.horario_chegada} onChange={e => setFormEdit(f => ({ ...f, horario_chegada: e.target.value }))} className={inputCls} style={inputStyle} />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>KM Chegada</label>
                                        <input type="number" value={formEdit.km_chegada} onChange={e => setFormEdit(f => ({ ...f, km_chegada: e.target.value }))} className={inputCls} style={inputStyle} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setEditModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                Cancelar
                            </button>
                            <Button onClick={handleSave} size="sm" iconName="Check" disabled={saving}>
                                {saving ? 'Salvando...' : 'Salvar'}
                            </Button>
                        </div>
                    </div>
                </div>
    );
}
