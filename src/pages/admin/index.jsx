import React, { useState, useEffect } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { fetchAllUsers, updateUserProfile, fetchMaintenanceAlerts, resolveMaintenanceAlert } from 'utils/userService';
import { useNavigate } from 'react-router-dom';

const ROLE_CONFIG = {
    admin:     { label: 'Admin',     color: '#7C3AED', bg: '#EDE9FE' },
    operador:  { label: 'Operador',  color: '#1D4ED8', bg: '#DBEAFE' },
    motorista: { label: 'Motorista', color: '#065F46', bg: '#D1FAE5' },
};

export default function AdminPanel() {
    const { profile, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { toast, showToast } = useToast();
    const [users, setUsers] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [tab, setTab] = useState('usuarios');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile && !isAdmin()) { navigate('/'); return; }
        if (profile) load();
    }, [profile]);

    const load = async () => {
        setLoading(true);
        try {
            const [u, a] = await Promise.all([fetchAllUsers(), fetchMaintenanceAlerts()]);
            setUsers(u);
            setAlerts(a);
        } catch (err) {
            showToast('Erro ao carregar dados: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, role) => {
        try {
            await updateUserProfile(userId, { role });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
            showToast('Permissão atualizada!');
        } catch (err) {
            showToast('Erro: ' + err.message, 'error');
        }
    };

    const handleResolveAlert = async (id) => {
        try {
            await resolveMaintenanceAlert(id);
            setAlerts(prev => prev.filter(a => a.id !== id));
            showToast('Alerta resolvido!');
        } catch (err) {
            showToast('Erro: ' + err.message, 'error');
        }
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-xl mx-auto px-4 md:px-6 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, backgroundColor: '#7C3AED1A' }}>
                            <Icon name="Shield" size={22} color="#7C3AED" />
                        </div>
                        <div>
                            <h1 className="font-heading font-bold text-2xl" style={{ color: 'var(--color-text-primary)' }}>Painel Admin</h1>
                            <p className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Usuários, permissões e alertas do sistema</p>
                        </div>
                    </div>

                    <div className="flex border-b mb-6" style={{ borderColor: 'var(--color-border)' }}>
                        {[['usuarios','Usuários & Permissões','Users'], ['alertas','Alertas de Manutenção','AlertTriangle']].map(([key, label, icon]) => (
                            <button key={key} onClick={() => setTab(key)}
                                className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium font-caption border-b-2 transition-colors ${tab === key ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <Icon name={icon} size={15} color="currentColor" />
                                {label}
                                {key === 'alertas' && alerts.length > 0 && (
                                    <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">{alerts.length}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : tab === 'usuarios' ? (
                        <div className="bg-white rounded-xl border shadow-card overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="w-full text-sm">
                                <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Usuário</th>
                                        <th className="px-4 py-3 text-left font-medium">Perfil</th>
                                        <th className="px-4 py-3 text-left font-medium">Alterar Para</th>
                                        <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Membro desde</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => {
                                        const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.operador;
                                        const isMe = u.id === profile?.id;
                                        return (
                                            <tr key={u.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: rc.color }}>
                                                            {(u.name || '?')[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{u.name || 'Sem nome'}</p>
                                                            {isMe && <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#EDE9FE', color: '#7C3AED' }}>Você</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium font-caption" style={{ backgroundColor: rc.bg, color: rc.color }}>{rc.label}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isMe ? (
                                                        <span className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Não pode alterar próprio perfil</span>
                                                    ) : (
                                                        <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                                                            className="h-8 px-2 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none">
                                                            <option value="operador">Operador</option>
                                                            <option value="admin">Admin</option>
                                                            <option value="motorista">Motorista</option>
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 hidden md:table-cell text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {alerts.length === 0 ? (
                                <div className="bg-white rounded-xl border shadow-card p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
                                    <Icon name="CheckCircle2" size={40} color="#059669" />
                                    <p className="mt-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum alerta pendente</p>
                                </div>
                            ) : alerts.map(a => (
                                <div key={a.id} className="bg-white rounded-xl border shadow-card p-4 flex items-start gap-4" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, backgroundColor: '#FEE2E2' }}>
                                        <Icon name="AlertTriangle" size={18} color="#DC2626" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{a.mensagem}</p>
                                        <p className="text-xs mt-0.5 font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                            {a.vehicles?.placa} · {a.vehicles?.tipo} · {new Date(a.created_at).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <Button variant="outline" size="sm" iconName="Check" iconSize={14} onClick={() => handleResolveAlert(a.id)}>Resolver</Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
            <Toast toast={toast} />
        </div>
    );
}
