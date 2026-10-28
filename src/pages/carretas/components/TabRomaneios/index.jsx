import React, { useState, useMemo, useCallback, useEffect } from 'react';

import * as XLSX from 'xlsx';

import { useToast } from 'hooks/useToast';
import { useConfirm, AppIcon as Icon, Toast } from 'components';
import { fetchRomaneios, fetchCarretasVeiculos, fetchCarreteirosPropriosOnly, fetchEmpresas, fetchRomaneiosFerragem, fetchFretesCidades, updateRomaneio, deleteRomaneio } from 'services/carretas';
import { fetchMaterials } from 'services/materialService';
import { fetchAllUsers } from 'services/userService';
import { subscribeTabela } from 'services/supabaseClient';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

import { FMT_DATE } from './utils/helpers';
import TabFerragens from './components/TabFerragens';
import TabCimento from './components/TabCimento';

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function TabRomaneios({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const [guia, setGuia]               = useState('cimento'); // 'cimento' | 'ferragens'
    const [romaneios, setRomaneios]     = useState([]);
    const [romaneiosFerragem, setRomaneiosFerragem] = useState([]);
    const [motoristas, setMotoristas]   = useState([]);
    const [veiculos, setVeiculos]       = useState([]);
    const [empresas, setEmpresas]       = useState([]);
    const [materiais, setMateriais]     = useState([]);
    const [fretesFretas, setFretesFretas] = useState([]);
    const [adminsFrete, setAdminsFrete] = useState([]); // usuários com role 'admin' — quem pode combinar frete fixo
    const [loading, setLoading]         = useState(true);
    const [modal, setModal]             = useState(null);
    const [detailModal, setDetailModal] = useState(null);
    const [filtroStatus, setFiltroStatus] = useState('');
    const mesAtualRomaneios = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; })();
    const [filtroMes, setFiltroMes] = useState(() => {
        try { return sessionStorage.getItem('carretas_romaneios_filtroMes') ?? mesAtualRomaneios; } catch { return mesAtualRomaneios; }
    });
    const handleSetFiltroMes = (v) => {
        setFiltroMes(v);
        try { sessionStorage.setItem('carretas_romaneios_filtroMes', v); } catch {}
    };
    const [filtroDia, setFiltroDia]       = useState(''); // dia específico (YYYY-MM-DD)
    const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' }); // tem prioridade sobre dia/mês
    const [usarPeriodo, setUsarPeriodo] = useState(false);
    const [pesquisa, setPesquisa] = useState('');

    const romaneiosFiltrados = useMemo(() => {
        if (!pesquisa.trim()) return romaneios;
        const q = pesquisa.toLowerCase();
        return romaneios.filter(r =>
            (r.numero || '').toLowerCase().includes(q) ||
            (r.motorista?.name || '').toLowerCase().includes(q) ||
            (r.veiculo?.placa || '').toLowerCase().includes(q) ||
            (r.destino || '').toLowerCase().includes(q) ||
            (r.empresa || '').toLowerCase().includes(q) ||
            (r.numero_nf || '').toLowerCase().includes(q) ||
            (r.numero_pedido || '').toLowerCase().includes(q)
        );
    }, [romaneios, pesquisa]);

    const romaneiosFerragemFiltrados = useMemo(() => {
        if (!pesquisa.trim()) return romaneiosFerragem;
        const q = pesquisa.toLowerCase();
        return romaneiosFerragem.filter(r =>
            (r.numero || '').toLowerCase().includes(q) ||
            (r.motorista?.name || '').toLowerCase().includes(q) ||
            (r.veiculo?.placa || '').toLowerCase().includes(q) ||
            (r.destino || '').toLowerCase().includes(q) ||
            (r.empresa || '').toLowerCase().includes(q) ||
            (r.numero_nf || '').toLowerCase().includes(q)
        );
    }, [romaneiosFerragem, pesquisa]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtroStatus) f.status = filtroStatus;
            // Período personalizado > dia específico > mês
            if (usarPeriodo && periodoCustom.inicio && periodoCustom.fim) {
                f.dataInicio = periodoCustom.inicio;
                f.dataFim    = periodoCustom.fim;
            } else if (filtroDia) {
                f.dataInicio = filtroDia;
                f.dataFim    = filtroDia;
            } else if (filtroMes) {
                f.dataInicio = filtroMes + '-01';
                f.dataFim    = filtroMes + '-' + String(new Date(
                    Number(filtroMes.split('-')[0]),
                    Number(filtroMes.split('-')[1]), 0
                ).getDate()).padStart(2, '0');
            }
            // Filtro de data da aba "Viagens lançadas pelos motoristas" — mesmo período do
            // mês/dia acima, mas sem o filtro de status (que é exclusivo da aba Romaneios)
            const fFerragem = {};
            if (f.dataInicio) fFerragem.dataInicio = f.dataInicio;
            if (f.dataFim)    fFerragem.dataFim    = f.dataFim;

            const [r, v, m, e, matResult, rf, fr, admins] = await Promise.all([
                fetchRomaneios(f),
                fetchCarretasVeiculos(),
                fetchCarreteirosPropriosOnly(),
                fetchEmpresas(),
                fetchMaterials().catch(err => { console.warn('[TabRomaneios] fetchMaterials falhou:', err); return []; }),
                fetchRomaneiosFerragem(fFerragem),
                fetchFretesCidades('frota'),
                fetchAllUsers().catch(err => { console.warn('[TabRomaneios] fetchAllUsers falhou:', err); return []; }),
            ]);
            // Enriquece materiais com dados do join dos romaneios (garante peso mesmo se catalog parcial)
            const matMap = {};
            (matResult || []).forEach(mat => { matMap[mat.id] = mat; });
            (r || []).forEach(rom => {
                (rom.itens || []).forEach(it => {
                    if (it.material_id && it.material && !matMap[it.material_id]) {
                        matMap[it.material_id] = it.material;
                    } else if (it.material_id && it.material && matMap[it.material_id] && !matMap[it.material_id].peso && it.material.peso) {
                        matMap[it.material_id] = { ...matMap[it.material_id], peso: it.material.peso };
                    }
                });
            });
            const mat = Object.values(matMap).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
            setRomaneios(r); setVeiculos((v || []).filter(x => !x.is_terceiro)); setMotoristas(m); setEmpresas(e); setMateriais(mat);
            setRomaneiosFerragem(rf || []);
            setFretesFretas(fr || []);
            setAdminsFrete((admins || []).filter(u => u.role === 'admin'));
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtroStatus, filtroMes, filtroDia, usarPeriodo, periodoCustom]); // eslint-disable-line

    useEffect(() => {
        load();
        // Realtime: sincroniza admin e motorista automaticamente
        const unsub = subscribeTabela('carretas_romaneios', load);
        return unsub;
    }, [load]);
    useRecarregarAoVoltar(load);

    const handleStatusChange = async (id, novoStatus) => {
        try {
            await updateRomaneio(id, { status: novoStatus });
            // Atualiza em ambas as listas (romaneio pode estar em qualquer uma)
            setRomaneios(prev => prev.map(r => r.id === id ? { ...r, status: novoStatus } : r));
            setRomaneiosFerragem(prev => prev.map(r => r.id === id ? { ...r, status: novoStatus } : r));
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Excluir romaneio?',
            message: 'Esta ação não pode ser desfeita.',
            confirmLabel: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        try { await deleteRomaneio(id); showToast('Excluído!', 'warning'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        if (!romaneios.length) { showToast('Nenhum romaneio para exportar', 'error'); return; }
        // Uma linha por PEDIDO (não por romaneio) — um romaneio pode ter
        // pedidos de empresas diferentes, então quebrar por pedido é o que
        // permite separar corretamente a receita de frete por empresa.
        // Romaneios sem nenhum pedido (só carga solta) ainda geram 1 linha,
        // usando os dados do próprio romaneio.
        const linhas = [];
        romaneios.forEach(r => {
            const peds = r.pedidos || [];
            if (peds.length === 0) {
                linhas.push({
                    'Romaneio': r.numero, 'Status': r.status, 'Motorista': r.motorista?.name || '', 'Placa': r.veiculo?.placa || '',
                    'Empresa': r.empresa || '', 'Data Saída': FMT_DATE(r.data_saida), 'Nº Pedido': r.numero_pedido || '',
                    'Cidade Destino': r.destino || '', 'NF': r.numero_nf || '',
                    'Valor Pedido (R$)': Number(r.valor_carga || 0), 'Frete (R$)': Number(r.valor_frete || 0),
                });
            } else {
                peds.forEach(p => {
                    const pct = Number(p.percentual_frete || 0.05);
                    linhas.push({
                        'Romaneio': r.numero, 'Status': r.status, 'Motorista': r.motorista?.name || '', 'Placa': r.veiculo?.placa || '',
                        'Empresa': p.empresa || r.empresa || '', 'Data Saída': FMT_DATE(r.data_saida), 'Nº Pedido': p.numero_pedido || '',
                        'Cidade Destino': p.cidade_destino || r.destino || '', 'NF': r.numero_nf || '',
                        'Valor Pedido (R$)': Number(p.valor_pedido || 0), 'Frete (R$)': Number(p.valor_pedido || 0) * pct,
                    });
                });
            }
        });
        // Ordena por Empresa pra ficar tudo agrupado visualmente na planilha
        linhas.sort((a, b) => (a['Empresa'] || 'zzz').localeCompare(b['Empresa'] || 'zzz') || a['Romaneio'].localeCompare(b['Romaneio']));

        const ws = XLSX.utils.json_to_sheet(linhas);
        ws['!cols'] = [10, 16, 20, 12, 22, 12, 12, 22, 12, 14, 14].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Romaneios por Pedido');

        // Resumo por empresa — total de pedidos, valor de carga e frete gerado,
        // pra ver de cara quanto cada empresa solicitante gerou de receita.
        const porEmpresa = {};
        linhas.forEach(l => {
            const emp = l['Empresa'] || '(sem empresa)';
            if (!porEmpresa[emp]) porEmpresa[emp] = { pedidos: 0, valorCarga: 0, frete: 0 };
            porEmpresa[emp].pedidos++;
            porEmpresa[emp].valorCarga += l['Valor Pedido (R$)'];
            porEmpresa[emp].frete += l['Frete (R$)'];
        });
        const resumoRows = Object.entries(porEmpresa)
            .sort((a, b) => b[1].frete - a[1].frete)
            .map(([emp, v]) => ({
                'Empresa': emp, 'Pedidos': v.pedidos,
                'Valor de Carga (R$)': v.valorCarga, 'Frete Gerado (R$)': v.frete,
            }));
        resumoRows.push({
            'Empresa': 'TOTAL', 'Pedidos': linhas.length,
            'Valor de Carga (R$)': resumoRows.reduce((s, r) => s + r['Valor de Carga (R$)'], 0),
            'Frete Gerado (R$)': resumoRows.reduce((s, r) => s + r['Frete Gerado (R$)'], 0),
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRows), 'Resumo por Empresa');

        XLSX.writeFile(wb, `romaneios_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const kpis = useMemo(() => {
        const freteTotal = romaneios.reduce((s, r) => s + Number(r.valor_frete || 0), 0);
        return {
            total:       romaneios.length,
            transito:    romaneios.filter(r => r.status === 'Em Trânsito').length,
            finalizados: romaneios.filter(r => r.status === 'Entrega finalizada').length,
            freteTotal,
        };
    }, [romaneios]);

    return (
        <div>
            {/* ── Guias Cimento / Ferragens ── */}
            <div className="flex gap-1 mb-5 p-1 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB', width: 'fit-content' }}>
                {[
                    { id: 'cimento',   label: 'Romaneios',                          icon: 'Package',  color: '#1D4ED8' },
                    { id: 'ferragens', label: 'Viagens lançadas pelos motoristas',   icon: 'Truck',    color: '#059669' },
                ].map(g => (
                    <button key={g.id} onClick={() => setGuia(g.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={guia === g.id
                            ? { backgroundColor: 'white', color: g.color, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: 600 }
                            : { color: 'var(--color-muted-foreground)' }}>
                        <Icon name={g.icon} size={14} color={guia === g.id ? g.color : 'var(--color-muted-foreground)'} />
                        {g.label}
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold"
                            style={guia === g.id
                                ? { backgroundColor: g.id === 'cimento' ? '#EFF6FF' : '#ECFDF5', color: g.color }
                                : { backgroundColor: '#F3F4F6', color: 'var(--color-muted-foreground)' }}>
                            {g.id === 'cimento' ? romaneios.length : romaneiosFerragem.length}
                        </span>
                    </button>
                ))}
            </div>

            {/* ═══ GUIA FERRAGENS ═══ */}
            {guia === 'ferragens' && (
                <TabFerragens
                    filtroDia={filtroDia}
                    filtroMes={filtroMes}
                    handleSetFiltroMes={handleSetFiltroMes}
                    handleStatusChange={handleStatusChange}
                    isAdmin={isAdmin}
                    loading={loading}
                    periodoCustom={periodoCustom}
                    pesquisa={pesquisa}
                    romaneiosFerragemFiltrados={romaneiosFerragemFiltrados}
                    setFiltroDia={setFiltroDia}
                    setPeriodoCustom={setPeriodoCustom}
                    setPesquisa={setPesquisa}
                    setUsarPeriodo={setUsarPeriodo}
                    usarPeriodo={usarPeriodo}
                />
            )}

            {guia === 'cimento' && (<TabCimento
                    adminsFrete={adminsFrete}
                    detailModal={detailModal}
                    empresas={empresas}
                    exportar={exportar}
                    filtroDia={filtroDia}
                    filtroMes={filtroMes}
                    filtroStatus={filtroStatus}
                    fretesFretas={fretesFretas}
                    handleDelete={handleDelete}
                    handleSetFiltroMes={handleSetFiltroMes}
                    handleStatusChange={handleStatusChange}
                    isAdmin={isAdmin}
                    kpis={kpis}
                    load={load}
                    loading={loading}
                    materiais={materiais}
                    modal={modal}
                    motoristas={motoristas}
                    periodoCustom={periodoCustom}
                    pesquisa={pesquisa}
                    romaneios={romaneios}
                    romaneiosFiltrados={romaneiosFiltrados}
                    setDetailModal={setDetailModal}
                    setFiltroDia={setFiltroDia}
                    setFiltroStatus={setFiltroStatus}
                    setModal={setModal}
                    setPeriodoCustom={setPeriodoCustom}
                    setPesquisa={setPesquisa}
                    setUsarPeriodo={setUsarPeriodo}
                    usarPeriodo={usarPeriodo}
                    veiculos={veiculos}
                />)} {/* fim guia cimento */}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
