/**
 * AccessDeniedModal — modal reutilizável para bloquear ações de não-admins
 * Uso: <AccessDeniedModal show={show} onClose={() => setShow(false)} />
 */
import React from 'react';
import Icon from 'components/AppIcon';

export default function AccessDeniedModal({ show, onClose }) {
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <Icon name="ShieldOff" size={28} color="#DC2626" />
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">Acesso Restrito</h3>
                <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                    Somente <strong>administradores</strong> têm acesso a essa função.<br />
                    Entre em contato com o administrador do sistema.
                </p>
                <button
                    onClick={onClose}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: '#1E3A5F' }}>
                    Entendido
                </button>
            </div>
        </div>
    );
}
