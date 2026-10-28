import React from 'react';

import { AppIcon as Icon, PrettySelect, CidadesAdicionaisField, Button } from 'components';
import { updateRegistroViagem, createRegistroViagem } from 'services/carretas';

import { inputCls, inputStyle } from '../../utils/constants';

// ─── modalRegistro ───
export default function ModalRegistro({ cidadesFrete, editandoRegistroId, formRegistro, load, paradasRegistro, salvandoRegistro, setEditandoRegistroId, setFormRegistro, setModalRegistro, setParadasRegistro, setSalvandoRegistro, showToast, user, veiculosProprios }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
                   >
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="FilePlus" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{editandoRegistroId ? 'Editar Viagem' : 'Registrar Viagem'}</h2>
                            </div>
                            <button onClick={() => { setModalRegistro(false); setEditandoRegistroId(null); }} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                            {/* Tipo de lançamento */}
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Tipo de lançamento</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button"
                                        onClick={() => setFormRegistro(f => ({ ...f, local_carregamento: '' }))}
                                        className="px-3 py-2.5 rounded-xl text-xs font-bold text-left border-2 transition-all"
                                        style={{
                                            background: formRegistro.local_carregamento !== 'Estoque' ? '#EFF6FF' : '#fff',
                                            borderColor: formRegistro.local_carregamento !== 'Estoque' ? '#1D4ED8' : 'var(--color-border)',
                                            color: formRegistro.local_carregamento !== 'Estoque' ? '#1D4ED8' : 'var(--color-muted-foreground)',
                                        }}>
                                        🏭 Viagem Normal
                                    </button>
                                    <button type="button"
                                        onClick={() => setFormRegistro(f => ({ ...f, local_carregamento: 'Estoque' }))}
                                        className="px-3 py-2.5 rounded-xl text-xs font-bold text-left border-2 transition-all"
                                        style={{
                                            background: formRegistro.local_carregamento === 'Estoque' ? '#FFFBEB' : '#fff',
                                            borderColor: formRegistro.local_carregamento === 'Estoque' ? '#D97706' : 'var(--color-border)',
                                            color: formRegistro.local_carregamento === 'Estoque' ? '#D97706' : 'var(--color-muted-foreground)',
                                        }}>
                                        📦 Carregamento no Estoque
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Data de carregamento <span className="text-red-500">*</span></label>
                                <input type="date" value={formRegistro.data_carregamento} onChange={e => setFormRegistro(f => ({ ...f, data_carregamento: e.target.value }))} className={inputCls} style={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Placa do veículo <span className="text-red-500">*</span></label>
                                <PrettySelect value={formRegistro.veiculo_id} onChange={e => setFormRegistro(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculosProprios.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </PrettySelect>
                            </div>
                            <div className={formRegistro.local_carregamento === 'Estoque' ? 'sm:col-span-2' : ''}>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Destino da carga <span className="text-red-500">*</span></label>
                                <PrettySelect value={formRegistro.destino} onChange={e => setFormRegistro(f => ({ ...f, destino: e.target.value }))}
                                    className={inputCls} style={inputStyle} placeholder="Cidade de destino">
                                    <option value="">Cidade de destino</option>
                                    {cidadesFrete.map(c => <option key={c.id} value={c.cidade}>{c.cidade}</option>)}
                                </PrettySelect>
                            </div>
                            <div className="sm:col-span-2">
                                <CidadesAdicionaisField
                                    cidades={[...new Set((cidadesFrete || []).map(c => c.cidade).filter(Boolean))]}
                                    value={paradasRegistro}
                                    onChange={setParadasRegistro}
                                    label="Essa viagem passa por mais de uma cidade?"
                                />
                            </div>

                            {formRegistro.local_carregamento === 'Estoque' ? (
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Tipo de cimento <span className="text-red-500">*</span></label>
                                    <PrettySelect value={formRegistro.tipo_cimento} onChange={e => setFormRegistro(f => ({ ...f, tipo_cimento: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione...</option>
                                        <option value="Montes Claros">Montes Claros</option>
                                        <option value="Liz">Liz</option>
                                        <option value="Ambas">Ambas (Montes Claros + Liz)</option>
                                    </PrettySelect>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Nº da Nota Fiscal <span className="text-red-500">*</span></label>
                                        <input value={formRegistro.numero_nota_fiscal} onChange={e => setFormRegistro(f => ({ ...f, numero_nota_fiscal: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 381469" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Data de descarga</label>
                                        <input type="date" value={formRegistro.data_descarga} onChange={e => setFormRegistro(f => ({ ...f, data_descarga: e.target.value }))} className={inputCls} style={inputStyle} />
                                    </div>
                                </>
                            )}

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Observações</label>
                                <textarea value={formRegistro.observacoes} onChange={e => setFormRegistro(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                            </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 p-5 border-t flex-shrink-0 sm:justify-end" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => { setModalRegistro(false); setEditandoRegistroId(null); }} disabled={salvandoRegistro} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center disabled:opacity-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={async () => {
                                if (salvandoRegistro) return;
                                const isEstoque = formRegistro.local_carregamento === 'Estoque';
                                // Placa era exibida como obrigatória (*) mas não era validada — corrigido aqui.
                                if (!formRegistro.data_carregamento || !formRegistro.destino || !formRegistro.veiculo_id) {
                                    showToast('Data, placa e destino são obrigatórios', 'error'); return;
                                }
                                if (isEstoque && !formRegistro.tipo_cimento) {
                                    showToast('Selecione o tipo de cimento', 'error'); return;
                                }
                                if (!isEstoque && !formRegistro.numero_nota_fiscal?.trim()) {
                                    showToast('Informe o Nº da Nota Fiscal', 'error'); return;
                                }
                                const payload = {
                                    ...formRegistro,
                                    // Limpa campos que não fazem sentido para o tipo escolhido
                                    numero_nota_fiscal: isEstoque ? null : (formRegistro.numero_nota_fiscal || null),
                                    data_descarga:      isEstoque ? null : (formRegistro.data_descarga || null),
                                    tipo_cimento:        isEstoque ? formRegistro.tipo_cimento : null,
                                    local_carregamento:  isEstoque ? 'Estoque' : null,
                                    paradas: paradasRegistro.filter(p => p && p.trim()),
                                };
                                setSalvandoRegistro(true);
                                try {
                                    if (editandoRegistroId) {
                                        await updateRegistroViagem(editandoRegistroId, payload);
                                        showToast('Viagem atualizada!', 'success');
                                    } else {
                                        await createRegistroViagem({ ...payload, motorista_id: user.id });
                                        showToast('Viagem registrada!', 'success');
                                    }
                                    setEditandoRegistroId(null);
                                    setModalRegistro(false); load();
                                } catch (e) { showToast('Erro: ' + e.message, 'error'); }
                                finally { setSalvandoRegistro(false); }
                            }} disabled={salvandoRegistro} loading={salvandoRegistro} size="sm" iconName="Check" className="w-full sm:w-auto">{editandoRegistroId ? 'Salvar' : 'Registrar'}</Button>
                        </div>

                    </div>
                </div>
    );
}
