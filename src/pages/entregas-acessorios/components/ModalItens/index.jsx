import React from 'react';

import { Button, AppIcon as Icon, ModalHeader } from 'components';

import { inputCls, inputStyle } from '../../utils/constants';
import ModalOverlay from '../ModalOverlay';

// ─── modalItens ───
export default function ModalItens({ criarItem, editandoItem, excluirItem, itensCatalogo, novoItemNome, salvarEdicaoItem, savingItem, setEditandoItem, setModalItens, setNovoItemNome }) {
    return (
        <ModalOverlay onClose={() => { setModalItens(false); setEditandoItem(null); setNovoItemNome(''); }} sm>
                    <ModalHeader title="Gerenciar Itens" icon="ListTodo" onClose={() => { setModalItens(false); setEditandoItem(null); setNovoItemNome(''); }} />
                    <div className="p-5 overflow-y-auto flex-1 space-y-4">
                        <div className="flex gap-2">
                            <input value={novoItemNome} onChange={e => setNovoItemNome(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && criarItem()}
                                placeholder="Nome do novo item (ex: Cinta)"
                                className={inputCls} style={inputStyle} />
                            <Button onClick={criarItem} size="sm" iconName="Plus" disabled={savingItem || !novoItemNome.trim()}>Adicionar</Button>
                        </div>
                        {itensCatalogo.length === 0 ? (
                            <p className="text-xs text-center py-6" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum item cadastrado ainda.</p>
                        ) : (
                            <div className="rounded-lg border divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                {itensCatalogo.map(item => (
                                    <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                                        {editandoItem?.id === item.id ? (
                                            <>
                                                <input value={editandoItem.nome}
                                                    onChange={e => setEditandoItem(ed => ({ ...ed, nome: e.target.value }))}
                                                    onKeyDown={e => e.key === 'Enter' && salvarEdicaoItem()}
                                                    className={inputCls + ' py-1.5'} style={inputStyle} autoFocus />
                                                <button onClick={salvarEdicaoItem} disabled={savingItem} className="p-1.5 rounded hover:bg-green-50 flex-shrink-0">
                                                    <Icon name="Check" size={16} color="#059669" />
                                                </button>
                                                <button onClick={() => setEditandoItem(null)} className="p-1.5 rounded hover:bg-gray-100 flex-shrink-0">
                                                    <Icon name="X" size={16} color="var(--color-muted-foreground)" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="flex-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>{item.nome}</span>
                                                <button onClick={() => setEditandoItem({ id: item.id, nome: item.nome })} className="p-1.5 rounded hover:bg-blue-50 flex-shrink-0">
                                                    <Icon name="Pencil" size={16} color="#1D4ED8" />
                                                </button>
                                                <button onClick={() => excluirItem(item)} className="p-1.5 rounded hover:bg-red-50 flex-shrink-0">
                                                    <Icon name="Trash2" size={16} color="#DC2626" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => { setModalItens(false); setEditandoItem(null); setNovoItemNome(''); }}
                            className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Fechar</button>
                    </div>
                </ModalOverlay>
    );
}
