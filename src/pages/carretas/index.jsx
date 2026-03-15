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
    aprovarChecklistComNotificacao, reprovarChecklistComNotificacao,
    fetchOrdensServico, createOrdemServico, updateOrdemServico,
    fetchMecanicos,
    fetchDespesasExtras, createDespesaExtra, updateDespesaExtra, deleteDespesaExtra,
    fetchDiarias, createDiaria, updateDiaria, deleteDiaria,
    CATEGORIAS_DESPESA,
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
        if (!viagens.length) { showToast('Nenhum dado encontrado para exportar no período selecionado.', 'error'); return; }
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
            if (filtro.mes)         { f.dataInicio = filtro.mes + '-01'; f.dataFim = filtro.mes + '-' + String(new Date(Number(filtro.mes.split('-')[0]), Number(filtro.mes.split('-')[1]), 0).getDate()).padStart(2,'0'); }
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
        if (!abast.length) { showToast('Nenhum abastecimento encontrado para exportar no período selecionado.', 'error'); return; }
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
    const handleAprovar = async (c) => {
        try {
            await aprovarChecklistComNotificacao(c.id, profile.id, c.motorista_id);
            showToast('Aprovado! Motorista notificado.', 'success'); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleManutencao = async () => {
        if (!obsManut.trim()) { showToast('Descreva a manutenção', 'error'); return; }
        const checklist = checklists.find(c => c.id === modalManut);
        try {
            await reprovarChecklistComNotificacao(modalManut, profile.id, checklist?.motorista_id, obsManut);
            showToast('Manutenção registrada! Motorista notificado.', 'success');
            setModalManut(null); setObsManut(''); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
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
                                        <button onClick={() => handleAprovar(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"><Icon name="CheckCircle2" size={13} />Aprovar</button>
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
            if (filtro.mes) { f.dataInicio = filtro.mes + '-01'; f.dataFim = filtro.mes + '-' + String(new Date(Number(filtro.mes.split('-')[0]), Number(filtro.mes.split('-')[1]), 0).getDate()).padStart(2,'0'); }
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
        if (!carregamentos.length) { showToast('Nenhum carregamento encontrado para exportar no período selecionado.', 'error'); return; }
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
                            <tr>{['Data','Pedido/NF','Motorista','Placa','Empresa','Destino','Qtd','Frete',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
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
            if (filtroMes) { f.dataInicio = filtroMes + '-01'; f.dataFim = filtroMes + '-' + String(new Date(Number(filtroMes.split('-')[0]), Number(filtroMes.split('-')[1]), 0).getDate()).padStart(2,'0'); }
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
        if (!viagensComBonus.length) { showToast('Nenhuma viagem encontrada para exportar no período selecionado.', 'error'); return; }
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

// ─── TAB: Despesas Extras (por veículo) ──────────────────────────────────────
function TabDespesasExtras({ isAdmin }) {
    const { toast, showToast } = useToast();
    const [despesas, setDespesas]   = useState([]);
    const [veiculos, setVeiculos]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [modal, setModal]         = useState(null);
    const [filtro, setFiltro]       = useState({ veiculoId: '', categoria: '', mes: '' });
    const [form, setForm] = useState({
        veiculo_id: '', categoria: 'Pneus', descricao: '', valor: '',
        data_despesa: new Date().toISOString().split('T')[0], nota_fiscal: '', observacoes: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.veiculoId) f.veiculoId  = filtro.veiculoId;
            if (filtro.categoria) f.categoria  = filtro.categoria;
            if (filtro.mes) {
                f.dataInicio = filtro.mes + '-01';
                f.dataFim    = filtro.mes + '-' + String(new Date(Number(filtro.mes.split('-')[0]), Number(filtro.mes.split('-')[1]), 0).getDate()).padStart(2,'0');
            }
            const [d, v] = await Promise.all([fetchDespesasExtras(f), fetchCarretasVeiculos()]);
            setDespesas(d); setVeiculos(v);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const totalPeriodo = useMemo(() => despesas.reduce((s, d) => s + Number(d.valor || 0), 0), [despesas]);

    const totalPorCategoria = useMemo(() => {
        const acc = {};
        despesas.forEach(d => { acc[d.categoria] = (acc[d.categoria] || 0) + Number(d.valor || 0); });
        return Object.entries(acc).sort((a, b) => b[1] - a[1]);
    }, [despesas]);

    const handleSubmit = async () => {
        if (!form.categoria || !form.valor || !form.data_despesa) { showToast('Categoria, valor e data são obrigatórios', 'error'); return; }
        try {
            if (modal.mode === 'create') await createDespesaExtra(form);
            else await updateDespesaExtra(modal.data.id, form);
            showToast('Despesa salva!', 'success'); setModal(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Excluir despesa?')) return;
        try { await deleteDespesaExtra(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        if (!despesas.length) { showToast('Nenhuma despesa no período selecionado.', 'error'); return; }
        const rows = despesas.map(d => ({
            'Data': FMT_DATE(d.data_despesa), 'Placa': d.veiculo?.placa || '—',
            'Categoria': d.categoria, 'Descrição': d.descricao || '',
            'NF': d.nota_fiscal || '', 'Valor (R$)': d.valor,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 12 },{ wch: 12 },{ wch: 22 },{ wch: 30 },{ wch: 14 },{ wch: 14 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Despesas Extras');
        XLSX.writeFile(wb, `despesas_extras_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const openCreate = () => {
        setForm({ veiculo_id: '', categoria: 'Pneus', descricao: '', valor: '', data_despesa: new Date().toISOString().split('T')[0], nota_fiscal: '', observacoes: '' });
        setModal({ mode: 'create' });
    };
    const openEdit = (d) => {
        setForm({ veiculo_id: d.veiculo_id || '', categoria: d.categoria, descricao: d.descricao || '', valor: d.valor, data_despesa: d.data_despesa, nota_fiscal: d.nota_fiscal || '', observacoes: d.observacoes || '' });
        setModal({ mode: 'edit', data: d });
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <select value={filtro.veiculoId} onChange={e => setFiltro(f => ({ ...f, veiculoId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos veículos</option>
                        {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                    </select>
                    <select value={filtro.categoria} onChange={e => setFiltro(f => ({ ...f, categoria: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todas categorias</option>
                        {CATEGORIAS_DESPESA.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="month" value={filtro.mes} onChange={e => setFiltro(f => ({ ...f, mes: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                </div>
                <div className="flex gap-2">
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar
                    </button>
                    <Button onClick={openCreate} iconName="Plus" size="sm">Nova Despesa</Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="bg-white rounded-xl border p-4 shadow-sm sm:col-span-2" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total no Período</p>
                    <p className="text-2xl font-bold font-data text-red-600">{BRL(totalPeriodo)}</p>
                </div>
                {totalPorCategoria.slice(0, 2).map(([cat, val]) => (
                    <div key={cat} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-xs mb-1 truncate" style={{ color: 'var(--color-muted-foreground)' }}>{cat}</p>
                        <p className="text-lg font-bold font-data text-orange-600">{BRL(val)}</p>
                    </div>
                ))}
            </div>

            {/* Breakdown por categoria */}
            {totalPorCategoria.length > 0 && (
                <div className="bg-white rounded-xl border p-4 shadow-sm mb-5" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Distribuição por categoria</p>
                    <div className="space-y-2">
                        {totalPorCategoria.map(([cat, val]) => {
                            const pct = totalPeriodo > 0 ? (val / totalPeriodo) * 100 : 0;
                            return (
                                <div key={cat}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span style={{ color: 'var(--color-text-primary)' }}>{cat}</span>
                                        <span className="font-data font-medium">{BRL(val)} <span style={{ color: 'var(--color-muted-foreground)' }}>({pct.toFixed(1)}%)</span></span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#F97316' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tabela */}
            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Data','Placa','Categoria','Descrição','NF','Valor',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {despesas.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma despesa registrada</td></tr>
                            : despesas.map((d, i) => (
                                <tr key={d.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-4 py-3 whitespace-nowrap">{FMT_DATE(d.data_despesa)}</td>
                                    <td className="px-4 py-3 font-data">{d.veiculo?.placa || '—'}</td>
                                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium">{d.categoria}</span></td>
                                    <td className="px-4 py-3 text-xs max-w-[180px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.descricao || '—'}</td>
                                    <td className="px-4 py-3 text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{d.nota_fiscal || '—'}</td>
                                    <td className="px-4 py-3 font-data font-semibold text-red-600">{BRL(d.valor)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            {isAdmin && <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-blue-50"><Icon name="Pencil" size={13} color="#1D4ED8" /></button>}
                                            {isAdmin && <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={13} color="#DC2626" /></button>}
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
                    <ModalHeader title={modal.mode === 'create' ? 'Nova Despesa Extra' : 'Editar Despesa'} icon="Receipt" onClose={() => setModal(null)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Categoria" required>
                            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className={inputCls} style={inputStyle}>
                                {CATEGORIAS_DESPESA.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </Field>
                        <Field label="Veículo">
                            <select value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Sem veículo específico</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </select>
                        </Field>
                        <Field label="Data" required>
                            <input type="date" value={form.data_despesa} onChange={e => setForm(f => ({ ...f, data_despesa: e.target.value }))} className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Valor (R$)" required>
                            <input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                        </Field>
                        <Field label="Descrição">
                            <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 4 pneus traseiros Bridgestone" />
                        </Field>
                        <Field label="Nº Nota Fiscal">
                            <input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 12345" />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Observações">
                                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                            </Field>
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

// ─── TAB: Diárias de Motoristas ───────────────────────────────────────────────
function TabDiarias({ isAdmin }) {
    const { toast, showToast } = useToast();
    const [diarias, setDiarias]     = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [viagens, setViagens]     = useState([]);
    const [loading, setLoading]     = useState(true);
    const [modal, setModal]         = useState(null);
    const [filtro, setFiltro]       = useState({ motoristaId: '', mes: '' });
    const [form, setForm] = useState({
        motorista_id: '', viagem_id: '', data_inicio: new Date().toISOString().split('T')[0],
        quantidade_dias: '1', valor_dia: '', descricao: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.motoristaId) f.motoristaId = filtro.motoristaId;
            if (filtro.mes) {
                f.dataInicio = filtro.mes + '-01';
                f.dataFim    = filtro.mes + '-' + String(new Date(Number(filtro.mes.split('-')[0]), Number(filtro.mes.split('-')[1]), 0).getDate()).padStart(2,'0');
            }
            const [d, m, v] = await Promise.all([fetchDiarias(f), fetchTodosMotoristas(), fetchViagens({})]);
            setDiarias(d);
            setMotoristas(m.filter(x => x.tipo_veiculo === 'carreta' || x.role === 'carreteiro'));
            setViagens(v);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const totais = useMemo(() => ({
        total: diarias.reduce((s, d) => s + Number(d.valor_total || 0), 0),
        porMotorista: Object.values(diarias.reduce((acc, d) => {
            const id = d.motorista_id || 'sem';
            const nome = d.motorista?.name || '—';
            if (!acc[id]) acc[id] = { nome, valor: 0, dias: 0 };
            acc[id].valor += Number(d.valor_total || 0);
            acc[id].dias  += Number(d.quantidade_dias || 0);
            return acc;
        }, {})).sort((a, b) => b.valor - a.valor),
    }), [diarias]);

    const previewTotal = useMemo(() =>
        Number(form.quantidade_dias || 0) * Number(form.valor_dia || 0)
    , [form.quantidade_dias, form.valor_dia]);

    const handleSubmit = async () => {
        if (!form.motorista_id || !form.valor_dia || !form.data_inicio) { showToast('Motorista, valor/dia e data são obrigatórios', 'error'); return; }
        try {
            if (modal.mode === 'create') await createDiaria(form);
            else await updateDiaria(modal.data.id, form);
            showToast('Diária salva!', 'success'); setModal(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Excluir diária?')) return;
        try { await deleteDiaria(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        if (!diarias.length) { showToast('Nenhuma diária no período.', 'error'); return; }
        const rows = diarias.map(d => ({
            'Data': FMT_DATE(d.data_inicio), 'Motorista': d.motorista?.name || '',
            'Viagem': d.viagem?.numero || '', 'Destino': d.viagem?.destino || '',
            'Dias': d.quantidade_dias, 'Valor/Dia (R$)': d.valor_dia, 'Total (R$)': d.valor_total,
            'Descrição': d.descricao || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [12,20,12,20,8,16,14,25].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Diárias');
        XLSX.writeFile(wb, `diarias_motoristas_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const openCreate = () => {
        setForm({ motorista_id: '', viagem_id: '', data_inicio: new Date().toISOString().split('T')[0], quantidade_dias: '1', valor_dia: '', descricao: '' });
        setModal({ mode: 'create' });
    };
    const openEdit = (d) => {
        setForm({ motorista_id: d.motorista_id || '', viagem_id: d.viagem_id || '', data_inicio: d.data_inicio, quantidade_dias: d.quantidade_dias, valor_dia: d.valor_dia, descricao: d.descricao || '' });
        setModal({ mode: 'edit', data: d });
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <select value={filtro.motoristaId} onChange={e => setFiltro(f => ({ ...f, motoristaId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos motoristas</option>
                        {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <input type="month" value={filtro.mes} onChange={e => setFiltro(f => ({ ...f, mes: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                </div>
                <div className="flex gap-2">
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar
                    </button>
                    <Button onClick={openCreate} iconName="Plus" size="sm">Nova Diária</Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total Diárias</p>
                    <p className="text-2xl font-bold font-data text-indigo-600">{BRL(totais.total)}</p>
                </div>
                {totais.porMotorista.slice(0, 2).map(m => (
                    <div key={m.nome} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-xs mb-1 truncate font-medium" style={{ color: 'var(--color-muted-foreground)' }}>{m.nome}</p>
                        <p className="text-lg font-bold font-data text-indigo-600">{BRL(m.valor)}</p>
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{m.dias} dia{m.dias !== 1 ? 's' : ''}</p>
                    </div>
                ))}
            </div>

            {/* Tabela */}
            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Data','Motorista','Viagem','Dias','Valor/Dia','Total',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {diarias.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma diária registrada</td></tr>
                            : diarias.map((d, i) => (
                                <tr key={d.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-4 py-3 whitespace-nowrap">{FMT_DATE(d.data_inicio)}</td>
                                    <td className="px-4 py-3 font-medium">{d.motorista?.name || '—'}</td>
                                    <td className="px-4 py-3 text-xs">
                                        {d.viagem ? <span className="font-data text-blue-700">{d.viagem.numero}</span> : <span style={{ color: 'var(--color-muted-foreground)' }}>—</span>}
                                        {d.viagem?.destino && <span className="block text-gray-400">{d.viagem.destino}</span>}
                                    </td>
                                    <td className="px-4 py-3 font-data text-center">{d.quantidade_dias}</td>
                                    <td className="px-4 py-3 font-data">{BRL(d.valor_dia)}</td>
                                    <td className="px-4 py-3 font-data font-semibold text-indigo-600">{BRL(d.valor_total)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            {isAdmin && <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-blue-50"><Icon name="Pencil" size={13} color="#1D4ED8" /></button>}
                                            {isAdmin && <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={13} color="#DC2626" /></button>}
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
                    <ModalHeader title={modal.mode === 'create' ? 'Nova Diária' : 'Editar Diária'} icon="CalendarDays" onClose={() => setModal(null)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Motorista" required>
                            <select value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Vincular à viagem (opcional)">
                            <select value={form.viagem_id} onChange={e => setForm(f => ({ ...f, viagem_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Sem vínculo</option>
                                {viagens.filter(v => !form.motorista_id || v.motorista_id === form.motorista_id).map(v =>
                                    <option key={v.id} value={v.id}>{v.numero} — {v.destino || 'Sem destino'}</option>
                                )}
                            </select>
                        </Field>
                        <Field label="Data de início" required>
                            <input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Quantidade de dias" required>
                            <input type="number" step="0.5" min="0.5" value={form.quantidade_dias} onChange={e => setForm(f => ({ ...f, quantidade_dias: e.target.value }))} className={inputCls} style={inputStyle} placeholder="1" />
                        </Field>
                        <Field label="Valor por dia (R$)" required>
                            <input type="number" step="0.01" min="0" value={form.valor_dia} onChange={e => setForm(f => ({ ...f, valor_dia: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                        </Field>
                        <div className="flex items-end pb-0.5">
                            {previewTotal > 0 && (
                                <div className="w-full p-3 rounded-lg text-center" style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                                    <p className="text-xs text-indigo-600 font-medium mb-0.5">Total calculado</p>
                                    <p className="text-xl font-bold font-data text-indigo-700">{BRL(previewTotal)}</p>
                                </div>
                            )}
                        </div>
                        <div className="sm:col-span-2">
                            <Field label="Descrição / motivo">
                                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Viagem a Bom Jesus da Lapa — 2 diárias" />
                            </Field>
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

// ─── TAB: Relatório Financeiro ───────────────────────────────────────────────
function TabRelatorioFinanceiro({ isAdmin }) {
    const { toast, showToast } = useToast();

    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const [periodoInicio, setPeriodoInicio] = useState(mesAtual);
    const [periodoFim,    setPeriodoFim]    = useState(mesAtual);
    const [empresa,       setEmpresa]       = useState('');
    const [empresas,      setEmpresas]      = useState([]);
    const [motoristas,    setMotoristas]    = useState([]);
    const [dados,         setDados]         = useState(null);
    const [loading,       setLoading]       = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [e, m] = await Promise.all([fetchEmpresas(), fetchTodosMotoristas()]);
                setEmpresas(e); setMotoristas(m.filter(m => m.tipo_veiculo === 'carreta' || m.role === 'carreteiro'));
            } catch { /* silencioso */ }
        })();
    }, []);

    const calcularRelatorio = useCallback(async () => {
        if (!periodoInicio || !periodoFim) { showToast('Selecione o período', 'error'); return; }
        if (periodoInicio > periodoFim) { showToast('A data inicial não pode ser maior que a final', 'error'); return; }

        setLoading(true);
        try {
            // Converte mês em datas
            const dataInicio = periodoInicio + '-01';
            const anoFim = Number(periodoFim.split('-')[0]);
            const mesFim = Number(periodoFim.split('-')[1]);
            const dataFim = periodoFim + '-' + String(new Date(anoFim, mesFim, 0).getDate()).padStart(2,'0');

            const filtros = { dataInicio, dataFim };
            if (empresa) filtros.empresaId = empresa;

            const [carregamentos, abastecimentos, viagens, despesasExtras, diariasLancadas] = await Promise.all([
                fetchCarregamentos(filtros),
                fetchAbastecimentos({ dataInicio, dataFim }),
                fetchViagens({ dataInicio, dataFim }),
                fetchDespesasExtras({ dataInicio, dataFim }),
                fetchDiarias({ dataInicio, dataFim }),
            ]);

            // ── Receitas (fretes) ──────────────────────────────────────────
            const receitaTotal     = carregamentos.reduce((s, c) => s + Number(c.valor_frete_calculado || 0), 0);
            const receitaPorEmpresa = {};
            carregamentos.forEach(c => {
                const nome = c.empresa?.nome || 'Sem empresa';
                receitaPorEmpresa[nome] = (receitaPorEmpresa[nome] || 0) + Number(c.valor_frete_calculado || 0);
            });

            // ── Despesas combustível ───────────────────────────────────────
            const despesaCombustivel = abastecimentos.reduce((s, a) => s + Number(a.valor_total || 0), 0);
            const litrosDiesel       = abastecimentos.reduce((s, a) => s + Number(a.litros_diesel || 0), 0);
            const litrosArla         = abastecimentos.reduce((s, a) => s + Number(a.litros_arla   || 0), 0);

            // ── Despesas extras por veículo ──────────────────────────────────
            const totalDespesasExtras = despesasExtras.reduce((s, d) => s + Number(d.valor || 0), 0);
            const despesasPorCategoria = {};
            despesasExtras.forEach(d => {
                despesasPorCategoria[d.categoria] = (despesasPorCategoria[d.categoria] || 0) + Number(d.valor || 0);
            });

            // ── Diárias lançadas ─────────────────────────────────────────────
            const totalDiariasLancadas = diariasLancadas.reduce((s, d) => s + Number(d.valor_total || 0), 0);

            // ── Bônus por motorista ────────────────────────────────────────
            const bonusPorMotorista = {};
            const viagensFinalizadas = viagens.filter(v => v.status === 'Entrega finalizada');
            viagensFinalizadas.forEach(v => {
                const id   = v.motorista_id || 'sem_id';
                const nome = v.motorista?.name || 'Sem motorista';
                if (!bonusPorMotorista[id]) bonusPorMotorista[id] = { nome, viagens: 0, bonus: 0 };
                bonusPorMotorista[id].viagens++;
                bonusPorMotorista[id].bonus += calcularBonusCarreteiro(v.destino);
            });
            const bonusTotal = Object.values(bonusPorMotorista).reduce((s, m) => s + m.bonus, 0);

            // ── Margens ───────────────────────────────────────────────────
            const despesaTotal  = despesaCombustivel + bonusTotal;
            const margemBruta   = receitaTotal - despesaCombustivel;          // receita − combustível
            const margemLiquida = receitaTotal - despesaTotal;                // receita − combustível − bônus
            const margemPct     = receitaTotal > 0 ? (margemLiquida / receitaTotal) * 100 : 0;

            // ── Por motorista (frete + bônus) ─────────────────────────────
            const fretePorMotorista = {};
            carregamentos.forEach(c => {
                const id   = c.motorista_id || 'sem_id';
                const nome = c.motorista?.name || 'Sem motorista';
                if (!fretePorMotorista[id]) fretePorMotorista[id] = { nome, carregamentos: 0, frete: 0 };
                fretePorMotorista[id].carregamentos++;
                fretePorMotorista[id].frete += Number(c.valor_frete_calculado || 0);
            });

            // Consolida motoristas
            const todosIds = new Set([
                ...Object.keys(bonusPorMotorista),
                ...Object.keys(fretePorMotorista),
            ]);
            const consolidadoMotoristas = Array.from(todosIds).map(id => ({
                nome:          bonusPorMotorista[id]?.nome  || fretePorMotorista[id]?.nome || '—',
                viagens:       bonusPorMotorista[id]?.viagens || 0,
                bonus:         bonusPorMotorista[id]?.bonus   || 0,
                carregamentos: fretePorMotorista[id]?.carregamentos || 0,
                frete:         fretePorMotorista[id]?.frete   || 0,
            })).sort((a, b) => b.frete - a.frete);

            setDados({
                periodo: `${periodoInicio === periodoFim ? periodoInicio : `${periodoInicio} a ${periodoFim}`}`,
                receitaTotal, receitaPorEmpresa,
                despesaCombustivel, litrosDiesel, litrosArla,
                bonusTotal, despesaTotal,
                margemBruta, margemLiquida, margemPct,
                consolidadoMotoristas,
                totalCarregamentos: carregamentos.length,
                totalViagens: viagens.length,
                viagensFinalizadas: viagensFinalizadas.length,
                totalDespesasExtras, despesasPorCategoria,
                totalDiariasLancadas,
            });
        } catch (e) { showToast('Erro ao calcular: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [periodoInicio, periodoFim, empresa]); // eslint-disable-line

    const exportarExcel = () => {
        if (!dados) { showToast('Gere o relatório antes de exportar', 'error'); return; }

        const wb = XLSX.utils.book_new();

        // Aba 1 — Resumo Financeiro
        const resumo = [
            ['RELATÓRIO FINANCEIRO — TRANSPORTE CARRETAS', '', ''],
            ['Período:', dados.periodo, ''],
            ['', '', ''],
            ['RECEITAS', '', ''],
            ['Receita Total de Fretes', dados.receitaTotal, ''],
            ...Object.entries(dados.receitaPorEmpresa).map(([nome, val]) => [`  → ${nome}`, val, '']),
            ['', '', ''],
            ['DESPESAS', '', ''],
            ['Combustível (Diesel + Arla)', dados.despesaCombustivel, ''],
            [`  → Diesel: ${dados.litrosDiesel.toFixed(1)} L`, '', ''],
            [`  → Arla: ${dados.litrosArla.toFixed(1)} L`, '', ''],
            ['Bônus Motoristas', dados.bonusTotal, ''],
            ['Diárias de Motoristas', dados.totalDiariasLancadas, ''],
            ['Despesas Extras (veículos)', dados.totalDespesasExtras, ''],
            ...Object.entries(dados.despesasPorCategoria).map(([cat, val]) => [`  → ${cat}`, val, '']),
            ['Total Despesas', dados.despesaTotal, ''],
            ['', '', ''],
            ['MARGENS', '', ''],
            ['Margem Bruta (Receita − Combustível)', dados.margemBruta, ''],
            ['Margem Líquida (Receita − Todas Despesas)', dados.margemLiquida, ''],
            ['Margem Líquida %', `${dados.margemPct.toFixed(2)}%`, ''],
            ['', '', ''],
            ['OPERACIONAL', '', ''],
            ['Total de Viagens', dados.totalViagens, ''],
            ['Viagens Finalizadas', dados.viagensFinalizadas, ''],
            ['Carregamentos', dados.totalCarregamentos, ''],
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(resumo);
        ws1['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumo Financeiro');

        // Aba 2 — Motoristas
        const rowsM = [
            ['Motorista', 'Carregamentos', 'Receita Frete (R$)', 'Viagens Finalizadas', 'Bônus (R$)', 'Total Motorista (R$)'],
            ...dados.consolidadoMotoristas.map(m => [
                m.nome, m.carregamentos, m.frete, m.viagens, m.bonus, m.frete + m.bonus,
            ]),
            ['TOTAL', dados.consolidadoMotoristas.reduce((s,m)=>s+m.carregamentos,0),
                dados.receitaTotal,
                dados.viagensFinalizadas,
                dados.bonusTotal,
                dados.receitaTotal + dados.bonusTotal],
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(rowsM);
        ws2['!cols'] = [{ wch: 22 },{ wch: 15 },{ wch: 20 },{ wch: 20 },{ wch: 14 },{ wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Por Motorista');

        const nome = `relatorio_financeiro_carretas_${dados.periodo.replace(/\s/g,'_')}.xlsx`;
        XLSX.writeFile(wb, nome);
        showToast('Relatório exportado com sucesso!', 'success');
    };

    const fmtPct = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

    return (
        <div>
            {/* ── Filtros ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border p-4 shadow-sm mb-5" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="font-heading font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Parâmetros do Relatório
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Mês inicial <span className="text-red-500">*</span>
                        </label>
                        <input type="month" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Mês final <span className="text-red-500">*</span>
                        </label>
                        <input type="month" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Filtrar por empresa (opcional)
                        </label>
                        <select value={empresa} onChange={e => setEmpresa(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                            <option value="">Todas as empresas</option>
                            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button onClick={calcularRelatorio} iconName={loading ? 'Loader' : 'BarChart3'} disabled={loading}>
                        {loading ? 'Calculando...' : 'Gerar Relatório'}
                    </Button>
                    {dados && (
                        <button onClick={exportarExcel}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition-colors"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                            <Icon name="FileDown" size={16} />
                            Exportar Excel
                        </button>
                    )}
                </div>
            </div>

            {/* ── Resultado ──────────────────────────────────────────────── */}
            {!dados && !loading && (
                <div className="bg-white rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="BarChart3" size={40} color="var(--color-muted-foreground)" />
                    <p className="text-sm mt-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                        Selecione o período e clique em "Gerar Relatório"
                    </p>
                </div>
            )}

            {loading && (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            )}

            {dados && !loading && (
                <div className="flex flex-col gap-5">

                    {/* Cabeçalho do período */}
                    <div className="flex items-center gap-2 px-1">
                        <Icon name="Calendar" size={16} color="var(--color-muted-foreground)" />
                        <span className="text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                            Período: <strong style={{ color: 'var(--color-text-primary)' }}>{dados.periodo}</strong>
                        </span>
                    </div>

                    {/* ── Cards de margem ─────────────────────────────────── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                            { l: 'Receita Total',     v: BRL(dados.receitaTotal),     c: '#065F46', bg: '#D1FAE5', i: 'TrendingUp',  sub: `${dados.totalCarregamentos} carregamentos` },
                            { l: 'Desp. Combustível', v: BRL(dados.despesaCombustivel), c: '#B45309', bg: '#FEF9C3', i: 'Fuel',        sub: `${dados.litrosDiesel.toFixed(0)}L diesel` },
                            { l: 'Bônus Motoristas',  v: BRL(dados.bonusTotal),       c: '#7C3AED', bg: '#EDE9FE', i: 'Award',       sub: `${dados.viagensFinalizadas} viagens finalizadas` },
                            { l: 'Despesas Extras',   v: BRL(dados.totalDespesasExtras), c: '#EA580C', bg: '#FEF3C7', i: 'Receipt',    sub: `${Object.keys(dados.despesasPorCategoria).length} categoria(s)` },
                            { l: 'Diárias',           v: BRL(dados.totalDiariasLancadas), c: '#4F46E5', bg: '#EEF2FF', i: 'CalendarDays', sub: 'motoristas' },
                            { l: 'Margem Líquida',    v: BRL(dados.margemLiquida),    c: dados.margemLiquida >= 0 ? '#1D4ED8' : '#DC2626', bg: dados.margemLiquida >= 0 ? '#DBEAFE' : '#FEE2E2', i: dados.margemLiquida >= 0 ? 'TrendingUp' : 'TrendingDown', sub: fmtPct(dados.margemPct) },
                        ].map(k => (
                            <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="rounded-lg flex items-center justify-center" style={{ width: 30, height: 30, backgroundColor: k.bg }}>
                                        <Icon name={k.i} size={15} color={k.c} />
                                    </div>
                                    <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                </div>
                                <p className="text-xl font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{k.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── DRE Simplificado ────────────────────────────────── */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                            <Icon name="FileText" size={16} color="var(--color-muted-foreground)" />
                            <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                Demonstrativo de Resultado (DRE)
                            </h3>
                        </div>
                        <div className="p-5 space-y-1">

                            {/* Receitas */}
                            <div className="flex justify-between py-2 border-b" style={{ borderColor: '#F1F5F9' }}>
                                <span className="text-xs font-semibold uppercase tracking-wide text-green-700">Receitas</span>
                            </div>
                            <div className="flex justify-between py-1.5 pl-3">
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Receita de Fretes</span>
                                <span className="font-data font-semibold text-green-700">{BRL(dados.receitaTotal)}</span>
                            </div>
                            {Object.entries(dados.receitaPorEmpresa).map(([nome, val]) => (
                                <div key={nome} className="flex justify-between py-1 pl-6">
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ {nome}</span>
                                    <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(val)}</span>
                                </div>
                            ))}

                            {/* Despesas */}
                            <div className="flex justify-between py-2 border-b mt-2" style={{ borderColor: '#F1F5F9' }}>
                                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Despesas</span>
                            </div>
                            <div className="flex justify-between py-1.5 pl-3">
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Combustível</span>
                                <span className="font-data font-semibold text-amber-700">({BRL(dados.despesaCombustivel)})</span>
                            </div>
                            <div className="flex justify-between py-1 pl-6">
                                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ Diesel: {dados.litrosDiesel.toFixed(1)} L</span>
                            </div>
                            {dados.litrosArla > 0 && (
                                <div className="flex justify-between py-1 pl-6">
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ Arla: {dados.litrosArla.toFixed(1)} L</span>
                                </div>
                            )}
                            <div className="flex justify-between py-1.5 pl-3">
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Bônus Motoristas</span>
                                <span className="font-data font-semibold text-purple-600">({BRL(dados.bonusTotal)})</span>
                            </div>
                            {dados.totalDiariasLancadas > 0 && (
                                <div className="flex justify-between py-1.5 pl-3">
                                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Diárias de Motoristas</span>
                                    <span className="font-data font-semibold text-indigo-600">({BRL(dados.totalDiariasLancadas)})</span>
                                </div>
                            )}
                            {dados.totalDespesasExtras > 0 && (
                                <div className="flex justify-between py-1.5 pl-3">
                                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Despesas Extras (veículos)</span>
                                    <span className="font-data font-semibold text-orange-600">({BRL(dados.totalDespesasExtras)})</span>
                                </div>
                            )}
                            {dados.totalDespesasExtras > 0 && Object.entries(dados.despesasPorCategoria).map(([cat, val]) => (
                                <div key={cat} className="flex justify-between py-0.5 pl-6">
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ {cat}</span>
                                    <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(val)}</span>
                                </div>
                            ))}

                            {/* Separador margem bruta */}
                            <div className="flex justify-between py-2.5 px-3 rounded-lg mt-2" style={{ backgroundColor: '#F0FDF4' }}>
                                <span className="text-sm font-semibold text-green-800">Margem Bruta (−Combustível)</span>
                                <span className="font-data font-bold text-green-700">{BRL(dados.margemBruta)}</span>
                            </div>

                            {/* Margem líquida */}
                            <div className="flex justify-between py-2.5 px-3 rounded-lg" style={{
                                backgroundColor: dados.margemLiquida >= 0 ? '#EFF6FF' : '#FEF2F2',
                                border: `1px solid ${dados.margemLiquida >= 0 ? '#BFDBFE' : '#FECACA'}`,
                            }}>
                                <div>
                                    <span className="text-sm font-bold" style={{ color: dados.margemLiquida >= 0 ? '#1D4ED8' : '#DC2626' }}>
                                        Margem Líquida
                                    </span>
                                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium"
                                        style={{ backgroundColor: dados.margemLiquida >= 0 ? '#DBEAFE' : '#FEE2E2', color: dados.margemLiquida >= 0 ? '#1D4ED8' : '#DC2626' }}>
                                        {fmtPct(dados.margemPct)}
                                    </span>
                                </div>
                                <span className="font-data font-bold" style={{ color: dados.margemLiquida >= 0 ? '#1D4ED8' : '#DC2626' }}>
                                    {BRL(dados.margemLiquida)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Receita por empresa ─────────────────────────────── */}
                    {Object.keys(dados.receitaPorEmpresa).length > 0 && (
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                                <Icon name="Building2" size={16} color="var(--color-muted-foreground)" />
                                <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Receita por Empresa</h3>
                            </div>
                            <div className="p-5 space-y-3">
                                {Object.entries(dados.receitaPorEmpresa)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([nome, val]) => {
                                        const pct = dados.receitaTotal > 0 ? (val / dados.receitaTotal) * 100 : 0;
                                        return (
                                            <div key={nome}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{nome}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{pct.toFixed(1)}%</span>
                                                        <span className="font-data font-semibold text-green-700">{BRL(val)}</span>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#059669' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* ── Bônus e fretes por motorista ────────────────────── */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                            <Icon name="Users" size={16} color="var(--color-muted-foreground)" />
                            <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Resumo por Motorista</h3>
                        </div>
                        {dados.consolidadoMotoristas.length === 0 ? (
                            <div className="p-8 text-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                Nenhum dado de motoristas no período
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                        <tr>
                                            {['Motorista', 'Carregamentos', 'Frete Gerado', 'Viagens Finalizadas', 'Bônus', 'Total'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dados.consolidadoMotoristas.map((m, i) => (
                                            <tr key={m.nome} className="border-t hover:bg-gray-50"
                                                style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{m.nome}</td>
                                                <td className="px-4 py-3 text-center font-data">{m.carregamentos}</td>
                                                <td className="px-4 py-3 font-data font-semibold text-green-700">{BRL(m.frete)}</td>
                                                <td className="px-4 py-3 text-center font-data">{m.viagens}</td>
                                                <td className="px-4 py-3 font-data font-semibold text-purple-600">{BRL(m.bonus)}</td>
                                                <td className="px-4 py-3 font-data font-bold text-blue-700">{BRL(m.frete + m.bonus)}</td>
                                            </tr>
                                        ))}
                                        {/* Linha de totais */}
                                        <tr className="border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F0F9FF' }}>
                                            <td className="px-4 py-3 font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>TOTAL</td>
                                            <td className="px-4 py-3 text-center font-data font-bold">{dados.totalCarregamentos}</td>
                                            <td className="px-4 py-3 font-data font-bold text-green-700">{BRL(dados.receitaTotal)}</td>
                                            <td className="px-4 py-3 text-center font-data font-bold">{dados.viagensFinalizadas}</td>
                                            <td className="px-4 py-3 font-data font-bold text-purple-600">{BRL(dados.bonusTotal)}</td>
                                            <td className="px-4 py-3 font-data font-bold text-blue-700">{BRL(dados.receitaTotal + dados.bonusTotal)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
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

// ─── TAB: Ordens de Serviço ───────────────────────────────────────────────────
function TabOrdensServico({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const [ordens, setOrdens]     = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [mecanicos, setMecanicos] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [filtroStatus, setFiltroStatus] = useState('');
    const [modal, setModal]       = useState(false);
    const [pdfFile, setPdfFile]   = useState(null);
    const [uploading, setUploading] = useState(false);
    const [viewPdf, setViewPdf]   = useState(null);
    const [form, setForm] = useState({
        veiculo_id: '', mecanico_id: '', descricao: '', prioridade: 'Normal', pdf_url: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [o, v, m] = await Promise.all([
                fetchOrdensServico(filtroStatus ? { status: filtroStatus } : {}),
                fetchCarretasVeiculos(),
                fetchMecanicos(),
            ]);
            setOrdens(o); setVeiculos(v); setMecanicos(m);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtroStatus]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const handlePdfChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') { showToast('Somente arquivos PDF são aceitos', 'error'); return; }
        if (file.size > 5 * 1024 * 1024) { showToast('PDF deve ter menos de 5MB', 'error'); return; }
        setPdfFile(file);
        // Convert to base64 data URL for storage
        const reader = new FileReader();
        reader.onload = (ev) => setForm(f => ({ ...f, pdf_url: ev.target.result }));
        reader.readAsDataURL(file);
    };

    const handleCreate = async () => {
        if (!form.veiculo_id || !form.descricao) { showToast('Veículo e descrição são obrigatórios', 'error'); return; }
        setUploading(true);
        try {
            await createOrdemServico(form);
            showToast('Ordem de serviço criada!', 'success');
            setModal(false); setPdfFile(null);
            setForm({ veiculo_id: '', mecanico_id: '', descricao: '', prioridade: 'Normal', pdf_url: '' });
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setUploading(false); }
    };

    const STATUS_OS = ['Pendente', 'Em Andamento', 'Problema Reportado', 'Finalizada'];
    const STATUS_COLORS_OS = {
        'Pendente':           { bg: '#FEF9C3', text: '#B45309' },
        'Em Andamento':       { bg: '#DBEAFE', text: '#1D4ED8' },
        'Finalizada':         { bg: '#D1FAE5', text: '#065F46' },
        'Problema Reportado': { bg: '#FEE2E2', text: '#B91C1C' },
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos os status</option>
                        {STATUS_OS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                {isAdmin && <Button onClick={() => { setForm({ veiculo_id: '', mecanico_id: '', descricao: '', prioridade: 'Normal', pdf_url: '' }); setPdfFile(null); setModal(true); }} iconName="Plus" size="sm">Nova OS</Button>}
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="flex flex-col gap-3">
                    {ordens.length === 0 && <div className="bg-white rounded-xl border p-10 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>Nenhuma ordem de serviço</div>}
                    {ordens.map(o => {
                        const sc = STATUS_COLORS_OS[o.status] || STATUS_COLORS_OS['Pendente'];
                        return (
                            <div key={o.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold font-data text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                OS #{o.id?.slice(0, 8).toUpperCase()}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{o.status}</span>
                                            {o.prioridade === 'Urgente' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">URGENTE</span>}
                                        </div>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                            {o.veiculo?.placa || '—'} {o.veiculo?.modelo ? `— ${o.veiculo.modelo}` : ''} · Mecânico: {o.mecanico?.name || '—'}
                                        </p>
                                    </div>
                                    {o.pdf_url && (
                                        <button onClick={() => setViewPdf(o.pdf_url)}
                                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                            <Icon name="FileText" size={13} color="#1D4ED8" />Ver PDF
                                        </button>
                                    )}
                                </div>
                                <div className="p-3 rounded-lg text-sm mb-2" style={{ backgroundColor: '#F8FAFC' }}>
                                    <p style={{ color: 'var(--color-text-primary)' }}>{o.descricao}</p>
                                </div>
                                {o.problema_encontrado && (
                                    <div className="p-3 rounded-lg text-xs mb-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                                        <p className="font-medium text-red-600 mb-1">⚠️ Problema reportado pelo mecânico:</p>
                                        <p className="text-red-700">{o.problema_encontrado}</p>
                                        {isAdmin && o.status === 'Problema Reportado' && (
                                            <div className="flex gap-2 mt-2">
                                                <button onClick={async () => { await updateOrdemServico(o.id, { status: 'Em Andamento', problema_encontrado: o.problema_encontrado }); showToast('Retomado!', 'success'); load(); }}
                                                    className="px-2 py-1 rounded text-xs font-medium bg-blue-600 text-white">Autorizar continuação</button>
                                                <button onClick={async () => { await updateOrdemServico(o.id, { status: 'Pendente' }); showToast('Devolvida para pendente!', 'success'); load(); }}
                                                    className="px-2 py-1 rounded text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">Devolver para fila</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {o.obs_finalizacao && (
                                    <div className="p-3 rounded-lg text-xs" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                        <p className="font-medium text-green-600 mb-1">✅ Finalizada pelo mecânico:</p>
                                        <p className="text-green-700">{o.obs_finalizacao}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {modal && (
                <ModalOverlay onClose={() => setModal(false)}>
                    <ModalHeader title="Nova Ordem de Serviço" icon="Wrench" onClose={() => setModal(false)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Veículo" required>
                            <select value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </select>
                        </Field>
                        <Field label="Mecânico responsável">
                            <select value={form.mecanico_id} onChange={e => setForm(f => ({ ...f, mecanico_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {mecanicos.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Prioridade">
                            <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="Normal">Normal</option>
                                <option value="Urgente">Urgente</option>
                            </select>
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Descrição do serviço" required>
                                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                                    className={inputCls} style={inputStyle} rows={4}
                                    placeholder="Descreva o serviço a ser realizado..." />
                            </Field>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Ordem de serviço em PDF (opcional)
                            </label>
                            <label className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer hover:bg-gray-50 transition-colors"
                                style={{ borderColor: pdfFile ? '#059669' : 'var(--color-border)' }}>
                                <Icon name="Upload" size={18} color={pdfFile ? '#059669' : 'var(--color-muted-foreground)'} />
                                <div>
                                    <p className="text-sm font-medium" style={{ color: pdfFile ? '#059669' : 'var(--color-text-primary)' }}>
                                        {pdfFile ? pdfFile.name : 'Clique para anexar PDF'}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>PDF, máximo 5MB</p>
                                </div>
                                <input type="file" accept=".pdf" onChange={handlePdfChange} className="hidden" />
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleCreate} iconName={uploading ? 'Loader' : 'Send'} size="sm" disabled={uploading}>
                            {uploading ? 'Enviando...' : 'Criar OS'}
                        </Button>
                    </div>
                </ModalOverlay>
            )}
            {/* Viewer de PDF in-app — header fixo sempre visível */}
            {viewPdf && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        position: 'relative', zIndex: 10000, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', backgroundColor: '#111827',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    }}>
                        <button
                            onClick={() => setViewPdf(null)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 16px', borderRadius: 8,
                                backgroundColor: '#2563EB', color: 'white',
                                border: 'none', cursor: 'pointer',
                                fontSize: 14, fontWeight: 600,
                            }}>
                            ← Voltar às Ordens de Serviço
                        </button>
                        <span style={{ color: '#9CA3AF', fontSize: 13 }}>Ordem de Serviço — PDF</span>
                        <button
                            onClick={() => setViewPdf(null)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 32, borderRadius: 6,
                                backgroundColor: '#374151', color: 'white',
                                border: 'none', cursor: 'pointer', fontSize: 18,
                            }}>
                            ✕
                        </button>
                    </div>
                    <iframe
                        src={viewPdf}
                        title="Ordem de Serviço"
                        style={{ flex: 1, border: 'none', width: '100%', backgroundColor: '#1a1a1a' }}
                    />
                </div>
            )}
            <Toast toast={toast} />
        </div>
    );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
const TABS = [
    { id: 'viagens',       label: 'Viagens',          icon: 'Navigation',    group: 'Operação' },
    { id: 'veiculos',      label: 'Veículos',          icon: 'Truck',         group: 'Operação' },
    { id: 'abastecimentos',label: 'Abastecimentos',    icon: 'Fuel',          group: 'Operação' },
    { id: 'checklist',     label: 'Checklist',         icon: 'ClipboardCheck',group: 'Operação' },
    { id: 'carregamentos', label: 'Carregamentos',     icon: 'Package',       group: 'Operação' },
    { id: 'bonificacoes',  label: 'Bonificações',      icon: 'Award',         group: 'Financeiro' },
    { id: 'despesas',      label: 'Despesas',          icon: 'Receipt',       group: 'Financeiro' },
    { id: 'diarias',       label: 'Diárias',           icon: 'CalendarDays',  group: 'Financeiro' },
    { id: 'financeiro',    label: 'Rel. Financeiro',   icon: 'BarChart3',     group: 'Financeiro' },
    { id: 'ordens',        label: 'Ordens de Serviço', icon: 'Wrench',        group: 'Gestão' },
    { id: 'empresas',      label: 'Empresas',          icon: 'Building2',     group: 'Gestão' },
    { id: 'configuracoes', label: 'Configurações',     icon: 'Settings',      group: 'Gestão' },
];

const GRUPOS = ['Operação', 'Financeiro', 'Gestão'];

export default function CarretasPage() {
    const { profile, isAdmin } = useAuth();
    const [tab, setTab]           = useState('viagens');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const admin = isAdmin();
    const tabAtual = TABS.find(t => t.id === tab);

    const SidebarItem = ({ t }) => {
        const ativo = tab === t.id;
        return (
            <button
                onClick={() => { setTab(t.id); setDrawerOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                style={{
                    backgroundColor: ativo ? 'var(--color-primary)' : 'transparent',
                    color: ativo ? '#fff' : 'var(--color-muted-foreground)',
                }}>
                <Icon name={t.icon} size={16} color={ativo ? '#fff' : 'currentColor'} />
                <span>{t.label}</span>
            </button>
        );
    };

    const SidebarContent = () => (
        <nav className="flex flex-col gap-1 p-3">
            {/* Logo/título no topo da sidebar */}
            <div className="px-3 py-3 mb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <p className="font-heading font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    Transporte — Carretas
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                    Controle de viagens e fretes
                </p>
            </div>
            {GRUPOS.map(grupo => (
                <div key={grupo} className="mb-2">
                    <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--color-muted-foreground)', fontSize: 10 }}>
                        {grupo}
                    </p>
                    {TABS.filter(t => t.group === grupo).map(t => (
                        <SidebarItem key={t.id} t={t} />
                    ))}
                </div>
            ))}
        </nav>
    );

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-2xl mx-auto">
                    <div className="flex">

                        {/* ── Sidebar desktop (lg+) ──────────────────────── */}
                        <aside className="hidden lg:flex flex-col flex-shrink-0 sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto border-r"
                            style={{ width: 220, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                            <SidebarContent />
                        </aside>

                        {/* ── Conteúdo principal ─────────────────────────── */}
                        <div className="flex-1 min-w-0 px-4 sm:px-6 py-6">
                            <BreadcrumbTrail className="mb-4" />

                            {/* Header com botão hamburger no mobile/tablet */}
                            <div className="flex items-center justify-between mb-6 gap-3">
                                <div>
                                    <h1 className="font-heading font-bold text-xl sm:text-2xl" style={{ color: 'var(--color-text-primary)' }}>
                                        {tabAtual?.label || 'Transporte — Carretas'}
                                    </h1>
                                    <p className="text-xs sm:text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                        Controle de viagens, frota e fretes de cimento
                                    </p>
                                </div>
                                {/* Botão menu — apenas em telas < lg */}
                                <button
                                    onClick={() => setDrawerOpen(true)}
                                    className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium flex-shrink-0 transition-colors hover:bg-gray-50"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                    <Icon name="Menu" size={18} color="currentColor" />
                                    <span className="hidden sm:inline">{tabAtual?.label}</span>
                                </button>
                            </div>

                            {/* Conteúdo da aba */}
                            {tab === 'viagens'        && <TabViagens        isAdmin={admin} profile={profile} />}
                            {tab === 'veiculos'       && <TabVeiculos       isAdmin={admin} />}
                            {tab === 'abastecimentos' && <TabAbastecimentos  isAdmin={admin} profile={profile} />}
                            {tab === 'checklist'      && <TabChecklist      isAdmin={admin} profile={profile} />}
                            {tab === 'carregamentos'  && <TabCarregamentos   isAdmin={admin} />}
                            {tab === 'bonificacoes'   && <TabBonificacoes   isAdmin={admin} />}
                            {tab === 'despesas'       && <TabDespesasExtras  isAdmin={admin} profile={profile} />}
                            {tab === 'diarias'         && <TabDiarias         isAdmin={admin} profile={profile} />}
                            {tab === 'financeiro'     && <TabRelatorioFinanceiro isAdmin={admin} />}
                            {tab === 'ordens'          && <TabOrdensServico  isAdmin={admin} profile={profile} />}
                            {tab === 'empresas'       && <TabEmpresas       isAdmin={admin} />}
                            {tab === 'configuracoes'  && <TabConfiguracoes  isAdmin={admin} />}
                        </div>
                    </div>
                </div>
            </main>

            {/* ── Drawer mobile/tablet (< lg) ──────────────────────────── */}
            {drawerOpen && (
                <>
                    {/* Overlay */}
                    <div
                        className="fixed inset-0 z-40 lg:hidden"
                        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                        onClick={() => setDrawerOpen(false)}
                    />
                    {/* Painel deslizante da esquerda */}
                    <div className="fixed top-0 left-0 bottom-0 z-50 lg:hidden flex flex-col overflow-y-auto shadow-2xl"
                        style={{ width: 260, backgroundColor: 'var(--color-card)' }}>
                        {/* Header do drawer */}
                        <div className="flex items-center justify-between px-4 py-4 border-b flex-shrink-0"
                            style={{ borderColor: 'var(--color-border)', paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
                            <div>
                                <p className="font-heading font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                    Transporte — Carretas
                                </p>
                                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Navegação</p>
                            </div>
                            <button
                                onClick={() => setDrawerOpen(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                                <Icon name="X" size={20} color="var(--color-muted-foreground)" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <SidebarContent />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
