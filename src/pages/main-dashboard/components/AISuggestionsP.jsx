import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'utils/AuthContext';
import Icon from 'components/AppIcon';
import AccessDeniedModal from 'components/ui/AccessDeniedModal';
import { fetchDismissedSuggestions, dismissSuggestion } from 'utils/aiSuggestionsService';

const PRIORITY = {
    alta:  { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA', icon: 'AlertTriangle', iconColor: '#DC2626' },
    media: { bg: '#FEF9C3', text: '#92400E', border: '#FDE68A', icon: 'Info',          iconColor: '#D97706' },
    baixa: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0', icon: 'Lightbulb',     iconColor: '#059669' },
};

/**
 * Gera sugestões com chaves ESTÁVEIS baseadas nos dados atuais.
 * Chaves de alta prioridade incluem identificadores dos itens afetados,
 * então mudam automaticamente quando os dados mudam (sugestão reativa).
 */
function buildSuggestions(romaneios, vehicles) {
    const statusAtivo = ['Aguardando', 'Carregando', 'Em Trânsito'];
    const inicioMes   = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const now         = Date.now();

    const pertenceAo = (rom, veiculo) => {
        if (rom.vehicle_id && veiculo.id) return String(rom.vehicle_id) === String(veiculo.id);
        return rom.placa && veiculo.placa &&
            rom.placa.trim().toUpperCase() === veiculo.placa.trim().toUpperCase();
    };

    // ── Utilização por veículo ──────────────────────────────────────────────
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
            .filter(r => {
                if (!pertenceAo(r, v)) return false;
                const d = r.saida ? new Date(r.saida) : new Date(r.created_at);
                return d >= inicioMes;
            })
            .reduce((max, r) => Math.max(max, Number(r.peso_total || 0)), 0);
        utilizacaoMap[v.id] = Math.min(100, Math.round((pesoMaxMes / cap) * 100));
    });

    const list = [];

    // ── 1. Romaneios pendentes de aprovação ────────────────────────────────
    const pendentes = romaneios.filter(r =>
        !r.aprovado && r.status !== 'Cancelado' && r.status !== 'Finalizado'
        && r.status_aprovacao !== 'reprovado'
    );
    if (pendentes.length > 0) {
        // Chave inclui IDs — muda automaticamente quando o conjunto muda
        const ids = pendentes.map(r => r.id).sort().join('-');
        list.push({
            key:      `pendentes_aprovacao_${ids}`,
            priority: 'alta',
            critical: true, // grave: sempre re-exibe se condição persistir
            title:    `${pendentes.length} romaneio(s) aguardando aprovação`,
            description: `${pendentes.slice(0, 3).map(r => r.numero).join(', ')}${pendentes.length > 3 ? ` e mais ${pendentes.length - 3}` : ''} precisam ser aprovados pelo administrador.`,
            action:   'Ir para Aprovações', route: '/admin', adminOnly: true,
        });
    }

    // ── 2. Veículos com baixa utilização ───────────────────────────────────
    const baixaUtil = (vehicles || []).filter(v => v.status === 'Disponível' && (utilizacaoMap[v.id] ?? 0) < 60);
    baixaUtil.slice(0, 2).forEach(v => {
        const util = utilizacaoMap[v.id] ?? 0;
        list.push({
            key:      `veiculo_subutilizado_${v.placa}`,
            priority: 'baixa',
            critical: false,
            title:    `Veículo subutilizado: ${v.placa}`,
            description: `${v.placa} (${v.tipo || 'Veículo'}) disponível com ${util}% de capacidade utilizada.`,
            action:   'Ver frota', route: '/vehicle-fleet-management', adminOnly: false,
        });
    });

    // ── 3. Romaneios sem veículo alocado ───────────────────────────────────
    const semVeiculo = romaneios
        .filter(r => ['Aguardando', 'Carregando'].includes(r.status) && !r.vehicle_id && !r.placa);
    if (semVeiculo.length > 0) {
        const ids = semVeiculo.map(r => r.id).sort().join('-');
        list.push({
            key:      `romaneios_sem_veiculo_${ids}`,
            priority: 'alta',
            critical: true,
            title:    `${semVeiculo.length} romaneio(s) sem veículo alocado`,
            description: `${semVeiculo.slice(0, 3).map(r => r.numero).join(', ')}${semVeiculo.length > 3 ? '...' : ''} aguardam alocação de veículo.`,
            action:   'Alocar veículo', route: '/romaneios', adminOnly: false,
        });
    }

    // ── 4. Romaneios em trânsito há mais de 3 dias ─────────────────────────
    const emAtraso = romaneios.filter(r =>
        r.status === 'Em Trânsito' && r.saida &&
        (now - new Date(r.saida).getTime()) / 86400000 > 3
    );
    if (emAtraso.length > 0) {
        const ids = emAtraso.map(r => r.id).sort().join('-');
        list.push({
            key:      `romaneios_em_atraso_${ids}`,
            priority: 'alta',
            critical: true,
            title:    `${emAtraso.length} romaneio(s) em trânsito por mais de 3 dias`,
            description: `${emAtraso.slice(0, 2).map(r => r.numero).join(', ')} estão em rota há mais tempo do esperado.`,
            action:   'Verificar', route: '/romaneios', adminOnly: false,
        });
    }

    // ── 5. CNHs próximas do vencimento (se tiver dados de motoristas) ───────
    // Detectado via user_profiles se houver campo vencimento_cnh no futuro

    // ── 6. Nenhum veículo disponível ───────────────────────────────────────
    const dispVeiculos = (vehicles || []).filter(v => v.status === 'Disponível');
    if (vehicles?.length > 0 && dispVeiculos.length === 0) {
        list.push({
            key:      'sem_veiculos_disponiveis',
            priority: 'media',
            critical: false,
            title:    'Nenhum veículo disponível na frota',
            description: 'Todos os veículos estão em uso ou manutenção. Revise o agendamento.',
            action:   'Ver frota', route: '/vehicle-fleet-management', adminOnly: false,
        });
    }

    if (list.length === 0) {
        list.push({
            key: 'operacao_saudavel', priority: 'baixa', critical: false,
            title: 'Operação saudável ✓',
            description: 'Nenhuma otimização crítica identificada. Continue monitorando.',
            action: null, route: null, adminOnly: false,
        });
    }

    return list;
}

