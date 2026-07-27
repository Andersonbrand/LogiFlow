import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import Toast from 'components/ui/Toast';
import { EditButton, DeleteButton, ActionButtonsGroup } from 'components/ActionButtons';
import { useToast } from 'utils/useToast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import { fetchVeiculosProprios, fetchMotoristasProprios } from 'utils/carretasService';
import SearchableSelect from 'components/ui/SearchableSelect';
import {
    fetchCatalogoPneus, addItemCatalogoPneus, updateItemCatalogoPneus, deleteItemCatalogoPneus, fetchCatalogoPneusRaw,
    fetchComprasPneus, createCompraPneus, deleteCompraPneus,
    fetchDespesasAdmPneus,
    fetchPneus, createPneu, updatePneu, deletePneu, substituirPneu,
    saldoCompra, kmRodado,
} from 'utils/pneusService';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', backgroundColor: 'transparent' };

const BANDAGEM_LABEL = { mista: 'Mista', borrachudo: 'Borrachudo', liso: 'Liso' };
const BANDAGEM_COR = { mista: '#7C3AED', borrachudo: '#D97706', liso: '#2563EB' };

// ─── Banner ilustrativo do módulo (SVG original, com pneu girando em CSS) ───
function PneusBanner() {
    return (
        <div className="relative overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(120deg, #0F172A 0%, #1D4ED8 55%, #2563EB 100%)' }}>
            <style>{`
                @keyframes girarPneu { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes girarPneuLento { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
                .pneu-banner-roda-grande { animation: girarPneu 9s linear infinite; transform-origin: center; }
                .pneu-banner-roda-pequena { animation: girarPneuLento 6s linear infinite; transform-origin: center; }
            `}</style>

            {/* Pontinhos decorativos de fundo */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.08]" preserveAspectRatio="xMidYMid slice">
                <pattern id="pneusGridPattern" width="26" height="26" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.4" fill="#fff" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#pneusGridPattern)" />
            </svg>

            <div className="relative flex items-center justify-between gap-4 px-6 py-6 sm:px-8 sm:py-7">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: '#93C5FD' }}>Módulo · Frota</p>
                    <h2 className="text-xl sm:text-2xl font-black text-white mb-1">Gestão de Pneus</h2>
                    <p className="text-sm max-w-md" style={{ color: '#BFDBFE' }}>
                        Controle a vida útil, o rendimento por marca e o saldo de compras dos pneus da frota própria.
                    </p>
                </div>

                {/* Ilustração: pneu grande girando + dois pneus menores ao fundo */}
                <div className="relative hidden sm:flex items-center justify-center flex-shrink-0" style={{ width: 150, height: 110 }}>
                    <svg className="pneu-banner-roda-pequena absolute" style={{ left: -6, bottom: -4, opacity: 0.55 }} width="52" height="52" viewBox="0 0 52 52">
                        <PneuSVG />
                    </svg>
                    <svg className="pneu-banner-roda-pequena absolute" style={{ right: -10, top: -6, opacity: 0.4 }} width="40" height="40" viewBox="0 0 52 52">
                        <PneuSVG />
                    </svg>
                    <svg className="pneu-banner-roda-grande relative" width="104" height="104" viewBox="0 0 52 52">
                        <PneuSVG />
                    </svg>
                </div>
            </div>
        </div>
    );
}

// Ilustração original de um pneu (aro + carcaça + banda de rodagem), em SVG puro
function PneuSVG() {
    return (
        <g>
            <circle cx="26" cy="26" r="24" fill="#0B1220" stroke="#334155" strokeWidth="1.5" />
            {Array.from({ length: 16 }).map((_, i) => {
                const ang = (i * 360) / 16;
                return (
                    <rect key={i} x="25.1" y="2.5" width="1.8" height="6" rx="0.9" fill="#475569"
                        transform={`rotate(${ang} 26 26)`} />
                );
            })}
            <circle cx="26" cy="26" r="15.5" fill="#1E293B" stroke="#475569" strokeWidth="1" />
            <circle cx="26" cy="26" r="9.5" fill="#334155" stroke="#64748B" strokeWidth="1" />
            {Array.from({ length: 6 }).map((_, i) => {
                const ang = (i * 360) / 6;
                return <circle key={i} cx="26" cy="19" r="1.3" fill="#94A3B8" transform={`rotate(${ang} 26 26)`} />;
            })}
            <circle cx="26" cy="26" r="2.6" fill="#CBD5E1" />
        </g>
    );
}


function Field({ label, required, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500"> *</span>}
            </label>
            {children}
        </div>
    );
}

