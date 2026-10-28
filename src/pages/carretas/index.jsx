import React, { useState } from 'react';

import { useAuth } from 'context/AuthContext';
import { AppIcon as Icon, NavigationBar, BreadcrumbTrail } from 'components';

import TabRomaneios from './components/TabRomaneios';
import TabVolume from './components/TabVolume';
import TabFretes from './components/TabFretes';
import TabCustos from './components/TabCustos';
import TabPneus from './components/TabPneus';
import TabViagens from './components/TabViagens';
import TabVeiculos from './components/TabVeiculos';
import TabAbastecimentos from './components/TabAbastecimentos';
import TabChecklist from './components/TabChecklist';
import TabHistoricoViagens from './components/TabHistoricoViagens';
import TabDistribuicaoViagens from './components/TabDistribuicaoViagens';
import TabPontosParada from './components/TabPontosParada';
import TabBonificacoes from './components/TabBonificacoes';
import TabDespesasExtras from './components/TabDespesasExtras';
import TabDiarias from './components/TabDiarias';
import TabRelatorioFinanceiro from './components/TabRelatorioFinanceiro';
import TabOrdensServico from './components/TabOrdensServico';
import TabEmpresas from './components/TabEmpresas';
import TabDuplicatas from './components/TabDuplicatas';
import TabMapaRegional from './components/TabMapaRegional';

const STATUS_VIAGEM = ['Agendado', 'Em processamento', 'Aguardando no pátio', 'Em trânsito', 'Entrega finalizada', 'Cancelado'];

const STATUS_COLORS = {
    'Agendado':            { bg: '#EFF6FF', text: '#1D4ED8' },
    'Em processamento':    { bg: '#FEF9C3', text: '#B45309' },
    'Aguardando no pátio': { bg: '#FEE2E2', text: '#B91C1C' },
    'Em trânsito':         { bg: '#D1FAE5', text: '#065F46' },
    'Entrega finalizada':  { bg: '#F0FDF4', text: '#15803D' },
    'Cancelado':           { bg: '#F3F4F6', text: '#6B7280' },
};

const RESPONSAVEIS = ['Juliana', 'Anderson'];

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function StatusBadge({ status }) {
    const cfg = STATUS_COLORS[status] || STATUS_COLORS['Agendado'];
    return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            {status}
        </span>
    );
}

// ─── Constantes da página principal ─────────────────────────────────────────
const TABS = [
    { id: 'viagens',       label: 'Viagens',          icon: 'Navigation',    group: 'Operação' },
    { id: 'romaneios',     label: 'Romaneios',         icon: 'FileText',      group: 'Operação' },
    { id: 'veiculos',      label: 'Veículos',          icon: 'Truck',         group: 'Operação' },
    { id: 'abastecimentos',label: 'Abastecimentos',    icon: 'Fuel',          group: 'Operação' },
    { id: 'checklist',     label: 'Checklist',         icon: 'ClipboardCheck',group: 'Operação' },
    { id: 'volume',        label: 'Volume de carregamento', icon: 'TrendingUp',    group: 'Operação' },
    { id: 'historico',     label: 'Histórico Rotas',   icon: 'MapPin',        group: 'Operação' },
    { id: 'distribuicao',  label: 'Distribuição de Viagens', icon: 'Shuffle', group: 'Operação' },
    { id: 'mapa_regional', label: 'Mapa de Vendas', icon: 'Map',           group: 'Operação' },
    { id: 'pontos_parada', label: 'Pontos de Parada',  icon: 'Navigation2',   group: 'Operação' },
    { id: 'fretes',        label: 'Fretes',             icon: 'DollarSign',    group: 'Financeiro' },
    { id: 'custos',        label: 'Custos de Rodagem',  icon: 'Calculator',    group: 'Financeiro' },
    { id: 'bonificacoes',  label: 'Bonificações',      icon: 'Award',         group: 'Financeiro' },
    { id: 'despesas',      label: 'Despesas',          icon: 'Receipt',       group: 'Financeiro' },
    { id: 'diarias',       label: 'Diárias',           icon: 'CalendarDays',  group: 'Financeiro' },
    { id: 'financeiro',    label: 'Rel. Financeiro',   icon: 'BarChart3',     group: 'Financeiro' },
    { id: 'ordens',        label: 'Ordens de Serviço', icon: 'Wrench',        group: 'Gestão' },
    { id: 'pneus',         label: 'Pneus',             icon: 'Disc',          group: 'Gestão' },
    { id: 'empresas',      label: 'Empresas',          icon: 'Building2',     group: 'Gestão' },
    { id: 'duplicatas',    label: 'Duplicatas',        icon: 'AlertTriangle', group: 'Gestão' },
];

