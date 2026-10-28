import React from 'react';

import { AppIcon as Icon, PrettySelect, Button } from 'components';

import { DRIVER_ROLES, CNH_CATEGORIAS, FORM_VAZIO } from '../../utils/constants';

// ─── showForm ───
export default function ShowForm({ cnhFile, form, handleSubmit, inputCls2, saving, setCnhFile, setField, setForm, setShowForm, setShowSenha, showSenha }) {
    return (
        <div className="bg-slate-50 rounded-xl border-2 border-blue-200 p-5">
                    <h3 className="font-semibold text-sm text-slate-800 mb-4 flex items-center gap-2">
                        <Icon name="UserPlus" size={15} color="var(--color-primary)" />
                        Cadastrar novo motorista / mecânico
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Nome */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nome completo *</label>
                            <input value={form.nome} onChange={e => setField('nome', e.target.value)}
                                placeholder="Nome do motorista" className={inputCls2} />
                        </div>

                        {/* E-mail */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">E-mail *</label>
                            <input type="email" value={form.email} onChange={e => setField('email', e.target.value)}
                                placeholder="motorista@empresa.com" className={inputCls2} />
                        </div>

                        {/* Senha */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Senha inicial *</label>
                            <div className="relative">
                                <input
                                    type={showSenha ? 'text' : 'password'}
                                    value={form.senha} onChange={e => setField('senha', e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    className={inputCls2}
                                    style={{ paddingRight: 36 }} />
                                <button type="button" onClick={() => setShowSenha(s => !s)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                                    <Icon name={showSenha ? 'EyeOff' : 'Eye'} size={14} color="#64748B" />
                                </button>
                            </div>
                        </div>

                        {/* Função */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Função *</label>
                            <PrettySelect value={form.role} onChange={e => setField('role', e.target.value)} className={inputCls2}>
                                {DRIVER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </PrettySelect>
                        </div>

                        {/* Data de nascimento */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data de nascimento</label>
                            <input type="date" value={form.dataNascimento} onChange={e => setField('dataNascimento', e.target.value)}
                                className={inputCls2} />
                        </div>

                        {/* Nº CNH */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">N° Registro da CNH</label>
                            <input value={form.cnhNumero} onChange={e => setField('cnhNumero', e.target.value)}
                                placeholder="00000000000" className={inputCls2} />
                        </div>

                        {/* Categoria CNH */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Categoria CNH</label>
                            <PrettySelect value={form.cnhCategoria} onChange={e => setField('cnhCategoria', e.target.value)} className={inputCls2}>
                                {CNH_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                            </PrettySelect>
                        </div>

                        {/* Vencimento CNH */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Vencimento da CNH</label>
                            <input type="date" value={form.cnhVencimento} onChange={e => setField('cnhVencimento', e.target.value)}
                                className={inputCls2} />
                        </div>

                        {/* Foto CNH */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Anexo da CNH (imagem)</label>
                            <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={e => setCnhFile(e.target.files?.[0] || null)}
                                className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                            />
                            {cnhFile && (
                                <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                                    <Icon name="Paperclip" size={11} color="#64748B" />
                                    {cnhFile.name}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Motorista Terceirizado */}
                    <div className="mt-3 flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
                        <button
                            type="button"
                            onClick={() => setField('is_terceiro', !form.is_terceiro)}
                            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0"
                            style={{ backgroundColor: form.is_terceiro ? '#D97706' : '#D1D5DB' }}>
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                                style={{ transform: form.is_terceiro ? 'translateX(20px)' : 'translateX(4px)' }} />
                        </button>
                        <div>
                            <p className="text-xs font-semibold" style={{ color: '#92400E' }}>Motorista Terceirizado</p>
                            <p className="text-xs" style={{ color: '#B45309' }}>Não gera bonificações nem aparece nas telas de controle interno</p>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4 justify-end">
                        <Button variant="outline" onClick={() => { setShowForm(false); setForm(FORM_VAZIO); setCnhFile(null); }} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button variant="default" iconName="UserPlus" iconSize={14} onClick={handleSubmit} loading={saving}>
                            Cadastrar Motorista
                        </Button>
                    </div>
                </div>
    );
}
