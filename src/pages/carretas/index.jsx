import React, { useState, useEffect, useCallback, useMemo } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { fetchCorredores, CORREDORES_PADRAO } from 'utils/corredoresService';
import {
    fetchViagens, createViagem, updateViagem, deleteViagem,
    fetchCarretasVeiculos, createCarretaVeiculo, updateCarretaVeiculo, deleteCarretaVeiculo,
    fetchAbastecimentos, createAbastecimento, deleteAbastecimento,
    fetchChecklists, createChecklist, aprovarChecklist, registrarManutencaoChecklist,
    fetchCarregamentos, createCarregamento, updateCarregamento, deleteCarregamento,
    fetchEmpresas, createEmpresa, deleteEmpresa,
    fetchCarreteiros, fetchTodosMotoristas,
    fetchConfigAbastecimento, saveConfigAbastecimento,
    CHECKLIST_ITENS, TIPOS_CALCULO_FRETE, calcularFrete, calcularBonusCarreteiro,
    CIDADES_BONUS_BAIXO, BONUS_BAIXO, BONUS_ALTO,
} from 'utils/carretasService';
import * as XLSX from 'xlsx';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT_DATE = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const STATUS_VIAGEM = ['Agendado', 'Em processamento', 'Aguardando no pátio', 'Em trânsito', 'Entrega finalizada', 'Cancelado'];
const STATUS_COLORS = {
    'Agendado':            { bg: '#EFF6FF', text: '#1D4ED8' },
    'Em processamento':    { bg: '#FEF9C3', text: '#B45309' },
    'Aguardando no pátio': { bg: '#FEE2E2', text: '#B91C1C' },
    'Em trânsito':         { bg: '#D1FAE5', text: '#065F46' },
    'Entrega finalizada':  { bg: '#F0FDF4', text: '#15803D' },
    'Cancelado':           { bg: '#F3F4F6', text: '#6B7280' },
};
const TIPO_COMPOSICAO = ['Cavalo + Carreta', 'Truck', 'Toco', 'Bitrem', 'Outro'];
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

function ModalOverlay({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {children}
            </div>
        </div>
    );
}

function ModalHeader({ title, icon, onClose }) {
    return (
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: '#EFF6FF' }}>
                    <Icon name={icon} size={18} color="#1D4ED8" />
                </div>
                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
            </button>
        </div>
    );
}

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

const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500";
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

