import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { supabase } from 'utils/supabaseClient';
import { calcularBonificacao } from 'utils/bonificacaoService';
import {
    fetchAbastecimentos, createAbastecimento, deleteAbastecimento,
    fetchPostos,
    fetchChecklists, createChecklist,
    fetchCarretasVeiculos,
    CHECKLIST_ITENS,
} from 'utils/carretasService';
import * as XLSX from 'xlsx';

const BRL = v => Number(v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

const PERIOD_OPTIONS = [
    { label: '30 dias', days: 30 },
    { label: '90 dias', days: 90 },
    { label: '6 meses', days: 180 },
];
const STATUS_CFG = {
    'Aguardando':  { bg: '#FEF9C3', text: '#B45309' },
    'Carregando':  { bg: '#DBEAFE', text: '#1D4ED8' },
    'Em Trânsito': { bg: '#D1FAE5', text: '#065F46' },
    'Finalizado':  { bg: '#F3F4F6', text: '#374151' },
    'Cancelado':   { bg: '#FEE2E2', text: '#991B1B' },
};
const STATUS_VIAGEM_CFG = {
    'Agendado':            { bg: '#EFF6FF', text: '#1D4ED8' },
    'Em processamento':    { bg: '#FEF9C3', text: '#B45309' },
    'Aguardando no pátio': { bg: '#FEE2E2', text: '#B91C1C' },
    'Em trânsito':         { bg: '#D1FAE5', text: '#065F46' },
    'Entrega finalizada':  { bg: '#F0FDF4', text: '#15803D' },
    'Cancelado':           { bg: '#F3F4F6', text: '#6B7280' },
};

function Field({ label, children, required }) {
    return (
        <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

// ─── TAB Combustível (Caminhão) ───────────────────────────────────────────────
function TabCombustivel({ user }) {
    const { toast, showToast } = useToast();
    const [abastecimentos, setAbastecimentos] = useState([]);
    const [postos, setPostos]   = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal]     = useState(false);
    const [mes, setMes]         = useState('');
    const [form, setForm]       = useState({
        veiculo_id: '', posto_id: '',
        data_abastecimento: new Date().toISOString().split('T')[0],
        horario: '', litros_diesel: '', valor_diesel: '',
        litros_arla: '', valor_arla: '', observacoes: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = { motoristaId: user.id };
            if (mes) {
                f.dataInicio = mes + '-01';
                f.dataFim    = mes + '-' + String(new Date(Number(mes.split('-')[0]), Number(mes.split('-')[1]), 0).getDate()).padStart(2,'0');
            }
            const [a, p, v] = await Promise.all([
                fetchAbastecimentos(f),
                fetchPostos().catch(() => []),
                fetchCarretasVeiculos(),
            ]);
            setAbastecimentos(a); setPostos(p); setVeiculos(v);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [user.id, mes]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const totais = useMemo(() => ({
        litrosDiesel: abastecimentos.reduce((s,a) => s + Number(a.litros_diesel||0), 0),
        valorDiesel:  abastecimentos.reduce((s,a) => s + Number(a.valor_diesel||0), 0),
        litrosArla:   abastecimentos.reduce((s,a) => s + Number(a.litros_arla||0), 0),
        valorArla:    abastecimentos.reduce((s,a) => s + Number(a.valor_arla||0), 0),
        valorTotal:   abastecimentos.reduce((s,a) => s + Number(a.valor_total||0), 0),
    }), [abastecimentos]);

    const handlePostoChange = (postoId) => {
        const posto = postos.find(p => p.id === postoId);
        setForm(f => ({
            ...f, posto_id: postoId,
            valor_diesel: posto?.preco_diesel && f.litros_diesel
                ? (Number(f.litros_diesel) * Number(posto.preco_diesel)).toFixed(2) : f.valor_diesel,
            valor_arla: posto?.preco_arla && f.litros_arla
                ? (Number(f.litros_arla) * Number(posto.preco_arla)).toFixed(2) : f.valor_arla,
        }));
    };
    const handleLitros = (campo, valor) => {
        const posto = postos.find(p => p.id === form.posto_id);
        setForm(f => {
            const n = { ...f, [campo]: valor };
            if (campo === 'litros_diesel' && posto?.preco_diesel)
                n.valor_diesel = valor ? (Number(valor) * Number(posto.preco_diesel)).toFixed(2) : '';
            if (campo === 'litros_arla' && posto?.preco_arla)
                n.valor_arla = valor ? (Number(valor) * Number(posto.preco_arla)).toFixed(2) : '';
            return n;
        });
    };

    const handleSubmit = async () => {
        if (!form.veiculo_id || !form.data_abastecimento) { showToast('Selecione o veículo e a data', 'error'); return; }
        try {
            const payload = { ...form, motorista_id: user.id };
            if (!payload.posto_id) delete payload.posto_id;
            const posto = postos.find(p => p.id === form.posto_id);
            if (posto) payload.posto = posto.nome;
            await createAbastecimento(payload);
            showToast('Abastecimento registrado!', 'success');
            setModal(false);
            setForm({ veiculo_id: '', posto_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', observacoes: '' });
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const postoNome = (a) => a.posto || postos.find(p => p.id === a.posto_id)?.nome || '—';

    return (
        <div>
            <div className="flex flex-wrap gap-2 items-center justify-between mb-5">
                <div className="flex gap-2 flex-wrap">
                    <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    <button onClick={() => setModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}>
                        <Icon name="Plus" size={14} color="white" /> Registrar
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                    { l: 'Diesel (L)', v: totais.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#1D4ED8', bg: '#EFF6FF', i: 'Fuel' },
                    { l: 'Custo Diesel', v: BRL(totais.valorDiesel), c: '#1D4ED8', bg: '#EFF6FF', i: 'DollarSign' },
                    { l: 'Arla (L)', v: totais.litrosArla.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#059669', bg: '#D1FAE5', i: 'Droplets' },
                    { l: 'Total Gasto', v: BRL(totais.valorTotal), c: '#7C3AED', bg: '#EDE9FE', i: 'Receipt' },
                ].map(k => (
                    <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}>
                                <Icon name={k.i} size={13} color={k.c} />
                            </div>
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                        </div>
                        <p className="text-base font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
            ) : (
                <div className="flex flex-col gap-3">
                    {abastecimentos.length === 0 ? (
                        <div className="bg-white rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="Fuel" size={36} color="var(--color-muted-foreground)" />
                            <p className="text-sm mt-3" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum abastecimento registrado</p>
                        </div>
                    ) : abastecimentos.map(a => (
                        <div key={a.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-start justify-between mb-2 gap-2">
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{postoNome(a)}</p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{FMT(a.data_abastecimento)}{a.horario ? ` · ${a.horario}` : ''} · {a.veiculo?.placa || '—'}</p>
                                </div>
                                <p className="text-base font-bold font-data text-purple-600 flex-shrink-0">{BRL(a.valor_total)}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {Number(a.litros_diesel||0) > 0 && (
                                    <div className="flex items-center gap-1.5 p-2 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
                                        <Icon name="Fuel" size={11} color="#1D4ED8" />
                                        <span className="text-blue-700">🛢️ {Number(a.litros_diesel).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L · {BRL(a.valor_diesel)}</span>
                                    </div>
                                )}
                                {Number(a.litros_arla||0) > 0 && (
                                    <div className="flex items-center gap-1.5 p-2 rounded-lg" style={{ backgroundColor: '#ECFDF5' }}>
                                        <Icon name="Droplets" size={11} color="#059669" />
                                        <span className="text-emerald-700">💧 {Number(a.litros_arla).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L · {BRL(a.valor_arla)}</span>
                                    </div>
                                )}
                            </div>
                            {a.observacoes && <p className="text-xs mt-2 text-amber-700 bg-amber-50 p-2 rounded-lg">{a.observacoes}</p>}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal registrar */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                    onClick={e => e.target === e.currentTarget && setModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
                                    <Icon name="Fuel" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>Registrar Abastecimento</h2>
                            </div>
                            <button onClick={() => setModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                            </button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Veículo" required>
                                <select value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </select>
                            </Field>
                            <Field label="Data" required>
                                <input type="date" value={form.data_abastecimento} onChange={e => setForm(f => ({ ...f, data_abastecimento: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Horário">
                                <input type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Posto">
                                <select value={form.posto_id} onChange={e => handlePostoChange(e.target.value)} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione o posto...</option>
                                    {postos.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.nome}{p.cidade ? ` — ${p.cidade}` : ''}
                                            {p.preco_diesel ? ` · D:R$${Number(p.preco_diesel).toFixed(3)}` : ''}
                                            {p.preco_arla   ? ` · A:R$${Number(p.preco_arla).toFixed(3)}`   : ''}
                                        </option>
                                    ))}
                                </select>
                                {form.posto_id && (() => {
                                    const p = postos.find(x => x.id === form.posto_id);
                                    return (p?.preco_diesel || p?.preco_arla) ? (
                                        <div className="flex gap-3 mt-1 text-xs">
                                            {p.preco_diesel && <span className="text-blue-600 font-medium">🛢️ R${Number(p.preco_diesel).toFixed(3)}/L</span>}
                                            {p.preco_arla   && <span className="text-emerald-600 font-medium">💧 R${Number(p.preco_arla).toFixed(3)}/L</span>}
                                        </div>
                                    ) : null;
                                })()}
                            </Field>
                            <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                <p className="text-xs font-semibold text-blue-700 mb-2">🛢️ Diesel</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros"><input type="number" step="0.01" value={form.litros_diesel} onChange={e => handleLitros('litros_diesel', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                    <Field label="Valor R$"><input type="number" step="0.01" value={form.valor_diesel} onChange={e => setForm(f => ({ ...f, valor_diesel: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                </div>
                            </div>
                            <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                                <p className="text-xs font-semibold text-emerald-700 mb-2">💧 ARLA 32</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros"><input type="number" step="0.01" value={form.litros_arla} onChange={e => handleLitros('litros_arla', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                    <Field label="Valor R$"><input type="number" step="0.01" value={form.valor_arla} onChange={e => setForm(f => ({ ...f, valor_arla: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <Field label="Observações">
                                    <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                                </Field>
                            </div>
                        </div>
                        <div className="flex gap-3 p-5 pt-0 justify-end">
                            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleSubmit} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                                <Icon name="Check" size={15} color="white" /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB Checklist (Caminhão) ─────────────────────────────────────────────────
function TabChecklistCaminhao({ user }) {
    const { toast, showToast } = useToast();
    const [checklists, setChecklists] = useState([]);
    const [veiculos, setVeiculos]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [modal, setModal]           = useState(false);
    const [modalFoto, setModalFoto]   = useState(null);
    const [fotoPreview, setFotoPreview] = useState(null);
    const fotoRef = useRef(null);
    const [form, setForm] = useState({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [c, v] = await Promise.all([
                fetchChecklists({ motoristaId: user.id }),
                fetchCarretasVeiculos(),
            ]);
            setChecklists(c); setVeiculos(v);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [user.id]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const handleFoto = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast('Foto muito grande (máx 5MB)', 'error'); return; }
        const reader = new FileReader();
        reader.onload = ev => { setFotoPreview(ev.target.result); setForm(f => ({ ...f, foto_url: ev.target.result })); };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!form.veiculo_id) { showToast('Selecione o veículo', 'error'); return; }
        const semana = new Date(); semana.setDate(semana.getDate() - semana.getDay() + 1);
        try {
            await createChecklist({ ...form, motorista_id: user.id, semana_ref: semana.toISOString().split('T')[0] });
            showToast('Checklist enviado!', 'success');
            setModal(false); setFotoPreview(null);
            setForm({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '' });
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                    <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                </button>
                <button onClick={() => { setForm({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '' }); setFotoPreview(null); setModal(true); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}>
                    <Icon name="ClipboardCheck" size={14} color="white" /> Novo Checklist
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
            ) : checklists.length === 0 ? (
                <div className="bg-white rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="ClipboardCheck" size={36} color="var(--color-muted-foreground)" />
                    <p className="text-sm mt-3" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum checklist enviado</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {checklists.map(c => {
                        const itens = c.itens || {};
                        const ok = Object.values(itens).filter(Boolean).length;
                        const total = CHECKLIST_ITENS.length;
                        return (
                            <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-start justify-between mb-3 gap-2">
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{c.veiculo?.placa || '—'}</p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                            Semana de {c.semana_ref ? FMT(c.semana_ref) : '—'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                        {c.aprovado
                                            ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><Icon name="CheckCircle2" size={11} />Aprovado</span>
                                            : <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Icon name="Clock" size={11} />Pendente</span>
                                        }
                                        {c.foto_url && (
                                            <button onClick={() => setModalFoto(c.foto_url)} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                                <Icon name="Camera" size={11} />Foto
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span style={{ color: 'var(--color-muted-foreground)' }}>Itens verificados</span>
                                        <span className="font-medium">{ok}/{total}</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${(ok/total)*100}%`, backgroundColor: ok===total ? '#059669' : ok>=total*0.7 ? '#D97706' : '#DC2626' }} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1 mb-2">
                                    {CHECKLIST_ITENS.map(item => (
                                        <div key={item.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ backgroundColor: itens[item.id] ? '#D1FAE5' : '#FEE2E2' }}>
                                            <Icon name={itens[item.id] ? 'Check' : 'X'} size={10} color={itens[item.id] ? '#059669' : '#DC2626'} />
                                            <span style={{ color: itens[item.id] ? '#065F46' : '#991B1B', fontSize: 10 }}>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                                {(c.problemas || c.necessidades || c.obs_manutencao) && (
                                    <div className="text-xs space-y-1 p-2 rounded-lg bg-gray-50 mt-2">
                                        {c.problemas && <p><span className="font-medium text-red-600">⚠ Problemas:</span> {c.problemas}</p>}
                                        {c.necessidades && <p><span className="font-medium text-amber-600">🔧 Necessidades:</span> {c.necessidades}</p>}
                                        {c.obs_manutencao && <p className="text-orange-700 bg-orange-50 p-1.5 rounded"><span className="font-medium">Manutenção registrada:</span> {c.obs_manutencao}</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal novo checklist */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                    onClick={e => e.target === e.currentTarget && setModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
                                    <Icon name="ClipboardCheck" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>Checklist Semanal</h2>
                            </div>
                            <button onClick={() => setModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <Field label="Veículo" required>
                                <select value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </select>
                            </Field>
                            <div>
                                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Itens verificados</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {CHECKLIST_ITENS.map(item => (
                                        <label key={item.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                            <input type="checkbox" checked={!!form.itens[item.id]} onChange={e => setForm(f => ({ ...f, itens: { ...f.itens, [item.id]: e.target.checked } }))} className="accent-blue-600" />
                                            <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{item.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <Field label="Problemas identificados">
                                <textarea value={form.problemas} onChange={e => setForm(f => ({ ...f, problemas: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Descreva problemas..." />
                            </Field>
                            <Field label="Necessidades / peças">
                                <textarea value={form.necessidades} onChange={e => setForm(f => ({ ...f, necessidades: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Pneus, peças, etc..." />
                            </Field>
                            {/* Foto */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>📷 Foto do problema (opcional)</label>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => fotoRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                        <Icon name="Camera" size={13} /> {fotoPreview ? 'Trocar foto' : 'Tirar / Anexar foto'}
                                    </button>
                                    {fotoPreview && <button type="button" onClick={() => { setFotoPreview(null); setForm(f => ({ ...f, foto_url: '' })); }} className="text-xs text-red-500">Remover</button>}
                                    <input ref={fotoRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
                                </div>
                                {fotoPreview && <img src={fotoPreview} alt="Preview" className="mt-2 rounded-lg border max-h-40 object-cover" style={{ borderColor: 'var(--color-border)' }} />}
                            </div>
                            <Field label="Observações livres">
                                <textarea value={form.observacoes_livres} onChange={e => setForm(f => ({ ...f, observacoes_livres: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                            </Field>
                        </div>
                        <div className="flex gap-3 p-5 pt-0 justify-end">
                            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleSubmit} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                                <Icon name="Send" size={15} color="white" /> Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal visualizar foto */}
            {modalFoto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} onClick={() => setModalFoto(null)}>
                    <img src={modalFoto} alt="Foto" className="rounded-xl max-w-2xl w-full max-h-[80vh] object-contain" />
                </div>
            )}
            <Toast toast={toast} />
        </div>
    );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function MotoristaDashboard() {
    const { user, profile } = useAuth();
    const { toast, showToast } = useToast();
    const [romaneios, setRomaneios] = useState([]);
    const [viagensAdmin, setViagensAdmin] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingViagens, setLoadingViagens] = useState(false);
    const [period, setPeriod] = useState(30);
    const [tab, setTab] = useState('viagens');

    const loadData = useCallback(async () => {
        if (!user?.id || !profile?.name) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('romaneios')
                .select(`id, numero, motorista, motorista_id, placa, destino, status, aprovado, aprovado_em, peso_total, saida, created_at,
                    romaneio_itens(id, quantidade, peso_total, material_id, materials(id, nome, unidade, peso, categoria_frete))`)
                .or(`motorista_id.eq.${user.id},motorista.ilike."${profile.name}"`)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setRomaneios(data || []);
        } catch (err) { showToast('Erro: ' + err.message, 'error'); }
        finally { setLoading(false); }
    }, [user?.id, profile?.name]); // eslint-disable-line

    const loadViagensAdmin = useCallback(async () => {
        if (!user?.id) return;
        try {
            setLoadingViagens(true);
            const { data, error } = await supabase
                .from('carretas_viagens')
                .select('*, veiculo:veiculo_id(id, placa, modelo)')
                .eq('motorista_id', user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setViagensAdmin(data || []);
        } catch { /* silencioso */ }
        finally { setLoadingViagens(false); }
    }, [user?.id]); // eslint-disable-line

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => { loadViagensAdmin(); }, [loadViagensAdmin]);

    const handleRefresh = () => { loadData(); loadViagensAdmin(); };

    const filtered = useMemo(() => {
        const cut = new Date(); cut.setDate(cut.getDate() - period);
        return romaneios.filter(r => !r.saida || new Date(r.saida) >= cut);
    }, [romaneios, period]);

    const bonificacoes = useMemo(() => filtered.map(r => ({ ...r, bonif: calcularBonificacao(r) })), [filtered]);

    const totais = useMemo(() => ({
        viagens: filtered.length,
        finalizadas: filtered.filter(r => r.status === 'Finalizado').length,
        emTransito: filtered.filter(r => r.status === 'Em Trânsito').length,
        totalBonus: bonificacoes.reduce((s, r) => s + (r.bonif?.valorTotal || 0), 0),
        totalToneladas: bonificacoes.reduce((s, r) => s + (r.bonif?.toneladasFerragem || 0), 0),
    }), [filtered, bonificacoes]);

    const exportarExcel = () => {
        try {
            const rows = bonificacoes.map(r => ({
                'Romaneio': r.numero || '', 'Destino': r.destino || '', 'Status': r.status || '',
                'Data': r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '',
                'Aprovado': r.aprovado ? 'Sim' : 'Não',
                'Ton. Ferragem': r.bonif?.toneladasFerragem || 0,
                'Bônus Ferragem': r.bonif?.valorFerragem || 0,
                'Cimento (fixo)': r.bonif?.valorCimento || 0,
                'Total Bônus (R$)': r.bonif?.valorTotal || 0,
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [12,20,12,12,10,14,14,14,14].map(w => ({ wch: w }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Bonificações');
            XLSX.writeFile(wb, `bonificacoes_${profile?.name||'motorista'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
            showToast('Exportado!', 'success');
        } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    };

    const TABS_MOT = [
        { id: 'viagens',       label: 'Meus Romaneios',   icon: 'FileText' },
        { id: 'viagens_admin', label: `Viagens (Admin)${viagensAdmin.length ? ` · ${viagensAdmin.length}` : ''}`, icon: 'Truck' },
        { id: 'combustivel',   label: 'Combustível',       icon: 'Fuel' },
        { id: 'checklist',     label: 'Checklist',         icon: 'ClipboardCheck' },
        { id: 'bonificacoes',  label: 'Bonificações',      icon: 'DollarSign' },
    ];

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
                    <BreadcrumbTrail className="mb-4" />

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: 'var(--color-primary)' }}>
                                {(profile?.name || 'M')[0].toUpperCase()}
                            </div>
                            <div>
                                <h1 className="font-heading font-bold text-2xl" style={{ color: 'var(--color-text-primary)' }}>Olá, {profile?.name || 'Motorista'}</h1>
                                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Suas viagens e bonificações</p>
                            </div>
                        </div>
                        <div className="flex gap-2 items-center flex-wrap">
                            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                {PERIOD_OPTIONS.map(p => (
                                    <button key={p.days} onClick={() => setPeriod(p.days)}
                                        className="px-3 py-2 text-xs font-medium transition-colors"
                                        style={period === p.days ? { backgroundColor: 'var(--color-primary)', color: '#fff' } : { backgroundColor: 'white', color: 'var(--color-muted-foreground)' }}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <button onClick={handleRefresh} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                <Icon name="RefreshCw" size={13} /> Atualizar
                            </button>
                            <button onClick={exportarExcel} className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                <Icon name="FileDown" size={13} /> Exportar
                            </button>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                        {[
                            { l: 'Total de Romaneios', v: totais.viagens,     i: 'Truck',         c: '#1D4ED8', bg: '#DBEAFE' },
                            { l: 'Finalizados',        v: totais.finalizadas,  i: 'CheckCircle2',  c: '#059669', bg: '#D1FAE5' },
                            { l: 'Em Trânsito',        v: totais.emTransito,   i: 'Navigation',    c: '#D97706', bg: '#FEF9C3' },
                            { l: 'Bônus no Período',   v: BRL(totais.totalBonus), i: 'DollarSign', c: '#7C3AED', bg: '#EDE9FE' },
                        ].map(k => (
                            <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                    <div className="rounded-lg flex items-center justify-center" style={{ width: 32, height: 32, backgroundColor: k.bg }}><Icon name={k.i} size={15} color={k.c} /></div>
                                </div>
                                <p className="text-xl font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b mb-5 overflow-x-auto scrollbar-none" style={{ borderColor: 'var(--color-border)' }}>
                        {TABS_MOT.map(({ id, label, icon }) => (
                            <button key={id} onClick={() => setTab(id)}
                                className={`flex items-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap flex-shrink-0 transition-colors ${tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <Icon name={icon} size={14} color="currentColor" />
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Conteúdo */}
                    {tab === 'combustivel' && user && <TabCombustivel user={user} />}
                    {tab === 'checklist'   && user && <TabChecklistCaminhao user={user} />}

                    {tab === 'viagens_admin' && (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 mb-1 p-3 rounded-xl" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                <Icon name="Info" size={15} color="#1D4ED8" />
                                <p className="text-xs text-blue-700">Viagens lançadas pela administração para você.</p>
                            </div>
                            {loadingViagens ? (
                                <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
                            ) : viagensAdmin.length === 0 ? (
                                <div className="bg-white rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
                                    <Icon name="Truck" size={36} color="var(--color-muted-foreground)" />
                                    <p className="text-sm mt-3" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem lançada pelo admin</p>
                                </div>
                            ) : viagensAdmin.map(v => {
                                const sc = STATUS_VIAGEM_CFG[v.status] || STATUS_VIAGEM_CFG['Agendado'];
                                return (
                                    <div key={v.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-start justify-between mb-2 gap-2">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="font-bold font-data text-blue-700">{v.numero}</span>
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{v.status}</span>
                                                </div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{v.destino || '—'}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{FMT(v.data_saida)}</p>
                                                {v.veiculo?.placa && <p className="text-xs font-data font-semibold mt-0.5 text-blue-700">{v.veiculo.placa}</p>}
                                            </div>
                                        </div>
                                        {v.observacoes && <p className="text-xs mt-1.5 p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">{v.observacoes}</p>}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {loading && tab === 'viagens' ? (
                        <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
                    ) : tab === 'viagens' ? (
                        <div className="flex flex-col gap-2">
                            {filtered.length === 0 ? (
                                <div className="bg-white rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    Nenhuma viagem no período selecionado
                                </div>
                            ) : filtered.map(r => {
                                const sc = STATUS_CFG[r.status] || STATUS_CFG['Finalizado'];
                                return (
                                    <div key={r.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="font-data font-bold text-blue-700">{r.numero}</span>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.status}</span>
                                        </div>
                                        <p className="text-sm mb-2" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</p>
                                        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                            <div className="flex items-center gap-3">
                                                {r.saida && <span>{new Date(r.saida).toLocaleDateString('pt-BR')}</span>}
                                                <span className="font-data">{Number(r.peso_total||0).toLocaleString('pt-BR')} kg</span>
                                            </div>
                                            {r.aprovado
                                                ? <span className="flex items-center gap-1 text-green-600 font-medium"><Icon name="CheckCircle2" size={12} color="#059669" />Aprovado</span>
                                                : <span className="flex items-center gap-1 text-amber-600"><Icon name="Clock" size={12} color="#D97706" />Pendente</span>
                                            }
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : tab === 'bonificacoes' ? (
                        <div className="flex flex-col gap-4">
                            <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <h3 className="font-heading font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>Resumo do Período</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Total Bônus</p><p className="text-2xl font-bold font-data text-purple-600">{BRL(totais.totalBonus)}</p></div>
                                    <div><p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Ton. Ferragem</p><p className="text-2xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{totais.totalToneladas.toFixed(2)} t</p></div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                    <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Detalhamento por Romaneio</h3>
                                </div>
                                <table className="w-full text-sm min-w-[500px]">
                                    <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                        <tr>
                                            <th className="px-4 py-2 text-left">Romaneio</th>
                                            <th className="px-4 py-2 text-left hidden sm:table-cell">Destino</th>
                                            <th className="px-4 py-2 text-right">Ton.</th>
                                            <th className="px-4 py-2 text-right">Bônus Ferragem</th>
                                            <th className="px-4 py-2 text-right">Cimento</th>
                                            <th className="px-4 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bonificacoes.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma bonificação no período</td></tr>
                                        ) : bonificacoes.map((r, idx) => (
                                            <tr key={r.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                <td className="px-4 py-2.5 font-data text-xs font-medium text-blue-700">{r.numero}</td>
                                                <td className="px-4 py-2.5 text-xs hidden sm:table-cell" style={{ color: 'var(--color-text-secondary)' }}>{r.destino || '—'}</td>
                                                <td className="px-4 py-2.5 text-right text-xs font-data">{(r.bonif?.toneladasFerragem||0).toFixed(3)} t</td>
                                                <td className="px-4 py-2.5 text-right text-xs font-data text-green-600">{BRL(r.bonif?.valorFerragem)}</td>
                                                <td className="px-4 py-2.5 text-right text-xs font-data">{r.bonif?.temCimento ? <span className="text-blue-600">{BRL(r.bonif.valorCimento)}</span> : <span className="text-gray-300">—</span>}</td>
                                                <td className="px-4 py-2.5 text-right text-xs font-data font-semibold text-purple-600">{BRL(r.bonif?.valorTotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : null}
                </div>
            </main>
            <Toast toast={toast} />
        </div>
    );
}
