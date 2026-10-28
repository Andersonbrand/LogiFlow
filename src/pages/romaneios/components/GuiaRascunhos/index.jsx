import React from 'react';

import { AppIcon as Icon } from 'components';

import RascunhoCard from '../RascunhoCard';

export default function GuiaRascunhos({ rascunhos, loading, onNew, onEdit, onDelete, onPromover }) {
    if (loading) return (
        <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: '#D97706', borderTopColor: 'transparent' }} />
        </div>
    );
    return (
        <div>
            <div className="flex items-start gap-3 p-3 rounded-xl border mb-5" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                <Icon name="Info" size={14} color="#92400E" style={{ marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs" style={{ color: '#92400E' }}>
                    Rascunhos são romaneios em formação. Adicione pedidos cumulativos com materiais e fretes calculados automaticamente.
                    Quando a carga estiver pronta, clique em <strong>Promover</strong> — o romaneio oficial é criado com número sequencial e todos os dados são aproveitados.
                </p>
            </div>
            {rascunhos.length === 0 ? (
                <div className="bg-white rounded-xl border shadow-card p-12 flex flex-col items-center gap-3 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
                        <Icon name="ClipboardList" size={28} color="#D97706" />
                    </div>
                    <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum rascunho criado</p>
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Crie um rascunho para planejar a carga antes de emitir o romaneio oficial.</p>
                    <button onClick={onNew} className="mt-1 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#D97706' }}>
                        Criar primeiro rascunho
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {rascunhos.map(r => <RascunhoCard key={r.id} r={r} onEdit={onEdit} onDelete={onDelete} onPromover={onPromover} />)}
                </div>
            )}
        </div>
    );
}
