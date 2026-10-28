import React from 'react';

import { PrettySelect } from 'components';

// ─── tab === 'dados' ───
export default function TabDados({ form, inputCls, inputStyle, motoristasComId, setF, vehicles }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Motorista — select dos cadastrados */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Motorista</label>
                                <PrettySelect value={form.motorista_id} onChange={e => {
                                    const m = motoristasComId.find(x => x.id === e.target.value);
                                    setF('motorista_id', e.target.value);
                                    setF('motorista', m?.name || '');
                                }} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione o motorista...</option>
                                    {motoristasComId.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </PrettySelect>
                            </div>

                            {/* Destino */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Destino <span style={{ color: '#DC2626' }}>*</span></label>
                                <input value={form.destino} onChange={e => setF('destino', e.target.value)} className={inputCls} style={inputStyle} placeholder="Cidade / Endereço" />
                            </div>

                            {/* Veículo */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Veículo (opcional)</label>
                                <PrettySelect value={form.vehicle_id} onChange={e => {
                                    const v = vehicles.find(x => x.id === e.target.value || String(x.id) === e.target.value);
                                    setF('vehicle_id', e.target.value);
                                    setF('placa', v?.placa || '');
                                }} className={inputCls} style={inputStyle}>
                                    <option value="">A definir...</option>
                                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo || ''}</option>)}
                                </PrettySelect>
                            </div>

                            {/* Data saída */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Data de Saída</label>
                                <input type="datetime-local" value={form.saida} onChange={e => setF('saida', e.target.value)} className={inputCls} style={inputStyle} />
                            </div>

                            {/* Observações */}
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Observações</label>
                                <textarea value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} rows={2} className={inputCls} style={inputStyle} placeholder="Informações adicionais..." />
                            </div>
                        </div>
    );
}
