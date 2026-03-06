import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from 'components/AppIcon';

const ROUTE_META = {
    '/main-dashboard': { label: 'Dashboard', icon: 'LayoutDashboard' },
    '/material-catalog': { label: 'Materiais', icon: 'Package' },
    '/vehicle-fleet-management': { label: 'Veículos', icon: 'Truck' },
    '/romaneios': { label: 'Romaneios', icon: 'FileText' },
    '/romaneios/novo': { label: 'Novo Romaneio', icon: 'FilePlus' },
    '/alocacao': { label: 'Alocação', icon: 'GitBranch' },
    '/relatorios': { label: 'Relatórios', icon: 'BarChart2' },
};

export default function BreadcrumbTrail({ className = '' }) {
    const location = useLocation();
    const navigate = useNavigate();

    const crumbs = useMemo(() => {
        const parts = location?.pathname?.split('/')?.filter(Boolean);
        const result = [{ label: 'Início', path: '/main-dashboard', icon: 'Home' }];

        let accumulated = '';
        parts?.forEach((part) => {
            accumulated += '/' + part;
            const meta = ROUTE_META?.[accumulated];
            if (meta && accumulated !== '/main-dashboard') {
                result?.push({ label: meta.label, path: accumulated, icon: meta.icon });
            }
        });

        return result;
    }, [location?.pathname]);

    // Don't render on dashboard (only one crumb)
    if (crumbs?.length <= 1) return null;

    return (
        <nav
            aria-label="Navegação estrutural"
            className={`breadcrumb-trail ${className}`}
        >
            {crumbs?.map((crumb, index) => {
                const isLast = index === crumbs?.length - 1;
                return (
                    <React.Fragment key={crumb?.path}>
                        {index > 0 && (
                            <span className="breadcrumb-separator" aria-hidden="true">
                                <Icon name="ChevronRight" size={14} color="currentColor" strokeWidth={2} />
                            </span>
                        )}
                        <span
                            className={`breadcrumb-item${isLast ? ' current' : ' clickable'}`}
                            onClick={!isLast ? () => navigate(crumb?.path) : undefined}
                            role={!isLast ? 'button' : undefined}
                            tabIndex={!isLast ? 0 : undefined}
                            aria-current={isLast ? 'page' : undefined}
                            onKeyDown={!isLast ? (e) => { if (e?.key === 'Enter' || e?.key === ' ') navigate(crumb?.path); } : undefined}
                            onFocus={!isLast ? (e) => { e.currentTarget.style.outline = '2px solid var(--color-ring)'; e.currentTarget.style.outlineOffset = '2px'; e.currentTarget.style.borderRadius = '4px'; } : undefined}
                            onBlur={!isLast ? (e) => { e.currentTarget.style.outline = ''; } : undefined}
                        >
                            <Icon name={crumb?.icon} size={13} color="currentColor" strokeWidth={2} />
                            <span>{crumb?.label}</span>
                        </span>
                    </React.Fragment>
                );
            })}
        </nav>
    );
}