// Select com opção de cadastrar um novo valor na hora (catálogo extensível)
function SelectComOpcaoNova({ value, onChange, opcoes, onAddNova, placeholder = 'Selecione...' }) {
    const [addMode, setAddMode] = useState(false);
    const [novo, setNovo] = useState('');
    if (addMode) {
        return (
            <div className="flex gap-1.5">
                <input autoFocus value={novo} onChange={e => setNovo(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { onAddNova(novo); setNovo(''); setAddMode(false); } if (e.key === 'Escape') setAddMode(false); }}
                    className={inputCls} style={inputStyle} placeholder="Novo valor..." />
                <button type="button" onClick={() => { if (novo.trim()) { onAddNova(novo); setNovo(''); } setAddMode(false); }}
                    className="px-2.5 rounded-lg text-white text-xs font-semibold" style={{ backgroundColor: '#059669' }}>
                    <Icon name="Check" size={14} color="#fff" />
                </button>
                <button type="button" onClick={() => setAddMode(false)}
                    className="px-2.5 rounded-lg border text-xs" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="X" size={14} color="var(--color-muted-foreground)" />
                </button>
            </div>
        );
    }
    return (
        <div className="flex gap-1.5">
            <select value={value} onChange={e => onChange(e.target.value)} className={inputCls} style={inputStyle}>
                <option value="">{placeholder}</option>
                {opcoes.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <button type="button" onClick={() => setAddMode(true)} title="Adicionar novo"
                className="px-2.5 rounded-lg border flex items-center justify-center" style={{ borderColor: 'var(--color-border)' }}>
                <Icon name="Plus" size={14} color="var(--color-primary)" />
            </button>
        </div>
    );
}

// Modal genérico para o admin cadastrar, editar e excluir itens do catálogo
// (usado para "Eixo Trocado"; serve para marca/modelo/medida também)
function GerenciarCatalogoModal({ tipo, titulo, onClose, onChanged, showToast, confirm }) {
    const [itens, setItens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [novoNome, setNovoNome] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [editandoNome, setEditandoNome] = useState('');
    const [salvando, setSalvando] = useState(false);

    const carregar = useCallback(async () => {
        setLoading(true);
        try { setItens(await fetchCatalogoPneusRaw(tipo)); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [tipo, showToast]);

    useEffect(() => { carregar(); }, [carregar]);

    const handleAdd = async () => {
        if (!novoNome.trim()) return;
        setSalvando(true);
        try {
            await addItemCatalogoPneus(tipo, novoNome.trim());
            setNovoNome('');
            showToast('Item adicionado!', 'success');
            await carregar(); onChanged?.();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSalvando(false); }
    };

    const handleEditSave = async (id) => {
        if (!editandoNome.trim()) return;
        try {
            await updateItemCatalogoPneus(id, editandoNome.trim());
            setEditandoId(null);
            showToast('Item atualizado!', 'success');
            await carregar(); onChanged?.();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (item) => {
        const ok = await confirm({ title: `Excluir "${item.valor}"?`, message: 'Pneus que já usam este valor mantêm o texto salvo, mas ele deixará de aparecer na lista.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try {
            await deleteItemCatalogoPneus(item.id);
            showToast('Item excluído.', 'success');
            await carregar(); onChanged?.();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>{titulo}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={16} color="var(--color-muted-foreground)" /></button>
                </div>
                <div className="overflow-y-auto flex-1 p-5 space-y-2">
                    {loading ? (
                        <p className="text-xs text-center py-6" style={{ color: 'var(--color-muted-foreground)' }}>Carregando...</p>
                    ) : itens.length === 0 ? (
                        <p className="text-xs text-center py-6" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum item cadastrado ainda.</p>
                    ) : (
                        itens.map(item => (
                            <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                                {editandoId === item.id ? (
                                    <>
                                        <input autoFocus value={editandoNome} onChange={e => setEditandoNome(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleEditSave(item.id); if (e.key === 'Escape') setEditandoId(null); }}
                                            className={inputCls} style={inputStyle} />
                                        <button onClick={() => handleEditSave(item.id)} className="p-1.5 rounded-lg hover:bg-green-50 flex-shrink-0"><Icon name="Check" size={14} color="#059669" /></button>
                                        <button onClick={() => setEditandoId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0"><Icon name="X" size={14} color="var(--color-muted-foreground)" /></button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>{item.valor}</span>
                                        <button onClick={() => { setEditandoId(item.id); setEditandoNome(item.valor); }} className="p-1.5 rounded-lg hover:bg-blue-50 flex-shrink-0"><Icon name="Pencil" size={14} color="#1D4ED8" /></button>
                                        <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0"><Icon name="Trash2" size={14} color="#DC2626" /></button>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
                <div className="flex gap-2 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                        placeholder="Novo item..." className={inputCls} style={inputStyle} />
                    <Button onClick={handleAdd} size="sm" iconName="Plus" disabled={salvando}>Adicionar</Button>
                </div>
            </div>
        </div>
    );
}

export default function TabPneus({ isAdmin }) {
    const [subAba, setSubAba] = useState('pneus'); // 'pneus' | 'compras' | 'dashboard'
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const [pneus, setPneus] = useState([]);
    const [compras, setCompras] = useState([]);
    const [despesasPneus, setDespesasPneus] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [catalogo, setCatalogo] = useState({ marca: [], modelo: [], medida: [], eixo: [] });
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [p, c, d, v, m, cat] = await Promise.all([
                fetchPneus(), fetchComprasPneus(), fetchDespesasAdmPneus(),
                fetchVeiculosProprios(), fetchMotoristasProprios(), fetchCatalogoPneus(),
            ]);
            setPneus(p); setCompras(c); setDespesasPneus(d); setVeiculos(v); setMotoristas(m); setCatalogo(cat);
        } catch (e) { showToast('Erro ao carregar pneus: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const handleAddCatalogo = async (tipo, valor) => {
        if (!valor?.trim()) return;
        try {
            await addItemCatalogoPneus(tipo, valor);
            const cat = await fetchCatalogoPneus();
            setCatalogo(cat);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const SUBTABS = [
        { id: 'pneus',     label: 'Pneus',    icon: 'Disc' },
        { id: 'compras',   label: 'Compras',  icon: 'ShoppingCart' },
        { id: 'dashboard', label: 'Dashboard', icon: 'BarChart3' },
    ];

    return (
        <div className="flex flex-col gap-4">
            <PneusBanner />

            <div className="flex gap-2 flex-wrap">
                {SUBTABS.map(t => (
                    <button key={t.id} onClick={() => setSubAba(t.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={subAba === t.id
                            ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                            : { backgroundColor: '#F1F5F9', color: 'var(--color-text-secondary)' }}>
                        <Icon name={t.icon} size={14} color={subAba === t.id ? '#fff' : 'var(--color-muted-foreground)'} />
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : subAba === 'pneus' ? (
                <PainelPneus {...{ pneus, compras, veiculos, motoristas, catalogo, isAdmin, showToast, confirm, load, handleAddCatalogo }} />
            ) : subAba === 'compras' ? (
                <PainelCompras {...{ compras, despesasPneus, catalogo, isAdmin, showToast, confirm, load, handleAddCatalogo, pneus }} />
            ) : (
                <PainelDashboard {...{ pneus, compras }} />
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}

// ─── Painel: Lista/cadastro de pneus ───────────────────────────────────────
function PainelPneus({ pneus, compras, veiculos, motoristas, catalogo, isAdmin, showToast, confirm, load, handleAddCatalogo }) {
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos'); // todos | em_uso | substituido
    const [modal, setModal] = useState(null); // { mode: 'create'|'edit', pneu }
    const [modalSubstituir, setModalSubstituir] = useState(null);
    const [modalGerenciarEixos, setModalGerenciarEixos] = useState(false);
    const [saving, setSaving] = useState(false);
    const emptyForm = () => ({
        marca: '', modelo: '', medida: '', categoria_bandagem: 'mista',
        veiculo_id: '', motorista_id: '', eixo_trocado: '',
        km_atual: '', km_final: '', data_instalacao: new Date().toISOString().slice(0, 10),
        data_substituicao: '', compra_id: '', observacoes: '',
    });
    const [form, setForm] = useState(emptyForm());

    const comprasComSaldo = useMemo(() => compras.map(c => ({ ...c, saldo: saldoCompra(c, pneus) })), [compras, pneus]);

    const filtrados = pneus.filter(p => {
        if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false;
        if (busca.trim()) {
            const q = busca.toLowerCase();
            return (
                (p.marca || '').toLowerCase().includes(q) ||
                (p.modelo || '').toLowerCase().includes(q) ||
                (p.veiculo?.placa || '').toLowerCase().includes(q) ||
                (p.motorista?.name || '').toLowerCase().includes(q)
            );
        }
        return true;
    });

    const openCreate = () => { setForm(emptyForm()); setModal({ mode: 'create' }); };
    const openEdit = (p) => {
        setForm({
            marca: p.marca || '', modelo: p.modelo || '', medida: p.medida || '',
            categoria_bandagem: p.categoria_bandagem || 'mista',
            veiculo_id: p.veiculo_id || '', motorista_id: p.motorista_id || '',
            eixo_trocado: p.eixo_trocado || '',
            km_atual: p.km_atual ?? '', km_final: p.km_final ?? '',
            data_instalacao: p.data_instalacao || '', data_substituicao: p.data_substituicao || '',
            compra_id: p.compra_id || '', observacoes: p.observacoes || '',
        });
        setModal({ mode: 'edit', pneu: p });
    };

    const handleSave = async () => {
        if (!form.marca) { showToast('Selecione a marca do pneu.', 'error'); return; }
        if (!form.veiculo_id) { showToast('Selecione o veículo.', 'error'); return; }
        setSaving(true);
        try {
            const payload = {
                marca: form.marca, modelo: form.modelo || null, medida: form.medida || null,
                categoria_bandagem: form.categoria_bandagem || null,
                veiculo_id: form.veiculo_id, motorista_id: form.motorista_id || null,
                eixo_trocado: form.eixo_trocado || null,
                km_atual: form.km_atual !== '' ? Number(form.km_atual) : null,
                km_final: form.km_final !== '' ? Number(form.km_final) : null,
                data_instalacao: form.data_instalacao || null,
                data_substituicao: form.data_substituicao || null,
                status: form.data_substituicao ? 'substituido' : 'em_uso',
                compra_id: form.compra_id || null,
                observacoes: form.observacoes || null,
            };
            if (modal.mode === 'edit') { await updatePneu(modal.pneu.id, payload); showToast('Pneu atualizado!', 'success'); }
            else { await createPneu(payload); showToast('Pneu cadastrado!', 'success'); }
            setModal(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (p) => {
        const ok = await confirm({ title: 'Excluir pneu?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deletePneu(p.id); showToast('Pneu excluído.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleSubstituir = async () => {
        if (!modalSubstituir) return;
        setSaving(true);
        try {
            await substituirPneu(modalSubstituir.id, {
                km_final: modalSubstituir._km_final, data_substituicao: modalSubstituir._data,
            });
            showToast('Pneu marcado como substituído!', 'success');
            setModalSubstituir(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                    <Icon name="Search" size={14} color="var(--color-muted-foreground)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                    <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar marca, modelo, placa, motorista..."
                        className="pl-8 pr-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20" style={{ borderColor: 'var(--color-border)', width: 260 }} />
                </div>
                {[{ v: 'todos', l: 'Todos' }, { v: 'em_uso', l: 'Em uso' }, { v: 'substituido', l: 'Substituídos' }].map(op => (
                    <button key={op.v} onClick={() => setFiltroStatus(op.v)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                        style={filtroStatus === op.v ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' } : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        {op.l}
                    </button>
                ))}
                {isAdmin && <Button onClick={openCreate} iconName="Plus" size="sm" className="ml-auto">Novo Pneu</Button>}
            </div>

            {filtrados.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                        <Icon name="Disc" size={28} color="#1D4ED8" />
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum pneu encontrado</p>
                </div>
            ) : (
                <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs" style={{ minWidth: 1000 }}>
                            <thead>
                                <tr style={{ backgroundColor: '#1D4ED8' }}>
                                    {['Veículo', 'Motorista', 'Marca / Modelo', 'Medida', 'Bandagem', 'Eixo', 'KM Instalação', 'KM Final', 'KM Rodado', 'Compra (NF)', 'Status', ''].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtrados.map((p, idx) => {
                                    const km = kmRodado(p);
                                    return (
                                        <tr key={p.id} className="border-t hover:bg-blue-50/30 transition-colors"
                                            style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                            <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{p.veiculo?.placa || '—'}</td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">{p.motorista?.name || '—'}</td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">{p.marca}{p.modelo ? ` — ${p.modelo}` : ''}</td>
                                            <td className="px-3 py-2.5 font-data">{p.medida || '—'}</td>
                                            <td className="px-3 py-2.5">
                                                <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${BANDAGEM_COR[p.categoria_bandagem]}1A`, color: BANDAGEM_COR[p.categoria_bandagem] }}>
                                                    {BANDAGEM_LABEL[p.categoria_bandagem] || '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 max-w-[140px] truncate" title={p.eixo_trocado}>{p.eixo_trocado || '—'}</td>
                                            <td className="px-3 py-2.5 font-data text-right">{p.km_atual != null ? Number(p.km_atual).toLocaleString('pt-BR') : '—'}</td>
                                            <td className="px-3 py-2.5 font-data text-right">{p.km_final != null ? Number(p.km_final).toLocaleString('pt-BR') : '—'}</td>
                                            <td className="px-3 py-2.5 font-data text-right font-bold" style={{ color: '#059669' }}>{km != null ? km.toLocaleString('pt-BR') : '—'}</td>
                                            <td className="px-3 py-2.5 max-w-[130px] truncate" title={p.compra?.despesa?.nota_fiscal}>
                                                {p.compra?.despesa?.nota_fiscal ? `NF ${p.compra.despesa.nota_fiscal}` : '—'}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {p.status === 'em_uso' ? (
                                                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">Em uso</span>
                                                ) : (
                                                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 whitespace-nowrap">Substituído</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-2.5">
                                                {isAdmin && (
                                                    <ActionButtonsGroup>
                                                        {p.status === 'em_uso' && (
                                                            <button onClick={() => setModalSubstituir({ id: p.id, _km_final: '', _data: new Date().toISOString().slice(0, 10) })}
                                                                title="Registrar substituição"
                                                                className="p-1.5 rounded-lg hover:bg-amber-50" style={{ color: '#D97706' }}>
                                                                <Icon name="RefreshCw" size={14} color="#D97706" />
                                                            </button>
                                                        )}
                                                        <EditButton title="Editar" onClick={() => openEdit(p)} />
                                                        <DeleteButton title="Excluir" onClick={() => handleDelete(p)} />
                                                    </ActionButtonsGroup>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-2 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: '#F9FAFB' }}>
                        {filtrados.length} pneu{filtrados.length !== 1 ? 's' : ''}
                    </div>
                </div>
            )}

            {/* Modal Novo/Editar Pneu */}
            {modal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-2">
                                <Icon name="Disc" size={18} color="var(--color-primary)" />
                                <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>{modal.mode === 'edit' ? 'Editar Pneu' : 'Novo Pneu'}</h3>
                            </div>
                            <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={16} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Marca" required>
                                    <SelectComOpcaoNova value={form.marca} onChange={v => setForm(f => ({ ...f, marca: v }))} opcoes={catalogo.marca} onAddNova={v => { handleAddCatalogo('marca', v); setForm(f => ({ ...f, marca: v })); }} />
                                </Field>
                                <Field label="Modelo">
                                    <SelectComOpcaoNova value={form.modelo} onChange={v => setForm(f => ({ ...f, modelo: v }))} opcoes={catalogo.modelo} onAddNova={v => { handleAddCatalogo('modelo', v); setForm(f => ({ ...f, modelo: v })); }} />
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Medida">
                                    <SelectComOpcaoNova value={form.medida} onChange={v => setForm(f => ({ ...f, medida: v }))} opcoes={catalogo.medida} onAddNova={v => { handleAddCatalogo('medida', v); setForm(f => ({ ...f, medida: v })); }} />
                                </Field>
                                <Field label="Categoria (Bandagem)">
                                    <select value={form.categoria_bandagem} onChange={e => setForm(f => ({ ...f, categoria_bandagem: e.target.value }))} className={inputCls} style={inputStyle}>
                                        {Object.keys(BANDAGEM_LABEL).map(k => <option key={k} value={k}>{BANDAGEM_LABEL[k]}</option>)}
                                    </select>
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Veículo (frota própria)" required>
                                    <SearchableSelect
                                        value={form.veiculo_id}
                                        onChange={v => setForm(f => ({ ...f, veiculo_id: v }))}
                                        options={veiculos.map(v => ({ value: v.id, label: v.placa, sublabel: v.modelo }))}
                                        placeholder="Selecione..." emptyLabel="Nenhum veículo da frota própria encontrado" />
                                </Field>
                                <Field label="Motorista">
                                    <SearchableSelect
                                        value={form.motorista_id}
                                        onChange={v => setForm(f => ({ ...f, motorista_id: v }))}
                                        options={motoristas.map(m => ({ value: m.id, label: m.name }))}
                                        placeholder="Selecione (opcional)..." emptyLabel="Nenhum motorista da frota própria encontrado" />
                                </Field>
                            </div>
                            <Field label="Eixo Trocado">
                                <div className="flex gap-1.5">
                                    <select value={form.eixo_trocado} onChange={e => setForm(f => ({ ...f, eixo_trocado: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione...</option>
                                        {catalogo.eixo.map(e => <option key={e} value={e}>{e}</option>)}
                                    </select>
                                    {isAdmin && (
                                        <button type="button" onClick={() => setModalGerenciarEixos(true)} title="Cadastrar, editar ou excluir eixos"
                                            className="px-2.5 rounded-lg border flex items-center justify-center flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                                            <Icon name="Settings" size={14} color="var(--color-primary)" />
                                        </button>
                                    )}
                                </div>
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="KM Atual (na instalação)">
                                    <input type="number" value={form.km_atual} onChange={e => setForm(f => ({ ...f, km_atual: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 120000" />
                                </Field>
                                <Field label="Data de Instalação">
                                    <input type="date" value={form.data_instalacao} onChange={e => setForm(f => ({ ...f, data_instalacao: e.target.value }))} className={inputCls} style={inputStyle} />
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="KM Final (quando substituído)">
                                    <input type="number" value={form.km_final} onChange={e => setForm(f => ({ ...f, km_final: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Deixe vazio se ainda em uso" />
                                </Field>
                                <Field label="Data da Substituição">
                                    <input type="date" value={form.data_substituicao} onChange={e => setForm(f => ({ ...f, data_substituicao: e.target.value }))} className={inputCls} style={inputStyle} />
                                </Field>
                            </div>
                            <Field label="Compra (saldo de qual NF está usando)">
                                <select value={form.compra_id} onChange={e => setForm(f => ({ ...f, compra_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Sem vínculo com compra</option>
                                    {comprasComSaldo.filter(c => c.saldo > 0 || c.id === form.compra_id).map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.marca}{c.modelo ? ` ${c.modelo}` : ''} — NF {c.despesa?.nota_fiscal || '—'} (saldo: {c.saldo})
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Observações">
                                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={{ ...inputStyle, minHeight: 60 }} />
                            </Field>
                        </div>
                        <div className="flex justify-end gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleSave} size="sm" iconName="Check" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Substituir */}
            {modalSubstituir && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Registrar Substituição</h3>
                            <button onClick={() => setModalSubstituir(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={16} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <Field label="KM Final" required>
                                <input type="number" value={modalSubstituir._km_final} onChange={e => setModalSubstituir(s => ({ ...s, _km_final: e.target.value }))} className={inputCls} style={inputStyle} placeholder="KM do veículo na retirada" />
                            </Field>
                            <Field label="Data da Substituição">
                                <input type="date" value={modalSubstituir._data} onChange={e => setModalSubstituir(s => ({ ...s, _data: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                        </div>
                        <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setModalSubstituir(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleSubstituir} size="sm" iconName="Check" disabled={saving}>{saving ? 'Salvando...' : 'Confirmar'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {modalGerenciarEixos && (
                <GerenciarCatalogoModal
                    tipo="eixo" titulo="Gerenciar Eixos"
                    onClose={() => setModalGerenciarEixos(false)}
                    onChanged={load}
                    showToast={showToast}
                    confirm={confirm}
                />
            )}
        </div>
    );
}

// ─── Painel: Compras (vínculo com NF de Despesas Adm.) ─────────────────────
function PainelCompras({ compras, despesasPneus, catalogo, isAdmin, showToast, confirm, load, handleAddCatalogo, pneus = [] }) {
    const [modal, setModal] = useState(null); // despesa selecionada
    const [saving, setSaving] = useState(false);
    const emptyForm = () => ({ marca: '', modelo: '', medida: '', quantidade: '', valor_total: '', observacoes: '' });
    const [form, setForm] = useState(emptyForm());

    const despesasVinculadas = new Set(compras.map(c => c.despesa_adm_id).filter(Boolean));

    const openVincular = (despesa) => {
        setForm({ ...emptyForm(), valor_total: despesa.valor || '' });
        setModal(despesa);
    };

    const handleSave = async () => {
        if (!form.marca) { showToast('Selecione a marca.', 'error'); return; }
        if (!form.quantidade || Number(form.quantidade) <= 0) { showToast('Informe a quantidade de pneus da compra.', 'error'); return; }
        setSaving(true);
        try {
            await createCompraPneus({
                despesa_adm_id: modal.id,
                marca: form.marca, modelo: form.modelo || null, medida: form.medida || null,
                quantidade: Number(form.quantidade),
                valor_total: form.valor_total !== '' ? Number(form.valor_total) : null,
                observacoes: form.observacoes || null,
            });
            showToast('Compra vinculada à NF!', 'success');
            setModal(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (c) => {
        const ok = await confirm({ title: 'Remover vínculo de compra?', message: 'Pneus já vinculados a essa compra deixarão de referenciar o saldo.', confirmLabel: 'Remover', variant: 'danger' });
        if (!ok) return;
        try { await deleteCompraPneus(c.id); showToast('Vínculo removido.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Compras já vinculadas</h3>
                {compras.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma compra de pneus vinculada ainda.</p>
                ) : (
                    <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs" style={{ minWidth: 800 }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#1D4ED8' }}>
                                        {['NF', 'Fornecedor', 'Data', 'Marca / Modelo', 'Medida', 'Qtd.', 'Saldo', 'Valor Total', ''].map(h => (
                                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {compras.map((c, idx) => (
                                        <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                            <td className="px-3 py-2.5 font-data whitespace-nowrap">{c.despesa?.nota_fiscal || '—'}</td>
                                            <td className="px-3 py-2.5 max-w-[140px] truncate">{c.despesa?.fornecedor || '—'}</td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">{FMT(c.despesa?.data_despesa)}</td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">{c.marca}{c.modelo ? ` — ${c.modelo}` : ''}</td>
                                            <td className="px-3 py-2.5 font-data">{c.medida || '—'}</td>
                                            <td className="px-3 py-2.5 font-data text-right">{c.quantidade}</td>
                                            <td className="px-3 py-2.5 font-data text-right font-bold" style={{ color: '#059669' }}>{saldoCompra(c, pneus)}</td>
                                            <td className="px-3 py-2.5 font-data text-right whitespace-nowrap">{c.valor_total != null ? BRL(c.valor_total) : '—'}</td>
                                            <td className="px-2 py-2.5">
                                                {isAdmin && <DeleteButton title="Remover vínculo" onClick={() => handleDelete(c)} />}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Notas fiscais de "Pneus em Estoque" (Despesas Administrativas)</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
                    Vincule cada NF lançada em Despesas Administrativas → categoria <strong>Pneus em Estoque</strong> a uma quantidade de pneus, para controlar o saldo disponível quando forem usados nos veículos.
                </p>
                {despesasPneus.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma despesa administrativa com categoria "Pneus em Estoque" encontrada.</p>
                ) : (
                    <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs" style={{ minWidth: 700 }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#F9FAFB' }}>
                                        {['NF', 'Fornecedor', 'Data', 'Valor', 'Status', ''].map(h => (
                                            <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {despesasPneus.map((d, idx) => {
                                        const vinculada = despesasVinculadas.has(d.id);
                                        return (
                                            <tr key={d.id} className="border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                                <td className="px-3 py-2.5 font-data whitespace-nowrap">{d.nota_fiscal || '—'}</td>
                                                <td className="px-3 py-2.5 max-w-[160px] truncate">{d.fornecedor || '—'}</td>
                                                <td className="px-3 py-2.5 whitespace-nowrap">{FMT(d.data_despesa)}</td>
                                                <td className="px-3 py-2.5 font-data whitespace-nowrap">{BRL(d.valor)}</td>
                                                <td className="px-3 py-2.5">
                                                    {vinculada ? (
                                                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">Vinculada</span>
                                                    ) : (
                                                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">Pendente</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2.5">
                                                    {isAdmin && (
                                                        <button onClick={() => openVincular(d)}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap">
                                                            <Icon name="Link" size={12} /> Vincular
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {modal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Vincular Compra — NF {modal.nota_fiscal || '—'}</h3>
                            <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={16} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Marca" required>
                                    <SelectComOpcaoNova value={form.marca} onChange={v => setForm(f => ({ ...f, marca: v }))} opcoes={catalogo.marca} onAddNova={v => { handleAddCatalogo('marca', v); setForm(f => ({ ...f, marca: v })); }} />
                                </Field>
                                <Field label="Modelo">
                                    <SelectComOpcaoNova value={form.modelo} onChange={v => setForm(f => ({ ...f, modelo: v }))} opcoes={catalogo.modelo} onAddNova={v => { handleAddCatalogo('modelo', v); setForm(f => ({ ...f, modelo: v })); }} />
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Medida">
                                    <SelectComOpcaoNova value={form.medida} onChange={v => setForm(f => ({ ...f, medida: v }))} opcoes={catalogo.medida} onAddNova={v => { handleAddCatalogo('medida', v); setForm(f => ({ ...f, medida: v })); }} />
                                </Field>
                                <Field label="Quantidade Comprada" required>
                                    <input type="number" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 6" />
                                </Field>
                            </div>
                            <Field label="Valor Total (opcional)">
                                <input type="number" step="0.01" value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Observações">
                                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={{ ...inputStyle, minHeight: 60 }} />
                            </Field>
                        </div>
                        <div className="flex justify-end gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleSave} size="sm" iconName="Check" disabled={saving}>{saving ? 'Salvando...' : 'Vincular'}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Painel: Dashboard analítico ────────────────────────────────────────────
function PainelDashboard({ pneus, compras }) {
    const emUso = pneus.filter(p => p.status === 'em_uso');
    const substituidos = pneus.filter(p => p.status === 'substituido');
    const comKm = substituidos.map(p => ({ ...p, km: kmRodado(p) })).filter(p => p.km != null);

    const kmMedioGeral = comKm.length ? comKm.reduce((s, p) => s + p.km, 0) / comKm.length : 0;

    // Vida útil média e ranking por marca
    const porMarca = {};
    comKm.forEach(p => {
        if (!porMarca[p.marca]) porMarca[p.marca] = { marca: p.marca, totalKm: 0, qtd: 0 };
        porMarca[p.marca].totalKm += p.km;
        porMarca[p.marca].qtd += 1;
    });
    const rankingMarcas = Object.values(porMarca)
        .map(m => ({ ...m, media: m.totalKm / m.qtd }))
        .sort((a, b) => b.media - a.media);

    // Pneus mais utilizados (marca + modelo, contando todos os pneus, não só substituídos)
    const usoContagem = {};
    pneus.forEach(p => {
        const key = `${p.marca}${p.modelo ? ' — ' + p.modelo : ''}`;
        usoContagem[key] = (usoContagem[key] || 0) + 1;
    });
    const maisUtilizados = Object.entries(usoContagem).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Gasto por marca (soma do valor_total das compras daquela marca)
    const gastoPorMarca = {};
    compras.forEach(c => {
        gastoPorMarca[c.marca] = (gastoPorMarca[c.marca] || 0) + Number(c.valor_total || 0);
    });
    const rankingGasto = Object.entries(gastoPorMarca).sort((a, b) => b[1] - a[1]);

    // Maior volume de compra
    const rankingCompras = [...compras].sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0)).slice(0, 8);

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1E3A5F' }}>Pneus em uso</p>
                    <p className="text-2xl font-black" style={{ color: '#1D4ED8' }}>{emUso.length}</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4B5563' }}>Pneus substituídos</p>
                    <p className="text-2xl font-black" style={{ color: '#374151' }}>{substituidos.length}</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#065F46' }}>Vida útil média</p>
                    <p className="text-2xl font-black" style={{ color: '#059669' }}>{kmMedioGeral ? Math.round(kmMedioGeral).toLocaleString('pt-BR') : '—'}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#065F46' }}>km rodados por pneu</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#92400E' }}>Marca com melhor rendimento</p>
                    <p className="text-lg font-black truncate" style={{ color: '#D97706' }}>{rankingMarcas[0]?.marca || '—'}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#92400E' }}>{rankingMarcas[0] ? `${Math.round(rankingMarcas[0].media).toLocaleString('pt-BR')} km médios` : ''}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PainelTabela titulo="Vida útil média por marca (km rodados)" vazio="Sem pneus substituídos com KM registrado ainda."
                    linhas={rankingMarcas.map(m => [m.marca, `${Math.round(m.media).toLocaleString('pt-BR')} km`, `${m.qtd} pneu${m.qtd !== 1 ? 's' : ''}`])}
                    cabecalho={['Marca', 'Média km', 'Qtd.']} />

                <PainelTabela titulo="Pneus mais utilizados (marca / modelo)" vazio="Nenhum pneu cadastrado ainda."
                    linhas={maisUtilizados.map(([nome, qtd]) => [nome, `${qtd} unidade${qtd !== 1 ? 's' : ''}`])}
                    cabecalho={['Marca / Modelo', 'Quantidade']} />

                <PainelTabela titulo="Gasto por marca (compras vinculadas)" vazio="Nenhuma compra com valor lançado ainda."
                    linhas={rankingGasto.map(([marca, valor]) => [marca, BRL(valor)])}
                    cabecalho={['Marca', 'Valor total']} />

                <PainelTabela titulo="Maior volume de compra" vazio="Nenhuma compra registrada ainda."
                    linhas={rankingCompras.map(c => [`${c.marca}${c.modelo ? ' — ' + c.modelo : ''}`, `${c.quantidade} un.`, c.despesa?.nota_fiscal ? `NF ${c.despesa.nota_fiscal}` : '—'])}
                    cabecalho={['Marca / Modelo', 'Qtd.', 'NF']} />
            </div>
        </div>
    );
}

function PainelTabela({ titulo, cabecalho, linhas, vazio }) {
    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{titulo}</p>
            </div>
            {linhas.length === 0 ? (
                <p className="text-xs p-4" style={{ color: 'var(--color-muted-foreground)' }}>{vazio}</p>
            ) : (
                <table className="w-full text-xs">
                    <thead>
                        <tr>
                            {cabecalho.map(h => <th key={h} className="px-4 py-2 text-left font-semibold" style={{ color: 'var(--color-muted-foreground)' }}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {linhas.map((linha, i) => (
                            <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                {linha.map((v, j) => <td key={j} className={`px-4 py-2 ${j === 0 ? 'font-medium' : 'font-data'}`} style={{ color: j === 0 ? 'var(--color-text-primary)' : 'var(--color-muted-foreground)' }}>{v}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
