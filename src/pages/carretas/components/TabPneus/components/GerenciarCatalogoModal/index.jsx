import React, { useState, useCallback, useEffect } from 'react';
import { fetchCatalogoPneusRaw, addItemCatalogoPneus, updateItemCatalogoPneus, deleteItemCatalogoPneus } from 'services/pneusService';
import { AppIcon as Icon, Button } from 'components';
import { inputCls, inputStyle } from '../../utils/constants';

// Modal genérico para o admin cadastrar, editar e excluir itens do catálogo
// (usado para "Eixo Trocado"; serve para marca/modelo/medida também)
export default function GerenciarCatalogoModal({ tipo, titulo, onClose, onChanged, showToast, confirm }) {
    const [itens, setItens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [novoNome, setNovoNome] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [editandoNome, setEditandoNome] = useState('');
    const [salvando, setSalvando] = useState(false);

    const carregar = useCallback(async () => {
        setLoading(true);
        try { setItens(await fetchCatalogoPneusRaw(tipo)); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [tipo, showToast]);

    useEffect(() => { carregar(); }, [carregar]);

    const handleAdd = async () => {
        if (!novoNome.trim()) return;
        setSalvando(true);
        try {
            await addItemCatalogoPneus(tipo, novoNome.trim());
            setNovoNome('');
            showToast('Item adicionado!', 'success');
            await carregar(); onChanged?.();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSalvando(false); }
    };

    const handleEditSave = async (id) => {
        if (!editandoNome.trim()) return;
        try {
            await updateItemCatalogoPneus(id, editandoNome.trim());
            setEditandoId(null);
            showToast('Item atualizado!', 'success');
            await carregar(); onChanged?.();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (item) => {
        const ok = await confirm({ title: `Excluir "${item.valor}"?`, message: 'Pneus que já usam este valor mantêm o texto salvo, mas ele deixará de aparecer na lista.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try {
            await deleteItemCatalogoPneus(item.id);
            showToast('Item excluído.', 'success');
            await carregar(); onChanged?.();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>{titulo}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={16} color="var(--color-muted-foreground)" /></button>
                </div>
                <div className="overflow-y-auto flex-1 p-5 space-y-2">
                    {loading ? (
                        <p className="text-xs text-center py-6" style={{ color: 'var(--color-muted-foreground)' }}>Carregando...</p>
                    ) : itens.length === 0 ? (
                        <p className="text-xs text-center py-6" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum item cadastrado ainda.</p>
                    ) : (
                        itens.map(item => (
                            <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                                {editandoId === item.id ? (
                                    <>
                                        <input autoFocus value={editandoNome} onChange={e => setEditandoNome(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleEditSave(item.id); if (e.key === 'Escape') setEditandoId(null); }}
                                            className={inputCls} style={inputStyle} />
                                        <button onClick={() => handleEditSave(item.id)} className="p-1.5 rounded-lg hover:bg-green-50 flex-shrink-0"><Icon name="Check" size={14} color="#059669" /></button>
                                        <button onClick={() => setEditandoId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0"><Icon name="X" size={14} color="var(--color-muted-foreground)" /></button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>{item.valor}</span>
                                        <button onClick={() => { setEditandoId(item.id); setEditandoNome(item.valor); }} className="p-1.5 rounded-lg hover:bg-blue-50 flex-shrink-0"><Icon name="Pencil" size={14} color="#1D4ED8" /></button>
                                        <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0"><Icon name="Trash2" size={14} color="#DC2626" /></button>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
                <div className="flex gap-2 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                        placeholder="Novo item..." className={inputCls} style={inputStyle} />
                    <Button onClick={handleAdd} size="sm" iconName="Plus" disabled={salvando}>Adicionar</Button>
                </div>
            </div>
        </div>
    );
}