// ─── TAB: Viagens ────────────────────────────────────────────────────────────
function TabViagens({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const [viagens, setViagens] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | {mode:'create'|'edit', data?}
    const [filterStatus, setFilterStatus] = useState('');
    const [form, setForm] = useState({
        status: 'Agendado', motorista_id: '', veiculo_id: '',
        data_saida: '', destino: '', toneladas: '', responsavel_cadastro: '', observacoes: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [v, ve, m] = await Promise.all([
                fetchViagens(filterStatus ? { status: filterStatus } : {}),
                fetchCarretasVeiculos(),
                fetchTodosMotoristas(),
            ]);
            setViagens(v); setVeiculos(ve); setMotoristas(m);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filterStatus]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setForm({ status: 'Agendado', motorista_id: '', veiculo_id: '', data_saida: '', destino: '', toneladas: '', responsavel_cadastro: '', observacoes: '' });
        setModal({ mode: 'create' });
    };
    const openEdit = (v) => {
        setForm({ status: v.status, motorista_id: v.motorista_id || '', veiculo_id: v.veiculo_id || '', data_saida: v.data_saida || '', destino: v.destino || '', toneladas: v.toneladas || '', responsavel_cadastro: v.responsavel_cadastro || '', observacoes: v.observacoes || '' });
        setModal({ mode: 'edit', data: v });
    };
    const handleSubmit = async () => {
        if (!form.destino) { showToast('Destino é obrigatório', 'error'); return; }
        try {
            if (modal.mode === 'create') await createViagem(form);
            else await updateViagem(modal.data.id, form);
            showToast(modal.mode === 'create' ? 'Viagem cadastrada!' : 'Viagem atualizada!', 'success');
            setModal(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDelete = async (id) => {
        if (!confirm('Excluir esta viagem?')) return;
        try { await deleteViagem(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const exportar = () => {
        const rows = viagens.map(v => ({
            'Número': v.numero, 'Status': v.status,
            'Motorista': v.motorista?.name || '', 'Placa': v.veiculo?.placa || '',
            'Data Saída': FMT_DATE(v.data_saida), 'Destino': v.destino || '',
            'Responsável': v.responsavel_cadastro || '', 'Obs': v.observacoes || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Viagens');
        XLSX.writeFile(wb, `viagens_carretas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
    };

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2 flex-wrap">
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos os status</option>
                        {STATUS_VIAGEM.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar
                    </button>
                    <Button onClick={openCreate} iconName="Plus" size="sm">Nova Viagem</Button>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-16"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>
                                {['Nº Viagem','Status','Motorista','Placa','Data Saída','Destino','Ton.','Responsável',''].map(h => (
                                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {viagens.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem cadastrada</td></tr>
                            ) : viagens.map((v, i) => (
                                <tr key={v.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-4 py-3 font-medium text-blue-700 font-data">{v.numero}</td>
                                    <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                                    <td className="px-4 py-3">{v.motorista?.name || '—'}</td>
                                    <td className="px-4 py-3 font-data">{v.veiculo?.placa || '—'}</td>
                                    <td className="px-4 py-3">{FMT_DATE(v.data_saida)}</td>
                                    <td className="px-4 py-3">{v.destino || '—'}</td>
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{v.responsavel_cadastro || '—'}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openEdit(v)} className="p-1.5 rounded hover:bg-blue-50 transition-colors"><Icon name="Pencil" size={14} color="#1D4ED8" /></button>
                                            {isAdmin && <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors"><Icon name="Trash2" size={14} color="#DC2626" /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modal && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <ModalHeader title={modal.mode === 'create' ? 'Nova Viagem' : 'Editar Viagem'} icon="Navigation" onClose={() => setModal(null)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Status" required>
                            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls} style={inputStyle}>
                                {STATUS_VIAGEM.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </Field>
                        <Field label="Responsável pelo cadastro">
                            <select value={form.responsavel_cadastro} onChange={e => setForm(f => ({ ...f, responsavel_cadastro: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {RESPONSAVEIS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </Field>
                        <Field label="Motorista">
                            <select value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Veículo (placa)">
                            <select value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </select>
                        </Field>
                        <Field label="Data de saída">
                            <input type="date" value={form.data_saida} onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))} className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Destino" required>
                            <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Cidade de destino" />
                        </Field>
                        <Field label="Toneladas transportadas">
                            <input type="number" step="0.001" value={form.toneladas} onChange={e => setForm(f => ({ ...f, toneladas: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 28.5" />
                        </Field>
                        <Field label="Observações">
                            <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={3} placeholder="Observações gerais..." />
                        </Field>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Veículos ────────────────────────────────────────────────────────────
function TabVeiculos({ isAdmin }) {
    const { toast, showToast } = useToast();
    const [veiculos, setVeiculos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({ placa: '', marca: '', modelo: '', ano_fabricacao: '', tipo_composicao: 'Cavalo + Carreta', capacidade_carga: '', media_consumo: '', capacidade_tanque: '', observacoes: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try { setVeiculos(await fetchCarretasVeiculos()); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, []); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setForm({ placa: '', marca: '', modelo: '', ano_fabricacao: '', tipo_composicao: 'Cavalo + Carreta', capacidade_carga: '', media_consumo: '', capacidade_tanque: '', observacoes: '' });
        setModal({ mode: 'create' });
    };
    const openEdit = (v) => {
        setForm({ placa: v.placa, marca: v.marca, modelo: v.modelo, ano_fabricacao: v.ano_fabricacao || '', tipo_composicao: v.tipo_composicao || 'Cavalo + Carreta', capacidade_carga: v.capacidade_carga || '', media_consumo: v.media_consumo || '', capacidade_tanque: v.capacidade_tanque || '', observacoes: v.observacoes || '' });
        setModal({ mode: 'edit', data: v });
    };
    const handleSubmit = async () => {
        if (!form.placa || !form.marca || !form.modelo) { showToast('Placa, marca e modelo são obrigatórios', 'error'); return; }
        try {
            if (modal.mode === 'create') await createCarretaVeiculo(form);
            else await updateCarretaVeiculo(modal.data.id, form);
            showToast('Veículo salvo!', 'success'); setModal(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDelete = async (id) => {
        if (!confirm('Excluir veículo?')) return;
        try { await deleteCarretaVeiculo(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div>
            <div className="flex justify-end mb-5">
                {isAdmin && <Button onClick={openCreate} iconName="Plus" size="sm">Novo Veículo</Button>}
            </div>
            {loading ? <div className="flex justify-center py-16"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {veiculos.length === 0 ? (
                        <div className="col-span-3 text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum veículo cadastrado</div>
                    ) : veiculos.map(v => (
                        <div key={v.id} className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="font-bold text-lg font-data" style={{ color: 'var(--color-text-primary)' }}>{v.placa}</p>
                                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{v.marca} {v.modelo} {v.ano_fabricacao ? `(${v.ano_fabricacao})` : ''}</p>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>{v.tipo_composicao}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                                {v.capacidade_carga && <div><p className="text-gray-400">Carga</p><p className="font-medium">{v.capacidade_carga} t</p></div>}
                                {v.media_consumo && <div><p className="text-gray-400">Consumo</p><p className="font-medium">{v.media_consumo} km/l</p></div>}
                                {v.capacidade_tanque && <div><p className="text-gray-400">Tanque</p><p className="font-medium">{v.capacidade_tanque} L</p></div>}
                            </div>
                            {isAdmin && (
                                <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    <button onClick={() => openEdit(v)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Icon name="Pencil" size={12} />Editar</button>
                                    <button onClick={() => handleDelete(v.id)} className="flex items-center gap-1 text-xs text-red-500 hover:underline"><Icon name="Trash2" size={12} />Excluir</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {modal && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <ModalHeader title={modal.mode === 'create' ? 'Novo Veículo' : 'Editar Veículo'} icon="Truck" onClose={() => setModal(null)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Placa" required><input value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))} className={inputCls} style={inputStyle} placeholder="ABC-1234" /></Field>
                        <Field label="Marca" required><input value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Volvo, Scania..." /></Field>
                        <Field label="Modelo" required><input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} className={inputCls} style={inputStyle} placeholder="FH 540..." /></Field>
                        <Field label="Ano de fabricação"><input type="number" value={form.ano_fabricacao} onChange={e => setForm(f => ({ ...f, ano_fabricacao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="2020" /></Field>
                        <Field label="Tipo de composição">
                            <select value={form.tipo_composicao} onChange={e => setForm(f => ({ ...f, tipo_composicao: e.target.value }))} className={inputCls} style={inputStyle}>
                                {TIPO_COMPOSICAO.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </Field>
                        <Field label="Cap. carga (t)"><input type="number" step="0.1" value={form.capacidade_carga} onChange={e => setForm(f => ({ ...f, capacidade_carga: e.target.value }))} className={inputCls} style={inputStyle} placeholder="30" /></Field>
                        <Field label="Média consumo (km/l)"><input type="number" step="0.1" value={form.media_consumo} onChange={e => setForm(f => ({ ...f, media_consumo: e.target.value }))} className={inputCls} style={inputStyle} placeholder="2.5" /></Field>
                        <Field label="Cap. tanque (L)"><input type="number" step="1" value={form.capacidade_tanque} onChange={e => setForm(f => ({ ...f, capacidade_tanque: e.target.value }))} className={inputCls} style={inputStyle} placeholder="600" /></Field>
                        <div className="sm:col-span-2">
                            <Field label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Abastecimentos ──────────────────────────────────────────────────────
function TabAbastecimentos({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const [abast, setAbast] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [filtro, setFiltro] = useState({ motoristaId: '', veiculoId: '', mes: '' });
    const [form, setForm] = useState({ motorista_id: '', veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', observacoes: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.motoristaId) f.motoristaId = filtro.motoristaId;
            if (filtro.veiculoId)   f.veiculoId   = filtro.veiculoId;
            if (filtro.mes)         { f.dataInicio = filtro.mes + '-01'; f.dataFim = filtro.mes + '-31'; }
            const [a, v, m] = await Promise.all([fetchAbastecimentos(f), fetchCarretasVeiculos(), fetchTodosMotoristas()]);
            setAbast(a); setVeiculos(v); setMotoristas(m);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const totais = useMemo(() => ({
        litrosDiesel: abast.reduce((s, a) => s + Number(a.litros_diesel || 0), 0),
        litrosArla:   abast.reduce((s, a) => s + Number(a.litros_arla   || 0), 0),
        valorTotal:   abast.reduce((s, a) => s + Number(a.valor_total   || 0), 0),
    }), [abast]);

    const handleSubmit = async () => {
        if (!form.veiculo_id || !form.motorista_id || !form.data_abastecimento) { showToast('Preencha veículo, motorista e data', 'error'); return; }
        try { await createAbastecimento(form); showToast('Abastecimento registrado!', 'success'); setModal(false); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDelete = async (id) => {
        if (!confirm('Excluir registro?')) return;
        try { await deleteAbastecimento(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const exportar = () => {
        const rows = abast.map(a => ({
            'Data': FMT_DATE(a.data_abastecimento), 'Motorista': a.motorista?.name || '', 'Placa': a.veiculo?.placa || '',
            'Posto': a.posto || '', 'L. Diesel': a.litros_diesel, 'R$ Diesel': a.valor_diesel,
            'L. Arla': a.litros_arla || 0, 'R$ Arla': a.valor_arla || 0, 'Total R$': a.valor_total,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Abastecimentos');
        XLSX.writeFile(wb, `abastecimentos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    {isAdmin && (
                        <select value={filtro.motoristaId} onChange={e => setFiltro(f => ({ ...f, motoristaId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todos motoristas</option>
                            {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    )}
                    <select value={filtro.veiculoId} onChange={e => setFiltro(f => ({ ...f, veiculoId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos veículos</option>
                        {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                    </select>
                    <input type="month" value={filtro.mes} onChange={e => setFiltro(f => ({ ...f, mes: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                </div>
                <div className="flex gap-2">
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}><Icon name="FileDown" size={14} /> Exportar</button>
                    <Button onClick={() => { setForm({ motorista_id: profile?.id || '', veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', observacoes: '' }); setModal(true); }} iconName="Plus" size="sm">Registrar</Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                    { l: 'Total Diesel (L)', v: totais.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#1D4ED8', bg: '#EFF6FF', i: 'Fuel' },
                    { l: 'Total Arla (L)',   v: totais.litrosArla.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#059669', bg: '#D1FAE5', i: 'Droplets' },
                    { l: 'Gasto Total',       v: BRL(totais.valorTotal), c: '#7C3AED', bg: '#EDE9FE', i: 'DollarSign' },
                ].map(k => (
                    <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}><Icon name={k.i} size={14} color={k.c} /></div>
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                        </div>
                        <p className="text-lg font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                    </div>
                ))}
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Data','Motorista','Placa','Posto','Diesel (L)','R$ Diesel','Arla (L)','Total',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {abast.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum abastecimento registrado</td></tr>
                            : abast.map((a, i) => (
                                <tr key={a.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-4 py-3">{FMT_DATE(a.data_abastecimento)}</td>
                                    <td className="px-4 py-3">{a.motorista?.name || '—'}</td>
                                    <td className="px-4 py-3 font-data">{a.veiculo?.placa || '—'}</td>
                                    <td className="px-4 py-3 text-xs">{a.posto || '—'}</td>
                                    <td className="px-4 py-3 font-data text-right">{Number(a.litros_diesel || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                    <td className="px-4 py-3 font-data text-right">{BRL(a.valor_diesel)}</td>
                                    <td className="px-4 py-3 font-data text-right text-emerald-600">{Number(a.litros_arla || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                    <td className="px-4 py-3 font-data text-right font-semibold text-purple-600">{BRL(a.valor_total)}</td>
                                    <td className="px-4 py-3">{isAdmin && <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={13} color="#DC2626" /></button>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modal && (
                <ModalOverlay onClose={() => setModal(false)}>
                    <ModalHeader title="Registrar Abastecimento" icon="Fuel" onClose={() => setModal(false)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {isAdmin && (
                            <Field label="Motorista" required>
                                <select value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </Field>
                        )}
                        <Field label="Veículo" required>
                            <select value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </select>
                        </Field>
                        <Field label="Data" required><input type="date" value={form.data_abastecimento} onChange={e => setForm(f => ({ ...f, data_abastecimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="Horário"><input type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="Posto"><input value={form.posto} onChange={e => setForm(f => ({ ...f, posto: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Nome do posto" /></Field>
                        <div />
                        <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                            <p className="text-xs font-semibold text-blue-700 mb-3">🛢️ Diesel</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Litros diesel"><input type="number" step="0.01" value={form.litros_diesel} onChange={e => setForm(f => ({ ...f, litros_diesel: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                <Field label="Valor R$"><input type="number" step="0.01" value={form.valor_diesel} onChange={e => setForm(f => ({ ...f, valor_diesel: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                            </div>
                        </div>
                        <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                            <p className="text-xs font-semibold text-emerald-700 mb-3">💧 ARLA 32</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Litros arla"><input type="number" step="0.01" value={form.litros_arla} onChange={e => setForm(f => ({ ...f, litros_arla: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                <Field label="Valor R$"><input type="number" step="0.01" value={form.valor_arla} onChange={e => setForm(f => ({ ...f, valor_arla: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                            </div>
                        </div>
                        <div className="sm:col-span-2">
                            <Field label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Checklist ───────────────────────────────────────────────────────────
function TabChecklist({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const [checklists, setChecklists] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [modalManut, setModalManut] = useState(null);
    const [obsManut, setObsManut] = useState('');
    const [filtro, setFiltro] = useState('pendentes');
    const [form, setForm] = useState({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [c, v, m] = await Promise.all([fetchChecklists(filtro === 'pendentes' ? { pendente: true } : {}), fetchCarretasVeiculos(), fetchTodosMotoristas()]);
            setChecklists(c); setVeiculos(v); setMotoristas(m);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const handleSubmit = async () => {
        if (!form.veiculo_id) { showToast('Selecione o veículo', 'error'); return; }
        const semana = new Date(); semana.setDate(semana.getDate() - semana.getDay() + 1);
        try {
            await createChecklist({ ...form, motorista_id: profile.id, semana_ref: semana.toISOString().split('T')[0] });
            showToast('Checklist enviado!', 'success'); setModal(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleAprovar = async (id) => {
        try { await aprovarChecklist(id, profile.id); showToast('Aprovado!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleManutencao = async () => {
        if (!obsManut.trim()) { showToast('Descreva a manutenção', 'error'); return; }
        try { await registrarManutencaoChecklist(modalManut, obsManut); showToast('Manutenção registrada!', 'success'); setModalManut(null); setObsManut(''); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
                <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    {[['pendentes','Pendentes'], ['todos','Todos']].map(([v, l]) => (
                        <button key={v} onClick={() => setFiltro(v)} className="px-4 py-2 text-xs font-medium transition-colors"
                            style={filtro === v ? { backgroundColor: 'var(--color-primary)', color: '#fff' } : { backgroundColor: 'white', color: 'var(--color-muted-foreground)' }}>{l}</button>
                    ))}
                </div>
                <Button onClick={() => { setForm({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '' }); setModal(true); }} iconName="ClipboardCheck" size="sm">Novo Checklist</Button>
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="flex flex-col gap-4">
                    {checklists.length === 0 && <div className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum checklist encontrado</div>}
                    {checklists.map(c => {
                        const itens = c.itens || {};
                        const ok = Object.values(itens).filter(Boolean).length;
                        const total = CHECKLIST_ITENS.length;
                        return (
                            <div key={c.id} className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{c.motorista?.name || '—'}</p>
                                            <span className="text-xs font-data text-gray-400">— {c.veiculo?.placa || '—'}</span>
                                        </div>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                            Semana de {c.semana_ref ? new Date(c.semana_ref + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {c.aprovado
                                            ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><Icon name="CheckCircle2" size={11} />Aprovado</span>
                                            : <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Icon name="Clock" size={11} />Pendente</span>
                                        }
                                        {c.manutencao_registrada && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><Icon name="Wrench" size={11} />Manutenção</span>}
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span style={{ color: 'var(--color-muted-foreground)' }}>Itens verificados</span>
                                        <span className="font-medium">{ok}/{total}</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${(ok / total) * 100}%`, backgroundColor: ok === total ? '#059669' : ok >= total * 0.7 ? '#D97706' : '#DC2626' }} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 mb-3">
                                    {CHECKLIST_ITENS.map(item => (
                                        <div key={item.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ backgroundColor: itens[item.id] ? '#D1FAE5' : '#FEE2E2' }}>
                                            <Icon name={itens[item.id] ? 'Check' : 'X'} size={10} color={itens[item.id] ? '#059669' : '#DC2626'} />
                                            <span style={{ color: itens[item.id] ? '#065F46' : '#991B1B' }}>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                                {(c.problemas || c.necessidades || c.observacoes_livres) && (
                                    <div className="text-xs space-y-1 mb-3 p-3 rounded-lg bg-gray-50">
                                        {c.problemas && <p><span className="font-medium text-gray-500">Problemas:</span> {c.problemas}</p>}
                                        {c.necessidades && <p><span className="font-medium text-gray-500">Necessidades:</span> {c.necessidades}</p>}
                                        {c.observacoes_livres && <p><span className="font-medium text-gray-500">Obs:</span> {c.observacoes_livres}</p>}
                                    </div>
                                )}
                                {isAdmin && !c.aprovado && (
                                    <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                        <button onClick={() => handleAprovar(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"><Icon name="CheckCircle2" size={13} />Aprovar</button>
                                        <button onClick={() => { setModalManut(c.id); setObsManut(''); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-300 text-orange-700 hover:bg-orange-50 transition-colors"><Icon name="Wrench" size={13} />Registrar Manutenção</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {modal && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <ModalHeader title="Checklist Semanal" icon="ClipboardCheck" onClose={() => setModal(null)} />
                    <div className="p-5 space-y-4">
                        <Field label="Veículo" required>
                            <select value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </select>
                        </Field>
                        <div>
                            <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>Itens verificados</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {CHECKLIST_ITENS.map(item => (
                                    <label key={item.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                                        <input type="checkbox" checked={!!form.itens[item.id]} onChange={e => setForm(f => ({ ...f, itens: { ...f.itens, [item.id]: e.target.checked } }))} className="accent-blue-600" />
                                        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{item.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <Field label="Problemas identificados"><textarea value={form.problemas} onChange={e => setForm(f => ({ ...f, problemas: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Descreva problemas encontrados..." /></Field>
                        <Field label="Necessidades / peças"><textarea value={form.necessidades} onChange={e => setForm(f => ({ ...f, necessidades: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Pneus, cintas, etc..." /></Field>
                        <Field label="Observações livres"><textarea value={form.observacoes_livres} onChange={e => setForm(f => ({ ...f, observacoes_livres: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Send">Enviar Checklist</Button>
                    </div>
                </ModalOverlay>
            )}

            {modalManut && (
                <ModalOverlay onClose={() => setModalManut(null)}>
                    <ModalHeader title="Registrar Manutenção" icon="Wrench" onClose={() => setModalManut(null)} />
                    <div className="p-5">
                        <Field label="Descreva a manutenção necessária" required>
                            <textarea value={obsManut} onChange={e => setObsManut(e.target.value)} className={inputCls} style={inputStyle} rows={4} placeholder="Detalhes da manutenção..." />
                        </Field>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModalManut(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleManutencao} size="sm" iconName="Wrench">Registrar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Carregamentos ───────────────────────────────────────────────────────
function TabCarregamentos({ isAdmin }) {
    const { toast, showToast } = useToast();
    const [carregamentos, setCarregamentos] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [filtro, setFiltro] = useState({ empresaId: '', mes: '' });
    const [form, setForm] = useState({ motorista_id: '', veiculo_id: '', empresa_id: '', data_carregamento: new Date().toISOString().split('T')[0], numero_pedido: '', numero_nota_fiscal: '', destino: '', quantidade: '', unidade_quantidade: 'saco', empresa_origem: '', tipo_calculo_frete: 'por_saco', valor_base_frete: '', observacoes: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.empresaId) f.empresaId = filtro.empresaId;
            if (filtro.mes) { f.dataInicio = filtro.mes + '-01'; f.dataFim = filtro.mes + '-31'; }
            const [c, v, m, e] = await Promise.all([fetchCarregamentos(f), fetchCarretasVeiculos(), fetchTodosMotoristas(), fetchEmpresas()]);
            setCarregamentos(c); setVeiculos(v); setMotoristas(m); setEmpresas(e);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const totais = useMemo(() => ({
        carregamentos: carregamentos.length,
        freteTotal: carregamentos.reduce((s, c) => s + Number(c.valor_frete_calculado || 0), 0),
    }), [carregamentos]);

    // Para frete por km, precisamos do consumo do veículo selecionado
    const veiculoSelecionado = useMemo(() => veiculos.find(v => v.id === form.veiculo_id), [veiculos, form.veiculo_id]);
    const previewFrete = useMemo(() => calcularFrete(form.tipo_calculo_frete, form.quantidade, form.valor_base_frete, veiculoSelecionado?.media_consumo), [form.tipo_calculo_frete, form.quantidade, form.valor_base_frete, veiculoSelecionado]);

    const handleSubmit = async () => {
        if (!form.destino || !form.data_carregamento) { showToast('Destino e data são obrigatórios', 'error'); return; }
        const payload = { ...form, _consumoVeiculo: veiculoSelecionado?.media_consumo };
        try {
            if (modal.mode === 'create') await createCarregamento(payload);
            else await updateCarregamento(modal.data.id, payload);
            showToast('Carregamento salvo!', 'success'); setModal(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDelete = async (id) => {
        if (!confirm('Excluir?')) return;
        try { await deleteCarregamento(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const exportar = () => {
        const rows = carregamentos.map(c => ({
            'Data': FMT_DATE(c.data_carregamento), 'Pedido': c.numero_pedido || '', 'Motorista': c.motorista?.name || '',
            'Placa': c.veiculo?.placa || '', 'Empresa': c.empresa?.nome || '', 'Destino': c.destino || '',
            'Qtd': c.quantidade || 0, 'Unidade': c.unidade_quantidade || '', 'Tipo Frete': c.tipo_calculo_frete || '',
            'Base Frete': c.valor_base_frete || 0, 'Frete Calc.': c.valor_frete_calculado || 0,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Carregamentos');
        XLSX.writeFile(wb, `carregamentos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
    };

    const openCreate = () => {
        setForm({ motorista_id: '', veiculo_id: '', empresa_id: '', data_carregamento: new Date().toISOString().split('T')[0], numero_pedido: '', numero_nota_fiscal: '', destino: '', quantidade: '', unidade_quantidade: 'saco', empresa_origem: '', tipo_calculo_frete: 'por_saco', valor_base_frete: '', observacoes: '' });
        setModal({ mode: 'create' });
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <select value={filtro.empresaId} onChange={e => setFiltro(f => ({ ...f, empresaId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todas empresas</option>
                        {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                    <input type="month" value={filtro.mes} onChange={e => setFiltro(f => ({ ...f, mes: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                </div>
                <div className="flex gap-2">
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}><Icon name="FileDown" size={14} /> Exportar</button>
                    <Button onClick={openCreate} iconName="Plus" size="sm">Novo Carregamento</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
                {[
                    { l: 'Carregamentos', v: totais.carregamentos, c: '#1D4ED8', bg: '#EFF6FF', i: 'Package' },
                    { l: 'Frete Total',   v: BRL(totais.freteTotal), c: '#7C3AED', bg: '#EDE9FE', i: 'DollarSign' },
                ].map(k => (
                    <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}><Icon name={k.i} size={14} color={k.c} /></div>
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                        </div>
                        <p className="text-lg font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                    </div>
                ))}
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Data','Motorista','Placa','Empresa','Destino','Qtd','Frete',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {carregamentos.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum carregamento registrado</td></tr>
                            : carregamentos.map((c, i) => (
                                <tr key={c.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-4 py-3">{FMT_DATE(c.data_carregamento)}</td>
                                    <td className="px-4 py-3 text-xs">
                                        {c.numero_pedido ? <span className="font-data">{c.numero_pedido}</span> : '—'}
                                        {c.numero_nota_fiscal && <span className="block text-gray-400">NF: {c.numero_nota_fiscal}</span>}
                                    </td>
                                    <td className="px-4 py-3">{c.motorista?.name || '—'}</td>
                                    <td className="px-4 py-3 font-data">{c.veiculo?.placa || '—'}</td>
                                    <td className="px-4 py-3 text-xs">{c.empresa?.nome || '—'}</td>
                                    <td className="px-4 py-3">{c.destino}</td>
                                    <td className="px-4 py-3 font-data text-right">{c.quantidade} {c.unidade_quantidade}</td>
                                    <td className="px-4 py-3 font-data text-right font-semibold text-purple-600">{BRL(c.valor_frete_calculado)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            {isAdmin && <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={13} color="#DC2626" /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modal && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <ModalHeader title="Novo Carregamento" icon="Package" onClose={() => setModal(null)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Motorista"><select value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}><option value="">Selecione...</option>{motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
                        <Field label="Veículo"><select value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}><option value="">Selecione...</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}</select></Field>
                        <Field label="Empresa (frete)" required><select value={form.empresa_id} onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))} className={inputCls} style={inputStyle}><option value="">Selecione...</option>{empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Field>
                        <Field label="Empresa de origem"><input value={form.empresa_origem} onChange={e => setForm(f => ({ ...f, empresa_origem: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Votorantim" /></Field>
                        <Field label="Data" required><input type="date" value={form.data_carregamento} onChange={e => setForm(f => ({ ...f, data_carregamento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="Nº do pedido"><input value={form.numero_pedido} onChange={e => setForm(f => ({ ...f, numero_pedido: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="Nº da nota fiscal"><input value={form.numero_nota_fiscal || ''} onChange={e => setForm(f => ({ ...f, numero_nota_fiscal: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="Destino" required><input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Cidade de destino" /></Field>
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Quantidade"><input type="number" step="0.01" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                            <Field label="Unidade"><select value={form.unidade_quantidade} onChange={e => setForm(f => ({ ...f, unidade_quantidade: e.target.value }))} className={inputCls} style={inputStyle}><option value="saco">Saco</option><option value="tonelada">Tonelada</option><option value="carga">Carga</option></select></Field>
                        </div>
                        <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#C4B5FD', backgroundColor: '#FAF5FF' }}>
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
                                <div className="mt-3 p-2 rounded-lg bg-purple-600 text-white text-sm font-semibold flex items-center justify-between">
                                    <span>Frete calculado:</span>
                                    <span className="font-data">{BRL(previewFrete)}</span>
                                </div>
                            )}
                        </div>
                        <div className="sm:col-span-2"><Field label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field></div>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Empresas ────────────────────────────────────────────────────────────
function TabEmpresas({ isAdmin }) {
    const { toast, showToast } = useToast();
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState({ nome: '', cnpj: '', observacoes: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try { setEmpresas(await fetchEmpresas()); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, []); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const handleSubmit = async () => {
        if (!form.nome.trim()) { showToast('Nome é obrigatório', 'error'); return; }
        try { await createEmpresa(form); showToast('Empresa cadastrada!', 'success'); setModal(false); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDelete = async (id) => {
        if (!confirm('Excluir empresa?')) return;
        try { await deleteEmpresa(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div>
            <div className="flex justify-end mb-5">
                {isAdmin && <Button onClick={() => { setForm({ nome: '', cnpj: '', observacoes: '' }); setModal(true); }} iconName="Plus" size="sm">Nova Empresa</Button>}
            </div>
            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Empresa','CNPJ','Observações',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {empresas.length === 0 ? <tr><td colSpan={4} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma empresa cadastrada</td></tr>
                            : empresas.map((e, i) => (
                                <tr key={e.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{e.nome}</td>
                                    <td className="px-4 py-3 font-data text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{e.cnpj || '—'}</td>
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{e.observacoes || '—'}</td>
                                    <td className="px-4 py-3">{isAdmin && <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={13} color="#DC2626" /></button>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {modal && (
                <ModalOverlay onClose={() => setModal(false)}>
                    <ModalHeader title="Nova Empresa" icon="Building2" onClose={() => setModal(false)} />
                    <div className="p-5 space-y-4">
                        <Field label="Nome da empresa" required><input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Comercial Araguaia" /></Field>
                        <Field label="CNPJ"><input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className={inputCls} style={inputStyle} placeholder="00.000.000/0000-00" /></Field>
                        <Field label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Bonificações (visão admin) ─────────────────────────────────────────
function TabBonificacoes({ isAdmin }) {
    const { toast, showToast } = useToast();
    const [viagens, setViagens] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [filtroMotorista, setFiltroMotorista] = useState('');
    const [filtroMes, setFiltroMes] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = { status: 'Entrega finalizada' };
            if (filtroMotorista) f.motoristaId = filtroMotorista;
            if (filtroMes) { f.dataInicio = filtroMes + '-01'; f.dataFim = filtroMes + '-31'; }
            const [v, m] = await Promise.all([fetchViagens(f), fetchTodosMotoristas()]);
            setViagens(v); setMotoristas(m);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtroMotorista, filtroMes]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const viagensComBonus = useMemo(() =>
        viagens.map(v => ({ ...v, bonus: calcularBonusCarreteiro(v.destino) }))
    , [viagens]);

    const totais = useMemo(() => {
        const porMotorista = {};
        viagensComBonus.forEach(v => {
            const id = v.motorista_id || 'sem_motorista';
            const nome = v.motorista?.name || 'Sem motorista';
            if (!porMotorista[id]) porMotorista[id] = { nome, viagens: 0, bonus: 0 };
            porMotorista[id].viagens++;
            porMotorista[id].bonus += v.bonus;
        });
        return {
            totalBonus: viagensComBonus.reduce((s, v) => s + v.bonus, 0),
            totalViagens: viagensComBonus.length,
            porMotorista: Object.values(porMotorista).sort((a, b) => b.bonus - a.bonus),
        };
    }, [viagensComBonus]);

    const exportar = () => {
        const rows = viagensComBonus.map(v => ({
            'Motorista': v.motorista?.name || '', 'Nº Viagem': v.numero,
            'Destino': v.destino || '', 'Data': FMT_DATE(v.data_saida),
            'Placa': v.veiculo?.placa || '', 'Toneladas': v.toneladas || '',
            'Bônus (R$)': v.bonus,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [18,12,20,12,10,10,12].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bonificações');
        XLSX.writeFile(wb, `bonificacoes_carretas_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <select value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos motoristas</option>
                        {motoristas.filter(m => m.tipo_veiculo === 'carreta' || m.role === 'carreteiro').map(m =>
                            <option key={m.id} value={m.id}>{m.name}</option>
                        )}
                    </select>
                    <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                </div>
                <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="FileDown" size={14} /> Exportar Excel
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Viagens Finalizadas</p>
                    <p className="text-2xl font-bold font-data text-blue-600">{totais.totalViagens}</p>
                </div>
                <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total Bônus</p>
                    <p className="text-2xl font-bold font-data text-purple-600">{BRL(totais.totalBonus)}</p>
                </div>
            </div>

            {/* Resumo por motorista */}
            {totais.porMotorista.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                    {totais.porMotorista.map(m => (
                        <div key={m.nome} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    {m.nome[0]?.toUpperCase()}
                                </div>
                                <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>{m.viagens} viagem{m.viagens !== 1 ? 's' : ''}</span>
                            </div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{m.nome}</p>
                            <p className="text-lg font-bold font-data text-purple-600">{BRL(m.bonus)}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabela detalhada */}
            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Motorista','Nº Viagem','Destino','Data','Placa','Bônus'].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {viagensComBonus.length === 0
                                ? <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem finalizada no período</td></tr>
                                : viagensComBonus.map((v, i) => (
                                    <tr key={v.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                        <td className="px-4 py-3 font-medium">{v.motorista?.name || '—'}</td>
                                        <td className="px-4 py-3 font-data text-blue-700">{v.numero}</td>
                                        <td className="px-4 py-3">{v.destino || '—'}</td>
                                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{FMT_DATE(v.data_saida)}</td>
                                        <td className="px-4 py-3 font-data">{v.veiculo?.placa || '—'}</td>
                                        <td className="px-4 py-3 font-data font-semibold text-purple-600">{BRL(v.bonus)}</td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>
            )}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Configurações ──────────────────────────────────────────────────────
function TabConfiguracoes({ isAdmin }) {
    const { toast, showToast } = useToast();
    const [config, setConfig]   = useState({ preco_diesel: '', preco_arla: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [motoristas, setMotoristas] = useState([]);
    const [veiculos, setVeiculos]     = useState([]);
    const [vinculo, setVinculo]       = useState({ motorista_id: '', veiculo_id: '' });
    const [exporting, setExporting]   = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [c, m, v] = await Promise.all([
                    fetchConfigAbastecimento(),
                    fetchTodosMotoristas(),
                    fetchCarretasVeiculos(),
                ]);
                setConfig({ preco_diesel: c.preco_diesel || '', preco_arla: c.preco_arla || '' });
                setMotoristas(m); setVeiculos(v);
            } catch { /* usa defaults */ }
            finally { setLoading(false); }
        })();
    }, []);

    const handleSaveConfig = async () => {
        if (!isAdmin) return;
        setSaving(true);
        try {
            await saveConfigAbastecimento({
                preco_diesel: Number(config.preco_diesel) || 0,
                preco_arla:   Number(config.preco_arla)   || 0,
            });
            showToast('Configurações salvas!', 'success');
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    const exportarRelatorio = async () => {
        if (!vinculo.motorista_id) { showToast('Selecione um motorista para exportar', 'error'); return; }
        setExporting(true);
        try {
            const filtros = { motoristaId: vinculo.motorista_id };
            if (vinculo.veiculo_id) filtros.veiculoId = vinculo.veiculo_id;
            const [vgns, absts, carrgs] = await Promise.all([
                fetchViagens(filtros),
                fetchAbastecimentos(filtros),
                fetchCarregamentos(filtros),
            ]);
            const mot = motoristas.find(m => m.id === vinculo.motorista_id);
            const vei = veiculos.find(v => v.id === vinculo.veiculo_id);
            const wb = XLSX.utils.book_new();

            // Aba Viagens + Bonificações
            const rowsVgns = vgns.map(v => ({
                'Nº Viagem': v.numero, 'Status': v.status,
                'Destino': v.destino || '', 'Data': FMT_DATE(v.data_saida),
                'Placa': v.veiculo?.placa || '', 'Toneladas': v.toneladas || '',
                'Bônus (R$)': calcularBonusCarreteiro(v.destino),
            }));
            const totalBonus = rowsVgns.reduce((s, r) => s + r['Bônus (R$)'], 0);
            rowsVgns.push({ 'Nº Viagem': 'TOTAL', 'Bônus (R$)': totalBonus });
            const ws1 = XLSX.utils.json_to_sheet(rowsVgns);
            XLSX.utils.book_append_sheet(wb, ws1, 'Viagens e Bônus');

            // Aba Abastecimentos
            const rowsAbst = absts.map(a => ({
                'Data': FMT_DATE(a.data_abastecimento), 'Placa': a.veiculo?.placa || '',
                'Posto': a.posto || '', 'Diesel (L)': a.litros_diesel || 0,
                'R$ Diesel': a.valor_diesel || 0, 'Arla (L)': a.litros_arla || 0,
                'R$ Arla': a.valor_arla || 0, 'Total (R$)': a.valor_total || 0,
            }));
            const totalComb = rowsAbst.reduce((s, r) => s + r['Total (R$)'], 0);
            rowsAbst.push({ 'Data': 'TOTAL', 'Total (R$)': totalComb });
            const ws2 = XLSX.utils.json_to_sheet(rowsAbst);
            XLSX.utils.book_append_sheet(wb, ws2, 'Abastecimentos');

            // Aba Carregamentos / Fretes
            const rowsCarr = carrgs.map(c => ({
                'Data': FMT_DATE(c.data_carregamento), 'Pedido': c.numero_pedido || '',
                'NF': c.numero_nota_fiscal || '', 'Empresa': c.empresa?.nome || '',
                'Destino': c.destino || '', 'Qtd': c.quantidade || 0,
                'Unidade': c.unidade_quantidade || '', 'Frete (R$)': c.valor_frete_calculado || 0,
            }));
            const totalFrete = rowsCarr.reduce((s, r) => s + r['Frete (R$)'], 0);
            rowsCarr.push({ 'Data': 'TOTAL', 'Frete (R$)': totalFrete });
            const ws3 = XLSX.utils.json_to_sheet(rowsCarr);
            XLSX.utils.book_append_sheet(wb, ws3, 'Carregamentos');

            const nomeArq = `relatorio_${mot?.name || 'motorista'}${vei ? '_' + vei.placa : ''}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`;
            XLSX.writeFile(wb, nomeArq);
            showToast('Relatório exportado!', 'success');
        } catch (e) { showToast('Erro ao exportar: ' + e.message, 'error'); }
        finally { setExporting(false); }
    };

    if (loading) return <div className="flex justify-center py-16"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>;

    return (
        <div className="flex flex-col gap-5 max-w-2xl">

            {/* Preços de combustível */}
            <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                        <Icon name="Fuel" size={18} color="#B45309" />
                    </div>
                    <div>
                        <h3 className="font-heading font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Preços de Combustível</h3>
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Usados no cálculo automático dos abastecimentos</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <Field label="Preço do Diesel (R$/L)" required>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>R$</span>
                            <input type="number" step="0.001" min="0" value={config.preco_diesel}
                                onChange={e => setConfig(c => ({ ...c, preco_diesel: e.target.value }))}
                                disabled={!isAdmin} className={inputCls + " pl-9"} style={inputStyle} placeholder="6,80" />
                        </div>
                    </Field>
                    <Field label="Preço do Arla (R$/L)" required>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>R$</span>
                            <input type="number" step="0.001" min="0" value={config.preco_arla}
                                onChange={e => setConfig(c => ({ ...c, preco_arla: e.target.value }))}
                                disabled={!isAdmin} className={inputCls + " pl-9"} style={inputStyle} placeholder="3,20" />
                        </div>
                    </Field>
                </div>
                <div className="p-3 rounded-xl mb-4 text-xs" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <p className="text-green-600">
                        Cálculo: <strong>(Diesel L × R$ {Number(config.preco_diesel || 0).toFixed(3)})</strong> + <strong>(Arla L × R$ {Number(config.preco_arla || 0).toFixed(3)})</strong>
                    </p>
                </div>
                {isAdmin
                    ? <Button onClick={handleSaveConfig} iconName={saving ? 'Loader' : 'Save'} size="sm" disabled={saving}>{saving ? 'Salvando...' : 'Salvar preços'}</Button>
                    : <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Apenas administradores podem alterar.</p>
                }
            </div>

            {/* Exportar relatório por motorista / placa */}
            <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EDE9FE' }}>
                        <Icon name="FileDown" size={18} color="#7C3AED" />
                    </div>
                    <div>
                        <h3 className="font-heading font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Relatório Completo por Motorista</h3>
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Exporta viagens, bonificações, combustível e fretes em Excel</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <Field label="Motorista" required>
                        <select value={vinculo.motorista_id} onChange={e => setVinculo(v => ({ ...v, motorista_id: e.target.value }))}
                            className={inputCls} style={inputStyle}>
                            <option value="">Selecione o motorista...</option>
                            {motoristas.filter(m => m.tipo_veiculo === 'carreta' || m.role === 'carreteiro').map(m =>
                                <option key={m.id} value={m.id}>{m.name}</option>
                            )}
                        </select>
                    </Field>
                    <Field label="Filtrar por placa (opcional)">
                        <select value={vinculo.veiculo_id} onChange={e => setVinculo(v => ({ ...v, veiculo_id: e.target.value }))}
                            className={inputCls} style={inputStyle}>
                            <option value="">Todas as placas</option>
                            {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                        </select>
                    </Field>
                </div>
                <div className="p-3 rounded-xl mb-4 text-xs" style={{ backgroundColor: '#F5F3FF', border: '1px solid #C4B5FD' }}>
                    <p className="text-purple-700 font-medium mb-1">O relatório Excel conterá 3 abas:</p>
                    <p className="text-purple-600">📋 Viagens e Bônus &nbsp;|&nbsp; ⛽ Abastecimentos &nbsp;|&nbsp; 📦 Carregamentos/Fretes</p>
                </div>
                <Button onClick={exportarRelatorio} iconName={exporting ? 'Loader' : 'Download'} disabled={exporting || !vinculo.motorista_id}>
                    {exporting ? 'Gerando...' : 'Exportar Relatório Excel'}
                </Button>
            </div>

            <Toast toast={toast} />
        </div>
    );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
const TABS = [
    { id: 'viagens',       label: 'Viagens',       icon: 'Navigation' },
    { id: 'veiculos',      label: 'Veículos',       icon: 'Truck' },
    { id: 'abastecimentos',label: 'Abastecimentos', icon: 'Fuel' },
    { id: 'checklist',     label: 'Checklist',      icon: 'ClipboardCheck' },
    { id: 'carregamentos', label: 'Carregamentos',  icon: 'Package' },
    { id: 'bonificacoes',  label: 'Bonificações',   icon: 'Award' },
    { id: 'empresas',      label: 'Empresas',       icon: 'Building2' },
    { id: 'configuracoes', label: 'Configurações',  icon: 'Settings' },
];

export default function CarretasPage() {
    const { profile, isAdmin } = useAuth();
    const [tab, setTab] = useState('viagens');
    const admin = isAdmin();

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-xl mx-auto px-4 tab:px-6 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="font-heading font-bold text-2xl" style={{ color: 'var(--color-text-primary)' }}>
                            Transporte — Carretas
                        </h1>
                        <p className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                            Controle de viagens, frota e fretes de cimento
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b mb-6 overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium font-caption border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <Icon name={t.icon} size={15} color="currentColor" />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Conteúdo */}
                    {tab === 'viagens'        && <TabViagens        isAdmin={admin} profile={profile} />}
                    {tab === 'veiculos'       && <TabVeiculos       isAdmin={admin} />}
                    {tab === 'abastecimentos' && <TabAbastecimentos  isAdmin={admin} profile={profile} />}
                    {tab === 'checklist'      && <TabChecklist      isAdmin={admin} profile={profile} />}
                    {tab === 'carregamentos'  && <TabCarregamentos   isAdmin={admin} />}
                    {tab === 'bonificacoes'   && <TabBonificacoes   isAdmin={admin} />}
                    {tab === 'empresas'       && <TabEmpresas       isAdmin={admin} />}
                    {tab === 'configuracoes'  && <TabConfiguracoes  isAdmin={admin} />}
                </div>
            </main>
        </div>
    );
}
