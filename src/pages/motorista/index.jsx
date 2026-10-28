import React, { useState,  useEffect, } from 'react';


import { useAuth } from 'context/AuthContext';
import { useToast } from 'hooks/useToast';
import { useConfirm,  NavigationBar, AppIcon as Icon, BreadcrumbTrail, Toast } from 'components';
import { } from 'services/romaneio';
import {           } from 'services/carretas';
import { } from 'services/vehicleService';
import { } from 'services/supabaseClient';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import useDeviceProfile from 'hooks/useDeviceProfile';
import { } from 'services/bonificacaoService';
import { usePageTabs } from 'context/PageTabsContext';

import { PERIOD_OPTIONS } from './utils/constants';
import { BRL } from './utils/helpers';
import TabViagens from './components/TabViagens';
import TabAbastecimentos from './components/TabAbastecimentos';
import TabChecklist from './components/TabChecklist';
import TabBonificacoes from './components/TabBonificacoes';
import ModalAbast from './components/ModalAbast';
import ModalCheck from './components/ModalCheck';
import { useMotoristaDados, useMotoristaAbastecimento, useMotoristaChecklist, useExportMotorista } from './hooks';

export default function MotoristaDashboard() {
    const { user, profile } = useAuth();
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const [tab, setTab]               = useState('viagens');
    const [period, setPeriod]         = useState('mes'); // padrão: mostra tudo do mês vigente
    // Período personalizado (usado na aba Bonificações) — quando preenchido,
    // sobrepõe o filtro de "últimos N dias" acima.
    const [periodoCustom, setPeriodoCustom] = useState(null); // { inicio: 'YYYY-MM-DD', fim: 'YYYY-MM-DD' } | null — filtro CONFIRMADO (aplicado na busca)
    // Valores digitados/selecionados nos campos de data, ainda não confirmados pelo botão "Buscar viagens".
    // Fica separado de `periodoCustom` de propósito: só deve disparar busca no banco quando o usuário
    // escolher as duas datas E clicar em "Buscar viagens" — nunca ao selecionar só a data inicial.
    const [periodoCustomInput, setPeriodoCustomInput] = useState(null); const { loading, romaneios, abast, checklists, veiculos, postos, configAbast, checklistItens, load, bonificacoes, bonificacoesComValor, bonificacoesPag, bonusExtras, totais } = useMotoristaDados({ period, periodoCustom, profile, showToast, user });
    
    
    
     
    
    const [filtroPlaca, setFiltroPlaca] = useState('');

    const { modalAbast, setModalAbast, editingAbastId, setEditingAbastId, emptyAbast, formAbast, setFormAbast, savingAbast, getPreco, handlePostoChange, handleLitros, handleAbast, abrirEdicaoAbast, excluirAbast } = useMotoristaAbastecimento({ abast, configAbast, confirm, load, postos, showToast, user, veiculos });
    const { modalCheck, setModalCheck, editingCheckId, setEditingCheckId, emptyCheck, formCheck, setFormCheck, savingCheck, progressoFotosCheck, handleCheck, abrirEdicaoCheck, excluirCheck } = useMotoristaChecklist({ checklists, confirm, load, showToast, user, veiculos });
    
    
    
    
    
    
    
    
    
       // eslint-disable-line
    useRecarregarAoVoltar(load);
    useDeviceProfile(); 
    
    
    
    
    
    
    
    
    
    
    
    
    const { exportar } = useExportMotorista({ bonificacoes, profile, showToast });
    // ── Tabs ─────────────────────────────────────────────────────────────────
    const TABS = [
        { id: 'viagens',        label: 'Meus Romaneios', icon: 'FileText' },
        { id: 'abastecimentos', label: 'Abastecimentos', icon: 'Fuel' },
        { id: 'checklist',      label: 'Checklist',      icon: 'ClipboardCheck' },
        { id: 'bonificacoes',   label: 'Bonificações',   icon: 'DollarSign' },
    ];
    const tabAtual = TABS.find(t => t.id === tab);
    const { setPageTabs } = usePageTabs();
    useEffect(() => {
        setPageTabs(TABS, tab, setTab);
        return () => setPageTabs(null);
    }, [tab]); // eslint-disable-line

    // Helper: preço efetivo para exibir no modal
    const precoDieselEfetivo = getPreco(formAbast.posto_id, 'diesel');
    const precoArlaEfetivo   = getPreco(formAbast.posto_id, 'arla');

    return (
        <div className="min-h-screen m-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-[1920px] mx-auto">
                    <div className="flex">

                        {/* ── Sidebar desktop ── */}
                        <aside className="hidden lg:flex flex-col flex-shrink-0 sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto border-r"
                            style={{ width: 210, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                            <nav className="flex flex-col gap-1 p-3">
                                <div className="px-3 py-3 mb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                            {(profile?.name || 'M')[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{profile?.name || 'Motorista'}</p>
                                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Motorista</p>
                                        </div>
                                    </div>
                                </div>
                                {TABS.map(t => {
                                    const ativo = tab === t.id;
                                    return (
                                        <button key={t.id} onClick={() => setTab(t.id)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                                            style={{ backgroundColor: ativo ? 'var(--color-primary)' : 'transparent', color: ativo ? '#fff' : 'var(--color-muted-foreground)' }}>
                                            <Icon name={t.icon} size={16} color={ativo ? '#fff' : 'currentColor'} />
                                            <span>{t.label}</span>
                                        </button>
                                    );
                                })}
                                <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-foreground)', fontSize: 10 }}>Período</p>
                                    <div className="flex flex-col gap-1 px-3">
                                        {PERIOD_OPTIONS.map(p => (
                                            <button key={p.days} onClick={() => setPeriod(p.days)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left"
                                                style={period === p.days ? { backgroundColor: 'var(--color-primary)', color: '#fff' } : { color: 'var(--color-muted-foreground)' }}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </nav>
                        </aside>

                        {/* ── Conteúdo ── */}
                        <div className="flex-1 min-w-0 px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
                            <BreadcrumbTrail className="mb-4" />

                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base lg:hidden"
                                        style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                        {(profile?.name || 'M')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h1 className="font-heading font-bold text-lg sm:text-xl" style={{ color: 'var(--color-text-primary)' }}>
                                            Olá, {profile?.name || 'Motorista'}
                                        </h1>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{tabAtual?.label}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="lg:hidden flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        {PERIOD_OPTIONS.map(p => (
                                            <button key={p.days} onClick={() => setPeriod(p.days)}
                                                className="px-2 sm:px-3 py-2 text-xs font-medium transition-colors"
                                                style={period === p.days ? { backgroundColor: 'var(--color-primary)', color: '#fff' } : { backgroundColor: 'white', color: 'var(--color-muted-foreground)' }}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={exportar} className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                        <Icon name="FileDown" size={14} color="currentColor" />
                                        <span className="hidden sm:inline">Exportar</span>
                                    </button>
                                </div>
                            </div>

                            {/* KPIs */}
                            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
                                {[
                                    { l: 'Total Romaneios', v: totais.viagens,     i: 'FileText',     c: '#1D4ED8', bg: '#EFF6FF' },
                                    { l: 'Finalizados',     v: totais.finalizadas, i: 'CheckCircle2', c: '#059669', bg: '#D1FAE5' },
                                    { l: 'Em Trânsito',     v: totais.emTransito,  i: 'Navigation',   c: '#D97706', bg: '#FEF9C3' },
                                    { l: 'Bônus no Período',v: BRL(totais.totalBonus), i: 'DollarSign', c: '#7C3AED', bg: '#EDE9FE' },
                                ].map(k => (
                                    <div key={k.l} className="bg-white rounded-xl border p-3 sm:p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}>
                                                <Icon name={k.i} size={14} color={k.c} />
                                            </div>
                                        </div>
                                        <p className="text-lg sm:text-xl font-bold font-data m-fluid-value" style={{ color: k.c }}>{k.v}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Quick actions */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                                <button onClick={() => { setEditingAbastId(null); setFormAbast(emptyAbast()); setModalAbast(true); }}
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
                                <button onClick={() => { setEditingCheckId(null); setFormCheck(emptyCheck()); setModalCheck(true); }}
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
                                    {/* Meus Romaneios */}
                                    {tab === 'viagens' && (
                                        <TabViagens romaneios={romaneios} />
                                    )}

                                    {/* Abastecimentos */}
                                    {tab === 'abastecimentos' && (
                                        <TabAbastecimentos
                    abast={abast}
                    abrirEdicaoAbast={abrirEdicaoAbast}
                    excluirAbast={excluirAbast}
                    filtroPlaca={filtroPlaca}
                    postos={postos}
                    setFiltroPlaca={setFiltroPlaca}
                    totais={totais}
                    veiculos={veiculos}
                />
                                    )}

                                    {/* Checklist */}
                                    {tab === 'checklist' && (
                                        <TabChecklist
                    abrirEdicaoCheck={abrirEdicaoCheck}
                    checklistItens={checklistItens}
                    checklists={checklists}
                    excluirCheck={excluirCheck}
                    filtroPlaca={filtroPlaca}
                    setFiltroPlaca={setFiltroPlaca}
                    veiculos={veiculos}
                />
                                    )}

                                    {/* Bonificações */}
                                    {tab === 'bonificacoes' && (
                                        <TabBonificacoes
                    bonificacoesComValor={bonificacoesComValor}
                    bonificacoesPag={bonificacoesPag}
                    bonusExtras={bonusExtras}
                    period={period}
                    periodoCustom={periodoCustom}
                    periodoCustomInput={periodoCustomInput}
                    setPeriodoCustom={setPeriodoCustom}
                    setPeriodoCustomInput={setPeriodoCustomInput}
                    totais={totais}
                />
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal Abastecimento */}
            {modalAbast && (
                <ModalAbast
                    configAbast={configAbast}
                    editingAbastId={editingAbastId}
                    formAbast={formAbast}
                    handleAbast={handleAbast}
                    handleLitros={handleLitros}
                    handlePostoChange={handlePostoChange}
                    postos={postos}
                    precoArlaEfetivo={precoArlaEfetivo}
                    precoDieselEfetivo={precoDieselEfetivo}
                    savingAbast={savingAbast}
                    setEditingAbastId={setEditingAbastId}
                    setFormAbast={setFormAbast}
                    setModalAbast={setModalAbast}
                    veiculos={veiculos}
                />
            )}

            {/* Modal Checklist */}
            {modalCheck && (
                <ModalCheck
                    checklistItens={checklistItens}
                    editingCheckId={editingCheckId}
                    formCheck={formCheck}
                    handleCheck={handleCheck}
                    progressoFotosCheck={progressoFotosCheck}
                    savingCheck={savingCheck}
                    setEditingCheckId={setEditingCheckId}
                    setFormCheck={setFormCheck}
                    setModalCheck={setModalCheck}
                    showToast={showToast}
                    veiculos={veiculos}
                />
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
