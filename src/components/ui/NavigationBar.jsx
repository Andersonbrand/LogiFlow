import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from 'components/AppIcon';
import MobileMenuOverlay from './MobileMenuOverlay';
import { useAuth } from 'utils/AuthContext';
import NotificationBell from 'components/ui/NotificationBell';

const NAV_ITEMS = [
    { id: 'dashboard',    name: 'Dashboard',   path: '/',                         icon: 'LayoutDashboard', roles: ['admin','operador'] },
    { id: 'romaneios',    name: 'Romaneios',   path: '/romaneios',                icon: 'FileText',        roles: ['admin','operador'] },
    { id: 'materiais',    name: 'Materiais',   path: '/material-catalog',         icon: 'Package',         roles: ['admin','operador'] },
    { id: 'veiculos',     name: 'Veículos',    path: '/vehicle-fleet-management', icon: 'Truck',           roles: ['admin','operador'] },
    { id: 'financeiro',   name: 'Financeiro',  path: '/financeiro',               icon: 'DollarSign',      roles: ['admin'] },
    { id: 'consolidacao', name: 'Consolidação',path: '/consolidacao',             icon: 'GitMerge',        roles: ['admin','operador'] },
    { id: 'relatorios',   name: 'Relatórios',  path: '/relatorios',               icon: 'BarChart3',       roles: ['admin','operador'] },
    { id: 'admin',        name: 'Admin',       path: '/admin',                    icon: 'Shield',          roles: ['admin'] },
    // Carretas (admin/operador)
    { id: 'carretas',     name: 'Carretas',    path: '/carretas',              icon: 'Truck',           roles: ['admin','operador'] },
    // Motorista caminhão
    { id: 'motorista',    name: 'Minhas Viagens', path: '/motorista',             icon: 'Truck',           roles: ['motorista'] },
    // Carreteiro
    { id: 'carreteiro',   name: 'Minhas Viagens', path: '/carreteiro',            icon: 'Truck',           roles: ['carreteiro'] },
];

export default function NavigationBar() {
    const location  = useLocation();
    const navigate  = useNavigate();
    const { user, profile, signOut, isAdmin } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled]     = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 4);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => { setMobileOpen(false); }, [location?.pathname]);

    const isActive = (path) => location?.pathname === path || location?.pathname?.startsWith(path + '/');

    const visibleItems = NAV_ITEMS.filter(item =>
        !item.roles || item.roles.includes(profile?.role)
    );

    const handleLogout = async () => {
        try { await signOut(); navigate('/login'); } catch {}
    };

    return (
        <>
            <nav className="nav-bar" style={{ boxShadow: scrolled ? '0 2px 8px rgba(15,23,42,0.12)' : '0 1px 3px rgba(15,23,42,0.08)' }}>
                <div className="nav-container">
                    <div className="nav-logo-area">
                        <div className="nav-logo-icon"><Icon name="Truck" size={20} color="#FFFFFF" strokeWidth={2} /></div>
                        <div className="flex flex-col leading-none">
                            <span className="nav-logo-text mb-2">LogiFlow</span>
                            <span className="nav-logo-sub">Gestão Logística</span>
                        </div>
                    </div>

                    <div className="nav-items hidden tab:flex">
                        {visibleItems.map(item => {
                            const active = isActive(item.path);
                            return (
                                <button key={item.name} onClick={() => navigate(item.path)}
                                    className={`nav-item${active ? ' active' : ''}`}>
                                    <Icon name={item.icon} size={16} color="currentColor" strokeWidth={2} />
                                    <span>{item.name}</span>
                                    {active && <span className="nav-item-indicator" />}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-1">
                        {user && <NotificationBell />}
                        {user && (
                            <div className="hidden tab:flex items-center gap-2 mr-2">
                                <div className="flex items-center justify-center rounded-full text-xs font-semibold text-white"
                                    style={{ width: 30, height: 30, backgroundColor: 'var(--color-primary)', fontSize: 12 }}>
                                    {(profile?.name || user.email || 'U')[0].toUpperCase()}
                                </div>
                                <div className="flex flex-col leading-none">
                                    <span className="text-xs font-medium max-w-[120px] truncate" style={{ color: 'var(--color-text-primary)' }}>
                                        {profile?.name || user.email}
                                    </span>
                                    <span className="text-[10px] font-caption capitalize" style={{ color: 'var(--color-muted-foreground)' }}>
                                        {profile?.role || 'operador'}
                                    </span>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            title="Sair da conta"
                            className="hidden tab:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border"
                            style={{ color: '#DC2626', borderColor: '#FECACA', backgroundColor: 'transparent' }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            <Icon name="LogOut" size={14} color="#DC2626" strokeWidth={2} />
                            <span>Sair</span>
                        </button>
                        <button className="nav-mobile-toggle tab:hidden" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}>
                            <Icon name="Menu" size={22} color="currentColor" />
                        </button>
                    </div>
                </div>
            </nav>
            <MobileMenuOverlay
                isOpen={mobileOpen}
                onClose={() => setMobileOpen(false)}
                navItems={visibleItems}
                activeChecker={isActive}
                onNavigate={(path) => navigate(path)}
                onLogout={handleLogout}
                user={user}
                profile={profile}
            />
        </>
    );
}
