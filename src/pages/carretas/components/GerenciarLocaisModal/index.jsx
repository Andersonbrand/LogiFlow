import React, { useState } from 'react';

import { useConfirm, AppIcon as Icon, EditButton, DeleteButton, Button } from 'components';
import { createLocalParada, updateLocalParada, deleteLocalParada } from 'services/carretas';

// ─── Modal: gerenciar catálogo de locais (Fábrica / Outro) ───────────────────
export default function GerenciarLocaisModal({ locaisFabrica, locaisOutro, onClose, onChanged, showToast }) {
    const { confirm, ConfirmDialog } = useConfirm();
    const [tab, setTab] = useState('Fábrica');
    const [novoNome, setNovoNome] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [editandoNome, setEditandoNome] = useState('');
    const [salvando, setSalvando] = useState(false);
    const lista = tab === 'Fábrica' ? locaisFabrica : locaisOutro;

    const handleAdd = async () => {
        if (!novoNome.trim()) return;
        setSalvando(true);
        try {
            await createLocalParada({ tipo_local: tab, nome: novoNome.trim() });
            setNovoNome('');
            showToast('Local adicionado!', 'success');
            onChanged();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSalvando(false); }
    };

    const handleEditSave = async (id) => {
        if (!editandoNome.trim()) return;
        try {
            await updateLocalParada(id, { nome: editandoNome.trim() });
            setEditandoId(null);
            showToast('Local atualizado!', 'success');
            onChanged();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir local?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteLocalParada(id); showToast('Local excluído.', 'success'); onChanged(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Gerenciar Locais</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={16} color="var(--color-muted-foreground)" /></button>
                </div>
                <div className="flex gap-2 px-5 pt-3">
                    {['Fábrica', 'Outro'].map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium"
                            style={{ backgroundColor: tab === t ? 'var(--color-primary)' : '#F1F5F9', color: tab === t ? '#fff' : 'var(--color-text-secondary)' }}>
                            {t}
                        </button>
                    ))}
                </div>
                <div className="overflow-y-auto flex-1 p-5 space-y-2">
                    {lista.length === 0 && <p className="text-xs text-center py-6" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum local cadastrado neste tipo.</p>}
                    {lista.map(l => (
                        <div key={l.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                            {editandoId === l.id ? (
                                <input autoFocus value={editandoNome} onChange={e => setEditandoNome(e.target.value)}
                                    className="flex-1 px-2 py-1 rounded border text-sm outline-none" style={{ borderColor: 'var(--color-border)' }} />
                            ) : (
                                <span className="flex-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>{l.nome}</span>
                            )}
                            {editandoId === l.id ? (
                                <button onClick={() => handleEditSave(l.id)} className="p-1.5 rounded hover:bg-green-50"><Icon name="Check" size={15} color="#059669" /></button>
                            ) : (
                                <EditButton onClick={() => { setEditandoId(l.id); setEditandoNome(l.nome); }} />
                            )}
                            <DeleteButton onClick={() => handleDelete(l.id)} />
                        </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2">
                        <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder={`Novo local de ${tab}...`}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: 'var(--color-border)' }} />
                        <Button onClick={handleAdd} size="sm" iconName="Plus" disabled={salvando || !novoNome.trim()}>Adicionar</Button>
                    </div>
                </div>
            </div>
            {ConfirmDialog}
        </div>
    );
}
