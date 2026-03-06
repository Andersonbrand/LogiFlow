import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from 'components/AppIcon';

const PRIORITY = {
    alta:  { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA', icon: 'AlertTriangle', iconColor: '#DC2626' },
    media: { bg: '#FEF9C3', text: '#92400E', border: '#FDE68A', icon: 'Info',          iconColor: '#D97706' },
    baixa: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0', icon: 'Lightbulb',     iconColor: '#059669' },
};

function buildSuggestions(romaneios, vehicles) {
    const list = [];
    let id = 1;

    // 1. Romaneios com mesmo destino aguardando → consolidar
    const aguardando = romaneios.filter(r => r.status === 'Aguardando' || r.status === 'Carregando');
    const byDest = {};
    aguardando.forEach(r => {
        if (!r.destino) return;
        const key = r.destino.split(',')[0].trim().toLowerCase();
        if (!byDest[key]) byDest[key] = [];
        byDest[key].push(r);
    });
    Object.values(byDest).forEach(group => {
        if (group.length < 2) return;
        const nums = group.slice(0, 3).map(r => r.numero).join(', ');
        list.push({
            id: id++, priority: 'alta',
            title: `Consolidar cargas para ${group[0].destino.split(',')[0]}`,
            description: `${nums}${group.length > 3 ? ` e mais ${group.length - 3}` : ''} têm destino próximo. Consolidação pode reduzir ${group.length - 1} viagem(ns).`,
            action: 'Ver consolidação', route: '/consolidacao',
            saving: `R$ ${(group.length * 320).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        });
    });

    // 2. Romaneios sem veículo alocado
    const semVeiculo = aguardando.filter(r => !r.vehicle_id && !r.placa);
    if (semVeiculo.length > 0) {
        list.push({
            id: id++, priority: 'alta',
            title: `${semVeiculo.length} romaneio(s) sem veículo alocado`,
            description: `${semVeiculo.slice(0, 3).map(r => r.numero).join(', ')}${semVeiculo.length > 3 ? '...' : ''} aguardam alocação de veículo.`,
            action: 'Alocar veículo', route: '/romaneios', saving: null,
        });
    }

    // 3. Veículos com utilização baixa e disponíveis
    const baixaUtil = (vehicles || []).filter(v => v.status === 'Disponível' && (v.utilizacao ?? 100) < 60);
    baixaUtil.slice(0, 2).forEach(v => {
        list.push({
            id: id++, priority: 'media',
            title: `Veículo subutilizado: ${v.placa}`,
            description: `${v.placa} (${v.tipo}) está disponível com ${v.utilizacao ?? 0}% de capacidade. Considere adicionar carga.`,
            action: 'Alocar carga', route: '/romaneios',
            saving: `R$ ${((v.capacidadePeso || 5000) * 0.01).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        });
    });

    // 4. Romaneios em trânsito há mais de 3 dias
    const now = Date.now();
    const emAtraso = romaneios.filter(r => {
        if (r.status !== 'Em Trânsito' || !r.saida) return false;
        return (now - new Date(r.saida).getTime()) / 86400000 > 3;
    });
    if (emAtraso.length > 0) {
        list.push({
            id: id++, priority: 'alta',
            title: `${emAtraso.length} romaneio(s) em trânsito por mais de 3 dias`,
            description: `${emAtraso.slice(0, 2).map(r => r.numero).join(', ')} estão em rota há mais tempo do esperado. Verifique com o motorista.`,
            action: 'Verificar', route: '/romaneios', saving: null,
        });
    }

    // 5. Nenhum veículo disponível
    const dispVeiculos = (vehicles || []).filter(v => v.status === 'Disponível');
    if (vehicles?.length > 0 && dispVeiculos.length === 0) {
        list.push({
            id: id++, priority: 'media',
            title: 'Nenhum veículo disponível na frota',
            description: 'Todos os veículos estão em uso ou manutenção. Revise o agendamento de entregas.',
            action: 'Ver frota', route: '/vehicle-fleet-management', saving: null,
        });
    }

    // 6. Romaneios com frete sem custo (margem não calculada)
    const semFinanceiro = romaneios.filter(r =>
        (r.status === 'Aguardando' || r.status === 'Carregando') &&
        !r.valor_frete && !r.custo_combustivel
    );
    if (semFinanceiro.length > 3) {
        list.push({
            id: id++, priority: 'baixa',
            title: `${semFinanceiro.length} romaneios sem dados financeiros`,
            description: 'Adicione valor de frete e custos para acompanhar a margem de cada viagem.',
            action: 'Preencher dados', route: '/romaneios', saving: null,
        });
    }

    if (list.length === 0) {
        list.push({
            id: 0, priority: 'baixa',
            title: 'Operação saudável ✓',
            description: 'Nenhuma otimização crítica identificada. Continue monitorando.',
            action: null, route: null, saving: null,
        });
    }

    return list;
}

export default function AISuggestionsPanel({ romaneios = [], vehicles = [] }) {
    const navigate = useNavigate();
    const [dismissed, setDismissed] = useState([]);
    const [suggestions, setSuggestions] = useState([]);

    useEffect(() => {
        setSuggestions(buildSuggestions(romaneios, vehicles));
        setDismissed([]); // reset on data change
    }, [romaneios, vehicles]);

    const visible = suggestions.filter(s => !dismissed.includes(s.id));

    return (
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
                                {(s.action || s.saving) && (
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        {s.action && s.route && (
                                            <button className="text-xs font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
                                                style={{ color: cfg.text }} onClick={() => navigate(s.route)}>
                                                {s.action}
                                            </button>
                                        )}
                                        {s.action && s.saving && <span style={{ color: cfg.text, opacity: 0.4 }}>·</span>}
                                        {s.saving && (
                                            <span className="text-xs" style={{ color: cfg.text, opacity: 0.65 }}>
                                                Economia est.: {s.saving}
                                            </span>
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
    );
}
