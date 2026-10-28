import React from 'react';

import { AppIcon as Icon, Button } from 'components';

// ─── confirmDelete ───
export default function ConfirmDelete({ confirmDelete, deleting, handleDeleteDriver, setConfirmDelete }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-red-50">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-100">
                                <Icon name="Trash2" size={20} color="#DC2626" />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-800">Excluir motorista</p>
                                <p className="text-xs text-slate-500">Esta ação não pode ser desfeita</p>
                            </div>
                        </div>
                        <div className="p-5">
                            <p className="text-sm text-slate-700 mb-1">
                                Tem certeza que deseja excluir <strong>{confirmDelete.name}</strong>?
                            </p>
                            <p className="text-xs text-slate-500 mb-5">
                                Todos os dados do motorista serão removidos permanentemente, incluindo bonificações e notificações.
                            </p>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                                    Cancelar
                                </Button>
                                <button
                                    onClick={handleDeleteDriver}
                                    disabled={deleting}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                                    {deleting
                                        ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                        : <Icon name="Trash2" size={16} color="#fff" />}
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
    );
}
