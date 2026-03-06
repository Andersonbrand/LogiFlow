import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from 'components/AppIcon';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from 'utils/userService';
import { useAuth } from 'utils/AuthContext';

// ✅ MELHORIA: NotificationBell com badge persistente, histórico e integração com alertas
export default function NotificationBell() {
    const { user } = useAuth();
    const [notifs, setNotifs]   = useState([]);
    const [open, setOpen]       = useState(false);
    const ref                   = useRef();

    const unread = notifs.filter(n => !n.lida).length;

    const load = useCallback(async () => {
        if (!user) return;
        try {
            const data = await fetchNotifications(user.id);
            setNotifs(data || []);
        } catch {
            // silently fail — não interrompe o uso do app
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        load();
        // Polling a cada 30s para manter badge atualizado
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, [user, load]);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleMarkRead = async (id) => {
        try {
            await markNotificationRead(id);
            setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
        } catch {}
    };

    const handleMarkAll = async () => {
        try {
            await markAllNotificationsRead(user.id);
            setNotifs(prev => prev.map(n => ({ ...n, lida: true })));
        } catch {}
    };

    const TIPO_CONFIG = {
        status_change: { icon: 'RefreshCw',     color: '#1D4ED8', bg: '#DBEAFE' },
        alert:         { icon: 'AlertTriangle',  color: '#D97706', bg: '#FEF9C3' },
        maintenance:   { icon: 'Wrench',         color: '#DC2626', bg: '#FEE2E2' },
        system:        { icon: 'Info',           color: '#6B7280', bg: '#F1F5F9' },
    };

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMin = Math.floor((now - d) / 60000);
        if (diffMin < 1) return 'agora';
        if (diffMin < 60) return `${diffMin}min atrás`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `${diffH}h atrás`;
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Notificações"
                aria-label={`Notificações${unread > 0 ? ` — ${unread} não lidas` : ''}`}
            >
                <Icon name="Bell" size={20} color="#FFFFFF" />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border z-[500] overflow-hidden"
                    style={{ borderColor: 'var(--color-border)' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2">
                            <span className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                Notificações
                            </span>
                            {unread > 0 && (
                                <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-mono">
                                    {unread}
                                </span>
                            )}
                        </div>
                        {unread > 0 && (
                            <button
                                onClick={handleMarkAll}
                                className="text-xs font-caption hover:underline flex items-center gap-1"
                                style={{ color: 'var(--color-primary)' }}
                            >
                                <Icon name="CheckCheck" size={12} color="currentColor" />
                                Marcar todas
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: 'var(--color-border)' }}>
                        {notifs.length === 0 ? (
                            <div className="py-10 text-center flex flex-col items-center gap-2">
                                <Icon name="BellOff" size={28} color="var(--color-muted-foreground)" />
                                <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                    Nenhuma notificação
                                </p>
                            </div>
                        ) : notifs.map(n => {
                            const cfg = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.system;
                            return (
                                <div
                                    key={n.id}
                                    className={`px-4 py-3 flex items-start gap-3 transition-colors hover:bg-gray-50 cursor-pointer ${!n.lida ? 'bg-blue-50/40' : ''}`}
                                    onClick={() => handleMarkRead(n.id)}
                                >
                                    <div className="flex-shrink-0 mt-0.5 rounded-lg p-1.5" style={{ backgroundColor: cfg.bg }}>
                                        <Icon name={cfg.icon} size={13} color={cfg.color} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                                            {n.titulo}
                                        </p>
                                        {n.mensagem && (
                                            <p className="text-xs mt-0.5 leading-snug line-clamp-2" style={{ color: 'var(--color-muted-foreground)' }}>
                                                {n.mensagem}
                                            </p>
                                        )}
                                        <p className="text-[10px] mt-1 font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                            {formatTime(n.created_at)}
                                        </p>
                                    </div>
                                    {!n.lida && (
                                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    {notifs.length > 0 && (
                        <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: 'var(--color-border)' }}>
                            <span className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                {notifs.length} notificação{notifs.length !== 1 ? 'ões' : ''} no histórico
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
