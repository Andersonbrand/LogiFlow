import React, { useState, useCallback, useEffect } from 'react';

import { useConfirm, AppIcon as Icon, PrettySelect, EditButton, DeleteButton, Button } from 'components';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import { fetchPecasCatalogoCompleto, createPecaCatalogo, updatePecaCatalogo, deletePecaCatalogo } from 'services/carretas';

// ─── Modal: gerenciar catálogo de peças (para solicitação nas OS) ────────────
export default function GerenciarPecasModal({ onClose, showToast }) {
    const { confirm, ConfirmDialog } = useConfirm();
    const [pecas, setPecas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [novoNome, setNovoNome] = useState('');
    const [novaCategoria, setNovaCategoria] = useState('Ambos');
    const [editandoId, setEditandoId] = useState(null);
    const [editandoNome, setEditandoNome] = useState('');
    const [editandoCategoria, setEditandoCategoria] = useState('Ambos');
    const [salvando, setSalvando] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await fetchPecasCatalogoCompleto();
            if (error) throw error;
            setPecas(data || []);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, []); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const listaFiltrada = filtroCategoria ? pecas.filter(p => p.categoria === filtroCategoria) : pecas;

    const handleAdd = async () => {
        if (!novoNome.trim()) return;
        setSalvando(true);
        try {
            await createPecaCatalogo({ nome: novoNome.trim(), categoria: novaCategoria });
            setNovoNome('');
            showToast('Peça adicionada!', 'success');
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSalvando(false); }
    };

    const handleEditSave = async (id) => {
        if (!editandoNome.trim()) return;
        try {
            await updatePecaCatalogo(id, { nome: editandoNome.trim(), categoria: editandoCategoria });
            setEditandoId(null);
            showToast('Peça atualizada!', 'success');
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir peça do catálogo?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deletePecaCatalogo(id); showToast('Peça excluída.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const inputClsLocal = 'px-2.5 py-1.5 rounded-lg border text-sm outline-none';
    const inputStyleLocal = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-2">
                        <Icon name="Package" size={18} color="var(--color-primary)" />
                        <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Catálogo de Peças</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={16} color="var(--color-muted-foreground)" /></button>
                </div>
                <div className="flex gap-2 px-5 pt-3">
                    {['', 'Caminhão', 'Carreta', 'Ambos'].map(t => (
                        <button key={t || 'todas'} onClick={() => setFiltroCategoria(t)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium"
                            style={{ backgroundColor: filtroCategoria === t ? 'var(--color-primary)' : '#F1F5F9', color: filtroCategoria === t ? '#fff' : 'var(--color-text-secondary)' }}>
                            {t || 'Todas'}
                        </button>
                    ))}
                </div>
                <div className="overflow-y-auto flex-1 p-5 space-y-2">
                    {loading ? (
                        <div className="flex justify-center py-6"><div className="animate-spin h-6 w-6 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
                    ) : listaFiltrada.length === 0 ? (
                        <p className="text-xs text-center py-6" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma peça cadastrada.</p>
                    ) : listaFiltrada.map(p => (
                        <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                            {editandoId === p.id ? (
                                <>
                                    <input autoFocus value={editandoNome} onChange={e => setEditandoNome(e.target.value)}
                                        className={`flex-1 ${inputClsLocal}`} style={inputStyleLocal} />
                                    <PrettySelect value={editandoCategoria} onChange={e => setEditandoCategoria(e.target.value)} className={inputClsLocal} style={inputStyleLocal}>
                                        {['Ambos', 'Caminhão', 'Carreta'].map(c => <option key={c} value={c}>{c}</option>)}
                                    </PrettySelect>
                                </>
                            ) : (
                                <>
                                    <span className="flex-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>{p.nome}</span>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#F1F5F9', color: 'var(--color-text-secondary)' }}>{p.categoria}</span>
                                </>
                            )}
                            {editandoId === p.id ? (
                                <button onClick={() => handleEditSave(p.id)} className="p-1.5 rounded hover:bg-green-50"><Icon name="Check" size={15} color="#059669" /></button>
                            ) : (
                                <EditButton onClick={() => { setEditandoId(p.id); setEditandoNome(p.nome); setEditandoCategoria(p.categoria); }} />
                            )}
                            <DeleteButton onClick={() => handleDelete(p.id)} />
                        </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2">
                        <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nova peça..."
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            className={`flex-1 ${inputClsLocal}`} style={inputStyleLocal} />
                        <PrettySelect value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} className={inputClsLocal} style={inputStyleLocal}>
                            {['Ambos', 'Caminhão', 'Carreta'].map(c => <option key={c} value={c}>{c}</option>)}
                        </PrettySelect>
                        <Button onClick={handleAdd} size="sm" iconName="Plus" disabled={salvando || !novoNome.trim()}>Add</Button>
                    </div>
                </div>
            </div>
            {ConfirmDialog}
        </div>
    );
}
