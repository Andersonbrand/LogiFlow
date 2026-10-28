import React, { useState } from 'react';
import { AppIcon as Icon } from 'components';
import PainelCustos from './components/PainelCustos';

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TabCustos({ isAdmin }) {
    const [tipoVeiculo, setTipoVeiculo] = useState('carreta');

    return (
        <div className="flex flex-col gap-5">
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-muted)' }}>
                {[
                    { id: 'carreta',  label: 'Carretas',   icon: 'Truck',  cor: '#4F46E5' },
                    { id: 'caminhao', label: 'Caminhões',  icon: 'Truck',  cor: '#0E7490' },
                ].map(g => (
                    <button key={g.id} onClick={() => setTipoVeiculo(g.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={tipoVeiculo === g.id
                            ? { backgroundColor: '#fff', color: g.cor, boxShadow: '0 1px 3px rgba(0,0,0,0.10)' }
                            : { color: 'var(--color-muted-foreground)' }}>
                        <Icon name={g.icon} size={14} color={tipoVeiculo === g.id ? g.cor : 'var(--color-muted-foreground)'} />
                        {g.label}
                    </button>
                ))}
            </div>

            {!isAdmin && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E' }}>
                    <Icon name="Info" size={13} color="#D97706" />
                    Visualização apenas. Somente administradores podem editar os valores.
                </div>
            )}

            <PainelCustos key={tipoVeiculo} tipoVeiculo={tipoVeiculo} isAdmin={isAdmin} />
        </div>
    );
}
