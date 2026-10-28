import React from 'react';

import { AppIcon as Icon, PrettySelect } from 'components';

// ─── criandoUsuario ───
export default function CriandoUsuario({ handleCriarUsuario, novoUsuarioForm, savingNovoUsuario, setCriandoUsuario, setNovoUsuarioForm }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                            <h3 className="font-bold text-base text-slate-800">Criar Usuário</h3>
                            <button onClick={() => setCriandoUsuario(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                                <Icon name="X" size={16} color="#64748B" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-slate-600">Nome *</label>
                                <input value={novoUsuarioForm.nome} onChange={e => setNovoUsuarioForm(f => ({ ...f, nome: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" style={{ borderColor: '#CBD5E1' }} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-slate-600">E-mail *</label>
                                <input type="email" value={novoUsuarioForm.email} onChange={e => setNovoUsuarioForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#CBD5E1' }} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-slate-600">Senha * (mín. 6 caracteres)</label>
                                <input type="password" value={novoUsuarioForm.senha} onChange={e => setNovoUsuarioForm(f => ({ ...f, senha: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#CBD5E1' }} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-slate-600">Papel de acesso *</label>
                                <PrettySelect value={novoUsuarioForm.role} onChange={e => setNovoUsuarioForm(f => ({ ...f, role: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#CBD5E1' }}>
                                    <option value="admin">Admin</option>
                                    <option value="operador">Operador</option>
                                    <option value="mecanico">Mecânico</option>
                                    <option value="motorista">Motorista (Caminhão)</option>
                                    <option value="motorista_carreta">Motorista (Carreta)</option>
                                </PrettySelect>
                            </div>
                            {novoUsuarioForm.role === 'motorista' && (
                                <div>
                                    <label className="block text-xs font-medium mb-1.5 text-slate-600">Tipo de veículo</label>
                                    <PrettySelect value={novoUsuarioForm.tipoVeiculo} onChange={e => setNovoUsuarioForm(f => ({ ...f, tipoVeiculo: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#CBD5E1' }}>
                                        <option value="caminhao">Caminhão</option>
                                        <option value="carreta">Carreta</option>
                                    </PrettySelect>
                                </div>
                            )}
                            <p className="text-xs text-slate-400">
                                Dados de CNH e outros detalhes específicos de motoristas podem ser preenchidos depois, na edição do usuário.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
                            <button onClick={() => setCriandoUsuario(false)} disabled={savingNovoUsuario}
                                className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-white disabled:opacity-50" style={{ borderColor: '#CBD5E1' }}>
                                Cancelar
                            </button>
                            <button onClick={handleCriarUsuario} disabled={savingNovoUsuario}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                                <Icon name={savingNovoUsuario ? 'Loader' : 'Check'} size={14} />
                                {savingNovoUsuario ? 'Criando...' : 'Criar'}
                            </button>
                        </div>
                    </div>
                </div>
    );
}
