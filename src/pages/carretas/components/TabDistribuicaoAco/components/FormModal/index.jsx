import React from 'react';

import { SearchableSelect, Autocomplete, AppIcon as Icon } from 'components';

import { PEDIDO_ACO_VAZIO } from '../../utils/helpers';

// ─── formModal ───
export default function FormModal({ cidadeOptions, clientesConhecidos, erroForm, formModal, inputCls, inputStyle, labelCls, labelStyle, motoristaOptions, mudarMotorista, placaOptions, profile, salvando, salvar, setCampo, setFormModal, setPedido }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', marginTop: 0 }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
                        <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <h3 className="font-heading font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
                                {formModal.id ? 'Editar envio de aço' : 'Registrar envio de aço'}
                            </h3>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls} style={labelStyle}>Motorista *</label>
                                    <SearchableSelect value={formModal.motoristaId} onChange={mudarMotorista} options={motoristaOptions}
                                        placeholder="Selecione..." emptyLabel="Nenhum motorista da frota própria encontrado" />
                                </div>
                                <div>
                                    <label className={labelCls} style={labelStyle}>Placa *</label>
                                    <SearchableSelect value={formModal.placa} onChange={v => setCampo('placa', v)} options={placaOptions}
                                        placeholder="Selecione a placa..." emptyLabel="Nenhum veículo da frota própria encontrado" allowCustom />
                                </div>
                            </div>

                            {formModal.destinoAntigo && (
                                <div className="rounded-lg border px-3 py-2 text-xs" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
                                    <strong>Registro antigo (texto livre):</strong> {formModal.destinoAntigo}<br />
                                    Preencha os pedidos abaixo para detalhar este envio.
                                </div>
                            )}

                            <div className="space-y-3">
                                {formModal.pedidos.map((p, idx) => (
                                    <div key={idx} className="rounded-xl border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: '#FAFAFA' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>Pedido {idx + 1}</span>
                                            {formModal.pedidos.length > 1 && (
                                                <button type="button" onClick={() => setFormModal(f => ({ ...f, pedidos: f.pedidos.filter((_, i) => i !== idx) }))}
                                                    className="text-xs text-red-600 hover:underline">Remover</button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelCls} style={labelStyle}>Nº do pedido *</label>
                                                <input value={p.numero_pedido} onChange={e => setPedido(idx, 'numero_pedido', e.target.value)} placeholder="Ex: 22557" className={inputCls} style={inputStyle} />
                                            </div>
                                            <div>
                                                <label className={labelCls} style={labelStyle}>Nome do cliente *</label>
                                                <Autocomplete value={p.cliente} onChange={v => setPedido(idx, 'cliente', v)} suggestions={clientesConhecidos} placeholder="Ex: Casa Rodrigues" />
                                            </div>
                                            <div>
                                                <label className={labelCls} style={labelStyle}>Cidade *</label>
                                                <SearchableSelect value={p.cidade} onChange={v => setPedido(idx, 'cidade', v)} options={cidadeOptions}
                                                    placeholder="Selecione a cidade..." emptyLabel="Nenhuma cidade encontrada" allowCustom />
                                            </div>
                                            <div>
                                                <label className={labelCls} style={labelStyle}>Data de entrega *</label>
                                                <input type="date" value={p.data_entrega} onChange={e => setPedido(idx, 'data_entrega', e.target.value)} className={inputCls} style={inputStyle} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setFormModal(f => ({ ...f, pedidos: [...f.pedidos, PEDIDO_ACO_VAZIO()] }))}
                                    className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
                                    <Icon name="Plus" size={14} /> Adicionar outro pedido (mesma viagem)
                                </button>
                            </div>

                            <div>
                                <label className={labelCls} style={labelStyle}>Observações (opcional)</label>
                                <textarea value={formModal.observacoes} onChange={e => setCampo('observacoes', e.target.value)} rows={2} className={inputCls} style={inputStyle} />
                            </div>

                            {profile?.assinatura_digital || formModal.assinaturaAtual ? (
                                <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer"
                                    style={formModal.assinar ? { backgroundColor: '#F5F3FF', border: '1px solid #C4B5FD' } : { backgroundColor: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                                    <input type="checkbox" checked={!!formModal.assinar} onChange={e => setCampo('assinar', e.target.checked)} className="w-4 h-4" />
                                    <Icon name={formModal.assinar ? 'BadgeCheck' : 'PenTool'} size={14} color={formModal.assinar ? '#7C3AED' : 'var(--color-muted-foreground)'} />
                                    <span className="text-xs font-medium" style={{ color: formModal.assinar ? '#7C3AED' : 'var(--color-text-secondary)' }}>
                                        {formModal.assinar
                                            ? <><strong>Transporte (admin):</strong> {formModal.assinaturaAtual || profile?.assinatura_digital}</>
                                            : `Assinar como Transporte (admin) (${profile?.assinatura_digital || formModal.assinaturaAtual})`}
                                        {!formModal.assinar && formModal.assinaturaAtual && ' — desmarcado: a assinatura será removida ao salvar'}
                                    </span>
                                </label>
                            ) : (
                                <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                    <Icon name="Info" size={12} />
                                    Você ainda não tem uma assinatura digital cadastrada. Cadastre em Admin &gt; Configurações.
                                </p>
                            )}
                            {erroForm && <p className="text-sm font-medium text-red-600">{erroForm}</p>}
                        </div>
                        <div className="flex gap-2 justify-end px-5 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setFormModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <button onClick={salvar} disabled={salvando}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">
                                <Icon name={salvando ? 'Loader' : 'Truck'} size={14} /> {formModal.id ? 'Salvar alterações' : 'Confirmar envio'}
                            </button>
                        </div>
                    </div>
                </div>
    );
}
