import React, { useState, useCallback, useEffect, useMemo } from 'react';

import * as XLSX from 'xlsx';

import { useToast } from 'hooks/useToast';
import { useConfirm, usePagination, PrettySelect, AppIcon as Icon, Button, Toast, Field, ModalHeader, ModalOverlay, SearchInput } from 'components';
import { useBonusConfig } from 'services/settingsService';
import { fetchCarregamentos, fetchBonificacoesExtras, fetchCarreteirosPropriosOnly, calcularBonusCarreteiro, createBonificacaoExtra, updateBonificacaoExtra, deleteBonificacaoExtra } from 'services/carretas';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

import { FMT_DATE, BRL } from '../../utils/helpers';
import { inputStyle, inputCls } from '../../utils/constants';
import ColapsaveisMotoristas from '../ColapsaveisMotoristas';
import TabViagens from './components/TabViagens';
import TabExtras from './components/TabExtras';

export default function TabBonificacoes({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const { bonusConfig } = useBonusConfig();

    // ── Estado ──────────────────────────────────────────────────────────────────
    const [carregamentos, setCarregamentos] = useState([]);
    const [extras,        setExtras]        = useState([]);
    const [motoristas,    setMotoristas]    = useState([]);
    const [filtroMotorista, setFiltroMotorista] = useState('');
    const mesAtualBonif = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; })();
    const [filtroMes, setFiltroMes] = useState(() => {
        try { return sessionStorage.getItem('carretas_bonif_filtroMes') ?? mesAtualBonif; } catch { return mesAtualBonif; }
    });
    const handleSetFiltroMes = (v) => {
        setFiltroMes(v);
        try { sessionStorage.setItem('carretas_bonif_filtroMes', v); } catch {}
    };
    const [filtroDia,       setFiltroDia]       = useState('');
    const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' }); // tem prioridade sobre dia/mês
    const [usarPeriodo, setUsarPeriodo] = useState(false);
    const [loading,  setLoading]  = useState(true);
    const [subTab,   setSubTab]   = useState('viagens'); // 'viagens' | 'extras'
    const [modalExtra, setModalExtra] = useState(null);  // null | {mode, data?}
    const [formExtra, setFormExtra] = useState({ motorista_id: '', valor: '', data: new Date().toISOString().split('T')[0], observacao: '' });

    // ── Carregar dados ───────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtroMotorista) f.motorista_id = filtroMotorista;
            if (usarPeriodo && periodoCustom.inicio && periodoCustom.fim) {
                f.dataInicio = periodoCustom.inicio; f.dataFim = periodoCustom.fim;
            } else if (filtroDia) {
                f.dataInicio = filtroDia; f.dataFim = filtroDia;
            } else if (filtroMes) {
                f.dataInicio = filtroMes + '-01';
                f.dataFim    = filtroMes + '-' + String(new Date(+filtroMes.split('-')[0], +filtroMes.split('-')[1], 0).getDate()).padStart(2,'0');
            }
            const fCarr = {};
            if (filtroMotorista) fCarr.motoristaId = filtroMotorista;
            if (filtroDia || filtroMes || (usarPeriodo && periodoCustom.inicio && periodoCustom.fim)) { fCarr.dataInicio = f.dataInicio; fCarr.dataFim = f.dataFim; }
            fCarr.is_terceiro = false; // Carregamentos de terceiros NUNCA entram no cálculo de bônus

            const [c, e, m] = await Promise.all([
                fetchCarregamentos(fCarr),
                fetchBonificacoesExtras(f),
                fetchCarreteirosPropriosOnly(),
            ]);
            setCarregamentos(c); setExtras(e); setMotoristas(m);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtroMotorista, filtroMes, filtroDia, usarPeriodo, periodoCustom]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    // ── Cálculos ─────────────────────────────────────────────────────────────────
    // CIF: apenas volume — excluir completamente de Viagens e Bonificações
    const isCIF = (c) => {
        const orig = (c.empresa_origem || '').toUpperCase();
        return orig.startsWith('CIF_') || orig.includes('|CIF_');
    };

    const carregamentosComBonus = useMemo(() =>
        carregamentos
            // exclui CIF, carregamentos sem motorista (retira/terceiros) e
            // carregamentos avulsos feitos por caminhão da frota (fora da
            // frota de carretas — ex: Montes Claros). Esses são marcados por
            // não terem veiculo_id de carreta mas terem placa_terceiro
            // preenchida; contam no volume de sacos e no frete, mas nunca
            // geram bônus de carreteiro.
            .filter(c => !isCIF(c) && c.motorista_id && !(!c.veiculo_id && c.placa_terceiro))
            .map(c => ({ ...c, bonus: calcularBonusCarreteiro(c.destino, bonusConfig) }))
    , [carregamentos, bonusConfig]); // eslint-disable-line

    const totais = useMemo(() => {
        const porMotorista = {};
        carregamentosComBonus.forEach(c => {
            const id   = c.motorista_id || 'sem';
            const nome = c.motorista?.name || 'Sem motorista';
            if (!porMotorista[id]) porMotorista[id] = { nome, carregamentos: 0, bonusViagens: 0, bonusExtras: 0, notas: [] };
            porMotorista[id].carregamentos++;
            porMotorista[id].bonusViagens += c.bonus;
            if (c.numero_nota_fiscal) porMotorista[id].notas.push(c.numero_nota_fiscal);
        });
        extras.forEach(e => {
            const id   = e.motorista_id || 'sem';
            const nome = e.motorista?.name || 'Sem motorista';
            if (!porMotorista[id]) porMotorista[id] = { nome, carregamentos: 0, bonusViagens: 0, bonusExtras: 0 };
            porMotorista[id].bonusExtras += Number(e.valor || 0);
        });
        const lista = Object.values(porMotorista).map(m => ({ ...m, bonusTotal: m.bonusViagens + m.bonusExtras }));
        return {
            totalViagens:   carregamentosComBonus.length,
            totalBonusViag: carregamentosComBonus.reduce((s, c) => s + c.bonus, 0),
            totalExtras:    extras.reduce((s, e) => s + Number(e.valor || 0), 0),
            porMotorista:   lista.sort((a, b) => b.bonusTotal - a.bonusTotal),
        };
    }, [carregamentosComBonus, extras]);

    // ── CRUD Extras ───────────────────────────────────────────────────────────────
    const abrirNovaExtra = () => {
        setFormExtra({ motorista_id: '', valor: '', data: new Date().toISOString().split('T')[0], observacao: '' });
        setModalExtra({ mode: 'create' });
    };
    const abrirEditExtra = e => {
        setFormExtra({ motorista_id: e.motorista_id, valor: String(e.valor), data: e.data, observacao: e.observacao || '' });
        setModalExtra({ mode: 'edit', data: e });
    };
    const [savingExtra, setSavingExtra] = useState(false);
    const salvarExtra = async () => {
        if (savingExtra) return; // já tem um envio em andamento — ignora clique repetido
        if (!formExtra.motorista_id)       { showToast('Selecione o motorista', 'error'); return; }
        if (!formExtra.valor || isNaN(+formExtra.valor)) { showToast('Informe um valor válido', 'error'); return; }
        if (!formExtra.observacao?.trim()) { showToast('Observação é obrigatória', 'error'); return; }
        setSavingExtra(true);
        try {
            const payload = { ...formExtra, valor: Number(formExtra.valor) };
            if (modalExtra.mode === 'create') await createBonificacaoExtra(payload);
            else await updateBonificacaoExtra(modalExtra.data.id, payload);
            showToast('Bonificação salva!', 'success');
            setModalExtra(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingExtra(false); }
    };
    const excluirExtra = async id => {
        const ok = await confirm({ title: 'Excluir bonificação extra?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteBonificacaoExtra(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    // ── Exportar ──────────────────────────────────────────────────────────────────
    const exportar = () => {
        const wb = XLSX.utils.book_new();
        if (carregamentosComBonus.length) {
            const rows = carregamentosComBonus.map(c => ({
                'Motorista': c.motorista?.name || '', 'Placa': c.veiculo?.placa || c.placa_terceiro || '',
                'Destino': c.destino || '', 'Data': FMT_DATE(c.data_carregamento),
                'Qtd (sacos)': c.quantidade || 0, 'Bônus (R$)': c.bonus,
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Bônus por Carregamento');
        }
        if (extras.length) {
            const rows2 = extras.map(e => ({
                'Motorista': e.motorista?.name || '', 'Data': e.data,
                'Valor (R$)': Number(e.valor || 0), 'Observação': e.observacao || '',
                'Criado por': e.criador?.name || '',
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows2), 'Bônus Extras');
        }
        if (!carregamentosComBonus.length && !extras.length) { showToast('Nenhum dado no período.', 'error'); return; }

        // Aba nova com o total de bônus por motorista — mesmo somatório já
        // exibido nos cards desta tela (totais.porMotorista).
        const rowsResumo = totais.porMotorista.map(m => ({
            'Motorista': m.nome,
            'Carregamentos': m.carregamentos,
            'Bônus Viagens (R$)': m.bonusViagens,
            'Bônus Extras (R$)': m.bonusExtras,
            'Total (R$)': m.bonusTotal,
        }));
        rowsResumo.push({
            'Motorista': 'TOTAL GERAL',
            'Carregamentos': totais.totalViagens,
            'Bônus Viagens (R$)': totais.totalBonusViag,
            'Bônus Extras (R$)': totais.totalExtras,
            'Total (R$)': totais.totalBonusViag + totais.totalExtras,
        });
        const wsResumo = XLSX.utils.json_to_sheet(rowsResumo);
        wsResumo['!cols'] = [26, 14, 16, 16, 14].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo (Soma por Motorista)');

        XLSX.writeFile(wb, `bonificacoes_carretas_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const [pesquisa, setPesquisa] = useState('');

    const carregamentosBonosFiltrados = useMemo(() => {
        if (!pesquisa.trim()) return carregamentosComBonus;
        const q = pesquisa.toLowerCase();
        return carregamentosComBonus.filter(c =>
            (c.motorista?.name || '').toLowerCase().includes(q) ||
            (c.destino || '').toLowerCase().includes(q) ||
            (c.numero_nota_fiscal || '').toLowerCase().includes(q) ||
            (c.veiculo?.placa || c.placa_terceiro || '').toLowerCase().includes(q)
        );
    }, [carregamentosComBonus, pesquisa]);

    const extrasFiltrados = useMemo(() => {
        if (!pesquisa.trim()) return extras;
        const q = pesquisa.toLowerCase();
        return extras.filter(e =>
            (e.motorista?.name || '').toLowerCase().includes(q) ||
            (e.observacao || '').toLowerCase().includes(q)
        );
    }, [extras, pesquisa]);

    const carreteiros = motoristas.filter(m => m && (m.tipo_veiculo === 'carreta' || m.role === 'carreteiro'));
    const carregamentosBonosPag = usePagination(carregamentosBonosFiltrados, 15, [carregamentosBonosFiltrados.length, pesquisa]);
    const extrasPag = usePagination(extrasFiltrados, 15, [extrasFiltrados.length, pesquisa]);

    return (
        <div>
            {/* ── Toolbar ── */}
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <PrettySelect value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos motoristas</option>
                        {carreteiros.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </PrettySelect>
                    <input type="month" value={filtroMes} onChange={e => { handleSetFiltroMes(e.target.value); setFiltroDia(''); setUsarPeriodo(false); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por mês" />
                    <input type="date" value={filtroDia} onChange={e => { setFiltroDia(e.target.value); handleSetFiltroMes(''); setUsarPeriodo(false); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por dia específico" />
                    <button type="button" onClick={() => setUsarPeriodo(v => !v)}
                        className="px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap"
                        style={usarPeriodo
                            ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                            : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        {usarPeriodo ? '✓ Período ativo' : 'Usar período'}
                    </button>
                    {usarPeriodo && (
                        <>
                            <input type="date" value={periodoCustom.inicio} onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))}
                                className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data inicial" />
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>até</span>
                            <input type="date" value={periodoCustom.fim} onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))}
                                className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data final" />
                        </>
                    )}
                    {(filtroMes || filtroDia || usarPeriodo) && (
                        <button onClick={() => { handleSetFiltroMes(''); setFiltroDia(''); setUsarPeriodo(false); setPeriodoCustom({ inicio: '', fim: '' }); }}
                            className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            title="Limpar data">✕ Data</button>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Motorista, destino, NF, placa..." width="240px" />
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar Excel
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                    { l: 'Carregamentos',   v: totais.totalViagens,                       c: '#1D4ED8', bg: '#EFF6FF', i: 'Package' },
                    { l: 'Bônus Viagens',   v: BRL(totais.totalBonusViag),                c: '#7C3AED', bg: '#EDE9FE', i: 'Award' },
                    { l: 'Bônus Extras',    v: BRL(totais.totalExtras),                   c: '#D97706', bg: '#FFFBEB', i: 'PlusCircle' },
                    { l: 'Total a Receber', v: BRL(totais.totalBonusViag + totais.totalExtras), c: '#059669', bg: '#ECFDF5', i: 'DollarSign' },
                ].map(k => (
                    <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}>
                                <Icon name={k.i} size={14} color={k.c} />
                            </div>
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                        </div>
                        <p className="text-xl font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                    </div>
                ))}
            </div>

            {/* ── Cards por motorista — colapsáveis ── */}
            {totais.porMotorista.length > 0 && (
                <ColapsaveisMotoristas motoristas={totais.porMotorista} />
            )}

            {/* ── Sub-abas ── */}
            <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-muted)' }}>
                {[
                    { id: 'viagens', label: 'Bônus por Viagens', icon: 'Truck' },
                    { id: 'extras',  label: 'Bonificações Extras', icon: 'PlusCircle' },
                ].map(s => (
                    <button key={s.id} onClick={() => setSubTab(s.id)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                        style={subTab === s.id
                            ? { backgroundColor: '#fff', color: 'var(--color-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                            : { color: 'var(--color-muted-foreground)' }}>
                        <Icon name={s.icon} size={13} />
                        {s.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* ── Sub-aba: Bônus por Viagens (carregamentos) ── */}
                    {subTab === 'viagens' && (
                        <TabViagens carregamentosBonosFiltrados={carregamentosBonosFiltrados} carregamentosBonosPag={carregamentosBonosPag} pesquisa={pesquisa} />
                    )}

                    {/* ── Sub-aba: Bonificações Extras ── */}
                    {subTab === 'extras' && (
                        <TabExtras
                    abrirEditExtra={abrirEditExtra}
                    abrirNovaExtra={abrirNovaExtra}
                    excluirExtra={excluirExtra}
                    extrasFiltrados={extrasFiltrados}
                    extrasPag={extrasPag}
                    isAdmin={isAdmin}
                    pesquisa={pesquisa}
                />
                    )}
                </>
            )}

            {/* ── Modal Bonificação Extra ── */}
            {modalExtra && isAdmin && (
                <ModalOverlay onClose={() => setModalExtra(null)}>
                    <ModalHeader
                        title={modalExtra.mode === 'create' ? 'Nova Bonificação Extra' : 'Editar Bonificação Extra'}
                        icon="PlusCircle"
                        onClose={() => setModalExtra(null)}
                    />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                        <Field label="Motorista" required>
                            <PrettySelect value={formExtra.motorista_id}
                                onChange={e => setFormExtra(f => ({ ...f, motorista_id: e.target.value }))}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {carreteiros.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Data" required>
                            <input type="date" value={formExtra.data}
                                onChange={e => setFormExtra(f => ({ ...f, data: e.target.value }))}
                                className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Valor (R$)" required>
                            <input type="number" step="0.01" min="0" value={formExtra.valor}
                                onChange={e => setFormExtra(f => ({ ...f, valor: e.target.value }))}
                                className={inputCls} style={inputStyle} placeholder="Ex: 150,00" />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Observação" required>
                                <textarea value={formExtra.observacao}
                                    onChange={e => setFormExtra(f => ({ ...f, observacao: e.target.value }))}
                                    className={inputCls} style={inputStyle} rows={3}
                                    placeholder="Descreva o motivo da bonificação (ex: Viagem extra em feriado, desempenho excepcional...)" />
                            </Field>
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModalExtra(null)}
                            className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={salvarExtra} size="sm" iconName="Check" loading={savingExtra} disabled={savingExtra}>Salvar</Button>
                    </div>
                </ModalOverlay>
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
