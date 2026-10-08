import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from 'components/AppIcon';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications, deleteNotification, inicioDoMesAtualISO } from 'utils/userService';
import { useAuth } from 'utils/AuthContext';
import { subscribeTabela } from 'utils/supabaseClient';
import { setIntervalVisivel } from 'utils/pollingVisivel';

// ✅ MELHORIA: NotificationBell com badge persistente, histórico e integração com alertas
export default function NotificationBell() {
    const { user } = useAuth();
    const [notifs, setNotifs]   = useState([]);
    const [open, setOpen]       = useState(false);
    const ref                   = useRef();
    const ultimaCargaRef        = useRef(0);
    const mesRef                = useRef(inicioDoMesAtualISO());

    // Só exibe notificações do mês corrente; ao virar o mês as antigas somem sozinhas
    const visiveis = notifs.filter(n => new Date(n.created_at) >= new Date(mesRef.current));
    const unread = visiveis.filter(n => !n.lida).length;

    const load = useCallback(async () => {
        if (!user) return;
        ultimaCargaRef.current = Date.now();
        try {
            const data = await fetchNotifications(user.id);
            setNotifs(data || []);
            mesRef.current = inicioDoMesAtualISO();
        } catch {
            // silently fail — não interrompe o uso do app
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        load();
        // Antes: consulta a cada 30 s em TODA aba aberta, mesmo oculta (até 2.880
        // requisições/dia por aba, cada uma vira log no Supabase). Agora:
        //  1) Realtime filtrado só nas notificações deste usuário (atualiza na hora);
        //  2) polling de segurança a cada 3 min, somente com a aba visível;
        //  3) ao voltar para a aba, recarrega se passou mais de 1 min desde a última carga.
        const unsub = subscribeTabela('notifications', load, 1000, `user_id=eq.${user.id}`);
        const stopPoll = setIntervalVisivel(load, 3 * 60 * 1000);
        const aoVoltar = () => {
            if (!document.hidden && Date.now() - ultimaCargaRef.current > 60 * 1000) load();
        };
        document.addEventListener('visibilitychange', aoVoltar);
        return () => {
            unsub();
            stopPoll();
            document.removeEventListener('visibilitychange', aoVoltar);
        };
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

    const handleClearAll = async () => {
        try {
            await clearAllNotifications(user.id);
            setNotifs([]);
        } catch {}
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        try {
            await deleteNotification(id);
            setNotifs(prev => prev.filter(n => n.id !== id));
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
                className="relative transition-all duration-200"
                title="Notificações"
                aria-label={`Notificações${unread > 0 ? ` — ${unread} não lidas` : ''}`}
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    backgroundColor: open ? 'var(--color-muted)' : 'transparent',
                    border: '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'var(--color-muted)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = open ? 'var(--color-muted)' : 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                }}
            >
                <Icon name="Bell" size={16} color="var(--color-text-secondary, #64748B)" />
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="notification-dropdown"
                    style={{
                        position: 'fixed',
                        top: '64px',
                        right: '8px',
                        left: 'auto',
                        width: 'min(320px, calc(100vw - 16px))',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.08)',
                        border: '1px solid var(--color-border)',
                        zIndex: 9999,
                        overflow: 'hidden',
                    }}
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
                        <div className="flex items-center gap-3">
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
                            {visiveis.length > 0 && (
                                <button
                                    onClick={handleClearAll}
                                    className="text-xs font-caption hover:underline flex items-center gap-1"
                                    style={{ color: '#DC2626' }}
                                    title="Excluir todas as notificações"
                                >
                                    <Icon name="Trash2" size={12} color="currentColor" />
                                    Limpar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: 'var(--color-border)' }}>
                        {visiveis.length === 0 ? (
                            <div className="py-10 text-center flex flex-col items-center gap-2">
                                <Icon name="BellOff" size={28} color="var(--color-muted-foreground)" />
                                <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                    Nenhuma notificação
                                </p>
                            </div>
                        ) : visiveis.map(n => {
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
                                    <button
                                        type="button"
                                        onClick={(e) => handleDelete(e, n.id)}
                                        title="Excluir notificação"
                                        aria-label="Excluir notificação"
                                        className="flex-shrink-0 p-1 rounded hover:bg-slate-200 transition-colors"
                                    >
                                        <Icon name="X" size={12} color="var(--color-muted-foreground)" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    {visiveis.length > 0 && (
                        <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: '#FAFAFA' }}>
                            <span className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                {visiveis.length} notificaç{visiveis.length !== 1 ? 'ões' : 'ão'} neste mês
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
