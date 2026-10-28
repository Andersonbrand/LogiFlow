import React, { useState,  useEffect } from 'react';

import { useAuth } from 'context/AuthContext';
import { useToast } from 'hooks/useToast';
import {  AppIcon as Icon, NavigationBar, Toast } from 'components';
import {       } from 'services/carretas';
import { } from 'services/vehicleService';
import {        } from 'services/pneusService';
import { } from 'config/pneuDiagramaConfig';
import { subscribeTabela } from 'services/supabaseClient';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

import { getAnexoTipo, downloadAnexo } from './utils/helpers';
import TabOs from './components/TabOs';
import TabPneus from './components/TabPneus';
import ModalFinalizar from './components/ModalFinalizar';
import ModalProblema from './components/ModalProblema';
import ModalPeca from './components/ModalPeca';
import { useMecanicoPneus, useMecanicoOrdens } from './hooks';

export default function MecanicoPage() {
    const { user, profile } = useAuth();
    const { toast, showToast } = useToast();
    const [pageTab, setPageTab]               = useState('os'); const { ordens, pecasCatalogo, loading, filtro, setFiltro, periodoPreset: osPeriodoPreset, periodo: osPeriodo, setPeriodo: setOsPeriodo, setPeriodoPreset: setOsPeriodoPreset, modalFinalizar, setModalFinalizar, modalProblema, setModalProblema, modalPeca, setModalPeca, pecaItem, setPecaItem, pecaItemOutro, setPecaItemOutro, pecaQtd, setPecaQtd, pecasParaSolicitar, setPecasParaSolicitar, obsFinalizar, setObsFinalizar, descProblema, setDescProblema, pdfUrl, setPdfUrl, assinarFinalizacao, setAssinarFinalizacao, load, handleFinalizar, handleReportarProblema, handleAdicionarPecaNaLista, handleRemoverPecaDaLista, handleSolicitarPeca, pendentes, andamento, problemas } = useMecanicoOrdens({ profile, showToast, user });
    
    
    
    
    
    
    
    
    
     
    
    
    
    const { motoristasPneu, catalogoPneus, loadingPneus, savingPneu, formPneu, setFormPneu, editandoPneuId, ConfirmDialogPneu, veiculoOptionsPneu, posicoesOcupadas, meusPneusAgrupados, paginaPneus, periodoPreset, periodo, setPeriodo, setPeriodoPreset, lotesExpandidos, toggleLote, verPneu, setVerPneu, handleEditarPneu, handleCancelarEdicaoPneu, handleExcluirPneu, handleExcluirLote, handleSalvarPneu } = useMecanicoPneus({ pageTab, showToast, user });
    
    
    
    
    
    
    
    
    
    
    
    
     
    
    
    
     
    
    
    
    
     // eslint-disable-line

    useEffect(() => {
        load();
        // Realtime: atualiza automaticamente quando admin excluir ou modificar uma OS
        const unsub = subscribeTabela('carretas_ordens_servico', load);
        return () => unsub();
    }, [load]); // eslint-disable-line
    useRecarregarAoVoltar(load);

    
    
    
    
    
    
    
    
    // PDF viewer: usa browser back para fechar (igual ao módulo de carretas)
    useEffect(() => {
        if (pdfUrl) {
            window.history.pushState({ pdfOpen: true }, '');
            const onPop = () => setPdfUrl(null);
            window.addEventListener('popstate', onPop);
            return () => window.removeEventListener('popstate', onPop);
        }
    }, [pdfUrl]);

    if (pdfUrl) {
        const tipoAnexo = getAnexoTipo(pdfUrl);
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    position: 'relative', zIndex: 10000, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px', backgroundColor: '#111827',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}>
                    <span style={{ color: '#9CA3AF', fontSize: 13 }}>Ordem de Serviço — Anexo</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => downloadAnexo(pdfUrl, `OS_anexo_${Date.now()}`)} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '0 12px', height: 32, borderRadius: 6,
                            backgroundColor: '#374151', color: '#D1D5DB',
                            border: 'none', cursor: 'pointer', fontSize: 12,
                        }} title="Baixar"><Icon name="Download" size={14} color="#D1D5DB" /> Baixar</button>
                        <button onClick={() => setPdfUrl(null)} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: 6,
                            backgroundColor: '#374151', color: '#D1D5DB',
                            border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1,
                        }} title="Fechar">✕</button>
                    </div>
                </div>
                {tipoAnexo === 'imagem' ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a', overflow: 'auto', padding: 16 }}>
                        <img src={pdfUrl} alt="Anexo da OS" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6 }} />
                    </div>
                ) : (
                    <iframe src={pdfUrl} title="OS" style={{ flex: 1, border: 'none', width: '100%', backgroundColor: '#1a1a1a', display: 'block' }} />
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-lg mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0" style={{ backgroundColor: '#059669' }}>
                            {(profile?.name || 'M')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="font-heading font-bold text-lg sm:text-xl truncate" style={{ color: 'var(--color-text-primary)' }}>
                                Olá, {profile?.name || 'Mecânico'}
                            </h1>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Ordens de serviço da oficina</p>
                        </div>
                        <button onClick={load} disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors flex-shrink-0 disabled:opacity-50"
                            style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                            <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {/* Abas */}
                    <div className="flex gap-1.5 mb-4 p-1 rounded-xl bg-gray-100 w-fit">
                        {[
                            { id: 'os', label: 'Ordens de Serviço', icon: 'Wrench' },
                            { id: 'pneus', label: 'Pneus', icon: 'CircleDot' },
                        ].map(t => (
                            <button key={t.id} onClick={() => setPageTab(t.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={pageTab === t.id
                                    ? { backgroundColor: '#fff', color: 'var(--color-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                                    : { color: 'var(--color-muted-foreground)' }}>
                                <Icon name={t.icon} size={14} color={pageTab === t.id ? 'var(--color-primary)' : 'var(--color-muted-foreground)'} />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {pageTab === 'os' && (
                    <TabOs
                    andamento={andamento}
                    filtro={filtro}
                    periodoPreset={osPeriodoPreset}
                    periodo={osPeriodo}
                    setPeriodo={setOsPeriodo}
                    setPeriodoPreset={setOsPeriodoPreset}
                    loading={loading}
                    ordens={ordens}
                    pendentes={pendentes}
                    problemas={problemas}
                    setAssinarFinalizacao={setAssinarFinalizacao}
                    setDescProblema={setDescProblema}
                    setFiltro={setFiltro}
                    setModalFinalizar={setModalFinalizar}
                    setModalPeca={setModalPeca}
                    setModalProblema={setModalProblema}
                    setObsFinalizar={setObsFinalizar}
                    setPdfUrl={setPdfUrl}
                    setPecaItem={setPecaItem}
                    setPecaItemOutro={setPecaItemOutro}
                    setPecaQtd={setPecaQtd}
                    setPecasParaSolicitar={setPecasParaSolicitar}
                />
                    )}

                    {pageTab === 'pneus' && (
                        <TabPneus
                    ConfirmDialogPneu={ConfirmDialogPneu}
                    catalogoPneus={catalogoPneus}
                    editandoPneuId={editandoPneuId}
                    formPneu={formPneu}
                    handleCancelarEdicaoPneu={handleCancelarEdicaoPneu}
                    handleEditarPneu={handleEditarPneu}
                    handleExcluirLote={handleExcluirLote}
                    handleExcluirPneu={handleExcluirPneu}
                    handleSalvarPneu={handleSalvarPneu}
                    loadingPneus={loadingPneus}
                    paginaPneus={paginaPneus}
                    periodoPreset={periodoPreset}
                    periodo={periodo}
                    setPeriodo={setPeriodo}
                    setPeriodoPreset={setPeriodoPreset}
                    lotesExpandidos={lotesExpandidos}
                    meusPneusAgrupados={meusPneusAgrupados}
                    motoristasPneu={motoristasPneu}
                    posicoesOcupadas={posicoesOcupadas}
                    savingPneu={savingPneu}
                    setFormPneu={setFormPneu}
                    setVerPneu={setVerPneu}
                    toggleLote={toggleLote}
                    veiculoOptionsPneu={veiculoOptionsPneu}
                    verPneu={verPneu}
                />
                    )}
                </div>
            </main>

            {/* Modal Finalizar */}
            {modalFinalizar && (
                <ModalFinalizar
                    assinarFinalizacao={assinarFinalizacao}
                    handleFinalizar={handleFinalizar}
                    modalFinalizar={modalFinalizar}
                    obsFinalizar={obsFinalizar}
                    profile={profile}
                    setAssinarFinalizacao={setAssinarFinalizacao}
                    setModalFinalizar={setModalFinalizar}
                    setObsFinalizar={setObsFinalizar}
                />
            )}

            {/* Modal Reportar Problema */}
            {modalProblema && (
                <ModalProblema descProblema={descProblema} handleReportarProblema={handleReportarProblema} modalProblema={modalProblema} setDescProblema={setDescProblema} setModalProblema={setModalProblema} />
            )}

            {/* Modal Solicitar Peça */}
            {modalPeca && (
                <ModalPeca
                    handleAdicionarPecaNaLista={handleAdicionarPecaNaLista}
                    handleRemoverPecaDaLista={handleRemoverPecaDaLista}
                    handleSolicitarPeca={handleSolicitarPeca}
                    modalPeca={modalPeca}
                    pecaItem={pecaItem}
                    pecaItemOutro={pecaItemOutro}
                    pecaQtd={pecaQtd}
                    pecasCatalogo={pecasCatalogo}
                    pecasParaSolicitar={pecasParaSolicitar}
                    setModalPeca={setModalPeca}
                    setPecaItem={setPecaItem}
                    setPecaItemOutro={setPecaItemOutro}
                    setPecaQtd={setPecaQtd}
                />
            )}

            <Toast toast={toast} />
        </div>
    );
}
