import React, { useState } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import { createMaterialCategory, deleteMaterialCategory } from 'utils/materialService';
import { useConfirm } from 'components/ui/ConfirmDialog';

/**
 * CategoryManagerModal — permite criar e excluir categorias de produto
 * usadas no formulário de cadastro de materiais (tabela material_categories).
 */
export default function CategoryManagerModal({ isOpen, onClose, categorias, onChange }) {
    const [novoNome, setNovoNome] = useState('');
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const { confirm, ConfirmDialog } = useConfirm();

    if (!isOpen) return null;

    const handleAdd = async () => {
        const nome = novoNome.trim();
        if (!nome) return;
        if (categorias.some(c => c.nome.toLowerCase() === nome.toLowerCase())) {
            setError('Essa categoria já existe.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const created = await createMaterialCategory(nome);
            onChange([...categorias, created].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
            setNovoNome('');
        } catch (err) {
            setError('Erro ao criar categoria: ' + (err.message || ''));
        } finally { setLoading(false); }
    };

    const handleDelete = async (cat) => {
        const ok = await confirm({
            title: `Excluir "${cat.nome}"?`,
            message: 'Materiais já cadastrados com essa categoria não serão alterados, mas ela deixará de aparecer na lista de opções.',
            variant: 'danger',
            confirmLabel: 'Excluir',
        });
        if (!ok) return;
        try {
            await deleteMaterialCategory(cat.id);
            onChange(categorias.filter(c => c.id !== cat.id));
        } catch (err) {
            setError('Erro ao excluir categoria: ' + (err.message || ''));
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <h2 className="font-heading font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Gerenciar Categorias</h2>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
                        <Icon name="X" size={16} color="var(--color-muted-foreground)" />
                    </button>
                </div>

                <div className="px-5 py-4">
                    <div className="flex gap-2 mb-2">
                        <input
                            value={novoNome}
                            onChange={e => { setNovoNome(e.target.value); setError(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            placeholder="Nova categoria"
                            className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none bg-white"
                        />
                        <Button variant="default" onClick={handleAdd} loading={loading} iconName="Plus" iconSize={14}>
                            Adicionar
                        </Button>
                    </div>
                    {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

                    <div className="max-h-64 overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                        {categorias.length === 0 ? (
                            <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma categoria cadastrada</p>
                        ) : (
                            categorias.map((c, i) => (
                                <div key={c.id} className={`flex items-center justify-between px-3 py-2 ${i !== categorias.length - 1 ? 'border-b' : ''}`} style={{ borderColor: 'var(--color-border)' }}>
                                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{c.nome}</span>
                                    <button onClick={() => handleDelete(c)} className="rounded-md p-1 hover:bg-red-50">
                                        <Icon name="Trash2" size={14} color="#DC2626" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="px-5 py-3 border-t flex justify-end" style={{ borderColor: 'var(--color-border)' }}>
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </div>
            </div>
            {ConfirmDialog}
        </div>
    );
}
