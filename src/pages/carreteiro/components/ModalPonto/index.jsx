import React from 'react';

import { AppIcon as Icon, PrettySelect, Button, Field } from 'components';
import { updatePontoParada, createPontoParada } from 'services/carretas';

import { inputCls, inputStyle } from '../../utils/constants';

// ─── modalPonto ───
export default function ModalPonto({ confirm, destinosParaTipo, editandoPontoId, formPonto, load, setEditandoPontoId, setFormPonto, setModalPonto, showToast, user, veiculosProprios }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
                   >
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '94dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="MapPin" size={18} color="#1D4ED8" />
                                </div>
                                <div>
                                    <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                                        {editandoPontoId ? 'Editar Ponto de Parada' : 'Novo Ponto de Parada'}
                                    </h2>
                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Registre saída e chegada no local</p>
                                </div>
                            </div>
                            <button onClick={() => { setModalPonto(false); setEditandoPontoId(null); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            <Field label="Cupom Fiscal / NF">
                                <input
                                    value={formPonto.cupom_fiscal}
                                    onChange={e => setFormPonto(f => ({ ...f, cupom_fiscal: e.target.value }))}
                                    className={inputCls} style={inputStyle}
                                    placeholder="Nº do cupom fiscal / nota (opcional)"
                                />
                            </Field>

                            <Field label="Veículo" required>
                                <PrettySelect value={formPonto.veiculo_id}
                                    onChange={e => setFormPonto(f => ({ ...f, veiculo_id: e.target.value }))}
                                    className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculosProprios.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </PrettySelect>
                            </Field>

                            {/* Bloco SAÍDA — de onde o motorista está saindo */}
                            <div className="p-4 rounded-xl border space-y-3"
                                style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#1D4ED8' }}>
                                    <Icon name="LogOut" size={14} color="#1D4ED8" />SAÍDA
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Tipo de Local">
                                        <PrettySelect value={formPonto.tipo_local}
                                            onChange={e => setFormPonto(f => ({ ...f, tipo_local: e.target.value, local: '' }))}
                                            className={inputCls} style={inputStyle}>
                                            {['Empresa','Fábrica','Entrega','Posto','Outro'].map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </PrettySelect>
                                    </Field>
                                    <Field label="Destino / Local" required>
                                        <PrettySelect
                                            value={formPonto.local}
                                            onChange={e => setFormPonto(f => ({ ...f, local: e.target.value }))}
                                            className={inputCls} style={inputStyle}>
                                            <option value="">Selecione...</option>
                                            {destinosParaTipo(formPonto.tipo_local).map(nome => (
                                                <option key={nome} value={nome}>{nome}</option>
                                            ))}
                                        </PrettySelect>
                                    </Field>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <Field label="Data" required>
                                        <input type="date" value={formPonto.data_saida}
                                            onChange={e => setFormPonto(f => ({ ...f, data_saida: e.target.value }))}
                                            className={inputCls} style={inputStyle} />
                                    </Field>
                                    <Field label="Horário">
                                        <input type="time" value={formPonto.horario_saida}
                                            onChange={e => setFormPonto(f => ({ ...f, horario_saida: e.target.value }))}
                                            className={inputCls} style={inputStyle} />
                                    </Field>
                                    <Field label="KM Saída">
                                        <input type="number" value={formPonto.km_saida}
                                            onChange={e => setFormPonto(f => ({ ...f, km_saida: e.target.value }))}
                                            className={inputCls} style={inputStyle} placeholder="Ex: 641300" />
                                    </Field>
                                </div>
                            </div>

                            {/* Bloco CHEGADA — para onde o motorista está indo */}
                            <div className="p-4 rounded-xl border space-y-3"
                                style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                                <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#065F46' }}>
                                    <Icon name="LogIn" size={14} color="#065F46" />CHEGADA
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Tipo de Local">
                                        <PrettySelect value={formPonto.tipo_local_chegada}
                                            onChange={e => setFormPonto(f => ({ ...f, tipo_local_chegada: e.target.value, local_chegada: '' }))}
                                            className={inputCls} style={inputStyle}>
                                            {['Empresa','Fábrica','Entrega','Posto','Outro'].map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </PrettySelect>
                                    </Field>
                                    <Field label="Destino / Local">
                                        <PrettySelect
                                            value={formPonto.local_chegada}
                                            onChange={e => setFormPonto(f => ({ ...f, local_chegada: e.target.value }))}
                                            className={inputCls} style={inputStyle}>
                                            <option value="">Selecione...</option>
                                            {destinosParaTipo(formPonto.tipo_local_chegada).map(nome => (
                                                <option key={nome} value={nome}>{nome}</option>
                                            ))}
                                        </PrettySelect>
                                    </Field>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <Field label="Data">
                                        <input type="date" value={formPonto.data_chegada}
                                            onChange={e => setFormPonto(f => ({ ...f, data_chegada: e.target.value }))}
                                            className={inputCls} style={inputStyle} />
                                    </Field>
                                    <Field label="Horário">
                                        <input type="time" value={formPonto.horario_chegada}
                                            onChange={e => setFormPonto(f => ({ ...f, horario_chegada: e.target.value }))}
                                            className={inputCls} style={inputStyle} />
                                    </Field>
                                    <Field label="KM Chegada">
                                        <input type="number" value={formPonto.km_chegada}
                                            onChange={e => setFormPonto(f => ({ ...f, km_chegada: e.target.value }))}
                                            className={inputCls} style={inputStyle} placeholder="Ex: 642600" />
                                    </Field>
                                </div>
                            </div>

                            {/* Horários extras (saídas/chegadas adicionais no mesmo dia) */}
                            {formPonto.horarios_extras && formPonto.horarios_extras.length > 0 && formPonto.horarios_extras.map((extra, idx) => (
                                <div key={idx} className="rounded-xl border space-y-3" style={{ borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }}>
                                    <div className="flex items-center justify-between px-4 pt-3">
                                        <p className="text-xs font-bold" style={{ color: '#6D28D9' }}>PONTO EXTRA #{idx + 1}</p>
                                        <button type="button" onClick={() => setFormPonto(f => ({ ...f, horarios_extras: f.horarios_extras.filter((_, i) => i !== idx) }))}
                                            className="p-1 rounded hover:bg-red-50" title="Remover">
                                            <Icon name="X" size={14} color="#DC2626" />
                                        </button>
                                    </div>
                                    <div className="px-4 pb-3 space-y-3">
                                        <Field label="Cupom Fiscal / NF">
                                            <input value={extra.cupom_fiscal || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], cupom_fiscal: e.target.value }; return { ...f, horarios_extras: h }; })}
                                                className={inputCls} style={inputStyle} placeholder="Nº do cupom fiscal / nota (opcional)" />
                                        </Field>
                                        <div className="p-3 rounded-lg border space-y-2" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                            <p className="text-xs font-bold flex items-center gap-1" style={{ color: '#1D4ED8' }}><Icon name="LogOut" size={12} color="#1D4ED8" />SAÍDA</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Field label="Tipo de Local">
                                                    <PrettySelect value={extra.tipo_local || 'Fábrica'} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], tipo_local: e.target.value, local: '' }; return { ...f, horarios_extras: h }; })}
                                                        className={inputCls} style={inputStyle}>
                                                        {['Empresa','Fábrica','Entrega','Posto','Outro'].map(t => (
                                                            <option key={t} value={t}>{t}</option>
                                                        ))}
                                                    </PrettySelect>
                                                </Field>
                                                <Field label="Destino / Local" required>
                                                    <PrettySelect value={extra.local || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], local: e.target.value }; return { ...f, horarios_extras: h }; })}
                                                        className={inputCls} style={inputStyle}>
                                                        <option value="">Selecione...</option>
                                                        {destinosParaTipo(extra.tipo_local || 'Fábrica').map(nome => (
                                                            <option key={nome} value={nome}>{nome}</option>
                                                        ))}
                                                    </PrettySelect>
                                                </Field>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Field label="Data" required>
                                                    <input type="date" value={extra.data_saida || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], data_saida: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} />
                                                </Field>
                                                <Field label="Horário">
                                                    <input type="time" value={extra.horario_saida || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], horario_saida: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} />
                                                </Field>
                                                <Field label="KM Saída">
                                                    <input type="number" value={extra.km_saida || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], km_saida: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} placeholder="Ex: 641300" />
                                                </Field>
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-lg border space-y-2" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                                            <p className="text-xs font-bold flex items-center gap-1" style={{ color: '#065F46' }}><Icon name="LogIn" size={12} color="#065F46" />CHEGADA</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Field label="Tipo de Local">
                                                    <PrettySelect value={extra.tipo_local_chegada || 'Fábrica'} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], tipo_local_chegada: e.target.value, local_chegada: '' }; return { ...f, horarios_extras: h }; })}
                                                        className={inputCls} style={inputStyle}>
                                                        {['Empresa','Fábrica','Entrega','Posto','Outro'].map(t => (
                                                            <option key={t} value={t}>{t}</option>
                                                        ))}
                                                    </PrettySelect>
                                                </Field>
                                                <Field label="Destino / Local">
                                                    <PrettySelect value={extra.local_chegada || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], local_chegada: e.target.value }; return { ...f, horarios_extras: h }; })}
                                                        className={inputCls} style={inputStyle}>
                                                        <option value="">Selecione...</option>
                                                        {destinosParaTipo(extra.tipo_local_chegada || 'Fábrica').map(nome => (
                                                            <option key={nome} value={nome}>{nome}</option>
                                                        ))}
                                                    </PrettySelect>
                                                </Field>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Field label="Data">
                                                    <input type="date" value={extra.data_chegada || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], data_chegada: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} />
                                                </Field>
                                                <Field label="Horário">
                                                    <input type="time" value={extra.horario_chegada || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], horario_chegada: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} />
                                                </Field>
                                                <Field label="KM Chegada">
                                                    <input type="number" value={extra.km_chegada || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], km_chegada: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} placeholder="Ex: 642600" />
                                                </Field>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(formPonto.horarios_extras || []).length === 0 ? (
                                <button type="button" onClick={() => setFormPonto(f => ({ ...f, horarios_extras: [...(f.horarios_extras || []), { tipo_local: 'Fábrica', local: '', cupom_fiscal: '', data_saida: formPonto.data_saida || new Date().toISOString().split('T')[0], horario_saida: '', km_saida: '', data_chegada: '', horario_chegada: '', km_chegada: '' }] }))}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-xs font-medium w-full justify-center hover:bg-purple-50 transition-colors"
                                    style={{ borderColor: '#C4B5FD', color: '#6D28D9' }}>
                                    <Icon name="Plus" size={14} color="#6D28D9" />
                                    Adicionar mais um registro de saída e chegada
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }}>
                                    <Icon name="Info" size={14} color="#B45309" />
                                    <p className="text-xs" style={{ color: '#92400E' }}>
                                        Cada registro de parada permite no máximo um ponto principal e um ponto extra. Crie um novo registro de parada para adicionar outro ponto.
                                    </p>
                                </div>
                            )}

                            {/* Observações */}
                            <div>
                                <Field label="Observações">
                                    <input value={formPonto.observacoes}
                                        onChange={e => setFormPonto(f => ({ ...f, observacoes: e.target.value }))}
                                        className={inputCls} style={inputStyle} placeholder="Irregularidades, barulhos..." />
                                </Field>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 p-5 border-t flex-shrink-0 sm:justify-end"
                            style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => { setModalPonto(false); setEditandoPontoId(null); }}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center"
                                style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={async () => {
                                if (!formPonto.local?.trim() || !formPonto.data_saida) {
                                    showToast('Local e data de saída são obrigatórios', 'error'); return;
                                }
                                if (!formPonto.veiculo_id) {
                                    showToast('Selecione o veículo — obrigatório pra saber qual placa fez essa parada', 'error'); return;
                                }
                                if ((formPonto.horarios_extras || []).length > 1) {
                                    showToast('Cada registro permite no máximo um ponto principal e um ponto extra. Crie um novo registro de parada.', 'error'); return;
                                }
                                const payload = {
                                    ...formPonto,
                                    motorista_id: user.id,
                                    km_saida: formPonto.km_saida !== '' ? Number(formPonto.km_saida) : null,
                                    km_chegada: formPonto.km_chegada !== '' ? Number(formPonto.km_chegada) : null,
                                    veiculo_id: formPonto.veiculo_id || null,
                                    data_chegada: formPonto.data_chegada || null,
                                    horario_saida: formPonto.horario_saida || null,
                                    horario_chegada: formPonto.horario_chegada || null,
                                    horarios_extras: (formPonto.horarios_extras || []).map(e => ({
                                        ...e,
                                        km_saida: e.km_saida !== '' && e.km_saida != null ? Number(e.km_saida) : null,
                                        km_chegada: e.km_chegada !== '' && e.km_chegada != null ? Number(e.km_chegada) : null,
                                        data_chegada: e.data_chegada || null,
                                        horario_saida: e.horario_saida || null,
                                        horario_chegada: e.horario_chegada || null,
                                    })),
                                };
                                try {
                                    const okTacografo = await confirm({
                                        title: 'Confira o disco do tacógrafo',
                                        message: 'Os horários e KMs registrados aqui devem ser coerentes com as informações do disco do tacógrafo do veículo. Confirma que os dados batem com o tacógrafo?',
                                        confirmLabel: 'Sim, está coerente', variant: 'info',
                                    });
                                    if (!okTacografo) return;
                                    if (editandoPontoId) {
                                        await updatePontoParada(editandoPontoId, payload);
                                        showToast('Registro atualizado!', 'success');
                                    } else {
                                        await createPontoParada(payload);
                                        showToast('Ponto de parada registrado!', 'success');
                                    }
                                    setModalPonto(false); setEditandoPontoId(null); load();
                                } catch (e) { showToast('Erro: ' + e.message, 'error'); }
                            }} size="sm" iconName="Check" className="w-full sm:w-auto">
                                {editandoPontoId ? 'Salvar' : 'Registrar'}
                            </Button>
                        </div>
                    </div>
                </div>
    );
}
