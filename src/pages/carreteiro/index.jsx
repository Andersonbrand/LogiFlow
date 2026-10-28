import React, { useState, useMemo, useCallback, useEffect } from 'react';

import * as XLSX from 'xlsx';

import { useAuth } from 'context/AuthContext';
import { useToast } from 'hooks/useToast';
import { useConfirm, NavigationBar, AppIcon as Icon, BreadcrumbTrail, Toast, ModalHeader } from 'components';
import { useBonusConfig } from 'services/settingsService';
import {                           marcarNotificacaoLida } from 'services/carretas';
import { } from 'services/romaneio';
import {  } from 'services/supabaseClient';
import { } from 'utils/pollingVisivel';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import useDeviceProfile from 'hooks/useDeviceProfile';
import { usePageTabs } from 'context/PageTabsContext';

import { FMT_DATE, BRL } from './utils/helpers';
import { PERIOD_OPTIONS } from './utils/constants';
import TabViagens from './components/TabViagens';
import TabRomaneios from './components/TabRomaneios';
import TabPontos from './components/TabPontos';
import TabBonificacoes from './components/TabBonificacoes';
import TabRegistros from './components/TabRegistros';
import TabAbastecimentos from './components/TabAbastecimentos';
import TabChecklist from './components/TabChecklist';
import ModalAbast from './components/ModalAbast';
import ModalCheck from './components/ModalCheck';
import ModalRegistro from './components/ModalRegistro';
import ModalFerragem from './components/ModalFerragem';
import ModalPonto from './components/ModalPonto';
import { useCarreteiroDados, useCarreteiroBonus, useCarreteiroFiltros, useRegistrosCarreteiro, usePontosCarreteiro, useFerragemCarreteiro, useAbastecimentoCarreteiro, useChecklistCarreteiro } from './hooks';

const STATUS_COLORS = {
    'Agendado':            { bg: '#EFF6FF', text: '#1D4ED8' },
    'Em processamento':    { bg: '#FEF9C3', text: '#B45309' },
    'Aguardando no pátio': { bg: '#FEE2E2', text: '#B91C1C' },
    'Em trânsito':         { bg: '#D1FAE5', text: '#065F46' },
    'Entrega finalizada':  { bg: '#F0FDF4', text: '#15803D' },
    'Cancelado':           { bg: '#F3F4F6', text: '#6B7280' },
};

