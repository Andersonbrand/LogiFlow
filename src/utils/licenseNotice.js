/**
 * Aviso de fim do período gratuito — configuração + estado compartilhado.
 *
 * Fluxo:
 *  1. A cada login, o dashboard mostra o aviso centralizado (LicenseNoticeModal).
 *  2. Ao clicar no X, o aviso é dispensado e passa a aparecer a faixa vermelha
 *     abaixo do header, em todas as páginas (LicenseNoticeBanner).
 *  3. No logout o estado é limpo, então o modal volta no próximo login.
 *
 * Para mudar datas/textos, edite apenas LICENSE_NOTICE abaixo.
 * Para desligar o aviso por completo: enabled: false.
 */
import { useSyncExternalStore } from 'react';

export const LICENSE_NOTICE = {
    enabled: true,
    title: 'ATENÇÃO!',
    message:
        'O período de utilização gratuita do LogiFlow termina no dia 30/11. ' +
        'Para continuar aproveitando todas as funcionalidades do sistema sem interrupções, ' +
        'regularize seu pagamento antes do vencimento.',
    bannerText: 'O prazo de vencimento para licença gratuita do LogiFlow, expira em 30/11.',
};

const STORAGE_KEY = 'logiflow:license-notice-dismissed';
const listeners = new Set();

function read() {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function emit() { listeners.forEach((l) => l()); }

export function dismissLicenseNotice() {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignora */ }
    emit();
}

/** Chamar no logout: faz o modal reaparecer no próximo login. */
export function resetLicenseNotice() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignora */ }
    emit();
}

function subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

/** true se o usuário já fechou o aviso central nesta sessão de login. */
export function useLicenseNoticeDismissed() {
    return useSyncExternalStore(subscribe, read, () => false);
}