// ─── Spinner inline ──────────────────────────────────────────────────────────
function Spinner() {
    return (
        <svg className="animate-spin" width={12} height={12} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

// ─── Painel principal ─────────────────────────────────────────────────────────
export default function AISuggestionsPanel({ romaneios = [], vehicles = [] }) {
    const navigate = useNavigate();
    const { isAdmin } = useAuth();

    const [dismissedMap, setDismissedMap] = useState({}); // { key: { is_verified } }
    const [loadingDismissed, setLoadingDismissed] = useState(true);
    const [dismissingKey, setDismissingKey] = useState(null); // chave em processo de dismiss
    const [showAccessDenied, setShowAccessDenied] = useState(false);

    // Carrega descartados persistidos do banco ao montar
    const loadDismissed = useCallback(async () => {
        const map = await fetchDismissedSuggestions();
        setDismissedMap(map);
        setLoadingDismissed(false);
    }, []);

    useEffect(() => { loadDismissed(); }, []);

    const suggestions = useMemo(() => buildSuggestions(romaneios, vehicles), [romaneios, vehicles]);

    // Filtra: sugestões críticas (alta) SEMPRE são exibidas mesmo se verificadas
    // Sugestões não críticas são ocultadas se tiverem sido verificadas/descartadas
    const visible = suggestions.filter(s => {
        if (s.key === 'operacao_saudavel') return true;
        const dismissed = dismissedMap[s.key];
        if (!dismissed) return true;          // não foi descartada → mostra
        if (s.critical) return false;         // grave mas descartada → oculta até dados mudarem
        return false;                         // não crítica e descartada → oculta permanente
    });

    const handleAction = (s) => {
        if (s.adminOnly && !isAdmin()) { setShowAccessDenied(true); return; }
        if (s.route) navigate(s.route);
    };

    // Dismiss com persistência no banco
    const handleDismiss = async (s, verified = false) => {
        setDismissingKey(s.key);
        try {
            await dismissSuggestion(s.key, verified);
            setDismissedMap(prev => ({ ...prev, [s.key]: { is_verified: verified } }));
        } catch { /* silencioso — remove da view mesmo assim */
            setDismissedMap(prev => ({ ...prev, [s.key]: { is_verified: verified } }));
        } finally {
            setDismissingKey(null);
        }
    };

    return (
        <>
            <AccessDeniedModal show={showAccessDenied} onClose={() => setShowAccessDenied(false)} />
            <div className="bg-white rounded-lg border border-slate-200 shadow-card overflow-hidden">

                {/* Header */}
                <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-slate-200"
                    style={{ backgroundColor: '#404040' }}>
                    <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-500">
                        <Icon name="Sparkles" size={15} color="#FFFFFF" strokeWidth={2} />
                    </div>
                    <h2 className="text-base font-heading font-semibold text-white flex-1">
                        Sugestões de Otimização
                    </h2>
                    <span className="text-xs font-caption bg-blue-500 text-white px-2 py-0.5 rounded-full">
                        {loadingDismissed ? '...' : `${visible.filter(s => s.key !== 'operacao_saudavel').length} ativas`}
                    </span>
                </div>

                {/* Corpo */}
                <div className="p-4 flex flex-col gap-3">
                    {loadingDismissed ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                            <Spinner />
                            <span className="text-xs">Carregando sugestões...</span>
                        </div>
                    ) : visible.length === 0 ? (
                        <div className="flex flex-col items-center py-6 gap-2 text-gray-400">
                            <Icon name="CheckCircle2" size={32} color="#059669" strokeWidth={1.5} />
                            <p className="text-sm">Todas as sugestões foram verificadas.</p>
                            <p className="text-xs text-slate-400">
                                Sugestões críticas reaparecem automaticamente se o problema persistir.
                            </p>
                        </div>
                    ) : visible.map(s => {
                        const cfg = PRIORITY[s.priority];
                        const isDismissing = dismissingKey === s.key;
                        const isVerified   = dismissedMap[s.key]?.is_verified;

                        return (
                            <div key={s.key} className="flex items-start gap-3 p-3 rounded-lg border"
                                style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>

                                <Icon name={cfg.icon} size={16} color={cfg.iconColor}
                                    strokeWidth={2} className="flex-shrink-0 mt-0.5" />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium" style={{ color: cfg.text }}>
                                            {s.title}
                                        </p>
                                        {/* Badge "verificado" para sugestões críticas já verificadas */}
                                        {isVerified && s.critical && (
                                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                                                style={{ backgroundColor: 'rgba(0,0,0,0.08)', color: cfg.text }}>
                                                ✓ verificado
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs mt-0.5 leading-snug"
                                        style={{ color: cfg.text, opacity: 0.8 }}>
                                        {s.description}
                                    </p>
                                    {s.action && (
                                        <button
                                            className="text-xs font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity flex items-center gap-1 mt-1.5"
                                            style={{ color: cfg.text }}
                                            onClick={() => handleAction(s)}>
                                            {s.adminOnly && !isAdmin() && (
                                                <Icon name="Lock" size={10} color={cfg.text} />
                                            )}
                                            {s.action}
                                        </button>
                                    )}
                                </div>

                                {/* Ações de dismiss — só para sugestões reais (não "operacao_saudavel") */}
                                {s.key !== 'operacao_saudavel' && (
                                    <div className="flex flex-col gap-1 flex-shrink-0">
                                        {/* Botão "Verificado ✓" — persistido no banco */}
                                        <button
                                            onClick={() => handleDismiss(s, true)}
                                            disabled={isDismissing}
                                            title="Marcar como verificado e remover da lista"
                                            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition-colors disabled:opacity-60"
                                            style={{
                                                backgroundColor: 'rgba(0,0,0,0.10)',
                                                color: cfg.text,
                                            }}>
                                            {isDismissing ? <Spinner /> : <Icon name="CheckCheck" size={11} color={cfg.text} />}
                                            <span className="hidden sm:inline">Verificado</span>
                                        </button>
                                        {/* Botão X — remove apenas da sessão atual para sugestões críticas */}
                                        {s.critical ? (
                                            <button
                                                onClick={() => handleDismiss(s, false)}
                                                disabled={isDismissing}
                                                title={s.critical ? 'Reaparecer se o problema persistir' : 'Fechar'}
                                                className="flex items-center justify-center p-1 rounded hover:bg-black/10 transition-colors"
                                                style={{ color: cfg.text }}>
                                                <Icon name="X" size={12} color={cfg.text} strokeWidth={2} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleDismiss(s, false)}
                                                disabled={isDismissing}
                                                title="Fechar permanentemente"
                                                className="flex items-center justify-center p-1 rounded hover:bg-black/10 transition-colors">
                                                <Icon name="X" size={12} color={cfg.text} strokeWidth={2} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Nota informativa */}
                    {visible.some(s => s.critical) && (
                        <p className="text-xs text-slate-400 text-center pt-1 border-t border-slate-100">
                            Sugestões críticas reaparecem automaticamente se o problema não for resolvido.
                        </p>
                    )}
                </div>
            </div>
        </>
    );
}
