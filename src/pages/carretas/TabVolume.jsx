import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import * as XLSX from 'xlsx';
import {
    fetchCarregamentos, createCarregamento, updateCarregamento, deleteCarregamento,
    fetchEmpresas,
    fetchFornecedoresCarretas, createFornecedorCarretas, deleteFornecedorCarretas,
    fetchCarretasVeiculos, fetchTodosMotoristas,
    calcularFrete, TIPOS_CALCULO_FRETE,
} from 'utils/carretasService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMes = m => {
    if (!m) return '';
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
const fmtNum = v => Number(v || 0).toLocaleString('pt-BR');

const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

// ─── Tipo de volume ────────────────────────────────────────────────────────────
const TIPOS = {
    ARA_GBI_FOB:  { label: 'FOB · Guanambi',  short: 'FOB GBI',  bg: '#EFF6FF', color: '#1E3A5F', border: '#BFDBFE', bar: '#1E3A5F' },
    ARA_BARR_FOB: { label: 'FOB · Barreiras', short: 'FOB Barr', bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE', bar: '#7C3AED' },
    CIF_GBI:      { label: 'CIF · Guanambi',  short: 'CIF GBI',  bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', bar: '#059669' },
    CIF_BARR:     { label: 'CIF · Barreiras', short: 'CIF Barr', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', bar: '#D97706' },
};

function parseTipo(row) {
    const raw = row.empresa_origem || '';
    if (raw.includes('|')) {
        const [tipo, nome] = raw.split('|');
        return { tipo: tipo.trim(), nome: nome.trim() };
    }
    if (TIPOS[raw.trim()]) return { tipo: raw.trim(), nome: '' };
    return { tipo: null, nome: raw };
}

function TipoBadge({ tipo }) {
    const t = TIPOS[tipo];
    if (!t) return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}>—</span>;
    return (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
            {t.label}
        </span>
    );
}

// ─── Modal genérico ───────────────────────────────────────────────────────────
function Modal({ title, icon, onClose, children, footer }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden" style={{ animation: 'slideUp .2s ease' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-2">
                        {icon && <Icon name={icon} size={18} color="var(--color-primary)" />}
                        <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <Icon name="X" size={16} color="var(--color-muted-foreground)" />
                    </button>
                </div>
                <div className="overflow-y-auto flex-1 p-5">{children}</div>
                {footer && (
                    <div className="flex justify-end gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

function Field({ label, required, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

// ─── Selector de Tipo ─────────────────────────────────────────────────────────
function TipoSelector({ value, onChange }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            {Object.entries(TIPOS).map(([key, t]) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold text-left border-2 transition-all"
                    style={{
                        background: value === key ? t.bg : '#fff',
                        borderColor: value === key ? t.color : 'var(--color-border)',
                        color: value === key ? t.color : 'var(--color-muted-foreground)',
                    }}>
                    {t.label}
                </button>
            ))}
        </div>
    );
}

// ─── Dropdown de Origem (Fornecedores) ────────────────────────────────────────
function OrigemDropdown({ value, onChange, fornecedores }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const ref = useRef();

    useEffect(() => {
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = fornecedores.filter(f => f.nome.toLowerCase().includes(q.toLowerCase()));

    return (
        <div ref={ref} className="relative">
            <div className="flex">
                <input
                    value={value}
                    onChange={e => { onChange(e.target.value); setQ(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    className={inputCls + ' pr-9'}
                    style={inputStyle}
                    placeholder="Nome do fornecedor / origem"
                />
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                    style={{ color: 'var(--color-primary)' }}>
                    <Icon name="ChevronDown" size={14} />
                </button>
            </div>
            {open && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum fornecedor encontrado</div>
                    ) : (
                        <div className="max-h-40 overflow-y-auto">
                            {filtered.map(f => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => { onChange(f.nome); setQ(''); setOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center">
                                    <span>{f.nome}</span>
                                    {f.cnpj && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{f.cnpj}</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function TabVolume({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    // Estado
    const hoje = new Date().toISOString().slice(0, 7);
    const [mes, setMes] = useState(hoje);
    const [empresaFiltro, setEmpresaFiltro] = useState('');
    const [carregamentos, setCarregamentos] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [fornecedores, setFornecedores] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subAba, setSubAba] = useState('dashboard'); // 'dashboard' | 'tabela' | 'fornecedores'

    // Modal carregamento
    const emptyForm = () => ({
        tipo: '', data_carregamento: new Date().toISOString().slice(0, 10),
        quantidade: '', unidade_quantidade: 'saco', empresa_origem: '',
        veiculo_id: '', motorista_id: '', empresa_id: '', numero_pedido: '', numero_nota_fiscal: '',
        destino: '', observacoes: '',
        tipo_calculo_frete: 'por_saco', valor_base_frete: '',
    });
    const [modal, setModal] = useState(null); // null | { mode: 'create'|'edit', id?: string }
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);

    // Frete preview
    const veiculoSelecionado = veiculos.find(v => v.id === form.veiculo_id);
    const previewFrete = calcularFrete(form.tipo_calculo_frete, form.quantidade, form.valor_base_frete, veiculoSelecionado?.media_consumo);

    // Modal fornecedor
    const [modalFornec, setModalFornec] = useState(false);
    const [formFornec, setFormFornec] = useState({ nome: '', cnpj: '', obs: '' });
    const [savingFornec, setSavingFornec] = useState(false);

    // ── Load ─────────────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [yr, mo] = mes.split('-');
            const lastDay = new Date(+yr, +mo, 0).getDate();
            const filters = {
                dataInicio: `${mes}-01`,
                dataFim: `${mes}-${String(lastDay).padStart(2, '0')}`,
            };
            if (empresaFiltro) filters.empresaId = empresaFiltro;

            const [carr, emp, forn, ve, mot] = await Promise.all([
                fetchCarregamentos(filters),
                fetchEmpresas(),
                fetchFornecedoresCarretas(),
                fetchCarretasVeiculos(),
                isAdmin ? fetchTodosMotoristas() : Promise.resolve([]),
            ]);
            setCarregamentos(carr);
            setEmpresas(emp);
            setFornecedores(forn);
            setVeiculos(ve);
            setMotoristas(mot);
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [mes, empresaFiltro, isAdmin]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    // ── Cálculo de totais ─────────────────────────────────────────────────────
    const totais = (() => {
        const t = { ARA_GBI_FOB: 0, ARA_BARR_FOB: 0, CIF_GBI: 0, CIF_BARR: 0, total: 0 };
        carregamentos.forEach(r => {
            const qtd = Number(r.quantidade) || 0;
            const { tipo } = parseTipo(r);
            if (tipo && t.hasOwnProperty(tipo)) t[tipo] += qtd;
            t.total += qtd;
        });
        return t;
    })();

    // ── Handlers carregamento ─────────────────────────────────────────────────
    const openCreate = () => { setForm(emptyForm()); setModal({ mode: 'create' }); };
    const openEdit = r => {
        const { tipo, nome } = parseTipo(r);
        setForm({
            tipo: tipo || '',
            data_carregamento: r.data_carregamento || new Date().toISOString().slice(0, 10),
            quantidade: r.quantidade || '',
            unidade_quantidade: r.unidade_quantidade || 'saco',
            empresa_origem: nome || '',
            empresa_id: r.empresa_id || '',
            veiculo_id: r.veiculo_id || '',
            motorista_id: r.motorista_id || '',
            numero_pedido: r.numero_pedido || '',
            numero_nota_fiscal: r.numero_nota_fiscal || '',
            destino: r.destino || '',
            observacoes: r.observacoes || '',
            tipo_calculo_frete: r.tipo_calculo_frete || 'por_saco',
            valor_base_frete: r.valor_base_frete || '',
        });
        setModal({ mode: 'edit', id: r.id });
    };

    const handleSave = async () => {
        if (!form.tipo) { showToast('Selecione o tipo de carregamento.', 'error'); return; }
        if (!form.data_carregamento) { showToast('Informe a data.', 'error'); return; }
        if (!form.quantidade || isNaN(form.quantidade)) { showToast('Informe a quantidade.', 'error'); return; }

        const empresaOrigem = form.empresa_origem ? `${form.tipo}|${form.empresa_origem}` : form.tipo;
        const payload = {
            empresa_origem: empresaOrigem,
            data_carregamento: form.data_carregamento,
            quantidade: Number(form.quantidade),
            unidade_quantidade: form.unidade_quantidade || 'saco',
            empresa_id: form.empresa_id || null,
            tipo_calculo_frete: form.tipo_calculo_frete || 'por_saco',
            valor_base_frete: form.valor_base_frete ? Number(form.valor_base_frete) : null,
            _consumoVeiculo: veiculoSelecionado?.media_consumo,
            veiculo_id: form.veiculo_id || null,
            motorista_id: form.motorista_id || null,
            numero_pedido: form.numero_pedido || null,
            numero_nota_fiscal: form.numero_nota_fiscal || null,
            destino: form.destino || null,
            observacoes: form.observacoes || null,
        };

        setSaving(true);
        try {
            if (modal.mode === 'edit') {
                await updateCarregamento(modal.id, payload);
                showToast('Carregamento atualizado!', 'success');
            } else {
                await createCarregamento(payload);
                showToast('Carregamento registrado!', 'success');
            }
            setModal(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    const handleDelete = async id => {
        const ok = await confirm({ title: 'Excluir carregamento?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteCarregamento(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    // ── Handlers fornecedor ───────────────────────────────────────────────────
    const handleSaveFornec = async () => {
        if (!formFornec.nome.trim()) { showToast('Nome é obrigatório.', 'error'); return; }
        setSavingFornec(true);
        try {
            await createFornecedorCarretas({ nome: formFornec.nome.trim(), cnpj: formFornec.cnpj.trim() || null, obs: formFornec.obs.trim() || null });
            showToast('Fornecedor salvo!', 'success');
            setModalFornec(false);
            setFormFornec({ nome: '', cnpj: '', obs: '' });
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingFornec(false); }
    };

    const handleDeleteFornec = async id => {
        const ok = await confirm({ title: 'Remover fornecedor?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Remover', variant: 'danger' });
        if (!ok) return;
        try { await deleteFornecedorCarretas(id); showToast('Removido!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    // ── Exportar ──────────────────────────────────────────────────────────────
    const exportar = () => {
        if (!carregamentos.length) { showToast('Nenhum dado para exportar.', 'error'); return; }
        const rows = carregamentos.map(r => {
            const { tipo, nome } = parseTipo(r);
            return {
                'Data': FMT(r.data_carregamento),
                'Tipo': TIPOS[tipo]?.label || tipo || '—',
                'Fornecedor/Origem': nome || '—',
                'Placa': r.veiculo?.placa || r.veiculo_id || '—',
                'Motorista': r.motorista?.name || r.motorista_id || '—',
                'Pedido': r.numero_pedido || '—',
                'NF': r.numero_nota_fiscal || '—',
                'Destino': r.destino || '—',
                'Quantidade': Number(r.quantidade) || 0,
                'Unidade': r.unidade_quantidade || 'saco',
                'Tipo Frete': r.tipo_calculo_frete || '',
                'Valor Base Frete': Number(r.valor_base_frete || 0),
                'Frete Calculado (R$)': Number(r.valor_frete_calculado || 0),
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Volume');
        // Summary sheet
        const sumRows = Object.entries(TIPOS).map(([key, t]) => ({
            'Tipo': t.label,
            'Volume (sacos)': totais[key] || 0,
            'Participação (%)': totais.total > 0 ? ((totais[key] / totais.total) * 100).toFixed(1) + '%' : '0%',
        }));
        sumRows.push({ 'Tipo': 'TOTAL', 'Volume (sacos)': totais.total, 'Participação (%)': '100%' });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sumRows), 'Resumo');
        XLSX.writeFile(wb, `volume_carretas_${mes}.xlsx`);
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div>
            {/* ── Filtros e ações ── */}
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Mês</label>
                        <input
                            type="month"
                            value={mes}
                            onChange={e => setMes(e.target.value)}
                            className="px-3 py-2 rounded-lg border text-sm"
                            style={inputStyle}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Empresa</label>
                        <select value={empresaFiltro} onChange={e => setEmpresaFiltro(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todas as empresas</option>
                            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar
                    </button>
                    {isAdmin && (
                        <Button onClick={openCreate} iconName="Plus" size="sm">Novo Carregamento</Button>
                    )}
                </div>
            </div>

            {/* ── Sub-abas ── */}
            <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-muted)', width: 'fit-content' }}>
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: 'BarChart3' },
                    { id: 'tabela', label: 'Registros', icon: 'Table2' },
                    { id: 'fornecedores', label: 'Fornecedores', icon: 'Building' },
                ].map(s => (
                    <button
                        key={s.id}
                        onClick={() => setSubAba(s.id)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                        style={subAba === s.id
                            ? { backgroundColor: '#fff', color: 'var(--color-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                            : { color: 'var(--color-muted-foreground)' }}>
                        <Icon name={s.icon} size={13} />
                        {s.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : subAba === 'dashboard' ? (
                <DashboardVolume totais={totais} carregamentos={carregamentos} mes={mes} />
            ) : subAba === 'tabela' ? (
                <TabelaCarregamentos
                    carregamentos={carregamentos}
                    isAdmin={isAdmin}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                />
            ) : (
                <PainelFornecedores
                    fornecedores={fornecedores}
                    isAdmin={isAdmin}
                    onNovo={() => { setFormFornec({ nome: '', cnpj: '', obs: '' }); setModalFornec(true); }}
                    onDelete={handleDeleteFornec}
                />
            )}

            {/* ── Modal Carregamento ── */}
            {modal && isAdmin && (
                <Modal
                    title={modal.mode === 'create' ? 'Novo Carregamento' : 'Editar Carregamento'}
                    icon="Package"
                    onClose={() => setModal(null)}
                    footer={<>
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSave} size="sm" iconName="Check" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
                    </>}
                >
                    <div className="flex flex-col gap-4">
                        <Field label="Tipo de carregamento" required>
                            <TipoSelector value={form.tipo} onChange={v => setForm(f => ({ ...f, tipo: v }))} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Data" required>
                                <input type="date" value={form.data_carregamento} onChange={e => setForm(f => ({ ...f, data_carregamento: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Quantidade (sacos)" required>
                                <input type="number" min="0" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 1200" />
                            </Field>
                        </div>
                        <Field label="Fornecedor / Origem">
                            <OrigemDropdown value={form.empresa_origem} onChange={v => setForm(f => ({ ...f, empresa_origem: v }))} fornecedores={fornecedores} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Veículo (placa)">
                                <select value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </select>
                            </Field>
                            <Field label="Motorista">
                                <select value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nº Pedido">
                                <input value={form.numero_pedido} onChange={e => setForm(f => ({ ...f, numero_pedido: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 123456" />
                            </Field>
                            <Field label="Nota Fiscal">
                                <input value={form.numero_nota_fiscal} onChange={e => setForm(f => ({ ...f, numero_nota_fiscal: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 381469" />
                            </Field>
                        </div>
                        <Field label="Destino">
                            <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Cidade ou estoque" />
                        </Field>
                        <Field label="Empresa (frete)">
                            <select value={form.empresa_id} onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                            </select>
                        </Field>
                        {/* ── Bloco de Frete ── */}
                        <div className="col-span-full p-4 rounded-xl border" style={{ borderColor: '#C4B5FD', backgroundColor: '#FAF5FF' }}>
                            <p className="text-xs font-semibold text-purple-700 mb-3">💰 Cálculo de Frete</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Tipo de cálculo">
                                    <select value={form.tipo_calculo_frete} onChange={e => setForm(f => ({ ...f, tipo_calculo_frete: e.target.value }))} className={inputCls} style={inputStyle}>
                                        {TIPOS_CALCULO_FRETE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </Field>
                                <Field label={
                                    form.tipo_calculo_frete === 'percentual' ? 'Percentual (%)' :
                                    form.tipo_calculo_frete === 'por_km' ? 'Preço diesel (R$/L)' : 'Valor base (R$)'
                                }>
                                    <input type="number" step="0.01" value={form.valor_base_frete} onChange={e => setForm(f => ({ ...f, valor_base_frete: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                                </Field>
                            </div>
                            {form.tipo_calculo_frete === 'por_km' && (
                                <p className="text-xs text-purple-600 mt-2">
                                    {veiculoSelecionado?.media_consumo
                                        ? `Consumo do veículo: ${veiculoSelecionado.media_consumo} km/L — informe a distância em km no campo Quantidade`
                                        : '⚠️ Veículo sem consumo cadastrado. Cadastre o consumo em Veículos para usar este cálculo.'}
                                </p>
                            )}
                            {previewFrete > 0 && (
                                <div className="mt-3 p-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold flex items-center justify-between">
                                    <span>Frete calculado:</span>
                                    <span className="font-mono">{BRL(previewFrete)}</span>
                                </div>
                            )}
                        </div>
                        <Field label="Observações">
                            <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Observações gerais..." />
                        </Field>
                    </div>
                </Modal>
            )}

            {/* ── Modal Fornecedor ── */}
            {modalFornec && isAdmin && (
                <Modal
                    title="Novo Fornecedor"
                    icon="Building"
                    onClose={() => setModalFornec(false)}
                    footer={<>
                        <button onClick={() => setModalFornec(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSaveFornec} size="sm" iconName="Check" disabled={savingFornec}>{savingFornec ? 'Salvando...' : 'Salvar'}</Button>
                    </>}
                >
                    <div className="flex flex-col gap-4">
                        <Field label="Nome" required>
                            <input value={formFornec.nome} onChange={e => setFormFornec(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Votorantim Cimentos" />
                        </Field>
                        <Field label="CNPJ">
                            <input value={formFornec.cnpj} onChange={e => setFormFornec(f => ({ ...f, cnpj: e.target.value }))} className={inputCls} style={inputStyle} placeholder="XX.XXX.XXX/XXXX-XX" />
                        </Field>
                        <Field label="Observações">
                            <textarea value={formFornec.obs} onChange={e => setFormFornec(f => ({ ...f, obs: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                        </Field>
                    </div>
                </Modal>
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}

// ─── Sub-componente: Dashboard ─────────────────────────────────────────────────
function DashboardVolume({ totais, carregamentos, mes }) {
    const pct = v => totais.total > 0 ? ((v / totais.total) * 100).toFixed(1) : '0.0';
    const tipoEntries = Object.entries(TIPOS);

    // Barras de progresso empilhadas
    const bars = tipoEntries.map(([key, t]) => ({
        key, t, v: totais[key] || 0, p: totais.total > 0 ? (totais[key] / totais.total) * 100 : 0,
    }));

    const freteTotal = carregamentos.reduce((s, r) => s + Number(r.valor_frete_calculado || 0), 0);

    return (
        <div className="flex flex-col gap-6">
            {/* Cards de resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Total */}
                <div className="rounded-xl p-4 text-white col-span-2 lg:col-span-1 relative overflow-hidden" style={{ background: 'var(--color-primary)' }}>
                    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ background: 'rgba(255,255,255,0.3)' }} />
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-75 mb-2">📦 Total Geral</p>
                    <p className="text-3xl font-black leading-none">{fmtNum(totais.total)}</p>
                    <p className="text-xs opacity-60 mt-1">sacos · {carregamentos.length} carreg.</p>
                </div>
                {/* Por tipo */}
                {tipoEntries.map(([key, t]) => (
                    <div key={key} className="rounded-xl p-4 relative overflow-hidden border" style={{ background: t.bg, borderColor: t.border }}>
                        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ background: t.bar }} />
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-75 mb-2" style={{ color: t.color }}>{t.label}</p>
                        <p className="text-2xl font-black leading-none" style={{ color: t.color }}>{fmtNum(totais[key] || 0)}</p>
                        <p className="text-sm font-semibold mt-1" style={{ color: t.color }}>{pct(totais[key] || 0)}%</p>
                        <p className="text-xs opacity-55" style={{ color: t.color }}>do volume total</p>
                    </div>
                ))}
            </div>

            {/* Barra de progresso empilhada */}
            <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-muted-foreground)' }}>Distribuição de volume — {fmtMes(mes)}</p>
                <div className="h-4 rounded-full overflow-hidden flex gap-0.5 mb-3" style={{ background: 'var(--color-border)' }}>
                    {bars.map(({ key, t, p }) => p > 0 && (
                        <div key={key} title={`${t.label}: ${p.toFixed(1)}%`}
                            className="h-full flex items-center justify-center text-white text-xs font-bold overflow-hidden transition-all"
                            style={{ width: `${p}%`, background: t.bar, minWidth: 0 }}>
                            {p > 8 ? `${p.toFixed(0)}%` : ''}
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap gap-3">
                    {tipoEntries.map(([key, t]) => (
                        <div key={key} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: t.bar }} />
                            {t.label} · {fmtNum(totais[key] || 0)} sacos
                        </div>
                    ))}
                </div>
            </div>

            {/* Card de Frete Total */}
            <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center gap-4" style={{ borderColor: '#C4B5FD' }}>
                <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, background: '#EDE9FE' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Frete Total do Período</p>
                    <p className="text-2xl font-black font-mono" style={{ color: '#7C3AED' }}>{BRL(freteTotal)}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>soma de valor_frete_calculado · alimenta o Rel. Financeiro</p>
                </div>
            </div>

            {/* Tabela de últimos carregamentos (resumo) */}
            {carregamentos.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Últimos carregamentos</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[600px]">
                            <thead className="text-xs border-b" style={{ background: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                <tr>
                                    {['Data', 'Tipo', 'Fornecedor', 'Placa', 'Destino', 'Qtd (sacos)'].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {carregamentos.slice(0, 8).map((r, i) => {
                                    const { tipo, nome } = parseTipo(r);
                                    return (
                                        <tr key={r.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                            <td className="px-3 py-2.5 whitespace-nowrap">{FMT(r.data_carregamento)}</td>
                                            <td className="px-3 py-2.5"><TipoBadge tipo={tipo} /></td>
                                            <td className="px-3 py-2.5 max-w-[140px] truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{nome || '—'}</td>
                                            <td className="px-3 py-2.5 font-mono text-xs">{r.veiculo?.placa || r.veiculo_id || '—'}</td>
                                            <td className="px-3 py-2.5 text-xs max-w-[120px] truncate">{r.destino || '—'}</td>
                                            <td className="px-3 py-2.5 font-bold font-mono text-right">{fmtNum(r.quantidade)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {carregamentos.length > 8 && (
                        <div className="px-4 py-2 border-t text-xs text-center" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            + {carregamentos.length - 8} registros — veja todos na aba "Registros"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Sub-componente: Tabela completa ──────────────────────────────────────────
function TabelaCarregamentos({ carregamentos, isAdmin, onEdit, onDelete }) {
    if (carregamentos.length === 0) {
        return (
            <div className="bg-white rounded-xl border p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
                <Icon name="Package" size={36} color="var(--color-muted-foreground)" />
                <p className="text-sm mt-3" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum carregamento encontrado para o período</p>
            </div>
        );
    }
    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm min-w-[800px]">
                <thead className="text-xs border-b" style={{ background: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                    <tr>
                        {['Data', 'Tipo', 'Fornecedor/Origem', 'Placa', 'Motorista', 'Pedido', 'NF', 'Destino', 'Qtd', 'Frete', ''].map(h => (
                            <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {carregamentos.map((r, i) => {
                        const { tipo, nome } = parseTipo(r);
                        return (
                            <tr key={r.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                <td className="px-3 py-2.5 whitespace-nowrap">{FMT(r.data_carregamento)}</td>
                                <td className="px-3 py-2.5"><TipoBadge tipo={tipo} /></td>
                                <td className="px-3 py-2.5 max-w-[140px] truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{nome || '—'}</td>
                                <td className="px-3 py-2.5 font-mono text-xs">{r.veiculo?.placa || r.veiculo_id || '—'}</td>
                                <td className="px-3 py-2.5 text-xs">{r.motorista?.name || r.motorista_id || '—'}</td>
                                <td className="px-3 py-2.5 font-mono text-xs">{r.numero_pedido || '—'}</td>
                                <td className="px-3 py-2.5 font-mono text-xs">{r.numero_nota_fiscal || '—'}</td>
                                <td className="px-3 py-2.5 text-xs max-w-[120px] truncate">{r.destino || '—'}</td>
                                <td className="px-3 py-2.5 font-bold font-mono whitespace-nowrap">{fmtNum(r.quantidade)}</td>
                                <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap" style={{ color: '#7C3AED' }}>{BRL(r.valor_frete_calculado)}</td>
                                {isAdmin && (
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => onEdit(r)} className="p-1.5 rounded hover:bg-blue-50 transition-colors"><Icon name="Pencil" size={13} color="#1D4ED8" /></button>
                                            <button onClick={() => onDelete(r.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors"><Icon name="Trash2" size={13} color="#DC2626" /></button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Sub-componente: Fornecedores ─────────────────────────────────────────────
function PainelFornecedores({ fornecedores, isAdmin, onNovo, onDelete }) {
    return (
        <div>
            {isAdmin && (
                <div className="flex justify-end mb-4">
                    <Button onClick={onNovo} iconName="Plus" size="sm">Novo Fornecedor</Button>
                </div>
            )}
            {fornecedores.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Building" size={36} color="var(--color-muted-foreground)" />
                    <p className="text-sm mt-3" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum fornecedor cadastrado</p>
                    {isAdmin && <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Clique em "Novo Fornecedor" para adicionar</p>}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {fornecedores.map(f => (
                        <div key={f.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-start justify-between mb-2">
                                <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{f.nome}</p>
                                {isAdmin && (
                                    <button onClick={() => onDelete(f.id)} className="p-1 rounded hover:bg-red-50 transition-colors flex-shrink-0">
                                        <Icon name="Trash2" size={13} color="#DC2626" />
                                    </button>
                                )}
                            </div>
                            {f.cnpj && <p className="text-xs font-mono" style={{ color: 'var(--color-muted-foreground)' }}>📄 {f.cnpj}</p>}
                            {f.obs && <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{f.obs}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
