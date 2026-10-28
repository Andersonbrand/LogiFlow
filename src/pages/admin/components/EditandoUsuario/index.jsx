import React from 'react';

import { AppIcon as Icon, PrettySelect } from 'components';

// ─── editandoUsuario ───
export default function EditandoUsuario({ editUsuarioForm, editandoUsuario, handleSalvarEdicaoUsuario, savingEditUsuario, setEditUsuarioForm, setEditandoUsuario }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                            <div>
                                <h3 className="font-bold text-base text-slate-800">Editar Usuário</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{editandoUsuario.email || 'sem e-mail cadastrado'}</p>
                            </div>
                            <button onClick={() => setEditandoUsuario(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                                <Icon name="X" size={16} color="#64748B" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-slate-600">Nome *</label>
                                <input value={editUsuarioForm.name} onChange={e => setEditUsuarioForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" style={{ borderColor: '#CBD5E1' }} />
                            </div>
                            {editandoUsuario.role === 'motorista' && (
                                <div>
                                    <label className="block text-xs font-medium mb-1.5 text-slate-600">Tipo de veículo</label>
                                    <PrettySelect value={editUsuarioForm.tipo_veiculo} onChange={e => setEditUsuarioForm(f => ({ ...f, tipo_veiculo: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#CBD5E1' }}>
                                        <option value="">—</option>
                                        <option value="caminhao">Caminhão</option>
                                        <option value="carreta">Carreta</option>
                                    </PrettySelect>
                                </div>
                            )}
                            {(editandoUsuario.role === 'motorista' || editandoUsuario.role === 'mecanico') && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5 text-slate-600">Nº da CNH</label>
                                            <input value={editUsuarioForm.cnh_numero} onChange={e => setEditUsuarioForm(f => ({ ...f, cnh_numero: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#CBD5E1' }} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5 text-slate-600">Categoria</label>
                                            <PrettySelect value={editUsuarioForm.cnh_categoria} onChange={e => setEditUsuarioForm(f => ({ ...f, cnh_categoria: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#CBD5E1' }}>
                                                {['A', 'B', 'AB', 'C', 'D', 'E', 'ACC'].map(c => <option key={c} value={c}>{c}</option>)}
                                            </PrettySelect>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5 text-slate-600">Venc. da CNH</label>
                                            <input type="date" value={editUsuarioForm.cnh_vencimento} onChange={e => setEditUsuarioForm(f => ({ ...f, cnh_vencimento: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#CBD5E1' }} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5 text-slate-600">Nascimento</label>
                                            <input type="date" value={editUsuarioForm.data_nascimento} onChange={e => setEditUsuarioForm(f => ({ ...f, data_nascimento: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#CBD5E1' }} />
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                                        <input type="checkbox" checked={editUsuarioForm.is_terceiro} onChange={e => setEditUsuarioForm(f => ({ ...f, is_terceiro: e.target.checked }))} />
                                        Terceirizado
                                    </label>
                                </>
                            )}
                            <p className="text-xs text-slate-400">
                                Papel de acesso e e-mail são gerenciados na tela de Usuários do Sistema e não podem ser alterados aqui.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
                            <button onClick={() => setEditandoUsuario(null)} disabled={savingEditUsuario}
                                className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-white disabled:opacity-50" style={{ borderColor: '#CBD5E1' }}>
                                Cancelar
                            </button>
                            <button onClick={handleSalvarEdicaoUsuario} disabled={savingEditUsuario}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                                <Icon name={savingEditUsuario ? 'Loader' : 'Check'} size={14} />
                                {savingEditUsuario ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
    );
}
