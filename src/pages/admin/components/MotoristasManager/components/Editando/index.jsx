import React from 'react';

import { AppIcon as Icon, PrettySelect, Button } from 'components';

import { DRIVER_ROLES, CNH_CATEGORIAS } from '../../utils/constants';

// ─── editando ───
export default function Editando({ editCnhFile, editForm, editSaving, editando, handleSalvarEdicao, inputCls2, setEditCnhFile, setEditForm, setEditando }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-amber-50">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-100">
                                <Icon name="Pencil" size={20} color="#D97706" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800">Editar Motorista</p>
                                <p className="text-xs text-slate-500 truncate">{editando.name}</p>
                            </div>
                            <button onClick={() => setEditando(null)}
                                className="p-1.5 rounded-lg hover:bg-amber-200 transition-colors flex-shrink-0">
                                <Icon name="X" size={16} color="#64748B" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 flex flex-col gap-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Nome */}
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Nome completo *</label>
                                    <input value={editForm.nome}
                                        onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))}
                                        placeholder="Nome do motorista" className={inputCls2} />
                                </div>

                                {/* Função */}
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Função *</label>
                                    <PrettySelect value={editForm.role}
                                        onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                                        className={inputCls2}>
                                        {DRIVER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </PrettySelect>
                                </div>

                                {/* Data de nascimento */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Data de nascimento</label>
                                    <input type="date" value={editForm.dataNascimento}
                                        onChange={e => setEditForm(p => ({ ...p, dataNascimento: e.target.value }))}
                                        className={inputCls2} />
                                </div>

                                {/* Nº CNH */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">N° Registro da CNH</label>
                                    <input value={editForm.cnhNumero}
                                        onChange={e => setEditForm(p => ({ ...p, cnhNumero: e.target.value }))}
                                        placeholder="00000000000" className={inputCls2} />
                                </div>

                                {/* Categoria CNH */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Categoria CNH</label>
                                    <PrettySelect value={editForm.cnhCategoria}
                                        onChange={e => setEditForm(p => ({ ...p, cnhCategoria: e.target.value }))}
                                        className={inputCls2}>
                                        {CNH_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </PrettySelect>
                                </div>

                                {/* Vencimento CNH */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Vencimento da CNH</label>
                                    <input type="date" value={editForm.cnhVencimento}
                                        onChange={e => setEditForm(p => ({ ...p, cnhVencimento: e.target.value }))}
                                        className={inputCls2} />
                                </div>

                                {/* Anexo CNH */}
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Anexo da CNH</label>
                                    {editando.cnh_foto_url && !editCnhFile && (
                                        <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                                            <Icon name="FileText" size={14} color="#64748B" />
                                            <span className="text-xs text-slate-600 flex-1 truncate">Arquivo atual anexado</span>
                                            <a href={editando.cnh_foto_url} target="_blank" rel="noopener noreferrer"
                                                className="text-xs text-amber-600 hover:underline font-medium">Ver</a>
                                        </div>
                                    )}
                                    <label className="flex flex-col items-center gap-1 cursor-pointer border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-xl p-3 transition-colors bg-slate-50 hover:bg-amber-50">
                                        <Icon name="Upload" size={18} color={editCnhFile ? '#D97706' : '#94A3B8'} />
                                        <span className="text-xs text-slate-500 text-center">
                                            {editCnhFile
                                                ? <span className="text-amber-700 font-medium">{editCnhFile.name}</span>
                                                : <>{editando.cnh_foto_url ? 'Clique para trocar o arquivo' : 'Clique para adicionar a CNH'}<br/><span className="text-slate-400">PDF, JPG, PNG, etc.</span></>
                                            }
                                        </span>
                                        <input type="file" accept="image/*,application/pdf" className="hidden"
                                            onChange={e => setEditCnhFile(e.target.files?.[0] || null)} />
                                    </label>
                                    {editCnhFile && (
                                        <button onClick={() => setEditCnhFile(null)}
                                            className="mt-1 text-xs text-slate-400 hover:text-red-500 transition-colors">
                                            Cancelar troca de arquivo
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Terceirizado toggle */}
                        <div className="px-6 py-3 border-t border-slate-100">
                            <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
                                <button
                                    type="button"
                                    onClick={() => setEditForm(p => ({ ...p, is_terceiro: !p.is_terceiro }))}
                                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0"
                                    style={{ backgroundColor: editForm.is_terceiro ? '#D97706' : '#D1D5DB' }}>
                                    <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                                        style={{ transform: editForm.is_terceiro ? 'translateX(20px)' : 'translateX(4px)' }} />
                                </button>
                                <div>
                                    <p className="text-xs font-semibold" style={{ color: '#92400E' }}>Motorista Terceirizado</p>
                                    <p className="text-xs" style={{ color: '#B45309' }}>Não gera bonificações nem aparece nas telas de controle interno</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
                            <Button variant="outline" onClick={() => setEditando(null)} disabled={editSaving}>Cancelar</Button>
                            <Button variant="default" iconName="Save" iconSize={14} onClick={handleSalvarEdicao} loading={editSaving}>
                                Salvar alterações
                            </Button>
                        </div>
                    </div>
                </div>
    );
}
