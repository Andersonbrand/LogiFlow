import React, { useState } from 'react';
import Icon from 'components/AppIcon';
import { ModalOverlay, ModalHeader } from 'components/ui/ModalShell';
import { createChecklistItem, updateChecklistItem, deleteChecklistItem, reordenarChecklistItem } from 'utils/carretasService';

/**
 * ChecklistItensManagerModal — painel do admin para adicionar, editar,
 * reordenar e excluir os itens verificados no checklist dos motoristas.
 */
export default function ChecklistItensManagerModal({ itens, onReload, onClose, showToast, confirm }) {
    const [novoLabel, setNovoLabel] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [editLabel, setEditLabel] = useState('');
    const [salvando, setSalvando] = useState(false);

    const handleAdd = async () => {
        if (!novoLabel.trim()) return;
        setSalvando(true);
        try {
            await createChecklistItem(novoLabel.trim());
            setNovoLabel('');
            await onReload();
            showToast('Item adicionado!', 'success');
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSalvando(false); }
    };

    const iniciarEdicao = (item) => { setEditandoId(item.id); setEditLabel(item.label); };

    const salvarEdicao = async (item) => {
        if (!editLabel.trim()) return;
        try {
            await updateChecklistItem(item.id, { label: editLabel.trim() });
            setEditandoId(null);
            await onReload();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const mover = async (item, direcao) => {
        try {
            await reordenarChecklistItem(item.id, direcao, itens);
            await onReload();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const excluir = async (item) => {
        const ok = await confirm({
            title: 'Excluir item do checklist?',
            message: `"${item.label}" deixará de aparecer em novos checklists. Checklists já enviados não são alterados.`,
            confirmLabel: 'Excluir', variant: 'danger',
        });
        if (!ok) return;
        try {
            await deleteChecklistItem(item.id);
            await onReload();
            showToast('Item excluído.', 'warning');
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const toggleAtivo = async (item) => {
        try {
            await updateChecklistItem(item.id, { ativo: !item.ativo });
            await onReload();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <ModalOverlay onClose={onClose}>
            <ModalHeader title="Itens do Checklist" icon="ListChecks" onClose={onClose} />
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                    Estes são os itens que os motoristas verificam em cada checklist. Adicione, edite a ordem ou desative os que não fizerem mais sentido.
                </p>

                <div className="flex gap-2">
                    <input value={novoLabel} onChange={e => setNovoLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                        placeholder="Novo item (ex: Nível de água do radiador)"
                        className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
                    <button onClick={handleAdd} disabled={salvando || !novoLabel.trim()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-primary)' }}>
                        <Icon name="Plus" size={15} color="white" />Adicionar
                    </button>
                </div>

                <div className="flex flex-col divide-y rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    {itens.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2 p-2.5" style={{ backgroundColor: item.ativo ? 'white' : '#F9FAFB' }}>
                            <div className="flex flex-col">
                                <button type="button" disabled={idx === 0} onClick={() => mover(item, 'up')} className="disabled:opacity-20 hover:bg-gray-100 rounded p-0.5">
                                    <Icon name="ChevronUp" size={13} color="var(--color-muted-foreground)" />
                                </button>
                                <button type="button" disabled={idx === itens.length - 1} onClick={() => mover(item, 'down')} className="disabled:opacity-20 hover:bg-gray-100 rounded p-0.5">
                                    <Icon name="ChevronDown" size={13} color="var(--color-muted-foreground)" />
                                </button>
                            </div>

                            {editandoId === item.id ? (
                                <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(item); if (e.key === 'Escape') setEditandoId(null); }}
                                    autoFocus
                                    className="flex-1 px-2 py-1 rounded-md border text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                    style={{ borderColor: 'var(--color-border)' }} />
                            ) : (
                                <span className="flex-1 text-sm" style={{ color: item.ativo ? 'var(--color-text-primary)' : 'var(--color-muted-foreground)' }}>
                                    {item.label}{!item.ativo && <span className="ml-2 text-[10px] uppercase font-semibold text-gray-400">(inativo)</span>}
                                </span>
                            )}

                            {editandoId === item.id ? (
                                <>
                                    <button onClick={() => salvarEdicao(item)} className="p-1.5 rounded-lg hover:bg-green-50" title="Salvar"><Icon name="Check" size={15} color="#059669" /></button>
                                    <button onClick={() => setEditandoId(null)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Cancelar"><Icon name="X" size={15} color="var(--color-muted-foreground)" /></button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => toggleAtivo(item)} className="p-1.5 rounded-lg hover:bg-gray-100" title={item.ativo ? 'Desativar' : 'Ativar'}>
                                        <Icon name={item.ativo ? 'Eye' : 'EyeOff'} size={15} color="var(--color-muted-foreground)" />
                                    </button>
                                    <button onClick={() => iniciarEdicao(item)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Editar"><Icon name="Pencil" size={15} color="var(--color-muted-foreground)" /></button>
                                    <button onClick={() => excluir(item)} className="p-1.5 rounded-lg hover:bg-red-50" title="Excluir"><Icon name="Trash2" size={15} color="#DC2626" /></button>
                                </>
                            )}
                        </div>
                    ))}
                    {itens.length === 0 && (
                        <div className="p-4 text-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum item cadastrado ainda.</div>
                    )}
                </div>
            </div>
            <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Fechar</button>
            </div>
        </ModalOverlay>
    );
}
