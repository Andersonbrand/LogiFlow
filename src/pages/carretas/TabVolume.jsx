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
    fetchVeiculosProprios, fetchVeiculosTerceiros,
    fetchMotoristasProprios, fetchMotoristasTerceiros, fetchCarreteirosPropriosOnly,
    calcularFrete, TIPOS_CALCULO_FRETE,
    fetchFretesCidades,
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
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

// ─── Select de Destino com auto-preenchimento de frete ───────────────────────
function DestinoSelect({ value, onChange, onFreteAutoFill, fretes, placeholder = 'Cidade ou estoque' }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const ref = useRef();

    useEffect(() => {
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = fretes.filter(f => f.cidade.toLowerCase().includes(q.toLowerCase()));

    const select = (frete) => {
        onChange(frete.cidade);
        if (onFreteAutoFill) onFreteAutoFill(frete.frete_por_saco);
        setQ('');
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            <div className="flex">
                <input
                    value={value}
                    onChange={e => { onChange(e.target.value); setQ(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    className={inputCls + ' pr-9'}
                    style={inputStyle}
                    placeholder={placeholder}
                />
                <button type="button" onClick={() => setOpen(o => !o)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                    style={{ color: 'var(--color-primary)' }}>
                    <Icon name="ChevronDown" size={14} />
                </button>
            </div>
            {open && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                {fretes.length === 0 ? 'Cadastre cidades na aba Fretes' : 'Nenhuma cidade encontrada'}
                            </div>
                        ) : filtered.map(f => (
                            <button key={f.id} type="button" onClick={() => select(f)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2">
                                <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{f.cidade}</span>
                                <span className="text-xs font-mono font-semibold flex-shrink-0" style={{ color: '#059669' }}>
                                    {Number(f.frete_por_saco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/saco
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
export default function TabVolume({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    // Estado
    const hoje = new Date().toISOString().slice(0, 7);
    const [mes, setMes] = useState(hoje);
    const [dia, setDia] = useState(''); // dia específico — tem prioridade sobre mês
    const [empresaFiltro, setEmpresaFiltro] = useState('');
    const [carregamentos, setCarregamentos] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [fornecedores, setFornecedores] = useState([]);
    const [veiculos, setVeiculos] = useState([]);         // todos (modal carregamento frota)
    const [veiculosProprios, setVeiculosProprios] = useState([]);  // frota própria (modal retira)
    const [veiculosTerceiros, setVeiculosTerceiros] = useState([]); // terceirizados (modal terceiro)
    const [motoristas, setMotoristas] = useState([]);       // todos (modal carregamento frota)
    const [motoristasProprios, setMotoristasProprios] = useState([]); // frota própria (modal retira)
    const [motoristasTerceiros, setMotoristasTerceiros] = useState([]); // terceirizados (modal terceiro)
    const [loading, setLoading] = useState(true);
    const [subAba, setSubAba] = useState('dashboard'); // 'dashboard' | 'tabela' | 'terceiros' | 'retira' | 'fornecedores'

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

    // Modal carregamento terceiro
    const emptyFormTerceiro = () => ({
        data_carregamento: new Date().toISOString().slice(0, 10),
        quantidade: '', unidade_quantidade: 'saco',
        empresa_origem: '', destino: '', numero_pedido: '', numero_nota_fiscal: '', observacoes: '',
        tipo: '', motorista_id: '', veiculo_id: '',
        tipo_calculo_frete: 'por_saco', valor_base_frete: '',
    });
    const [modalTerceiro, setModalTerceiro] = useState(null);
    const [formTerceiro, setFormTerceiro] = useState(emptyFormTerceiro());
    const [savingTerceiro, setSavingTerceiro] = useState(false);
    const [carregamentosTerceiros, setCarregamentosTerceiros] = useState([]);
    const [carregamentosRetira, setCarregamentosRetira] = useState([]);
    const [fretesFretas, setFretesFretas] = useState([]);
    const [fretosTerceiros, setFretesTerceiros] = useState([]);

    // Modal retira
    const emptyFormRetira = () => ({
        data_carregamento: new Date().toISOString().slice(0, 10),
        quantidade: '', empresa_origem: '', numero_pedido: '', numero_nota_fiscal: '',
        pedido_venda: '', motorista_id: '', veiculo_id: '', observacoes: '', tipo: '',
        destino: 'Fábrica', nome_cliente: '', // Retira sempre ocorre na fábrica
    });
    const [modalRetira, setModalRetira] = useState(null);
    const [formRetira, setFormRetira] = useState(emptyFormRetira());
    const [savingRetira, setSavingRetira] = useState(false);

    // Frete preview
    const veiculoSelecionado = veiculos.find(v => v.id === form.veiculo_id);
    const previewFrete = calcularFrete(form.tipo_calculo_frete, form.quantidade, form.valor_base_frete, veiculoSelecionado?.media_consumo);

    // Modal fornecedor
    const [modalFornec, setModalFornec] = useState(false);
    const [formFornec, setFormFornec] = useState({ nome: '', cnpj: '', observacoes: '' });
    const [savingFornec, setSavingFornec] = useState(false);

    // ── Load ─────────────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            let filters = {};
            if (dia) {
                filters.dataInicio = dia;
                filters.dataFim    = dia;
            } else {
                const [yr, mo] = mes.split('-');
                const lastDay = new Date(+yr, +mo, 0).getDate();
                filters.dataInicio = `${mes}-01`;
                filters.dataFim    = `${mes}-${String(lastDay).padStart(2, '0')}`;
            }
            if (empresaFiltro) filters.empresaId = empresaFiltro;

            const [
                carr, emp, forn,
                ve, vePropr, veTer,
                mot, motPropr, motTer,
                carrTerc, fretFr, fretTerc, carrRet
            ] = await Promise.all([
                fetchCarregamentos({ ...filters, is_terceiro: false, is_retira: false }),
                fetchEmpresas(),
                fetchFornecedoresCarretas(),
                // Veículos: todos (modal frota) + separados por tipo
                fetchCarretasVeiculos(),
                fetchVeiculosProprios(),
                fetchVeiculosTerceiros(),
                // Motoristas: todos (modal frota) + separados por tipo
                isAdmin ? fetchTodosMotoristas()     : Promise.resolve([]),
                isAdmin ? fetchCarreteirosPropriosOnly()  : Promise.resolve([]),
                isAdmin ? fetchMotoristasTerceiros() : Promise.resolve([]),
                fetchCarregamentos({ ...filters, is_terceiro: true }),
                fetchFretesCidades('frota'),
                fetchFretesCidades('terceiros'),
                fetchCarregamentos({ ...filters, is_retira: true }),
            ]);
            setCarregamentos(carr);
            setEmpresas(emp);
            setFornecedores(forn);
            setVeiculos(ve);
            setVeiculosProprios(vePropr);
            setVeiculosTerceiros(veTer);
            setMotoristas(mot);
            setMotoristasProprios(motPropr);
            setMotoristasTerceiros(motTer);
            setCarregamentosTerceiros(carrTerc);
            setFretesFretas(fretFr);
            setFretesTerceiros(fretTerc);
            setCarregamentosRetira(carrRet);
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [mes, dia, empresaFiltro, isAdmin]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    // ── Cálculo de totais ─────────────────────────────────────────────────────
    const totais = (() => {
        const t = { ARA_GBI_FOB: 0, ARA_BARR_FOB: 0, CIF_GBI: 0, CIF_BARR: 0, total: 0, totalTerceiros: 0 };
        carregamentos.forEach(r => {
            const qtd = Number(r.quantidade) || 0;
            const { tipo } = parseTipo(r);
            if (tipo && t.hasOwnProperty(tipo)) t[tipo] += qtd;
            t.total += qtd;
        });
        // Terceiros e Retira: somar volume de FOB Guanambi e FOB Barreiras nos badges respectivos
        [...carregamentosTerceiros, ...carregamentosRetira].forEach(r => {
            const qtd = Number(r.quantidade) || 0;
            t.totalTerceiros += qtd;
            const { tipo } = parseTipo(r);
            if (tipo === 'ARA_GBI_FOB')  t.ARA_GBI_FOB  += qtd;
            if (tipo === 'ARA_BARR_FOB') t.ARA_BARR_FOB += qtd;
        });
        t.totalGeral = t.total + t.totalTerceiros;
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
            destino: form.destino || '',
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

    // ── Handlers carregamento terceiro ───────────────────────────────────────
    const openCreateTerceiro = () => { setFormTerceiro(emptyFormTerceiro()); setModalTerceiro({ mode: 'create' }); };
    const openEditTerceiro = r => {
        const { tipo, nome } = parseTipo(r);
        setFormTerceiro({
            tipo: tipo || '',
            data_carregamento: r.data_carregamento || new Date().toISOString().slice(0, 10),
            quantidade: r.quantidade || '',
            unidade_quantidade: r.unidade_quantidade || 'saco',
            empresa_origem: nome || '',
            numero_pedido: r.numero_pedido || '',
            numero_nota_fiscal: r.numero_nota_fiscal || '',
            destino: r.destino || '',
            observacoes: r.observacoes || '',
            motorista_id: r.motorista_id || '',
            veiculo_id: r.veiculo_id || '',
            tipo_calculo_frete: r.tipo_calculo_frete || 'por_saco',
            valor_base_frete: r.valor_base_frete || '',
        });
        setModalTerceiro({ mode: 'edit', id: r.id });
    };
    const handleSaveTerceiro = async () => {
        if (!formTerceiro.tipo) { showToast('Selecione o tipo de carregamento.', 'error'); return; }
        if (!formTerceiro.data_carregamento) { showToast('Informe a data.', 'error'); return; }
        if (!formTerceiro.quantidade || isNaN(formTerceiro.quantidade)) { showToast('Informe a quantidade.', 'error'); return; }
        const empresaOrigem = formTerceiro.empresa_origem ? `${formTerceiro.tipo}|${formTerceiro.empresa_origem}` : formTerceiro.tipo;
        const payload = {
            empresa_origem: empresaOrigem,
            data_carregamento: formTerceiro.data_carregamento,
            quantidade: Number(formTerceiro.quantidade),
            unidade_quantidade: formTerceiro.unidade_quantidade || 'saco',
            numero_pedido: formTerceiro.numero_pedido || null,
            numero_nota_fiscal: formTerceiro.numero_nota_fiscal || null,
            destino: formTerceiro.destino || '',
            observacoes: formTerceiro.observacoes || null,
            is_terceiro: true,
            motorista_id: formTerceiro.motorista_id || null,
            empresa_id: null,
            veiculo_id: formTerceiro.veiculo_id || null,
            tipo_calculo_frete: formTerceiro.tipo_calculo_frete || null,
            valor_base_frete: formTerceiro.valor_base_frete ? Number(formTerceiro.valor_base_frete) : null,
            _consumoVeiculo: null,
        };
        setSavingTerceiro(true);
        try {
            if (modalTerceiro.mode === 'edit') {
                await updateCarregamento(modalTerceiro.id, payload);
                showToast('Carregamento atualizado!', 'success');
            } else {
                await createCarregamento(payload);
                showToast('Carregamento de terceiro registrado!', 'success');
            }
            setModalTerceiro(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingTerceiro(false); }
    };
    const handleDeleteTerceiro = async id => {
        const ok = await confirm({ title: 'Excluir carregamento?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteCarregamento(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    // ── Handlers retira ───────────────────────────────────────────────────────
    const openCreateRetira = () => { setFormRetira(emptyFormRetira()); setModalRetira({ mode: 'create' }); };
    const openEditRetira = r => {
        const { tipo, nome } = parseTipo(r);
        setFormRetira({
            tipo: tipo || '',
            data_carregamento: r.data_carregamento || new Date().toISOString().slice(0, 10),
            quantidade: r.quantidade || '',
            nome_cliente: r.nome_cliente || '',
            empresa_origem: nome || '',
            numero_pedido: r.numero_pedido || '',
            numero_nota_fiscal: r.numero_nota_fiscal || '',
            pedido_venda: r.pedido_venda || '',
            motorista_id: r.motorista_id || '',
            veiculo_id: r.veiculo_id || '',
            observacoes: r.observacoes || '',
            destino: r.destino || 'Fábrica',
        });
        setModalRetira({ mode: 'edit', id: r.id });
    };
    const handleSaveRetira = async () => {
        if (!formRetira.data_carregamento) { showToast('Informe a data.', 'error'); return; }
        if (!formRetira.quantidade || isNaN(formRetira.quantidade)) { showToast('Informe a quantidade.', 'error'); return; }
        if (!formRetira.tipo) { showToast('Selecione o tipo de carregamento (FOB/CIF).', 'error'); return; }
        const empresaOrigem = formRetira.empresa_origem ? `${formRetira.tipo}|${formRetira.empresa_origem}` : formRetira.tipo;
        const payload = {
            empresa_origem: empresaOrigem,
            data_carregamento: formRetira.data_carregamento,
            quantidade: Number(formRetira.quantidade),
            unidade_quantidade: 'saco',
            destino: formRetira.destino || 'Fábrica', // Retira: destino padrão = Fábrica
            numero_pedido: formRetira.numero_pedido || null,
            numero_nota_fiscal: formRetira.numero_nota_fiscal || null,
            pedido_venda: formRetira.pedido_venda || null,
            nome_cliente: formRetira.nome_cliente || null,
            motorista_id: formRetira.motorista_id || null,
            veiculo_id: formRetira.veiculo_id || null,
            observacoes: formRetira.observacoes || null,
            is_retira: true,
            is_terceiro: false,
            empresa_id: null,
            tipo_calculo_frete: null,
            valor_base_frete: null,
            _consumoVeiculo: null,
        };
        setSavingRetira(true);
        try {
            if (modalRetira.mode === 'edit') {
                await updateCarregamento(modalRetira.id, payload);
                showToast('Retira atualizada!', 'success');
            } else {
                await createCarregamento(payload);
                showToast('Retira registrada!', 'success');
            }
            setModalRetira(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingRetira(false); }
    };
    const handleDeleteRetira = async id => {
        const ok = await confirm({ title: 'Excluir retira?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteCarregamento(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    // ── Handlers fornecedor ───────────────────────────────────────────────────
    const handleSaveFornec = async () => {
        if (!formFornec.nome.trim()) { showToast('Nome é obrigatório.', 'error'); return; }
        setSavingFornec(true);
        try {
            await createFornecedorCarretas({ nome: formFornec.nome.trim(), cnpj: formFornec.cnpj.trim() || null, observacoes: formFornec.observacoes.trim() || null });
            showToast('Fornecedor salvo!', 'success');
            setModalFornec(false);
            setFormFornec({ nome: '', cnpj: '', observacoes: '' });
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
                            onChange={e => { setMes(e.target.value); setDia(''); }}
                            className="px-3 py-2 rounded-lg border text-sm"
                            style={inputStyle}
                            title="Filtrar por mês"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Dia específico</label>
                        <input
                            type="date"
                            value={dia}
                            onChange={e => { setDia(e.target.value); setMes(''); }}
                            className="px-3 py-2 rounded-lg border text-sm"
                            style={inputStyle}
                            title="Filtrar por dia específico"
                        />
                    </div>
                    {(dia) && (
                        <button
                            onClick={() => { setDia(''); setMes(hoje); }}
                            className="flex items-center gap-1 px-2 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 self-end"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            ✕ Dia
                        </button>
                    )}
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
{/* Botão de novo fica em cada aba — removido do header global */}
                </div>
            </div>

            {/* ── Sub-abas ── */}
            <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-muted)', width: 'fit-content' }}>
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: 'BarChart3' },
                    { id: 'tabela', label: 'Registros', icon: 'Table2' },
                    { id: 'terceiros', label: 'Terceiros', icon: 'Users' },
                    { id: 'retira', label: 'Retira de Clientes', icon: 'ShoppingBag' },
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
                <DashboardVolume totais={totais} carregamentos={carregamentos} carregamentosTerceiros={carregamentosTerceiros} carregamentosRetira={carregamentosRetira} mes={mes} />
            ) : subAba === 'tabela' ? (
                <TabelaCarregamentos
                    carregamentos={carregamentos}
                    isAdmin={isAdmin}
                    onNovo={openCreate}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                />
            ) : subAba === 'terceiros' ? (
                <TabelaTerceiros
                    carregamentos={carregamentosTerceiros}
                    isAdmin={isAdmin}
                    onNovo={openCreateTerceiro}
                    onEdit={openEditTerceiro}
                    onDelete={handleDeleteTerceiro}
                    fretosTerceiros={fretosTerceiros}
                    motoristas={motoristasTerceiros}
                    mes={mes}
                />
            ) : subAba === 'retira' ? (
                <TabelaRetira
                    carregamentos={carregamentosRetira}
                    isAdmin={isAdmin}
                    onNovo={openCreateRetira}
                    onEdit={openEditRetira}
                    onDelete={handleDeleteRetira}
                    veiculos={veiculosTerceiros}
                    motoristas={motoristasTerceiros}
                />
            ) : (
                <PainelFornecedores
                    fornecedores={fornecedores}
                    isAdmin={isAdmin}
                    onNovo={() => { setFormFornec({ nome: '', cnpj: '', observacoes: '' }); setModalFornec(true); }}
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
                                    {veiculosProprios.map(v => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
                                </select>
                            </Field>
                            <Field label="Motorista">
                                <select value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {motoristasProprios.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
                            <DestinoSelect
                                value={form.destino}
                                onChange={v => setForm(f => ({ ...f, destino: v }))}
                                onFreteAutoFill={v => setForm(f => ({ ...f, tipo_calculo_frete: 'por_saco', valor_base_frete: String(v) }))}
                                fretes={fretesFretas}
                                placeholder="Cidade ou estoque"
                            />
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
                            <textarea value={formFornec.observacoes} onChange={e => setFormFornec(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                        </Field>
                    </div>
                </Modal>
            )}

            {/* ── Modal Carregamento Terceiro ── */}
            {modalTerceiro && isAdmin && (
                <Modal
                    title={modalTerceiro.mode === 'create' ? 'Novo Carregamento — Terceiro' : 'Editar Carregamento — Terceiro'}
                    icon="Users"
                    onClose={() => setModalTerceiro(null)}
                    footer={<>
                        <button onClick={() => setModalTerceiro(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSaveTerceiro} size="sm" iconName="Check" disabled={savingTerceiro}>{savingTerceiro ? 'Salvando...' : 'Salvar'}</Button>
                    </>}
                >
                    <div className="flex flex-col gap-4">
                        <div className="p-3 rounded-xl text-xs font-medium" style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                            ⚠️ Este lançamento é exclusivo para veículos terceirizados. Não gera bonificações e não aparece nas telas dos motoristas.
                        </div>
                        <Field label="Tipo de carregamento" required>
                            <TipoSelector value={formTerceiro.tipo} onChange={v => setFormTerceiro(f => ({ ...f, tipo: v }))} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Data" required>
                                <input type="date" value={formTerceiro.data_carregamento} onChange={e => setFormTerceiro(f => ({ ...f, data_carregamento: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Quantidade (sacos)" required>
                                <input type="number" min="0" value={formTerceiro.quantidade} onChange={e => setFormTerceiro(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 1200" />
                            </Field>
                        </div>
                        <Field label="Motorista Terceirizado">
                            <select value={formTerceiro.motorista_id} onChange={e => setFormTerceiro(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione o motorista (opcional)...</option>
                                {motoristasTerceiros.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            {motoristasTerceiros.length === 0 && (
                                <p className="text-xs mt-1 text-amber-600">⚠ Nenhum motorista com flag "terceirizado" cadastrado em Configurações.</p>
                            )}
                        </Field>
                        <Field label="Placa do Veículo Terceirizado">
                            <select value={formTerceiro.veiculo_id} onChange={e => setFormTerceiro(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione a placa (opcional)...</option>
                                {veiculosTerceiros.map(v => (
                                    <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>
                                ))}
                            </select>
                            {veiculosTerceiros.length === 0 && (
                                <p className="text-xs mt-1 text-amber-600">⚠ Nenhum veículo com flag "terceirizado" cadastrado em Veículos.</p>
                            )}
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Tipo de Cálculo do Frete">
                                <select value={formTerceiro.tipo_calculo_frete} onChange={e => setFormTerceiro(f => ({ ...f, tipo_calculo_frete: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Sem cálculo de frete</option>
                                    {TIPOS_CALCULO_FRETE.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label={formTerceiro.tipo_calculo_frete === 'por_saco' ? 'R$ por saco' : formTerceiro.tipo_calculo_frete === 'por_tonelada' ? 'R$ por tonelada' : formTerceiro.tipo_calculo_frete === 'percentual' ? '% do valor' : formTerceiro.tipo_calculo_frete === 'por_carga' ? 'Valor fixo (R$)' : 'Valor base'}>
                                <input type="number" min="0" step="0.01" value={formTerceiro.valor_base_frete} onChange={e => setFormTerceiro(f => ({ ...f, valor_base_frete: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 9,52" disabled={!formTerceiro.tipo_calculo_frete} />
                            </Field>
                        </div>
                        {formTerceiro.tipo_calculo_frete && formTerceiro.valor_base_frete && formTerceiro.quantidade && (
                            <div className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }}>
                                💰 Frete calculado: {Number(calcularFrete(formTerceiro.tipo_calculo_frete, formTerceiro.quantidade, formTerceiro.valor_base_frete, null)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                        )}
                        <Field label="Fornecedor / Origem">
                            <OrigemDropdown value={formTerceiro.empresa_origem} onChange={v => setFormTerceiro(f => ({ ...f, empresa_origem: v }))} fornecedores={fornecedores} />
                        </Field>
                        <Field label="Destino">
                            <DestinoSelect
                                value={formTerceiro.destino}
                                onChange={v => setFormTerceiro(f => ({ ...f, destino: v }))}
                                onFreteAutoFill={v => setFormTerceiro(f => ({ ...f, tipo_calculo_frete: 'por_saco', valor_base_frete: String(v) }))}
                                fretes={fretosTerceiros}
                                placeholder="Cidade ou estoque"
                            />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nº Pedido">
                                <input value={formTerceiro.numero_pedido} onChange={e => setFormTerceiro(f => ({ ...f, numero_pedido: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 123456" />
                            </Field>
                            <Field label="Nota Fiscal">
                                <input value={formTerceiro.numero_nota_fiscal} onChange={e => setFormTerceiro(f => ({ ...f, numero_nota_fiscal: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 381469" />
                            </Field>
                        </div>
                        <Field label="Observações">
                            <textarea value={formTerceiro.observacoes} onChange={e => setFormTerceiro(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Observações gerais..." />
                        </Field>
                    </div>
                </Modal>
            )}

            {/* ── Modal Retira ── */}
            {modalRetira && isAdmin && (
                <Modal
                    title={modalRetira.mode === 'create' ? 'Nova Retira de Cliente' : 'Editar Retira de Cliente'}
                    icon="ShoppingBag"
                    onClose={() => setModalRetira(null)}
                    footer={<>
                        <button onClick={() => setModalRetira(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSaveRetira} size="sm" iconName="Check" disabled={savingRetira}>{savingRetira ? 'Salvando...' : 'Salvar'}</Button>
                    </>}
                >
                    <div className="flex flex-col gap-4">
                        <div className="p-3 rounded-xl text-xs font-medium flex items-center gap-2" style={{ backgroundColor: '#F0FDF4', color: '#065F46', border: '1px solid #BBF7D0' }}>
                            🏭 Retira de cliente na fábrica — registre o tipo (FOB/CIF), veículo e motorista da frota própria.
                        </div>
                        {/* Tipo de carregamento — igual ao Registros */}
                        <Field label="Tipo de carregamento" required>
                            <TipoSelector value={formRetira.tipo} onChange={v => setFormRetira(f => ({ ...f, tipo: v }))} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Data" required>
                                <input type="date" value={formRetira.data_carregamento} onChange={e => setFormRetira(f => ({ ...f, data_carregamento: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Quantidade (sacos)" required>
                                <input type="number" min="0" value={formRetira.quantidade} onChange={e => setFormRetira(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 800" />
                            </Field>
                        </div>
                        <Field label="Cliente / Origem">
                            <OrigemDropdown value={formRetira.empresa_origem} onChange={v => setFormRetira(f => ({ ...f, empresa_origem: v }))} fornecedores={fornecedores} />
                        </Field>
                        {/* Veículos e Motoristas — apenas frota própria (não terceiros) */}
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Veículo Terceirizado">
                                <select value={formRetira.veiculo_id} onChange={e => setFormRetira(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculosTerceiros.map(v => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
                                </select>
                            </Field>
                            <Field label="Nome do Cliente">
                                <input
                                    value={formRetira.nome_cliente || ''}
                                    onChange={e => setFormRetira(f => ({ ...f, nome_cliente: e.target.value }))}
                                    className={inputCls} style={inputStyle}
                                    placeholder="Nome do cliente que retirou"
                                />
                            </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Pedido de Venda">
                                <input value={formRetira.pedido_venda} onChange={e => setFormRetira(f => ({ ...f, pedido_venda: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: PV-00123" />
                            </Field>
                            <Field label="Nota Fiscal">
                                <input value={formRetira.numero_nota_fiscal} onChange={e => setFormRetira(f => ({ ...f, numero_nota_fiscal: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 381469" />
                            </Field>
                        </div>
                        <Field label="Nº Pedido">
                            <input value={formRetira.numero_pedido} onChange={e => setFormRetira(f => ({ ...f, numero_pedido: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 123456" />
                        </Field>
                        <Field label="Observações">
                            <textarea value={formRetira.observacoes} onChange={e => setFormRetira(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Observações..." />
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
function DashboardVolume({ totais, carregamentos, carregamentosTerceiros = [], carregamentosRetira = [], mes }) {
    const pct = v => totais.totalGeral > 0 ? ((v / totais.totalGeral) * 100).toFixed(1) : '0.0';
    const tipoEntries = Object.entries(TIPOS);

    // Barras de progresso empilhadas
    const bars = tipoEntries.map(([key, t]) => ({
        key, t, v: totais[key] || 0, p: totais.total > 0 ? (totais[key] / totais.total) * 100 : 0,
    }));

    const freteTotal = carregamentos.reduce((s, r) => s + Number(r.valor_frete_calculado || 0), 0);

    const [expandido, setExpandido] = React.useState(false);
    const totalFrota     = totais.total;
    const totalTerceiros = carregamentosTerceiros.reduce((s,r) => s + (Number(r.quantidade)||0), 0);
    const totalRetiras   = carregamentosRetira.reduce((s,r) => s + (Number(r.quantidade)||0), 0);
    const totalGeral     = totalFrota + totalTerceiros + totalRetiras;

    return (
        <div className="flex flex-col gap-6">
            {/* ── Badge de total expandível ── */}
            <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ borderColor: 'var(--color-primary)' }}>
                <button
                    onClick={() => setExpandido(e => !e)}
                    className="w-full text-left px-5 py-4 text-white flex items-center justify-between gap-4"
                    style={{ background: 'var(--color-primary)' }}>
                    <div className="flex items-center gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide opacity-75">📦 Volume Total Carregado — todas as origens</p>
                            <p className="text-4xl font-black leading-none mt-1">{fmtNum(totalGeral)}</p>
                            <p className="text-xs opacity-60 mt-1">sacos · clique para {expandido ? 'recolher' : 'detalhar'}</p>
                        </div>
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                        <Icon name={expandido ? 'ChevronUp' : 'ChevronDown'} size={18} color="#fff" />
                    </div>
                </button>
                {expandido && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ divideColor: 'var(--color-border)' }}>
                        <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: '#EFF6FF' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                                <Icon name="Truck" size={18} color="#1D4ED8" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase" style={{ color: '#1E3A5F' }}>Frota Própria</p>
                                <p className="text-2xl font-black" style={{ color: '#1D4ED8' }}>{fmtNum(totalFrota)}</p>
                                <p className="text-xs" style={{ color: '#3B82F6' }}>{carregamentos.length} registros · aba Registros</p>
                            </div>
                        </div>
                        <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: '#FFFBEB' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF3C7' }}>
                                <Icon name="Users" size={18} color="#D97706" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase" style={{ color: '#92400E' }}>Terceiros</p>
                                <p className="text-2xl font-black" style={{ color: '#D97706' }}>{fmtNum(totalTerceiros)}</p>
                                <p className="text-xs" style={{ color: '#B45309' }}>{carregamentosTerceiros.length} registros · aba Terceiros</p>
                            </div>
                        </div>
                        <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: '#F0FDF4' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#DCFCE7' }}>
                                <Icon name="ShoppingBag" size={18} color="#059669" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase" style={{ color: '#065F46' }}>Retira de Clientes</p>
                                <p className="text-2xl font-black" style={{ color: '#059669' }}>{fmtNum(totalRetiras)}</p>
                                <p className="text-xs" style={{ color: '#059669' }}>aba Retira de Clientes</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Cards por tipo (frota própria) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
function TabelaCarregamentos({ carregamentos, isAdmin, onEdit, onDelete, onNovo }) {
    const [pesquisa, setPesquisa] = useState('');
    const carregamentosFiltrados = carregamentos.filter(r => {
        if (!pesquisa.trim()) return true;
        const q = pesquisa.toLowerCase();
        return (
            (r.numero_pedido || '').toLowerCase().includes(q) ||
            (r.numero_nota_fiscal || '').toLowerCase().includes(q) ||
            (r.motorista?.name || '').toLowerCase().includes(q) ||
            (r.destino || '').toLowerCase().includes(q) ||
            (r.veiculo?.placa || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-shrink-0" style={{ minWidth: '260px' }}>
                    <Icon name="Search" size={13} color="var(--color-muted-foreground)"
                        style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                        type="text"
                        value={pesquisa}
                        onChange={e => setPesquisa(e.target.value)}
                        placeholder="Pedido, NF, motorista, destino, placa..."
                        className="w-full pl-7 pr-7 py-2 rounded-lg border text-xs outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
                    />
                    {pesquisa && (
                        <button onClick={() => setPesquisa('')}
                            style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted-foreground)', fontSize: '13px', lineHeight: 1 }}>✕</button>
                    )}
                </div>
                {isAdmin && <Button onClick={onNovo} iconName="Plus" size="sm">Novo Carregamento</Button>}
            </div>
            {carregamentosFiltrados.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Package" size={36} color="var(--color-muted-foreground)" />
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum carregamento encontrado para o período'}</p>
                </div>
            ) : (
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
                    {carregamentosFiltrados.map((r, i) => {
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
            )}
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
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Building" size={36} color="var(--color-muted-foreground)" />
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum fornecedor cadastrado</p>
                    {isAdmin && <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Clique em "Novo Fornecedor" para adicionar</p>}
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
                            {f.observacoes && <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{f.observacoes}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Sub-componente: Tabela Terceiros ─────────────────────────────────────────
function TabelaTerceiros({ carregamentos, isAdmin, onNovo, onEdit, onDelete, fretosTerceiros = [], motoristas = [], mes }) {
    const [filtroMotoristaTer, setFiltroMotoristaTer] = useState('');

    // Calcula frete de cada carregamento: usa valor_frete_calculado se existir,
    // senão busca na tabela de fretes pelo destino
    const calcFrete = (r) => {
        if (r.valor_frete_calculado && Number(r.valor_frete_calculado) > 0) return Number(r.valor_frete_calculado);
        if (!r.destino) return 0;
        const entrada = fretosTerceiros.find(f => f.cidade.toLowerCase() === (r.destino || '').toLowerCase());
        if (entrada) return Number(entrada.frete_por_saco) * (Number(r.quantidade) || 0);
        return 0;
    };

    const totalSacos = carregamentos.reduce((s, r) => s + (Number(r.quantidade) || 0), 0);
    const totalFrete = carregamentos.reduce((s, r) => s + calcFrete(r), 0);

    // Agrupamento por motorista para o card de resumo
    const porMotorista = (() => {
        const map = {};
        carregamentos.forEach(r => {
            const key = r.motorista_id || '__sem_motorista__';
            const nome = r.motorista?.name || '—';
            const placa = r.veiculo?.placa || '—';
            if (!map[key]) map[key] = { nome, placa, sacos: 0, frete: 0, viagens: 0 };
            map[key].sacos  += Number(r.quantidade) || 0;
            map[key].frete  += calcFrete(r);
            map[key].viagens += 1;
        });
        return Object.values(map).sort((a, b) => b.frete - a.frete);
    })();

    const carr = filtroMotoristaTer
        ? carregamentos.filter(r => r.motorista_id === filtroMotoristaTer)
        : carregamentos;

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="p-3 rounded-xl text-xs font-medium flex items-center gap-2" style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                    <span>🚛</span>
                    <span>Carregamentos de <strong>veículos terceirizados</strong> — sem bonificações ou vínculo com a frota.</span>
                </div>
                {isAdmin && (
                    <Button onClick={onNovo} iconName="Plus" size="sm">Novo Carregamento Terceiro</Button>
                )}
            </div>

            {/* Cards de resumo do mês */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#B45309' }}>Total Sacos (mês)</p>
                    <p className="text-2xl font-black" style={{ color: '#D97706' }}>{totalSacos.toLocaleString('pt-BR')}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>{carregamentos.length} registros</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#065F46' }}>Frete Total (mês)</p>
                    <p className="text-2xl font-black" style={{ color: '#059669' }}>{BRL(totalFrete)}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#065F46' }}>soma dos fretes calculados</p>
                </div>
                <div className="rounded-xl p-4 border col-span-2" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1E3A5F' }}>Motoristas ativos (mês)</p>
                    <p className="text-2xl font-black" style={{ color: '#1D4ED8' }}>{porMotorista.length}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#1E3A5F' }}>motoristas com carregamentos</p>
                </div>
            </div>

            {/* Card de resumo por motorista */}
            {porMotorista.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm" style={{ borderColor: '#FDE68A' }}>
                    <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
                        <p className="text-sm font-semibold" style={{ color: '#92400E' }}>💰 Resumo por Motorista — {mes ? new Date(mes + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'mês atual'}</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[500px]">
                            <thead className="text-xs border-b" style={{ background: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
                                <tr>
                                    {['Motorista', 'Viagens', 'Total (sacos)', 'Frete Total'].map(h => (
                                        <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {porMotorista.map((m, i) => (
                                    <tr key={i} className="border-t hover:bg-amber-50 transition-colors cursor-pointer"
                                        style={{ borderColor: '#FDE68A', background: i % 2 === 0 ? '#fff' : '#FFFBEB' }}
                                        onClick={() => setFiltroMotoristaTer(prev => prev === Object.keys(carregamentos.reduce((acc, r) => { if (r.motorista?.name === m.nome) acc[r.motorista_id] = true; return acc; }, {}))[0] ? '' : carregamentos.find(r => r.motorista?.name === m.nome)?.motorista_id || '')}>
                                        <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{m.nome}</td>
                                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{m.viagens}</td>
                                        <td className="px-4 py-2.5 font-mono font-bold" style={{ color: '#D97706' }}>{m.sacos.toLocaleString('pt-BR')}</td>
                                        <td className="px-4 py-2.5 font-mono font-bold" style={{ color: '#059669' }}>{BRL(m.frete)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t" style={{ borderColor: '#FDE68A', backgroundColor: '#FEF3C7' }}>
                                    <td className="px-4 py-2.5 font-bold text-xs" style={{ color: '#92400E' }}>TOTAL</td>
                                    <td className="px-4 py-2.5 font-mono font-bold text-xs" style={{ color: '#92400E' }}>{carregamentos.length}</td>
                                    <td className="px-4 py-2.5 font-mono font-bold text-xs" style={{ color: '#D97706' }}>{totalSacos.toLocaleString('pt-BR')}</td>
                                    <td className="px-4 py-2.5 font-mono font-bold text-xs" style={{ color: '#059669' }}>{BRL(totalFrete)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Filtro por motorista */}
            {motoristas.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Filtrar:</span>
                    <button onClick={() => setFiltroMotoristaTer('')}
                        className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                        style={!filtroMotoristaTer
                            ? { backgroundColor: '#D97706', color: '#fff', borderColor: '#D97706' }
                            : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        Todos
                    </button>
                    {motoristas.map(m => (
                        <button key={m.id} onClick={() => setFiltroMotoristaTer(prev => prev === m.id ? '' : m.id)}
                            className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                            style={filtroMotoristaTer === m.id
                                ? { backgroundColor: '#D97706', color: '#fff', borderColor: '#D97706' }
                                : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            {m.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Tabela de carregamentos */}
            {carr.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Users" size={36} color="var(--color-muted-foreground)" />
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                        {filtroMotoristaTer ? 'Nenhum carregamento para este motorista no período' : 'Nenhum carregamento de terceiros no período'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: '#FDE68A' }}>
                    <table className="w-full text-sm min-w-[750px]">
                        <thead className="text-xs border-b" style={{ background: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
                            <tr>
                                {['Data', 'Motorista', 'Placa', 'Tipo', 'Fornecedor/Origem', 'Destino', 'Pedido', 'NF', 'Qtd (sacos)', 'Frete', ''].map(h => (
                                    <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {carr.map((r, i) => {
                                const { tipo, nome } = parseTipo(r);
                                const frete = calcFrete(r);
                                return (
                                    <tr key={r.id} className="border-t hover:bg-amber-50 transition-colors"
                                        style={{ borderColor: '#FDE68A', background: i % 2 === 0 ? '#fff' : '#FFFBEB' }}>
                                        <td className="px-3 py-2.5 whitespace-nowrap">{FMT(r.data_carregamento)}</td>
                                        <td className="px-3 py-2.5 text-xs font-medium">{r.motorista?.name || '—'}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{r.veiculo?.placa || '—'}</td>
                                        <td className="px-3 py-2.5"><TipoBadge tipo={tipo} /></td>
                                        <td className="px-3 py-2.5 max-w-[130px] truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{nome || '—'}</td>
                                        <td className="px-3 py-2.5 text-xs max-w-[120px] truncate">{r.destino || '—'}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{r.numero_pedido || '—'}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{r.numero_nota_fiscal || '—'}</td>
                                        <td className="px-3 py-2.5 font-bold font-mono whitespace-nowrap" style={{ color: '#D97706' }}>{(Number(r.quantidade)||0).toLocaleString('pt-BR')}</td>
                                        <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap" style={{ color: '#059669' }}>{frete > 0 ? BRL(frete) : '—'}</td>
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
            )}
        </div>
    );
}

// ─── Sub-componente: Retira de Clientes na Fábrica ───────────────────────────
function TabelaRetira({ carregamentos, isAdmin, onNovo, onEdit, onDelete, veiculos, motoristas }) {
    const totalSacos = carregamentos.reduce((s, r) => s + (Number(r.quantidade) || 0), 0);

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="p-3 rounded-xl text-xs font-medium flex items-center gap-2" style={{ backgroundColor: '#F0FDF4', color: '#065F46', border: '1px solid #BBF7D0' }}>
                    <span>🏭</span>
                    <span>Retira de clientes na fábrica — apenas volume, <strong>sem frete e sem bonificações</strong>.</span>
                </div>
                {isAdmin && (
                    <Button onClick={onNovo} iconName="Plus" size="sm">Nova Retira</Button>
                )}
            </div>

            {/* Cards de resumo */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#065F46' }}>Total Sacos (mês)</p>
                    <p className="text-2xl font-black" style={{ color: '#059669' }}>{totalSacos.toLocaleString('pt-BR')}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#065F46' }}>{carregamentos.length} registros</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#065F46' }}>Média por retira</p>
                    <p className="text-2xl font-black" style={{ color: '#059669' }}>
                        {carregamentos.length > 0 ? Math.round(totalSacos / carregamentos.length).toLocaleString('pt-BR') : '—'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#065F46' }}>sacos por operação</p>
                </div>
            </div>

            {carregamentos.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="ShoppingBag" size={36} color="var(--color-muted-foreground)" />
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma retira registrada no período</p>
                    {isAdmin && <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Clique em "Nova Retira" para adicionar</p>}
                </div>
            ) : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: '#BBF7D0' }}>
                    <table className="w-full text-sm min-w-[750px]">
                        <thead className="text-xs border-b" style={{ background: '#F0FDF4', borderColor: '#BBF7D0', color: '#065F46' }}>
                            <tr>
                                {['Data', 'Cliente/Origem', 'Motorista', 'Placa', 'Pedido Venda', 'NF', 'Nº Pedido', 'Qtd (sacos)', ''].map(h => (
                                    <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {carregamentos.map((r, i) => {
                                const { nome } = parseTipo(r);
                                return (
                                    <tr key={r.id} className="border-t hover:bg-green-50 transition-colors"
                                        style={{ borderColor: '#BBF7D0', background: i % 2 === 0 ? '#fff' : '#F0FDF4' }}>
                                        <td className="px-3 py-2.5 whitespace-nowrap">{FMT(r.data_carregamento)}</td>
                                        <td className="px-3 py-2.5 text-xs font-medium max-w-[140px] truncate">{nome || r.empresa_origem || '—'}</td>
                                        <td className="px-3 py-2.5 text-xs">{r.motorista?.name || '—'}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{r.veiculo?.placa || '—'}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs font-semibold" style={{ color: '#059669' }}>{r.pedido_venda || '—'}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{r.numero_nota_fiscal || '—'}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{r.numero_pedido || '—'}</td>
                                        <td className="px-3 py-2.5 font-bold font-mono whitespace-nowrap" style={{ color: '#059669' }}>{(Number(r.quantidade) || 0).toLocaleString('pt-BR')}</td>
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
            )}
        </div>
    );
}
