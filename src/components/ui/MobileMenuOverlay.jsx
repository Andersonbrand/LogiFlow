import React, { useEffect, useRef } from 'react';
import Icon from 'components/AppIcon';

export default function MobileMenuOverlay({ isOpen, onClose, navItems = [], activeChecker, onNavigate }) {
    const panelRef = useRef(null);
    const closeButtonRef = useRef(null);

    // Focus trap and ESC key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e?.key === 'Escape') onClose();
            if (e?.key === 'Tab') {
                const focusable = panelRef?.current?.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabIndex="-1"])'
                );
                if (!focusable || focusable?.length === 0) return;
                const first = focusable?.[0];
                const last = focusable?.[focusable?.length - 1];
                if (e?.shiftKey && document.activeElement === first) {
                    e?.preventDefault();
                    last?.focus();
                } else if (!e?.shiftKey && document.activeElement === last) {
                    e?.preventDefault();
                    first?.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        setTimeout(() => closeButtonRef?.current?.focus(), 50);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleItemClick = (path) => {
        onNavigate(path);
        onClose();
    };

    return (
        <div id="mobile-menu-overlay" role="dialog" aria-modal="true" aria-label="Menu de navegação">
            {/* Backdrop */}
            <div
                className="mobile-overlay-backdrop"
                onClick={onClose}
                aria-hidden="true"
            />
            {/* Panel */}
            <div
                ref={panelRef}
                className="mobile-overlay-panel"
                style={{
                    animation: 'slideInLeft 250ms cubic-bezier(0.4,0,0.2,1) both',
                }}
            >
                {/* Header */}
                <div className="mobile-overlay-header">
                    <div className="flex items-center gap-3">
                        <div className="nav-logo-icon" aria-hidden="true">
                            <Icon name="Truck" size={18} color="#FFFFFF" strokeWidth={2} />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="nav-logo-text" style={{ fontSize: '1rem' }}>LogiFlow</span>
                            <span className="nav-logo-sub">Gestão Logística</span>
                        </div>
                    </div>
                    <button
                        ref={closeButtonRef}
                        className="nav-mobile-toggle"
                        aria-label="Fechar menu"
                        onClick={onClose}
                    >
                        <Icon name="X" size={20} color="currentColor" strokeWidth={2} />
                    </button>
                </div>

                {/* Nav Items */}
                <nav className="mobile-overlay-nav" aria-label="Menu mobile">
                    {navItems?.map((item) => {
                        const active = activeChecker ? activeChecker(item?.path) : false;
                        return (
                            <button
                                key={item?.path || item?.name}
                                className={`mobile-nav-item${active ? ' active' : ''}`}
                                aria-current={active ? 'page' : undefined}
                                onClick={() => handleItemClick(item?.path)}
                                style={{ outline: 'none', width: '100%', textAlign: 'left' }}
                                onFocus={(e) => { if (!active) e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring)'; }}
                                onBlur={(e) => { e.currentTarget.style.boxShadow = ''; }}
                            >
                                <Icon name={item?.icon} size={20} color="currentColor" strokeWidth={2} />
                                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem' }}>{item?.label}</span>
                                {active && (
                                    <span className="ml-auto">
                                        <Icon name="ChevronRight" size={16} color="currentColor" strokeWidth={2} />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div
                    className="px-4 py-4 border-t border-border flex items-center gap-3"
                    style={{ flexShrink: 0 }}
                >
                    <button
                        className="mobile-nav-item flex-1"
                        style={{ outline: 'none' }}
                        onClick={onClose}
                        aria-label="Perfil do usuário"
                    >
                        <Icon name="UserCircle" size={20} color="currentColor" strokeWidth={2} />
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>Meu Perfil</span>
                    </button>
                    <button
                        className="mobile-nav-item"
                        style={{ outline: 'none', minWidth: 44 }}
                        aria-label="Notificações"
                    >
                        <Icon name="Bell" size={20} color="currentColor" strokeWidth={2} />
                    </button>
                </div>
            </div>
            <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0.6; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
        </div>
    );
}