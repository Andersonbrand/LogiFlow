import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import Icon from 'components/AppIcon';
import { useAuth as useAuthUtils } from 'utils/AuthContext';
import { useAuth as useAuthContext } from 'context/AuthContext';
import {
    LICENSE_NOTICE,
    dismissLicenseNotice,
    useLicenseNoticeDismissed,
} from 'utils/licenseNotice';

const DASHBOARD_PATHS = ['/', '/main-dashboard'];
// Perfis que NÃO veem a faixa (motoristas, carreteiros e mecânicos)
const ROLES_SEM_FAIXA = ['motorista', 'carreteiro', 'mecanico'];

// ─── Aviso central (somente no dashboard, a cada login) ──────────────────────
export function LicenseNoticeModal() {
    const dismissed = useLicenseNoticeDismissed();
    const open = LICENSE_NOTICE.enabled && !dismissed;

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') dismissLicenseNotice(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="license-notice-title"
        >
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in"
                style={{ border: '1px solid #FECACA' }}
            >
                <button
                    type="button"
                    onClick={dismissLicenseNotice}
                    aria-label="Fechar aviso"
                    title="Fechar"
                    className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-100"
                >
                    <Icon name="X" size={18} color="#DC2626" />
                </button>

                <div className="px-6 pt-8 pb-8 flex flex-col items-center text-center" style={{ backgroundColor: '#FEF2F2' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm" style={{ backgroundColor: '#FEE2E2' }}>
                        <Icon name="AlertTriangle" size={26} color="#DC2626" />
                    </div>
                    <h3 id="license-notice-title" className="font-heading font-bold text-lg mb-2" style={{ color: '#B91C1C' }}>
                        {LICENSE_NOTICE.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                        {LICENSE_NOTICE.message}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Faixa fixa abaixo do header (todas as páginas) ──────────────────────────
export function LicenseNoticeBanner() {
    const dismissed = useLicenseNoticeDismissed();
    const { pathname } = useLocation();
    // O projeto tem duas cópias do AuthContext; só uma está montada (a outra devolve {}).
    const profile = useAuthUtils()?.profile ?? useAuthContext()?.profile;
    const ref = useRef(null);

    // No dashboard o aviso central aparece primeiro; a faixa entra após o X.
    const onDashboard = DASHBOARD_PATHS.includes(pathname);
    const perfilPermitido = !!profile?.role && !ROLES_SEM_FAIXA.includes(profile.role);
    const visible = LICENSE_NOTICE.enabled && perfilPermitido && (dismissed || !onDashboard);

    // Publica a altura da faixa em --license-banner-h para o conteúdo descer junto.
    useLayoutEffect(() => {
        const root = document.documentElement;
        if (!visible || !ref.current) {
            root.style.setProperty('--license-banner-h', '0px');
            return undefined;
        }
        const el = ref.current;
        const update = () => root.style.setProperty('--license-banner-h', `${el.offsetHeight}px`);
        update();
        let ro;
        if (typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(update);
            ro.observe(el);
        } else {
            window.addEventListener('resize', update);
        }
        return () => {
            ro ? ro.disconnect() : window.removeEventListener('resize', update);
            root.style.setProperty('--license-banner-h', '0px');
        };
    }, [visible]);

    if (!visible) return null;

    return (
        <div
            ref={ref}
            className="fixed left-0 right-0 z-[90] px-3 py-2"
            style={{ top: 60, backgroundColor: 'var(--color-background)' }}
            role="status"
        >
            <div
                className="max-w-screen-2xl mx-auto flex items-center justify-center gap-2.5 rounded-lg px-4 py-2 text-center"
                style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}
            >
                <Icon name="AlertTriangle" size={16} color="#DC2626" className="flex-shrink-0" />
                <span className="text-xs sm:text-sm font-bold" style={{ color: '#B91C1C' }}>
                    {LICENSE_NOTICE.bannerText}
                </span>
            </div>
        </div>
    );
}

export default LicenseNoticeBanner;
