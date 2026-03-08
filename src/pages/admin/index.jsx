import React, { useState, useEffect } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { fetchAllUsers, updateUserProfile, fetchMaintenanceAlerts, resolveMaintenanceAlert } from 'utils/userService';
import { fetchRomaneios, aprovarRomaneio } from 'utils/romaneioService';
import { fetchBonificacoesConsolidadas, calcularBonificacao } from 'utils/bonificacaoService';
import { useNavigate } from 'react-router-dom';

const BRL = v => Number(v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ROLE_CONFIG = {
    admin:     { label: 'Admin',     color: '#7C3AED', bg: '#EDE9FE' },
    operador:  { label: 'Operador',  color: '#1D4ED8', bg: '#DBEAFE' },
    motorista: { label: 'Motorista', color: '#065F46', bg: '#D1FAE5' },
};

export default function AdminPanel() {
    const { profile, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { toast, showToast } = useToast();
    const [users, setUsers]           = useState([]);
    const [alerts, setAlerts]         = useState([]);
    const [romaneios, setRomaneios]   = useState([]);
    const [bonifs, setBonifs]         = useState([]);
    const [tab, setTab]               = useState('usuarios');
    const [loading, setLoading]       = useState(true);

    useEffect(() => {
        if (profile && !isAdmin()) { navigate('/'); return; }
        if (profile) load();
    }, [profile]);

    const load = async () => {
        setLoading(true);
        try {
            const [u, a, rom] = await Promise.all([
                fetchAllUsers(),
                fetchMaintenanceAlerts(),
                fetchRomaneios(),
            ]);
            setUsers(u || []);
            setAlerts(a || []);
            setRomaneios((rom || []).filter(r => !r.aprovado && r.status !== 'Cancelado'));
        } catch (err) {
            showToast('Erro ao carregar dados: ' + err.message, 'error');
        }
        // Bonificações isoladas para não travar o painel se falhar
        try {
            const bon = await fetchBonificacoesConsolidadas();
            setBonifs(bon || []);
        } catch {
            setBonifs([]);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, role) => {
        try {
            await updateUserProfile(userId, { role });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
            showToast('Permissão atualizada!', 'success');
        } catch (err) {
            showToast('Erro: ' + err.message, 'error');
        }
    };

    const handleResolveAlert = async (id) => {
        try {
            await resolveMaintenanceAlert(id);
            setAlerts(prev => prev.filter(a => a.id !== id));
            showToast('Alerta resolvido!', 'success');
        } catch (err) {
            showToast('Erro: ' + err.message, 'error');
        }
    };

    const handleAprovar = async (romaneio) => {
        try {
            await aprovarRomaneio(romaneio.id, profile.id);
            setRomaneios(prev => prev.filter(r => r.id !== romaneio.id));
            showToast(`Romaneio ${romaneio.numero} aprovado!`, 'success');
        } catch (err) {
            showToast('Erro ao aprovar: ' + err.message, 'error');
        }
    };

    const handleReprovar = async (romaneio) => {
        const motivo = window.prompt(`Motivo da reprovação do romaneio ${romaneio.numero}:
(deixe em branco para não informar)`);
        if (motivo === null) return; // cancelou o prompt
        try {
            await reprovarRomaneio(romaneio.id, profile.id, motivo);
            setRomaneios(prev => prev.filter(r => r.id !== romaneio.id));
            showToast(`Romaneio ${romaneio.numero} reprovado.`, 'warning');
        } catch (err) {
            showToast('Erro ao reprovar: ' + err.message, 'error');
        }
    };

    const TABS = [
        ['usuarios', 'Usuários', 'Users'],
        ['motoristas', 'Motoristas', 'Truck'],
        ['aprovacoes', 'Aprovações', 'CheckSquare', romaneios.length],
        ['bonificacoes', 'Bonificações', 'DollarSign'],
        ['alertas', 'Alertas', 'AlertTriangle', alerts.length],
    ];

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
                            <p className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Usuários, aprovações, bonificações e alertas</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b mb-6 overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                        {TABS.map(([key, label, icon, count]) => (
                            <button key={key} onClick={() => setTab(key)}
                                className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium font-caption border-b-2 transition-colors whitespace-nowrap ${tab === key ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <Icon name={icon} size={15} color="currentColor" />
                                {label}
                                {count > 0 && (
                                    <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">{count}</span>
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
                                                    {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                    ) : tab === 'motoristas' ? (
                        <div className="bg-white rounded-xl border shadow-card overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                                <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Motoristas Cadastrados</h3>
                                <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                    Para cadastrar um motorista, crie um usuário na aba Usuários e defina o perfil como <strong>Motorista</strong>
                                </p>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Nome</th>
                                        <th className="px-4 py-3 text-left font-medium">Membro desde</th>
                                        <th className="px-4 py-3 text-left font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.filter(u => u.role === 'motorista').length === 0 ? (
                                        <tr><td colSpan={3} className="text-center py-10 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                            <div className="flex flex-col items-center gap-2">
                                                <Icon name="Truck" size={32} color="var(--color-muted-foreground)" />
                                                <p>Nenhum motorista cadastrado</p>
                                                <p className="text-xs">Vá até a aba <strong>Usuários</strong>, crie um novo usuário e defina o perfil como <strong>Motorista</strong></p>
                                            </div>
                                        </td></tr>
                                    ) : users.filter(u => u.role === 'motorista').map((u, idx) => (
                                        <tr key={u.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#065F46' }}>
                                                        {(u.name || '?')[0].toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{u.name || 'Sem nome'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                                {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>Ativo</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                    ) : tab === 'aprovacoes' ? (
                        <div className="flex flex-col gap-3">
                            {romaneios.length === 0 ? (
                                <div className="bg-white rounded-xl border shadow-card p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
                                    <Icon name="CheckCircle2" size={40} color="#059669" />
                                    <p className="mt-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum romaneio pendente de aprovação</p>
                                </div>
                            ) : romaneios.map(r => {
                                const bonif = calcularBonificacao(r);
                                return (
                                    <div key={r.id} className="bg-white rounded-xl border shadow-card p-4" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-start gap-4">
                                            <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, backgroundColor: '#FEF9C3' }}>
                                                <Icon name="FileText" size={18} color="#D97706" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-medium text-sm font-data text-blue-700">{r.numero}</p>
                                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEF9C3', color: '#B45309' }}>{r.status}</span>
                                                </div>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                                    {r.motorista || 'Sem motorista'} · {r.destino || 'Sem destino'} · {Number(r.peso_total||0).toLocaleString('pt-BR')} kg
                                                </p>
                                                <div className="flex gap-4 mt-2 flex-wrap">
                                                    <span className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        Bônus estimado: <strong className="text-purple-600">{BRL(bonif.valorTotal)}</strong>
                                                    </span>
                                                    {bonif.temCimento && (
                                                        <span className="text-xs font-caption text-blue-600">+ Cimento: {BRL(bonif.valorCimento)}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Button variant="default" size="sm" iconName="Check" iconSize={14}
                                                    onClick={() => handleAprovar(r)}>
                                                    Aprovar
                                                </Button>
                                                <button
                                                    onClick={() => handleReprovar(r)}
                                                    className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-red-50"
                                                    style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                    Reprovar
                                                </button>
                                                <button
                                                    onClick={() => navigate('/romaneios')}
                                                    className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-blue-50"
                                                    style={{ borderColor: '#BFDBFE', color: '#1D4ED8' }}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                                    Ver Romaneio
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    ) : tab === 'bonificacoes' ? (
                        <div className="bg-white rounded-xl border shadow-card overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                    Bonificações Consolidadas por Motorista
                                </h3>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Motorista</th>
                                        <th className="px-4 py-3 text-right font-medium">Romaneios</th>
                                        <th className="px-4 py-3 text-right font-medium">Ton. Ferragem</th>
                                        <th className="px-4 py-3 text-right font-medium">Total Bônus</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bonifs.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center py-10 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                            Nenhuma bonificação registrada ainda
                                        </td></tr>
                                    ) : bonifs.map((b, idx) => (
                                        <tr key={b.motoristaId} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                            <td className="px-4 py-3 font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{b.nome}</td>
                                            <td className="px-4 py-3 text-right font-data text-xs">{b.romaneios}</td>
                                            <td className="px-4 py-3 text-right font-data text-xs">{b.toneladasTotal.toFixed(3)} t</td>
                                            <td className="px-4 py-3 text-right font-data font-semibold text-purple-600">{BRL(b.valorTotal)}</td>
                                        </tr>
                                    ))}
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