const GRUPOS = ['Operação', 'Financeiro', 'Gestão'];

export default function CarretasPage() {
    const { profile, isAdmin } = useAuth();
    const admin = isAdmin();
    const TAB_STORAGE_KEY = 'carretas_aba_ativa';
    const [tab, setTabState] = useState(() => {
        try {
            const salva = sessionStorage.getItem(TAB_STORAGE_KEY);
            // só usa a aba salva se ela ainda existir na lista atual de abas
            // (e, no caso de "duplicatas", só se o usuário for admin)
            return (salva && TABS.some(t => t.id === salva) && (salva !== 'duplicatas' || admin)) ? salva : 'viagens';
        } catch { return 'viagens'; }
    });
    // Mantém a aba ativa depois de um refresh da página (ex.: pra atualizar
    // dados) — sem isso, todo F5 dentro do módulo Carretas voltava pra
    // primeira aba (Viagens), obrigando a navegar de novo até onde estava.
    const setTab = (id) => {
        setTabState(id);
        try { sessionStorage.setItem(TAB_STORAGE_KEY, id); } catch {}
    };
    const [drawerOpen, setDrawerOpen] = useState(false);
    const tabAtual = TABS.find(t => t.id === tab);

    const SidebarItem = ({ t }) => {
        const ativo = tab === t.id;
        return (
            <button
                onClick={() => { setTab(t.id); setDrawerOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                style={{
                    backgroundColor: ativo ? 'var(--color-primary)' : 'transparent',
                    color: ativo ? '#fff' : 'var(--color-muted-foreground)',
                }}>
                <Icon name={t.icon} size={16} color={ativo ? '#fff' : 'currentColor'} />
                <span>{t.label}</span>
            </button>
        );
    };

    const SidebarContent = () => (
        <nav className="flex flex-col gap-1 p-3">
            {/* Logo/título no topo da sidebar */}
            <div className="px-3 py-3 mb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <p className="font-heading font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    Transporte — Carretas
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                    Controle de viagens e fretes
                </p>
            </div>
            {GRUPOS.map(grupo => (
                <div key={grupo} className="mb-2">
                    <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--color-muted-foreground)', fontSize: 10 }}>
                        {grupo}
                    </p>
                    {TABS.filter(t => t.group === grupo && (t.id !== 'duplicatas' || admin)).map(t => (
                        <SidebarItem key={t.id} t={t} />
                    ))}
                </div>
            ))}
        </nav>
    );

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-[1920px] mx-auto">
                    <div className="flex">

                        {/* ── Sidebar desktop (lg+) ──────────────────────── */}
                        {/* position: fixed (não sticky) — sticky só trava o eixo vertical;
                            se alguma tabela larga empurra a página pra rolar na horizontal,
                            um elemento sticky "anda" junto e fica cortado à esquerda. fixed
                            trava nos dois eixos, sempre relativo à janela, então a sidebar
                            nunca some, não importa o quanto o conteúdo role. */}
                        <aside className="hidden lg:flex flex-col flex-shrink-0 fixed top-[60px] h-[calc(100vh-60px)] overflow-y-auto border-r z-20"
                            style={{ width: 220, left: 'max(0px, calc((100vw - 1920px) / 2))', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                            <SidebarContent />
                        </aside>

                        {/* ── Conteúdo principal ─────────────────────────── */}
                        <div className="flex-1 min-w-0 px-4 sm:px-6 py-6 lg:ml-[220px]">
                            <BreadcrumbTrail className="mb-4" />

                            {/* Header com botão hamburger no mobile/tablet */}
                            <div className="flex items-center justify-between mb-6 gap-3">
                                <div>
                                    <h1 className="font-heading font-bold text-xl sm:text-2xl" style={{ color: 'var(--color-text-primary)' }}>
                                        {tabAtual?.label || 'Transporte — Carretas'}
                                    </h1>
                                    <p className="text-xs sm:text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                        Controle de viagens, frota e fretes de cimento
                                    </p>
                                </div>
                                {/* Botão menu — apenas em telas < lg */}
                                <button
                                    onClick={() => setDrawerOpen(true)}
                                    className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium flex-shrink-0 transition-colors hover:bg-gray-50"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                    <Icon name="Menu" size={18} color="currentColor" />
                                    <span className="hidden sm:inline">{tabAtual?.label}</span>
                                </button>
                            </div>

                            {/* Conteúdo da aba */}
                            {tab === 'viagens'        && <TabViagens        key={tab} isAdmin={admin} />}
                            {tab === 'romaneios'      && <TabRomaneios      isAdmin={admin} />}
                            {tab === 'veiculos'       && <TabVeiculos       isAdmin={admin} />}
                            {tab === 'abastecimentos' && <TabAbastecimentos  isAdmin={admin} profile={profile} />}
                            {tab === 'checklist'      && <TabChecklist      isAdmin={admin} profile={profile} />}
                            {tab === 'volume'         && <TabVolume         key={tab} isAdmin={admin} />}
                            {tab === 'historico'      && <TabHistoricoViagens isAdmin={admin} />}
                            {tab === 'distribuicao'   && <TabDistribuicaoViagens key={tab} />}
                            {tab === 'mapa_regional'  && <TabMapaRegional   key={tab} />}
                            {tab === 'pontos_parada'  && <TabPontosParada     isAdmin={admin} />}
                            {tab === 'fretes'         && <TabFretes          isAdmin={admin} />}
                            {tab === 'custos'         && <TabCustos          isAdmin={admin} />}
                            {tab === 'bonificacoes'   && <TabBonificacoes   isAdmin={admin} />}
                            {tab === 'despesas'       && <TabDespesasExtras  isAdmin={admin} profile={profile} />}
                            {tab === 'diarias'         && <TabDiarias         isAdmin={admin} profile={profile} />}
                            {tab === 'financeiro'     && <TabRelatorioFinanceiro isAdmin={admin} />}
                            {tab === 'ordens'          && <TabOrdensServico  isAdmin={admin} profile={profile} />}
                            {tab === 'pneus'           && <TabPneus          isAdmin={admin} />}
                            {tab === 'empresas'       && <TabEmpresas       isAdmin={admin} />}
                            {tab === 'duplicatas'     && admin && <TabDuplicatas />}
                            
                        </div>
                    </div>
                </div>
            </main>

            {/* ── Drawer mobile/tablet (< lg) ──────────────────────────── */}
            {drawerOpen && (
                <>
                    {/* Overlay */}
                    <div
                        className="fixed inset-0 z-[140] lg:hidden"
                        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                        onClick={() => setDrawerOpen(false)}
                    />
                    {/* Painel deslizante da esquerda */}
                    <div className="fixed top-0 left-0 bottom-0 z-[150] lg:hidden flex flex-col overflow-y-auto shadow-2xl"
                        style={{ width: 260, backgroundColor: 'var(--color-card)' }}>
                        {/* Header do drawer */}
                        <div className="flex items-center justify-between px-4 py-4 border-b flex-shrink-0"
                            style={{ borderColor: 'var(--color-border)', paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
                            <div>
                                <p className="font-heading font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                    Transporte — Carretas
                                </p>
                                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Navegação</p>
                            </div>
                            <button
                                onClick={() => setDrawerOpen(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                                <Icon name="X" size={20} color="var(--color-muted-foreground)" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <SidebarContent />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
