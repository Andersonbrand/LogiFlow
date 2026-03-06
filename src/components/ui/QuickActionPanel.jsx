import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';

const SCREEN_ACTIONS = {
    '/main-dashboard': [
        {
            id: 'novo-romaneio',
            label: 'Criar Romaneio',
            icon: 'FilePlus',
            variant: 'default',
            path: '/romaneios',
            tooltip: 'Criar novo romaneio de carga',
        },
    ],
    '/material-catalog': [
        {
            id: 'cadastrar-material',
            label: 'Cadastrar Material',
            icon: 'Plus',
            variant: 'default',
            path: null,
            tooltip: 'Adicionar novo material ao catálogo',
        },
    ],
    '/vehicle-fleet-management': [
        {
            id: 'cadastrar-veiculo',
            label: 'Cadastrar Veículo',
            icon: 'Plus',
            variant: 'default',
            path: null,
            tooltip: 'Adicionar novo veículo à frota',
        },
    ],
};

export default function QuickActionPanel({ onAction, className = '' }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [fabOpen, setFabOpen] = useState(false);

    const actions = SCREEN_ACTIONS?.[location?.pathname] || [];

    const handleActionClick = (action) => {
        if (action?.path) {
            navigate(action?.path);
        }
        if (onAction) onAction(action);
        setFabOpen(false);
    };

    if (actions?.length === 0) return null;

    const primaryAction = actions?.[0];
    const secondaryActions = actions?.slice(1);

    return (
        <>
            {/* Desktop: inline action panel */}
            <div className={`quick-action-panel hidden md:flex ${className}`} role="toolbar" aria-label="Ações rápidas">
                {actions?.map((action) => (
                    <Button
                        key={action?.id}
                        variant={action?.variant}
                        iconName={action?.icon}
                        iconPosition="left"
                        iconSize={16}
                        title={action?.tooltip}
                        onClick={() => handleActionClick(action)}
                    >
                        {action?.label}
                    </Button>
                ))}
            </div>
            {/* Mobile: FAB with optional sub-actions */}
            <div className="md:hidden">
                {secondaryActions?.length > 0 && fabOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-[45]"
                            onClick={() => setFabOpen(false)}
                            aria-hidden="true"
                        />
                        {/* Sub-action buttons */}
                        <div className="fixed bottom-24 right-6 z-[50] flex flex-col gap-3 items-end">
                            {[...actions]?.reverse()?.map((action) => (
                                <button
                                    key={action?.id}
                                    className="flex items-center gap-2 px-4 py-3 rounded-[10px] text-sm font-medium shadow-elevated transition-all duration-[250ms] cursor-pointer"
                                    style={{
                                        backgroundColor: 'var(--color-card)',
                                        color: 'var(--color-foreground)',
                                        border: '1px solid var(--color-border)',
                                        fontFamily: 'Inter, sans-serif',
                                        minHeight: '44px',
                                        boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
                                        animation: 'fadeInUp 200ms ease-out both',
                                    }}
                                    onClick={() => handleActionClick(action)}
                                    title={action?.tooltip}
                                >
                                    <Icon name={action?.icon} size={18} color="var(--color-primary)" strokeWidth={2} />
                                    <span>{action?.label}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* Main FAB */}
                <button
                    className="quick-action-fab"
                    aria-label={fabOpen ? 'Fechar ações' : primaryAction?.tooltip}
                    aria-expanded={fabOpen}
                    onClick={() => {
                        if (secondaryActions?.length > 0) {
                            setFabOpen((prev) => !prev);
                        } else {
                            handleActionClick(primaryAction);
                        }
                    }}
                >
                    <Icon
                        name={fabOpen ? 'X' : primaryAction?.icon}
                        size={24}
                        color="#FFFFFF"
                        strokeWidth={2}
                    />
                </button>
            </div>
            <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </>
    );
}