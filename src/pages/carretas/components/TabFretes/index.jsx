import React, { useState } from 'react';
import { AppIcon as Icon } from 'components';
import PainelCaptacao from './components/PainelCaptacao';
import PainelCustos from './components/PainelCustos';
import TabelaFretes from './components/TabelaFretes';

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TabFretes({ isAdmin }) {
    const [guia, setGuia] = useState('frota');
    const [captacaoValor, setCaptacaoValor] = useState(0);
    const [custoConfig, setCustoConfig] = useState({ custoMedioProduto: 0, custoOperacional: 0 });

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Tabela de Fretes</h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                    Valores de referência por saco para cada destino — atualização: 06/05/2026
                </p>
            </div>

            {/* Sub-guias */}
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-muted)' }}>
                {[
                    { id: 'frota',      label: 'Fretes da Frota',      icon: 'Truck',   cor: '#2563EB' },
                    { id: 'terceiros',  label: 'Fretes de Terceiros',   icon: 'Users',   cor: '#D97706' },
                    { id: 'liz',        label: 'Frete Estoque',         icon: 'Package', cor: '#9333EA' },
                ].map(g => (
                    <button key={g.id} onClick={() => setGuia(g.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={guia === g.id
                            ? { backgroundColor: '#fff', color: g.cor, boxShadow: '0 1px 3px rgba(0,0,0,0.10)' }
                            : { color: 'var(--color-muted-foreground)' }}>
                        <Icon name={g.icon} size={14} color={guia === g.id ? g.cor : 'var(--color-muted-foreground)'} />
                        {g.label}
                    </button>
                ))}
            </div>

            {/* Aviso readonly para não-admin */}
            {!isAdmin && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E' }}>
                    <Icon name="Info" size={13} color="#D97706" />
                    Visualização apenas. Somente administradores podem editar os valores.
                </div>
            )}

            {/* Painel de captação e custos — apenas na guia Frota (própria) */}
            {guia === 'frota' && <PainelCaptacao isAdmin={isAdmin} onChange={setCaptacaoValor} />}
            {guia === 'frota' && <PainelCustos isAdmin={isAdmin} onChange={setCustoConfig} />}

            {/* Conteúdo da guia */}
            {guia === 'frota' && (
                <TabelaFretes
                    tipo="frota"
                    label="Fretes da Frota Própria"
                    icon="Truck"
                    cor="#2563EB"
                    isAdmin={isAdmin}
                    captacaoValor={captacaoValor}
                    custoConfig={custoConfig}
                />
            )}
            {guia === 'terceiros' && (
                <TabelaFretes
                    tipo="terceiros"
                    label="Fretes de Terceiros"
                    icon="Users"
                    cor="#D97706"
                    isAdmin={isAdmin}
                />
            )}
            {guia === 'liz' && (
                <TabelaFretes
                    tipo="liz"
                    label="Frete Estoque"
                    icon="Package"
                    cor="#9333EA"
                    isAdmin={isAdmin}
                />
            )}
        </div>
    );
}