export default function CarreteiroDashboard() {
    const { user, profile } = useAuth();
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const { bonusConfig } = useBonusConfig();
    const [tab, setTab]           = useState('viagens');
    const [period, setPeriod]     = useState('mes'); // padrão: mostra tudo do mês vigente
    // Período personalizado (usado na aba Bonificações) — quando preenchido,
    // sobrepõe o filtro de "últimos N dias" acima.
    const [periodoCustom, setPeriodoCustom] = useState(null); // { inicio: 'YYYY-MM-DD', fim: 'YYYY-MM-DD' } | null — filtro CONFIRMADO (aplicado na busca)
    // Valores digitados/selecionados nos campos de data, ainda não confirmados pelo botão "Buscar viagens".
    // Fica separado de `periodoCustom` de propósito: só deve disparar busca no banco quando o usuário
    // escolher as duas datas E clicar em "Buscar viagens" — nunca ao selecionar só a data inicial.
    const [periodoCustomInput, setPeriodoCustomInput] = useState(null); const { viagens, carregamentos, romaneiosPrincipais, romaneiosPrincipaisPag, bonusExtras, abast, checklists, veiculos, postos, empresas, cidadesFrete, locaisFabrica, locaisOutro, loading, configAbast, registros, notificacoes, setNotificacoes, pontosParada, romaneiosCarreteiro, romaneiosFerragem, setRomaneiosFerragem, romsAbertos, checklistItens, load } = useCarreteiroDados({ period, periodoCustom, profile, showToast, user });
    
    
    
    
    
    
    
    const veiculosProprios = useMemo(() => veiculos.filter(v => !v.is_terceiro), [veiculos]); // frota própria — exclui terceirizados dos selects
    const [filtroPlaca, setFiltroPlaca] = useState(''); 
    
    
    
    
    
    
    
    
    
    
    
    const { modalRegistro, setModalRegistro, editandoRegistroId, setEditandoRegistroId, salvandoRegistro, setSalvandoRegistro, emptyRegistro, formRegistro, setFormRegistro, paradasRegistro, setParadasRegistro, handleDeleteRegistro, handleEditRegistro } = useRegistrosCarreteiro({ confirm, load, showToast });
    
    
    
    
     const { modalPonto, setModalPonto, pontoDetalhe, setPontoDetalhe, editandoPontoId, setEditandoPontoId, formPonto, setFormPonto, abrirEditarPonto, excluirPonto } = usePontosCarreteiro({ confirm, load, showToast });
     
    
    // Lista de destinos disponíveis para cada tipo de local, evitando texto livre
    // e reaproveitando os cadastros já existentes no LogiFlow.
    const destinosParaTipo = useCallback((tipo) => {
        switch (tipo) {
            case 'Empresa': return empresas.map(e => e.nome).filter(Boolean);
            case 'Fábrica':  return locaisFabrica.map(l => l.nome).filter(Boolean);
            case 'Entrega': return cidadesFrete.map(c => c.cidade).filter(Boolean);
            case 'Posto':    return postos.map(p => p.nome).filter(Boolean);
            case 'Outro':    return locaisOutro.map(l => l.nome).filter(Boolean);
            default: return [];
        }
    }, [empresas, locaisFabrica, cidadesFrete, postos, locaisOutro]);
    const { modalFerragem, setModalFerragem, editandoFerragemId, setEditandoFerragemId, formFerragem, setFormFerragem, paradasFerragem, setParadasFerragem, salvandoFerragem, setSalvandoFerragem } = useFerragemCarreteiro({  });
     
      
    const { modalAbast, setModalAbast, editandoAbastId, setEditandoAbastId, salvandoAbast, formAbast, setFormAbast, getPrecoCarreteiro, handlePostoChangeCarreteiro, handleLitrosCarreteiro, handleAbast, handleEditAbast, handleDeleteAbast } = useAbastecimentoCarreteiro({ configAbast, confirm, load, postos, showToast, user });
    const { modalCheck, setModalCheck, editandoCheckId, setEditandoCheckId, salvandoCheck, progressoFotosCheck, formCheck, setFormCheck, handleCheck, handleEditCheck, handleDeleteChecklist } = useChecklistCarreteiro({ confirm, load, showToast, user });
    
    
    
    
     
    
    
     
    useRecarregarAoVoltar(load);
    useDeviceProfile(); const { carregamentosComBonus, carregamentosComBonusPag, bonusExtrasPag, viagensComBonus, totalBonusViagens, totalBonusExtras } = useCarreteiroBonus({ bonusConfig, bonusExtras, carregamentos, period, periodoCustom, viagens });
    
    
    
    
    
    const { registrosFiltrados, romaneiosFerragemFiltrados, romaneiosCarreteiroFiltrados, pontosParadaFiltrados, abastFiltrados, checklistsFiltrados, seletorPlaca, totais } = useCarreteiroFiltros({ abast, carregamentos, checklists, filtroPlaca, period, periodoCustom, pontosParada, registros, romaneiosCarreteiro, romaneiosFerragem, setFiltroPlaca, totalBonusExtras, totalBonusViagens, veiculos, viagens });
    
     
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    const exportar = () => {
        if (!viagensComBonus.length) { showToast('Nenhum dado para exportar no período selecionado.', 'error'); return; }
        const rows = viagensComBonus.map(v => ({
            'Nº Viagem': v.numero, 'Status': v.status, 'Destino': v.destino || '',
            'Data Saída': FMT_DATE(v.data_saida), 'Placa': v.veiculo?.placa || '',
            'Bônus': v.bonus,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Minhas Viagens');
        XLSX.writeFile(wb, `viagens_${profile?.name || 'carreteiro'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const TABS = [
        { id: 'viagens',       label: 'Minhas Viagens',   icon: 'Navigation' },
        { id: 'pontos',        label: 'Pontos de Parada',  icon: 'MapPin' },
        { id: 'bonificacoes',  label: 'Bonificações',      icon: 'DollarSign' },
        { id: 'registros',     label: 'Registrar Viagem',  icon: 'FilePlus' },
        { id: 'abastecimentos',label: 'Abastecimentos',    icon: 'Fuel' },
        { id: 'checklist',     label: 'Checklist',         icon: 'ClipboardCheck' },
    ];

    
    
    const tabAtual = TABS.find(t => t.id === tab);
    const { setPageTabs } = usePageTabs();
    useEffect(() => {
        setPageTabs(TABS, tab, setTab);
        return () => setPageTabs(null);
    }, [tab]); // eslint-disable-line

    return (
        <div className="min-h-screen m-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-[1920px] mx-auto">
                    <div className="flex">

                        {/* ── Sidebar desktop (lg+) ──────────────────────── */}
                        <aside className="hidden lg:flex flex-col flex-shrink-0 sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto border-r"
                            style={{ width: 210, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                            <nav className="flex flex-col gap-1 p-3">
                                {/* Perfil */}
                                <div className="px-3 py-3 mb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                            {(profile?.name || 'C')[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{profile?.name || 'Carreteiro'}</p>
                                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Motorista</p>
                                        </div>
                                    </div>
                                </div>
                                {TABS.map(t => {
                                    const ativo = tab === t.id;
                                    return (
                                        <button key={t.id} onClick={() => setTab(t.id)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                                            style={{
                                                backgroundColor: ativo ? 'var(--color-primary)' : 'transparent',
                                                color: ativo ? '#fff' : 'var(--color-muted-foreground)',
                                            }}>
                                            <Icon name={t.icon} size={16} color={ativo ? '#fff' : 'currentColor'} />
                                            <span>{t.label}</span>
                                        </button>
                                    );
                                })}
                                {/* Período no sidebar */}
                                <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-foreground)', fontSize: 10 }}>Período</p>
                                    <div className="flex flex-col gap-1 px-3">
                                        {PERIOD_OPTIONS.map(p => (
                                            <button key={p.days} onClick={() => setPeriod(p.days)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left"
                                                style={period === p.days
                                                    ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                                                    : { color: 'var(--color-muted-foreground)', backgroundColor: 'transparent' }}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </nav>
                        </aside>

                        {/* ── Conteúdo principal ─────────────────────────── */}
                        <div className="flex-1 min-w-0 px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
                            <BreadcrumbTrail className="mb-4" />

                            {/* Header mobile */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base lg:hidden"
                                        style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                        {(profile?.name || 'C')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h1 className="font-heading font-bold text-lg sm:text-xl" style={{ color: 'var(--color-text-primary)' }}>
                                            Olá, {profile?.name || 'Carreteiro'}
                                        </h1>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                            {tabAtual?.label}
                                        </p>
                                    </div>
                                </div>
                                {/* Controles direita — mobile: hamburger + período; desktop: exportar */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Período — apenas mobile/tablet (no desktop fica na sidebar) */}
                                    <div className="lg:hidden flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        {PERIOD_OPTIONS.map(p => (
                                            <button key={p.days} onClick={() => setPeriod(p.days)}
                                                className="px-2 sm:px-3 py-2 text-xs font-medium transition-colors"
                                                style={period === p.days ? { backgroundColor: 'var(--color-primary)', color: '#fff' } : { backgroundColor: 'white', color: 'var(--color-muted-foreground)' }}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={exportar}
                                        className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                        <Icon name="FileDown" size={14} color="currentColor" />
                                        <span className="hidden sm:inline">Exportar</span>
                                    </button>
                                </div>
                            </div>

                            {/* Notificações pendentes */}
                            {notificacoes.filter(n => !n.lida).length > 0 && (
                                <div className="flex flex-col gap-2 mb-4">
                                    {notificacoes.filter(n => !n.lida).map(n => (
                                        <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl border shadow-sm"
                                            style={{ backgroundColor: n.tipo === 'checklist_aprovado' ? '#F0FDF4' : '#FEF2F2', borderColor: n.tipo === 'checklist_aprovado' ? '#BBF7D0' : '#FECACA' }}>
                                            <div className="flex-shrink-0 mt-0.5">
                                                <Icon name={n.tipo === 'checklist_aprovado' ? 'CheckCircle2' : 'AlertTriangle'} size={18} color={n.tipo === 'checklist_aprovado' ? '#059669' : '#DC2626'} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm" style={{ color: n.tipo === 'checklist_aprovado' ? '#065F46' : '#991B1B' }}>{n.titulo}</p>
                                                <p className="text-xs mt-0.5" style={{ color: n.tipo === 'checklist_aprovado' ? '#059669' : '#DC2626' }}>{n.mensagem}</p>
                                            </div>
                                            <button onClick={async () => { await marcarNotificacaoLida(n.id); setNotificacoes(prev => prev.map(x => x.id === n.id ? { ...x, lida: true } : x)); }}
                                                className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors">
                                                <Icon name="X" size={14} color={n.tipo === 'checklist_aprovado' ? '#059669' : '#DC2626'} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* KPIs */}
                            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
                                {[
                                    { l: 'Carregamentos',    v: totais.viagens,            i: 'Package',      c: '#1D4ED8', bg: '#EFF6FF' },
                                    { l: 'Em Trânsito',      v: totais.emTransito,          i: 'Truck',        c: '#D97706', bg: '#FEF9C3' },
                                    { l: 'Bônus Viagens',    v: BRL(totais.totalBonusViagens), i: 'Award',     c: '#7C3AED', bg: '#EDE9FE' },
                                    { l: 'Bônus Extras',     v: BRL(totais.totalBonusExtras),  i: 'PlusCircle',c: '#D97706', bg: '#FFFBEB' },
                                    { l: 'Total a Receber',  v: BRL(totais.totalBonus),    i: 'DollarSign',   c: '#059669', bg: '#D1FAE5' },
                                ].map(k => (
                                    <div key={k.l} className="bg-white rounded-xl border p-3 sm:p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}>
                                                <Icon name={k.i} size={14} color={k.c} />
                                            </div>
                                        </div>
                                        <p className="text-lg sm:text-xl font-bold font-data m-fluid-value" style={{ color: k.c }}>{k.v}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Ações rápidas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                                <button onClick={() => { setEditandoAbastId(null); setFormAbast({ veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto_id: '', posto: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', cupom_fiscal: '', observacoes: '' }); setModalAbast(true); }}
                                    className="flex items-center gap-3 p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all"
                                    style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#D1FAE5' }}>
                                        <Icon name="Fuel" size={20} color="#059669" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Abastecimento</p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Diesel + Arla</p>
                                    </div>
                                </button>
                                <button onClick={() => { setEditandoCheckId(null); setFormCheck({ veiculo_id: '', odometro: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '', fotos_urls: [] }); setModalCheck(true); }}
                                    className="flex items-center gap-3 p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all"
                                    style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                                        <Icon name="ClipboardCheck" size={20} color="#1D4ED8" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Checklist Semanal</p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Verificação do veículo</p>
                                    </div>
                                </button>
                            </div>

                            {/* Conteúdo das abas */}
                            {loading ? (
                                <div className="flex justify-center py-16">
                                    <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                                </div>
                            ) : (
                                <>
                                    {tab === 'viagens' && (
                                        <TabViagens carregamentosComBonus={carregamentosComBonus} romaneiosFerragem={romaneiosFerragem} romaneiosPrincipais={romaneiosPrincipais} romaneiosPrincipaisPag={romaneiosPrincipaisPag} />
                                    )}

                                    {tab === 'romaneios' && (
                                        <TabRomaneios romaneiosCarreteiroFiltrados={romaneiosCarreteiroFiltrados} />
                                    )}

                                    {tab === 'pontos' && (
                                        <TabPontos
                    confirm={confirm}
                    load={load}
                    pontosParadaFiltrados={pontosParadaFiltrados}
                    setEditandoPontoId={setEditandoPontoId}
                    setFormPonto={setFormPonto}
                    setModalPonto={setModalPonto}
                    setPontoDetalhe={setPontoDetalhe}
                    showToast={showToast}
                />
                                    )}

                                    {tab === 'bonificacoes' && (
                                        <TabBonificacoes
                    bonusExtras={bonusExtras}
                    bonusExtrasPag={bonusExtrasPag}
                    carregamentosComBonus={carregamentosComBonus}
                    carregamentosComBonusPag={carregamentosComBonusPag}
                    period={period}
                    periodoCustom={periodoCustom}
                    periodoCustomInput={periodoCustomInput}
                    setPeriodoCustom={setPeriodoCustom}
                    setPeriodoCustomInput={setPeriodoCustomInput}
                    totais={totais}
                />
                                    )}

                                    {tab === 'registros' && (
                                        <TabRegistros
                    confirm={confirm}
                    emptyRegistro={emptyRegistro}
                    handleDeleteRegistro={handleDeleteRegistro}
                    handleEditRegistro={handleEditRegistro}
                    registrosFiltrados={registrosFiltrados}
                    romaneiosFerragemFiltrados={romaneiosFerragemFiltrados}
                    seletorPlaca={seletorPlaca}
                    setEditandoFerragemId={setEditandoFerragemId}
                    setEditandoRegistroId={setEditandoRegistroId}
                    setFormFerragem={setFormFerragem}
                    setFormRegistro={setFormRegistro}
                    setModalFerragem={setModalFerragem}
                    setModalRegistro={setModalRegistro}
                    setParadasFerragem={setParadasFerragem}
                    setParadasRegistro={setParadasRegistro}
                    setRomaneiosFerragem={setRomaneiosFerragem}
                    showToast={showToast}
                />
                                    )}

                                    {tab === 'abastecimentos' && (
                                        <TabAbastecimentos abastFiltrados={abastFiltrados} handleDeleteAbast={handleDeleteAbast} handleEditAbast={handleEditAbast} seletorPlaca={seletorPlaca} totais={totais} />
                                    )}

                                    {tab === 'checklist' && (
                                        <TabChecklist checklistItens={checklistItens} checklistsFiltrados={checklistsFiltrados} handleDeleteChecklist={handleDeleteChecklist} handleEditCheck={handleEditCheck} seletorPlaca={seletorPlaca} />
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modais */}
            {modalAbast && (
                <ModalAbast
                    editandoAbastId={editandoAbastId}
                    formAbast={formAbast}
                    getPrecoCarreteiro={getPrecoCarreteiro}
                    handleAbast={handleAbast}
                    handleLitrosCarreteiro={handleLitrosCarreteiro}
                    handlePostoChangeCarreteiro={handlePostoChangeCarreteiro}
                    postos={postos}
                    salvandoAbast={salvandoAbast}
                    setEditandoAbastId={setEditandoAbastId}
                    setFormAbast={setFormAbast}
                    setModalAbast={setModalAbast}
                    veiculosProprios={veiculosProprios}
                />
            )}

            {modalCheck && (
                <ModalCheck
                    checklistItens={checklistItens}
                    editandoCheckId={editandoCheckId}
                    formCheck={formCheck}
                    handleCheck={handleCheck}
                    progressoFotosCheck={progressoFotosCheck}
                    salvandoCheck={salvandoCheck}
                    setEditandoCheckId={setEditandoCheckId}
                    setFormCheck={setFormCheck}
                    setModalCheck={setModalCheck}
                    showToast={showToast}
                    veiculosProprios={veiculosProprios}
                />
            )}

            {modalRegistro && (
                <ModalRegistro
                    cidadesFrete={cidadesFrete}
                    editandoRegistroId={editandoRegistroId}
                    formRegistro={formRegistro}
                    load={load}
                    paradasRegistro={paradasRegistro}
                    salvandoRegistro={salvandoRegistro}
                    setEditandoRegistroId={setEditandoRegistroId}
                    setFormRegistro={setFormRegistro}
                    setModalRegistro={setModalRegistro}
                    setParadasRegistro={setParadasRegistro}
                    setSalvandoRegistro={setSalvandoRegistro}
                    showToast={showToast}
                    user={user}
                    veiculosProprios={veiculosProprios}
                />
            )}

            {modalFerragem && (
                <ModalFerragem
                    cidadesFrete={cidadesFrete}
                    editandoFerragemId={editandoFerragemId}
                    empresas={empresas}
                    formFerragem={formFerragem}
                    load={load}
                    paradasFerragem={paradasFerragem}
                    romsAbertos={romsAbertos}
                    salvandoFerragem={salvandoFerragem}
                    setEditandoFerragemId={setEditandoFerragemId}
                    setFormFerragem={setFormFerragem}
                    setModalFerragem={setModalFerragem}
                    setParadasFerragem={setParadasFerragem}
                    setRomaneiosFerragem={setRomaneiosFerragem}
                    setSalvandoFerragem={setSalvandoFerragem}
                    showToast={showToast}
                    user={user}
                    veiculosProprios={veiculosProprios}
                />
            )}

            {pontoDetalhe && (() => {
                const p = pontoDetalhe;
                const rodado = p.km_saida != null && p.km_chegada != null ? Number(p.km_chegada) - Number(p.km_saida) : null;
                const Item = ({ label, children }) => (
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>{label}</p>
                        <p className="text-sm font-semibold break-words" style={{ color: 'var(--color-text-primary)' }}>{children || '—'}</p>
                    </div>
                );
                return (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 m-modal-overlay"
                        style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} onClick={() => setPontoDetalhe(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <ModalHeader title="Ponto de parada" icon="MapPin" onClose={() => setPontoDetalhe(null)} />
                            <div className="p-4 overflow-y-auto flex flex-col gap-4">
                                {/* Saída | Chegada lado a lado, aproveitando a largura da tela */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border p-3 flex flex-col gap-2.5" style={{ borderColor: 'var(--color-border)', backgroundColor: '#EFF6FF' }}>
                                        <p className="text-xs font-bold" style={{ color: '#1D4ED8' }}>SAÍDA</p>
                                        <Item label="Local">{p.local}{p.tipo_local ? ` (${p.tipo_local})` : ''}</Item>
                                        <Item label="Data / hora">{p.data_saida ? FMT_DATE(p.data_saida) : ''}{p.horario_saida ? ` · ${p.horario_saida}` : ''}</Item>
                                        <Item label="KM">{p.km_saida != null ? Number(p.km_saida).toLocaleString('pt-BR') : ''}</Item>
                                    </div>
                                    <div className="rounded-xl border p-3 flex flex-col gap-2.5" style={{ borderColor: 'var(--color-border)', backgroundColor: '#ECFDF5' }}>
                                        <p className="text-xs font-bold" style={{ color: '#059669' }}>CHEGADA</p>
                                        <Item label="Local">{p.local_chegada}{p.local_chegada && p.tipo_local_chegada ? ` (${p.tipo_local_chegada})` : ''}</Item>
                                        <Item label="Data / hora">{p.data_chegada ? FMT_DATE(p.data_chegada) : ''}{p.horario_chegada ? ` · ${p.horario_chegada}` : ''}</Item>
                                        <Item label="KM">{p.km_chegada != null ? Number(p.km_chegada).toLocaleString('pt-BR') : ''}</Item>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <Item label="Placa">{p.veiculo?.placa}</Item>
                                    <Item label="KM rodados">{rodado != null && rodado >= 0 ? `${rodado.toLocaleString('pt-BR')} km` : ''}</Item>
                                    <Item label="Cupom">{p.cupom_fiscal}</Item>
                                </div>
                                {p.observacoes && <Item label="Observações">{p.observacoes}</Item>}
                                {p.horarios_extras?.length > 0 && (
                                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E9D5FF' }}>
                                        <p className="px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: '#FAF5FF', color: '#6D28D9' }}>Horários extras</p>
                                        {p.horarios_extras.map((ex, i) => (
                                            <div key={i} className="px-3 py-2 border-t text-xs grid grid-cols-2 gap-2" style={{ borderColor: '#E9D5FF' }}>
                                                <div><strong>{ex.local || `Extra #${i + 1}`}</strong><br />{ex.data_saida ? FMT_DATE(ex.data_saida) : '—'} {ex.horario_saida || ''} · {ex.km_saida != null ? Number(ex.km_saida).toLocaleString('pt-BR') : '—'} km</div>
                                                <div><strong>{ex.local_chegada || '—'}</strong><br />{ex.data_chegada ? FMT_DATE(ex.data_chegada) : '—'} {ex.horario_chegada || ''} · {ex.km_chegada != null ? Number(ex.km_chegada).toLocaleString('pt-BR') : '—'} km</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 justify-end px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                <button onClick={() => excluirPonto(p)} className="px-3 py-2 rounded-lg border text-sm font-medium text-red-600 hover:bg-red-50" style={{ borderColor: '#FECACA' }}>Excluir</button>
                                <button onClick={() => { setPontoDetalhe(null); abrirEditarPonto(p); }} className="px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Editar</button>
                                <button onClick={() => setPontoDetalhe(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Fechar</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {modalPonto && (
                <ModalPonto
                    confirm={confirm}
                    destinosParaTipo={destinosParaTipo}
                    editandoPontoId={editandoPontoId}
                    formPonto={formPonto}
                    load={load}
                    setEditandoPontoId={setEditandoPontoId}
                    setFormPonto={setFormPonto}
                    setModalPonto={setModalPonto}
                    showToast={showToast}
                    user={user}
                    veiculosProprios={veiculosProprios}
                />
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
