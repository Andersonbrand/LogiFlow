import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'utils/AuthContext';
import Icon from 'components/AppIcon';
import AccessDeniedModal from 'components/ui/AccessDeniedModal';

const PRIORITY = {
    alta:  { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA', icon: 'AlertTriangle', iconColor: '#DC2626' },
    media: { bg: '#FEF9C3', text: '#92400E', border: '#FDE68A', icon: 'Info',          iconColor: '#D97706' },
    baixa: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0', icon: 'Lightbulb',     iconColor: '#059669' },
};

function buildSuggestions(romaneios, vehicles) {
    const statusAtivo = ['Aguardando', 'Carregando', 'Em Trânsito'];
    const inicioMes   = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const pertenceAo = (rom, veiculo) => {
        if (rom.vehicle_id && veiculo.id) return String(rom.vehicle_id) === String(veiculo.id);
        return rom.placa && veiculo.placa &&
            rom.placa.trim().toUpperCase() === veiculo.placa.trim().toUpperCase();
    };

    const utilizacaoMap = {};
    (vehicles || []).forEach(v => {
        const cap = Number(v.capacidade_peso || v.capacidadePeso || 0);
        const pesoAtivo = romaneios
            .filter(r => pertenceAo(r, v) && statusAtivo.includes(r.status))
            .reduce((s, r) => s + Number(r.peso_total || 0), 0);
        if (cap > 0 && pesoAtivo > 0) {
            utilizacaoMap[v.id] = Math.min(100, Math.round((pesoAtivo / cap) * 100));
            return;
        }
        const viagensMes = romaneios.filter(r => {
            if (!pertenceAo(r, v)) return false;
            const d = r.saida ? new Date(r.saida) : new Date(r.created_at);
            return d >= inicioMes;
        }).length;
        if (cap === 0) { utilizacaoMap[v.id] = Math.min(100, Math.round((viagensMes / 8) * 100)); return; }
        const pesoMaxMes = romaneios
            .filter(r => { if (!pertenceAo(r, v)) return false; const d = r.saida ? new Date(r.saida) : new Date(r.created_at); return d >= inicioMes; })
            .reduce((max, r) => Math.max(max, Number(r.peso_total || 0)), 0);
        utilizacaoMap[v.id] = Math.min(100, Math.round((pesoMaxMes / cap) * 100));
    });

    const list = [];
    let id = 1;
    const now = Date.now();

    // 1. Romaneios pendentes de aprovação — ação só para admins (flag adminOnly)
    const pendentesAprovacao = romaneios.filter(r => !r.aprovado && r.status !== 'Cancelado' && r.status !== 'Finalizado' && r.status_aprovacao !== 'reprovado');
    if (pendentesAprovacao.length > 0) {
        list.push({
            id: id++, priority: 'alta',
            title: `${pendentesAprovacao.length} romaneio(s) aguardando aprovação`,
            description: `${pendentesAprovacao.slice(0, 3).map(r => r.numero).join(', ')}${pendentesAprovacao.length > 3 ? ` e mais ${pendentesAprovacao.length - 3}` : ''} precisam ser aprovados pelo administrador.`,
            action: 'Ir para Aprovações', route: '/admin',
            adminOnly: true, // <- indica que requer admin
            saving: null,
        });
    }

    // 2. Veículos com baixa utilização
    const baixaUtil = (vehicles || []).filter(v => v.status === 'Disponível' && (utilizacaoMap[v.id] ?? 0) < 60);
    baixaUtil.slice(0, 2).forEach(v => {
        const util = utilizacaoMap[v.id] ?? 0;
        list.push({
            id: id++, priority: 'baixa',
            title: `Veículo subutilizado: ${v.placa}`,
            description: `${v.placa} (${v.tipo || 'Veículo'}) disponível com ${util}% de capacidade utilizada.`,
            action: 'Ver frota', route: '/vehicle-fleet-management',
            adminOnly: false,
            saving: null,
        });
    });

    // 3. Romaneios sem veículo alocado
    const aguardando = romaneios.filter(r => r.status === 'Aguardando' || r.status === 'Carregando');
    const semVeiculo = aguardando.filter(r => !r.vehicle_id && !r.placa);
    if (semVeiculo.length > 0) {
        list.push({
            id: id++, priority: 'alta',
            title: `${semVeiculo.length} romaneio(s) sem veículo alocado`,
            description: `${semVeiculo.slice(0, 3).map(r => r.numero).join(', ')}${semVeiculo.length > 3 ? '...' : ''} aguardam alocação de veículo.`,
            action: 'Alocar veículo', route: '/romaneios', adminOnly: false, saving: null,
        });
    }

    // 4. Romaneios em trânsito há mais de 3 dias
    const emAtraso = romaneios.filter(r => {
        if (r.status !== 'Em Trânsito' || !r.saida) return false;
        return (now - new Date(r.saida).getTime()) / 86400000 > 3;
    });
    if (emAtraso.length > 0) {
        list.push({
            id: id++, priority: 'alta',
            title: `${emAtraso.length} romaneio(s) em trânsito por mais de 3 dias`,
            description: `${emAtraso.slice(0, 2).map(r => r.numero).join(', ')} estão em rota há mais tempo do esperado.`,
            action: 'Verificar', route: '/romaneios', adminOnly: false, saving: null,
        });
    }

    // 5. Nenhum veículo disponível
    const dispVeiculos = (vehicles || []).filter(v => v.status === 'Disponível');
    if (vehicles?.length > 0 && dispVeiculos.length === 0) {
        list.push({
            id: id++, priority: 'media',
            title: 'Nenhum veículo disponível na frota',
            description: 'Todos os veículos estão em uso ou manutenção. Revise o agendamento.',
            action: 'Ver frota', route: '/vehicle-fleet-management', adminOnly: false, saving: null,
        });
    }

    if (list.length === 0) {
        list.push({
            id: 0, priority: 'baixa',
            title: 'Operação saudável ✓',
            description: 'Nenhuma otimização crítica identificada. Continue monitorando.',
            action: null, route: null, adminOnly: false, saving: null,
        });
    }

    return list;
}

export default function AISuggestionsPanel({ romaneios = [], vehicles = [] }) {
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const [dismissed, setDismissed] = useState([]);
    const [showAccessDenied, setShowAccessDenied] = useState(false);

    const suggestions = useMemo(() => {
        setDismissed([]);
        return buildSuggestions(romaneios, vehicles);
    }, [romaneios, vehicles]);

    const visible = suggestions.filter(s => !dismissed.includes(s.id));

    const handleAction = (suggestion) => {
        if (suggestion.adminOnly && !isAdmin()) {
            setShowAccessDenied(true);
            return;
        }
        if (suggestion.route) navigate(suggestion.route);
    };

    return (
        <>
            <AccessDeniedModal show={showAccessDenied} onClose={() => setShowAccessDenied(false)} />
            <div className="bg-white rounded-lg border border-slate-200 shadow-card overflow-hidden">
                <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-slate-200" style={{ backgroundColor: '#404040' }}>
                    <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-500">
                        <Icon name="Sparkles" size={15} color="#FFFFFF" strokeWidth={2} />
                    </div>
                    <h2 className="text-base font-heading font-semibold text-white flex-1">Sugestões de Otimização</h2>
                    <span className="text-xs font-caption bg-blue-500 text-white px-2 py-0.5 rounded-full">
                        {visible.length} ativas
                    </span>
                </div>

                <div className="p-4 flex flex-col gap-3">
                    {visible.length === 0 ? (
                        <div className="flex flex-col items-center py-6 gap-2 text-gray-400">
                            <Icon name="CheckCircle2" size={32} color="#059669" strokeWidth={1.5} />
                            <p className="text-sm">Todas as sugestões foram tratadas.</p>
                        </div>
                    ) : visible.map(s => {
                        const cfg = PRIORITY[s.priority];
                        return (
                            <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border"
                                style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>
                                <Icon name={cfg.icon} size={16} color={cfg.iconColor} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium" style={{ color: cfg.text }}>{s.title}</p>
                                    <p className="text-xs mt-0.5 leading-snug" style={{ color: cfg.text, opacity: 0.8 }}>{s.description}</p>
                                    {s.action && (
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <button
                                                className="text-xs font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity flex items-center gap-1"
                                                style={{ color: cfg.text }}
                                                onClick={() => handleAction(s)}>
                                                {s.adminOnly && !isAdmin() && (
                                                    <Icon name="Lock" size={10} color={cfg.text} />
                                                )}
                                                {s.action}
                                            </button>
                                            {s.saving && (
                                                <>
                                                    <span style={{ color: cfg.text, opacity: 0.4 }}>·</span>
                                                    <span className="text-xs" style={{ color: cfg.text, opacity: 0.65 }}>
                                                        Economia est.: {s.saving}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {s.id !== 0 && (
                                    <button onClick={() => setDismissed(p => [...p, s.id])}
                                        className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors">
                                        <Icon name="X" size={13} color={cfg.text} strokeWidth={2} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
