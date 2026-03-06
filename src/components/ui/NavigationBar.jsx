import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from 'components/AppIcon';
import MobileMenuOverlay from './MobileMenuOverlay';
import { useAuth } from 'utils/AuthContext';
import NotificationBell from 'components/ui/NotificationBell';

const NAV_ITEMS = [
    { name: 'Dashboard',  path: '/',                         icon: 'LayoutDashboard' },
    { name: 'Romaneios',  path: '/romaneios',                icon: 'FileText' },
    { name: 'Materiais',  path: '/material-catalog',         icon: 'Package' },
    { name: 'Veículos',   path: '/vehicle-fleet-management', icon: 'Truck' },
    { name: 'Financeiro',    path: '/financeiro',               icon: 'DollarSign' },
    { name: 'Consolidação',  path: '/consolidacao',             icon: 'GitMerge' },
    { name: 'Relatórios', path: '/relatorios',               icon: 'BarChart3' },
    { name: 'Admin',      path: '/admin',                    icon: 'Shield', adminOnly: true },
];

export default function NavigationBar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, profile, signOut, isAdmin } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 4);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => { setMobileOpen(false); }, [location?.pathname]);

    const isActive = (path) => location?.pathname === path || location?.pathname?.startsWith(path + '/');

    const handleLogout = async () => {
        try { await signOut(); navigate('/login'); } catch { }
    };

    return (
        <>
            <nav className="nav-bar" style={{ boxShadow: scrolled ? '0 2px 8px rgba(15,23,42,0.12)' : '0 1px 3px rgba(15,23,42,0.08)' }}>
                <div className="nav-container">
                    {/* Logo */}
                    <div className="nav-logo-area">
                        <div className="nav-logo-icon"><Icon name="Truck" size={20} color="#FFFFFF" strokeWidth={2} /></div>
                        <div className="flex flex-col leading-none">
                            <span className="nav-logo-text">LogiFlow</span>
                            <span className="nav-logo-sub">Gestão Logística</span>
                        </div>
                    </div>

                    {/* Desktop Nav */}
                    <div className="nav-items hidden md:flex">
                        {NAV_ITEMS.filter(item => !item.adminOnly || isAdmin?.()).map(item => {
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

                    {/* Right actions */}
                    <div className="flex items-center gap-1">
                        <>{user && <NotificationBell />}</>
                        {user && (
                            <div className="hidden md:flex items-center gap-2 mr-2">
                                <div className="flex items-center justify-center rounded-full text-xs font-semibold text-white"
                                    style={{ width: 30, height: 30, backgroundColor: 'var(--color-primary)', fontSize: 12 }}>
                                    {(user.user_metadata?.name || user.email || 'U')[0].toUpperCase()}
                                </div>
                                <span className="text-xs font-caption max-w-[120px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                                    {user.user_metadata?.name || user.email}
                                </span>
                            </div>
                        )}
                        <button className="nav-mobile-toggle hidden md:flex" title="Sair" onClick={handleLogout}>
                            <Icon name="LogOut" size={18} color="currentColor" />
                        </button>
                        <button className="nav-mobile-toggle md:hidden" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}>
                            <Icon name="Menu" size={22} color="currentColor" />
                        </button>
                    </div>
                </div>
            </nav>
            <MobileMenuOverlay
                isOpen={mobileOpen}
                onClose={() => setMobileOpen(false)}
                navItems={NAV_ITEMS}
                activeChecker={isActive}
                onNavigate={(path) => navigate(path)}
            />
        </>
    );
}
