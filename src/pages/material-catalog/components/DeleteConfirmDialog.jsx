import React from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';

export default function DeleteConfirmDialog({ material, onConfirm, onCancel }) {
    if (!material) return null;
    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" style={ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' } onClick={e => e.target === e.currentTarget && onCancel()}>
            <div className="bg-[var(--color-card)] rounded-xl shadow-2xl w-full max-w-sm p-6">
                <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                        <Icon name="Trash2" size={28} color="#DC2626" />
                    </div>
                    <h3 className="font-heading font-semibold text-[var(--color-text-primary)] text-lg">Excluir Material</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Tem certeza que deseja excluir <span className="font-semibold text-[var(--color-text-primary)]">"{material?.nome}"</span>? Esta ação não pode ser desfeita.
                    </p>
                </div>
                <div className="flex gap-3 mt-6">
                    <Button variant="outline" fullWidth onClick={onCancel}>Cancelar</Button>
                    <Button variant="destructive" fullWidth onClick={() => onConfirm(material?.id)} iconName="Trash2" iconPosition="left">
                        Excluir
                    </Button>
                </div>
            </div>
        </div>
    );
}