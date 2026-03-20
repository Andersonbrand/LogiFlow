import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import { useAuth } from 'utils/AuthContext';
import { fetchCorredores, CORREDORES_PADRAO } from 'utils/corredoresService';
import {
    fetchViagens, createViagem, updateViagem, deleteViagem,
    fetchCarretasVeiculos, createCarretaVeiculo, updateCarretaVeiculo, deleteCarretaVeiculo,
    fetchAbastecimentos, createAbastecimento, deleteAbastecimento,
    fetchChecklists, createChecklist, aprovarChecklist, registrarManutencaoChecklist,
    fetchCarregamentos, createCarregamento, updateCarregamento, deleteCarregamento,
    fetchEmpresas, createEmpresa, updateEmpresa, deleteEmpresa,
    fetchCarreteiros, fetchTodosMotoristas,
    fetchConfigAbastecimento, saveConfigAbastecimento,
    CHECKLIST_ITENS, TIPOS_CALCULO_FRETE, calcularFrete, calcularBonusCarreteiro,
    aprovarChecklistComNotificacao, reprovarChecklistComNotificacao,
    fetchOrdensServico, createOrdemServico, updateOrdemServico,
    fetchMecanicos,
    fetchDespesasExtras, createDespesaExtra, updateDespesaExtra, deleteDespesaExtra,
    fetchDiarias, createDiaria, updateDiaria, deleteDiaria,
    CATEGORIAS_DESPESA, fetchCategoriasDespesa, createCategoriaDespesa,
    CIDADES_BONUS_BAIXO, BONUS_BAIXO, BONUS_ALTO,
    fetchPostos, createPosto, updatePosto, deletePosto,
    fetchRomaneiosCarreta, createRomaneioCarreta, updateRomaneioCarreta,
    aprovarRomaneioCarreta, deleteRomaneioCarreta,
} from 'utils/carretasService';
import { fetchMaterials } from 'utils/materialService';
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: '68px' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
                style={{ maxHeight: 'calc(100dvh - 76px)' }}>
                {children}
            </div>
        </div>
    );
}

function ModalHeader({ title, icon, onClose }) {
    return (
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0 rounded-t-2xl"
            style={{ borderColor: 'var(--color-border)' }}>
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
    const { confirm, ConfirmDialog } = useConfirm();
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
            // Se não for admin, filtra apenas as viagens deste motorista
            const filtros = {};
            if (filterStatus) filtros.status = filterStatus;
            if (!isAdmin && profile?.id) filtros.motoristaId = profile.id;

            const [v, ve, m] = await Promise.all([
                fetchViagens(filtros),
                fetchCarretasVeiculos(),
                isAdmin ? fetchTodosMotoristas() : Promise.resolve([]),
            ]);
            setViagens(v); setVeiculos(ve); setMotoristas(m);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filterStatus, isAdmin, profile?.id]); // eslint-disable-line

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
        if (!await confirm({ title: 'Excluir viagem?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir' })) return;
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
                    <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar em tempo real">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    {isAdmin && (
                        <>
                            <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                                <Icon name="FileDown" size={14} /> Exportar
                            </button>
                            <Button onClick={openCreate} iconName="Plus" size="sm">Nova Viagem</Button>
                        </>
                    )}
                </div>
            </div>

            {/* Cabeçalho informativo para o motorista */}
            {!isAdmin && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <Icon name="Info" size={15} color="#1D4ED8" />
                    <p className="text-xs text-blue-700">Exibindo suas viagens lançadas pela administração. Entre em contato com o admin para atualizações.</p>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : isAdmin ? (
                /* ── Visão admin: tabela completa ── */
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[700px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>
                                {['Nº Viagem','Status','Motorista','Placa','Data Saída','Destino','Ton.','Responsável',''].map(h => (
                                    <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {viagens.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem cadastrada</td></tr>
                            ) : viagens.map((v, i) => (
                                <tr key={v.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-3 py-3 font-medium text-blue-700 font-data whitespace-nowrap">{v.numero}</td>
                                    <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={v.status} /></td>
                                    <td className="px-3 py-3 whitespace-nowrap">{v.motorista?.name || '—'}</td>
                                    <td className="px-3 py-3 font-data whitespace-nowrap">{v.veiculo?.placa || '—'}</td>
                                    <td className="px-3 py-3 whitespace-nowrap">{FMT_DATE(v.data_saida)}</td>
                                    <td className="px-3 py-3 max-w-[140px] truncate">{v.destino || '—'}</td>
                                    <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)' }}>{v.toneladas || '—'}</td>
                                    <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)' }}>{v.responsavel_cadastro || '—'}</td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openEdit(v)} className="p-1.5 rounded hover:bg-blue-50 transition-colors"><Icon name="Pencil" size={14} color="#1D4ED8" /></button>
                                            <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors"><Icon name="Trash2" size={14} color="#DC2626" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* ── Visão motorista: cards com suas próprias viagens ── */
                <div className="flex flex-col gap-3">
                    {viagens.length === 0 ? (
                        <div className="bg-white rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="Truck" size={36} color="var(--color-muted-foreground)" />
                            <p className="text-sm mt-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem encontrada para você</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>As viagens lançadas pelo admin aparecerão aqui</p>
                        </div>
                    ) : viagens.map(v => (
                        <div key={v.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-start justify-between mb-3 gap-2">
                                <div>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="font-bold font-data text-blue-700">{v.numero}</span>
                                        <StatusBadge status={v.status} />
                                    </div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{v.destino || '—'}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{FMT_DATE(v.data_saida)}</p>
                                    {v.veiculo?.placa && <p className="text-xs font-data font-medium mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{v.veiculo.placa}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {v.toneladas && (
                                    <div className="flex items-center gap-1.5 p-2 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                                        <Icon name="Weight" size={12} color="var(--color-muted-foreground)" />
                                        <span style={{ color: 'var(--color-muted-foreground)' }}>{v.toneladas} ton</span>
                                    </div>
                                )}
                                {v.responsavel_cadastro && (
                                    <div className="flex items-center gap-1.5 p-2 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                                        <Icon name="User" size={12} color="var(--color-muted-foreground)" />
                                        <span style={{ color: 'var(--color-muted-foreground)' }}>Resp: {v.responsavel_cadastro}</span>
                                    </div>
                                )}
                            </div>
                            {v.observacoes && (
                                <p className="text-xs mt-2 p-2 rounded-lg bg-amber-50 text-amber-700">{v.observacoes}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal novo/editar viagem — apenas admin */}
            {modal && isAdmin && (
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
                    <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Veículos ────────────────────────────────────────────────────────────
function TabVeiculos({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
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
        if (!await confirm({ title: 'Excluir veículo?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir' })) return;
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
                    <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Abastecimentos ──────────────────────────────────────────────────────
function TabAbastecimentos({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [abast, setAbast] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [postos, setPostos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [modalPostos, setModalPostos] = useState(false);
    const [editPosto, setEditPosto] = useState(null);
    const [formPosto, setFormPosto] = useState({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' });
    const [filtro, setFiltro] = useState({ motoristaId: '', veiculoId: '', mes: '' });
    const [form, setForm] = useState({ motorista_id: '', veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto_id: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', observacoes: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.motoristaId) f.motoristaId = filtro.motoristaId;
            if (filtro.veiculoId)   f.veiculoId   = filtro.veiculoId;
            if (filtro.mes)         { f.dataInicio = filtro.mes + '-01'; f.dataFim = filtro.mes + '-' + String(new Date(Number(filtro.mes.split('-')[0]), Number(filtro.mes.split('-')[1]), 0).getDate()).padStart(2,'0'); }
            const [a, v, m, p] = await Promise.all([fetchAbastecimentos(f), fetchCarretasVeiculos(), fetchTodosMotoristas(), fetchPostos().catch(() => [])]);
            setAbast(a); setVeiculos(v); setMotoristas(m); setPostos(p);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const totais = useMemo(() => ({
        litrosDiesel: abast.reduce((s, a) => s + Number(a.litros_diesel || 0), 0),
        litrosArla:   abast.reduce((s, a) => s + Number(a.litros_arla   || 0), 0),
        valorDiesel:  abast.reduce((s, a) => s + Number(a.valor_diesel  || 0), 0),
        valorArla:    abast.reduce((s, a) => s + Number(a.valor_arla    || 0), 0),
        valorTotal:   abast.reduce((s, a) => s + Number(a.valor_total   || 0), 0),
    }), [abast]);

    const handleSubmit = async () => {
        if (!form.veiculo_id || !form.motorista_id || !form.data_abastecimento) { showToast('Preencha veículo, motorista e data', 'error'); return; }
        const payload = { ...form };
        if (!payload.posto_id) delete payload.posto_id;
        // nome do posto para exibição legacy
        const posto = postos.find(p => p.id === form.posto_id);
        if (posto) payload.posto = posto.nome;
        try { await createAbastecimento(payload); showToast('Abastecimento registrado!', 'success'); setModal(false); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDelete = async (id) => {
        if (!await confirm({ title: 'Excluir abastecimento?', message: 'Este registro será removido permanentemente.', confirmLabel: 'Excluir' })) return;
        try { await deleteAbastecimento(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleSavePosto = async () => {
        if (!formPosto.nome.trim()) { showToast('Nome do posto é obrigatório', 'error'); return; }
        try {
            if (editPosto) { await updatePosto(editPosto.id, formPosto); showToast('Posto atualizado!', 'success'); }
            else { await createPosto(formPosto); showToast('Posto cadastrado!', 'success'); }
            setEditPosto(null); setFormPosto({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' });
            const p = await fetchPostos().catch(() => []); setPostos(p);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    // Auto-preenche preços quando motorista seleciona o posto
    const handlePostoChange = (postoId) => {
        const posto = postos.find(p => p.id === postoId);
        setForm(f => ({
            ...f,
            posto_id: postoId,
            // Preenche valor automaticamente se o posto tiver preço cadastrado
            valor_diesel: posto?.preco_diesel && f.litros_diesel
                ? (Number(f.litros_diesel) * Number(posto.preco_diesel)).toFixed(2)
                : f.valor_diesel,
            valor_arla: posto?.preco_arla && f.litros_arla
                ? (Number(f.litros_arla) * Number(posto.preco_arla)).toFixed(2)
                : f.valor_arla,
        }));
    };

    // Recalcula valor ao mudar litros quando posto já está selecionado
    const handleLitrosChange = (campo, valor) => {
        const posto = postos.find(p => p.id === form.posto_id);
        setForm(f => {
            const novo = { ...f, [campo]: valor };
            if (campo === 'litros_diesel' && posto?.preco_diesel) {
                novo.valor_diesel = valor ? (Number(valor) * Number(posto.preco_diesel)).toFixed(2) : '';
            }
            if (campo === 'litros_arla' && posto?.preco_arla) {
                novo.valor_arla = valor ? (Number(valor) * Number(posto.preco_arla)).toFixed(2) : '';
            }
            return novo;
        });
    };
    const handleDeletePosto = async (id) => {
        if (!await confirm({ title: 'Excluir posto?', message: 'Os abastecimentos vinculados a este posto não serão afetados.', confirmLabel: 'Excluir' })) return;
        try { await deletePosto(id); showToast('Excluído!', 'success'); const p = await fetchPostos().catch(() => []); setPostos(p); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        if (!abast.length) { showToast('Nenhum abastecimento encontrado para exportar.', 'error'); return; }
        const rows = abast.map(a => ({
            'Data': FMT_DATE(a.data_abastecimento), 'Horário': a.horario || '', 'Motorista': a.motorista?.name || '', 'Placa': a.veiculo?.placa || '',
            'Posto': a.posto || '', 'L. Diesel': Number(a.litros_diesel || 0), 'R$ Diesel': Number(a.valor_diesel || 0),
            'L. Arla': Number(a.litros_arla || 0), 'R$ Arla': Number(a.valor_arla || 0), 'Total R$': Number(a.valor_total || 0),
            'Observações': a.observacoes || '',
        }));
        // linha totais
        rows.push({ 'Data': 'TOTAL', 'L. Diesel': totais.litrosDiesel, 'R$ Diesel': totais.valorDiesel, 'L. Arla': totais.litrosArla, 'R$ Arla': totais.valorArla, 'Total R$': totais.valorTotal });
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [12,8,20,12,18,10,12,10,12,12,25].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Abastecimentos');
        XLSX.writeFile(wb, `abastecimentos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const postoNome = (a) => a.posto || (postos.find(p => p.id === a.posto_id)?.nome) || '—';

    return (
        <div>
            <div className="flex flex-wrap gap-2 items-center justify-between mb-5">
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
                <div className="flex gap-2 flex-wrap">
                    {/* item 4: botão atualizar */}
                    <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    {isAdmin && (
                        <button onClick={() => setModalPostos(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="MapPin" size={14} /> Postos
                        </button>
                    )}
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}><Icon name="FileDown" size={14} /> Exportar</button>
                    <Button onClick={() => { setForm({ motorista_id: isAdmin ? '' : (profile?.id || ''), veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto_id: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', observacoes: '' }); setModal(true); }} iconName="Plus" size="sm">Registrar</Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                    { l: 'Diesel (L)', v: totais.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#1D4ED8', bg: '#EFF6FF', i: 'Fuel' },
                    { l: 'Custo Diesel', v: BRL(totais.valorDiesel), c: '#1D4ED8', bg: '#EFF6FF', i: 'DollarSign' },
                    { l: 'Arla (L)', v: totais.litrosArla.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#059669', bg: '#D1FAE5', i: 'Droplets' },
                    { l: 'Gasto Total', v: BRL(totais.valorTotal), c: '#7C3AED', bg: '#EDE9FE', i: 'Receipt' },
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
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[700px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Data','Motorista','Placa','Posto','Diesel (L)','R$ Diesel','Arla (L)','R$ Arla','Total',''].map(h => <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {abast.length === 0 ? <tr><td colSpan={10} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum abastecimento registrado</td></tr>
                            : abast.map((a, i) => (
                                <tr key={a.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-3 py-3 whitespace-nowrap">{FMT_DATE(a.data_abastecimento)}</td>
                                    <td className="px-3 py-3 whitespace-nowrap">{a.motorista?.name || '—'}</td>
                                    <td className="px-3 py-3 font-data whitespace-nowrap">{a.veiculo?.placa || '—'}</td>
                                    <td className="px-3 py-3 text-xs max-w-[120px] truncate">{postoNome(a)}</td>
                                    <td className="px-3 py-3 font-data text-right text-blue-700">{Number(a.litros_diesel || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                    <td className="px-3 py-3 font-data text-right">{BRL(a.valor_diesel)}</td>
                                    <td className="px-3 py-3 font-data text-right text-emerald-600">{Number(a.litros_arla || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                    <td className="px-3 py-3 font-data text-right text-emerald-700">{BRL(a.valor_arla)}</td>
                                    <td className="px-3 py-3 font-data text-right font-semibold text-purple-600">{BRL(a.valor_total)}</td>
                                    <td className="px-3 py-3">{isAdmin && <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={13} color="#DC2626" /></button>}</td>
                                </tr>
                            ))}
                        </tbody>
                        {abast.length > 0 && (
                            <tfoot>
                                <tr style={{ backgroundColor: '#F0F9FF', borderTop: '2px solid #BFDBFE' }}>
                                    <td colSpan={4} className="px-3 py-2 text-xs font-bold text-blue-800">TOTAL</td>
                                    <td className="px-3 py-2 font-data font-bold text-right text-blue-700">{totais.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                    <td className="px-3 py-2 font-data font-bold text-right text-blue-700">{BRL(totais.valorDiesel)}</td>
                                    <td className="px-3 py-2 font-data font-bold text-right text-emerald-700">{totais.litrosArla.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                    <td className="px-3 py-2 font-data font-bold text-right text-emerald-700">{BRL(totais.valorArla)}</td>
                                    <td className="px-3 py-2 font-data font-bold text-right text-purple-700">{BRL(totais.valorTotal)}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}

            {/* Modal registrar abastecimento */}
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
                        <Field label="Posto" required>
                            <select value={form.posto_id} onChange={e => handlePostoChange(e.target.value)} className={inputCls} style={inputStyle}>
                                <option value="">Selecione o posto...</option>
                                {postos.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.nome}{p.cidade ? ` — ${p.cidade}` : ''}
                                        {p.preco_diesel ? ` · D: R$${Number(p.preco_diesel).toFixed(3)}` : ''}
                                        {p.preco_arla ? ` · A: R$${Number(p.preco_arla).toFixed(3)}` : ''}
                                    </option>
                                ))}
                            </select>
                            {postos.length === 0 && <p className="text-xs text-amber-600 mt-1">Nenhum posto cadastrado. Peça ao admin para cadastrar.</p>}
                            {/* Exibe preços do posto selecionado */}
                            {form.posto_id && postos.find(p => p.id === form.posto_id) && (() => {
                                const p = postos.find(px => px.id === form.posto_id);
                                return (p.preco_diesel || p.preco_arla) ? (
                                    <div className="flex gap-3 mt-1.5 text-xs">
                                        {p.preco_diesel && <span className="text-blue-600 font-medium">🛢️ Diesel: R$ {Number(p.preco_diesel).toFixed(3)}/L</span>}
                                        {p.preco_arla && <span className="text-emerald-600 font-medium">💧 Arla: R$ {Number(p.preco_arla).toFixed(3)}/L</span>}
                                    </div>
                                ) : null;
                            })()}
                        </Field>
                        <div />
                        <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                            <p className="text-xs font-semibold text-blue-700 mb-3">🛢️ Diesel</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Litros diesel">
                                    <input type="number" step="0.01" value={form.litros_diesel}
                                        onChange={e => handleLitrosChange('litros_diesel', e.target.value)}
                                        className={inputCls} style={inputStyle} placeholder="0,00" />
                                </Field>
                                <Field label="Valor R$">
                                    <input type="number" step="0.01" value={form.valor_diesel}
                                        onChange={e => setForm(f => ({ ...f, valor_diesel: e.target.value }))}
                                        className={inputCls} style={inputStyle} placeholder="0,00" />
                                </Field>
                            </div>
                        </div>
                        <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                            <p className="text-xs font-semibold text-emerald-700 mb-3">💧 ARLA 32</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Litros arla">
                                    <input type="number" step="0.01" value={form.litros_arla}
                                        onChange={e => handleLitrosChange('litros_arla', e.target.value)}
                                        className={inputCls} style={inputStyle} placeholder="0,00" />
                                </Field>
                                <Field label="Valor R$">
                                    <input type="number" step="0.01" value={form.valor_arla}
                                        onChange={e => setForm(f => ({ ...f, valor_arla: e.target.value }))}
                                        className={inputCls} style={inputStyle} placeholder="0,00" />
                                </Field>
                            </div>
                        </div>
                        <div className="sm:col-span-2">
                            <Field label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                        </div>
                    </div>
                    <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal gerenciar postos (admin) */}
            {modalPostos && isAdmin && (
                <ModalOverlay onClose={() => { setModalPostos(false); setEditPosto(null); setFormPosto({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' }); }}>
                    <ModalHeader title="Gerenciar Postos de Combustível" icon="MapPin" onClose={() => { setModalPostos(false); setEditPosto(null); setFormPosto({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' }); }} />
                    <div className="p-5">
                        {/* Formulário add/edit */}
                        <div className="p-4 rounded-xl border mb-4" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                                {editPosto ? '✏️ Editar Posto' : '➕ Novo Posto'}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Nome do posto" required>
                                    <input value={formPosto.nome} onChange={e => setFormPosto(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Posto Shell Centro" />
                                </Field>
                                <Field label="Cidade">
                                    <input value={formPosto.cidade} onChange={e => setFormPosto(f => ({ ...f, cidade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Guanambi" />
                                </Field>
                                <Field label="CNPJ (opcional)">
                                    <input value={formPosto.cnpj} onChange={e => setFormPosto(f => ({ ...f, cnpj: e.target.value }))} className={inputCls} style={inputStyle} placeholder="00.000.000/0001-00" />
                                </Field>
                            </div>
                            {/* Preços de combustível */}
                            <div className="grid grid-cols-2 gap-3 mt-3 p-3 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                <div>
                                    <label className="block text-xs font-semibold text-blue-700 mb-1.5">🛢️ Preço Diesel (R$/L)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-600">R$</span>
                                        <input type="number" step="0.001" min="0" value={formPosto.preco_diesel}
                                            onChange={e => setFormPosto(f => ({ ...f, preco_diesel: e.target.value }))}
                                            className={inputCls + ' pl-8'} style={inputStyle} placeholder="6,800" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-emerald-700 mb-1.5">💧 Preço Arla (R$/L)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-600">R$</span>
                                        <input type="number" step="0.001" min="0" value={formPosto.preco_arla}
                                            onChange={e => setFormPosto(f => ({ ...f, preco_arla: e.target.value }))}
                                            className={inputCls + ' pl-8'} style={inputStyle} placeholder="3,200" />
                                    </div>
                                </div>
                                <p className="col-span-2 text-xs text-blue-600">Preços preenchidos automaticamente ao motorista selecionar este posto no abastecimento.</p>
                            </div>
                            <div className="flex gap-2 mt-3">
                                <Button onClick={handleSavePosto} size="sm" iconName={editPosto ? 'Save' : 'Plus'}>{editPosto ? 'Atualizar Posto' : 'Adicionar Posto'}</Button>
                                {editPosto && (
                                    <button onClick={() => { setEditPosto(null); setFormPosto({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' }); }}
                                        className="px-3 py-1.5 rounded-lg border text-xs hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Lista de postos */}
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Postos cadastrados ({postos.length})</p>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {postos.length === 0 && <p className="text-sm text-center py-6" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum posto cadastrado</p>}
                            {postos.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{p.nome}</p>
                                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                            {p.cidade && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{p.cidade}</span>}
                                            {p.preco_diesel && (
                                                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                    🛢️ R$ {Number(p.preco_diesel).toFixed(3)}/L
                                                </span>
                                            )}
                                            {p.preco_arla && (
                                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                    💧 R$ {Number(p.preco_arla).toFixed(3)}/L
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                        <button onClick={() => {
                                            setEditPosto(p);
                                            setFormPosto({ nome: p.nome, cidade: p.cidade || '', cnpj: p.cnpj || '', preco_diesel: p.preco_diesel || '', preco_arla: p.preco_arla || '' });
                                        }} className="p-1.5 rounded hover:bg-blue-50"><Icon name="Pencil" size={13} color="#1D4ED8" /></button>
                                        <button onClick={() => handleDeletePosto(p.id)} className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={13} color="#DC2626" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </ModalOverlay>
            )}
                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
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
    const [form, setForm] = useState({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '', fotos_urls: [] });
    const [galeriaPreviews, setGaleriaPreviews] = useState([]);
    const [modalGaleria, setModalGaleria] = useState(null);
    const fotoRef = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [c, v, m] = await Promise.all([fetchChecklists(filtro === 'pendentes' ? { pendente: true } : {}), fetchCarretasVeiculos(), fetchTodosMotoristas()]);
            setChecklists(c); setVeiculos(v); setMotoristas(m);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const handleFotoChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const MAX_SIZE = 5 * 1024 * 1024;
        const tooBig = files.filter(f => f.size > MAX_SIZE);
        if (tooBig.length) { showToast(`${tooBig.length} foto(s) muito grande(s) (máx 5MB cada)`, 'error'); return; }
        const MAX_FOTOS = 6;
        const restam = MAX_FOTOS - galeriaPreviews.length;
        if (restam <= 0) { showToast(`Máximo de ${MAX_FOTOS} fotos atingido`, 'error'); return; }
        const filesToAdd = files.slice(0, restam);
        if (files.length > restam) showToast(`Apenas ${restam} foto(s) adicionada(s)`, 'info');
        filesToAdd.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const b64 = ev.target.result;
                setGaleriaPreviews(prev => [...prev, b64]);
                setForm(f => ({ ...f, fotos_urls: [...(f.fotos_urls || []), b64], foto_url: f.foto_url || b64 }));
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const removerFoto = (idx) => {
        setGaleriaPreviews(prev => prev.filter((_, i) => i !== idx));
        setForm(f => { const novas = (f.fotos_urls || []).filter((_, i) => i !== idx); return { ...f, fotos_urls: novas, foto_url: novas[0] || '' }; });
    };

    const resetForm = () => {
        setForm({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '', fotos_urls: [] });
        setGaleriaPreviews([]);
    };

    const handleSubmit = async () => {
        if (!form.veiculo_id) { showToast('Selecione o veículo', 'error'); return; }
        const semana = new Date(); semana.setDate(semana.getDate() - semana.getDay() + 1);
        try {
            await createChecklist({ ...form, motorista_id: profile.id, semana_ref: semana.toISOString().split('T')[0] });
            showToast('Checklist enviado!', 'success'); setModal(null); resetForm(); load();
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

    const getFotos = (c) => {
        const arr = Array.isArray(c.fotos_urls) && c.fotos_urls.length > 0 ? c.fotos_urls : c.foto_url ? [c.foto_url] : [];
        return arr.filter(Boolean);
    };

    return (
        <div>
            <div className="flex flex-wrap gap-2 items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                        {[['pendentes','Pendentes'], ['todos','Todos']].map(([v, l]) => (
                            <button key={v} onClick={() => setFiltro(v)} className="px-4 py-2 text-xs font-medium transition-colors"
                                style={filtro === v ? { backgroundColor: 'var(--color-primary)', color: '#fff' } : { backgroundColor: 'white', color: 'var(--color-muted-foreground)' }}>{l}</button>
                        ))}
                    </div>
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                </div>
                <Button onClick={() => { resetForm(); setModal(true); }} iconName="ClipboardCheck" size="sm">Novo Checklist</Button>
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="flex flex-col gap-4">
                    {checklists.length === 0 && <div className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum checklist encontrado</div>}
                    {checklists.map(c => {
                        const itens = c.itens || {};
                        const ok = Object.values(itens).filter(Boolean).length;
                        const total = CHECKLIST_ITENS.length;
                        const fotos = getFotos(c);
                        return (
                            <div key={c.id} className="bg-white rounded-xl border p-4 sm:p-5 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-start justify-between mb-3 gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{c.motorista?.name || '—'}</p>
                                            <span className="text-xs font-data text-gray-400">— {c.veiculo?.placa || '—'}</span>
                                        </div>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                            Semana de {c.semana_ref ? new Date(c.semana_ref + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                        {c.aprovado
                                            ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap"><Icon name="CheckCircle2" size={11} />Aprovado</span>
                                            : <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap"><Icon name="Clock" size={11} />Pendente</span>
                                        }
                                        {c.manutencao_registrada && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 whitespace-nowrap"><Icon name="Wrench" size={11} />Manutenção</span>}
                                        {fotos.length > 0 && (
                                            <button onClick={() => setModalGaleria({ fotos, idx: 0 })}
                                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors whitespace-nowrap">
                                                <Icon name="Camera" size={11} />
                                                {fotos.length > 1 ? `${fotos.length} fotos` : 'Foto'}
                                            </button>
                                        )}
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
                                {fotos.length > 0 && (
                                    <div className="flex gap-2 mb-3 flex-wrap">
                                        {fotos.map((foto, idx) => (
                                            <button key={idx} onClick={() => setModalGaleria({ fotos, idx })}
                                                className="rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                                                style={{ borderColor: 'var(--color-border)' }}>
                                                <img src={foto} alt={`Foto ${idx + 1}`} className="object-cover" style={{ width: 64, height: 64 }} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {(c.problemas || c.necessidades || c.observacoes_livres) && (
                                    <div className="text-xs space-y-1 mb-3 p-3 rounded-lg bg-gray-50">
                                        {c.problemas && <p><span className="font-medium text-red-600">⚠ Problemas:</span> {c.problemas}</p>}
                                        {c.necessidades && <p><span className="font-medium text-amber-600">🔧 Necessidades:</span> {c.necessidades}</p>}
                                        {c.observacoes_livres && <p><span className="font-medium text-gray-500">Obs:</span> {c.observacoes_livres}</p>}
                                    </div>
                                )}
                                {c.obs_manutencao && (
                                    <div className="text-xs p-2 rounded-lg mb-3" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                        <span className="font-medium text-orange-700">Manutenção registrada:</span> {c.obs_manutencao}
                                    </div>
                                )}
                                {isAdmin && !c.aprovado && (
                                    <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
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
                <ModalOverlay onClose={() => { setModal(null); resetForm(); }}>
                    <ModalHeader title="Checklist Semanal" icon="ClipboardCheck" onClose={() => { setModal(null); resetForm(); }} />
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
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
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                    📷 Fotos do problema <span className="text-gray-400 font-normal">(até 6 fotos)</span>
                                </label>
                                {galeriaPreviews.length > 0 && <span className="text-xs font-medium text-blue-600">{galeriaPreviews.length}/6</span>}
                            </div>
                            {galeriaPreviews.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {galeriaPreviews.map((src, idx) => (
                                        <div key={idx} className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)', aspectRatio: '1' }}>
                                            <img src={src} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => removerFoto(idx)}
                                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600">✕</button>
                                            <span className="absolute bottom-1 left-1 text-xs text-white font-bold bg-black/50 px-1 rounded">{idx + 1}</span>
                                        </div>
                                    ))}
                                    {galeriaPreviews.length < 6 && (
                                        <button type="button" onClick={() => fotoRef.current?.click()}
                                            className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 hover:bg-blue-50 transition-colors"
                                            style={{ borderColor: '#93C5FD', aspectRatio: '1' }}>
                                            <Icon name="Plus" size={20} color="#1D4ED8" />
                                            <span className="text-xs text-blue-600">Adicionar</span>
                                        </button>
                                    )}
                                </div>
                            )}
                            {galeriaPreviews.length === 0 && (
                                <button type="button" onClick={() => fotoRef.current?.click()}
                                    className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed hover:bg-blue-50 transition-colors"
                                    style={{ borderColor: '#93C5FD' }}>
                                    <Icon name="Camera" size={28} color="#1D4ED8" />
                                    <span className="text-sm text-blue-600 font-medium">Tirar foto ou escolher da galeria</span>
                                    <span className="text-xs text-gray-400">Você pode adicionar até 6 fotos</span>
                                </button>
                            )}
                            <input ref={fotoRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFotoChange} className="hidden" />
                        </div>
                        <Field label="Observações livres"><textarea value={form.observacoes_livres} onChange={e => setForm(f => ({ ...f, observacoes_livres: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                    </div>
                    <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => { setModal(null); resetForm(); }} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
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
                    <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModalManut(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleManutencao} size="sm" iconName="Wrench">Registrar</Button>
                    </div>
                </ModalOverlay>
            )}

            {modalGaleria && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.92)' }} onClick={() => setModalGaleria(null)}>
                    <div className="relative w-full max-w-3xl px-4" onClick={e => e.stopPropagation()}>
                        <img src={modalGaleria.fotos[modalGaleria.idx]} alt={`Foto ${modalGaleria.idx + 1}`}
                            className="w-full rounded-2xl object-contain shadow-2xl" style={{ maxHeight: '75vh' }} />
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                            {modalGaleria.idx + 1} / {modalGaleria.fotos.length}
                        </div>
                        <button onClick={() => setModalGaleria(null)} className="absolute top-3 right-4 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                            <Icon name="X" size={16} color="white" />
                        </button>
                        {modalGaleria.fotos.length > 1 && modalGaleria.idx > 0 && (
                            <button onClick={() => setModalGaleria(g => ({ ...g, idx: g.idx - 1 }))}
                                className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                                <Icon name="ChevronLeft" size={20} color="white" />
                            </button>
                        )}
                        {modalGaleria.fotos.length > 1 && modalGaleria.idx < modalGaleria.fotos.length - 1 && (
                            <button onClick={() => setModalGaleria(g => ({ ...g, idx: g.idx + 1 }))}
                                className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                                <Icon name="ChevronRight" size={20} color="white" />
                            </button>
                        )}
                        {modalGaleria.fotos.length > 1 && (
                            <div className="flex gap-2 justify-center mt-4 flex-wrap">
                                {modalGaleria.fotos.map((f, i) => (
                                    <button key={i} onClick={() => setModalGaleria(g => ({ ...g, idx: i }))}
                                        className="rounded-lg overflow-hidden transition-all"
                                        style={{ border: `2px solid ${i === modalGaleria.idx ? '#3B82F6' : 'transparent'}`, opacity: i === modalGaleria.idx ? 1 : 0.6 }}>
                                        <img src={f} alt="" className="object-cover" style={{ width: 52, height: 52 }} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}


// ─── TAB: Carregamentos ───────────────────────────────────────────────────────
function TabCarregamentos({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
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
        if (!await confirm({ title: 'Excluir carregamento?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir' })) return;
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
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
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
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[640px]">
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
                    <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Empresas ────────────────────────────────────────────────────────────
function TabEmpresas({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    // modal: false | { mode: 'create' | 'edit', data?: empresa }
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState({ nome: '', cnpj: '', observacoes: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try { setEmpresas(await fetchEmpresas()); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, []); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const openCreate = () => { setForm({ nome: '', cnpj: '', observacoes: '' }); setModal({ mode: 'create' }); };
    const openEdit = (emp) => { setForm({ nome: emp.nome, cnpj: emp.cnpj || '', observacoes: emp.observacoes || '' }); setModal({ mode: 'edit', data: emp }); };

    const handleSubmit = async () => {
        if (!form.nome.trim()) { showToast('Nome é obrigatório', 'error'); return; }
        try {
            if (modal.mode === 'edit') {
                await updateEmpresa(modal.data.id, form);
                showToast('Empresa atualizada!', 'success');
            } else {
                await createEmpresa(form);
                showToast('Empresa cadastrada!', 'success');
            }
            setModal(false); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (emp) => {
        if (!await confirm({ title: `Excluir "${emp.nome}"?`, message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir' })) return;
        try {
            await deleteEmpresa(emp.id);
            showToast('Excluída!', 'success'); load();
        } catch (e) {
            // Erro de FK: empresa está vinculada a carregamentos
            const msg = e?.message || '';
            if (msg.includes('foreign key') || msg.includes('fkey') || msg.includes('violates')) {
                showToast(`Não é possível excluir "${emp.nome}" pois ela está vinculada a carregamentos. Edite ou desative-a.`, 'error');
            } else {
                showToast('Erro: ' + msg, 'error');
            }
        }
    };

    return (
        <div>
            <div className="flex justify-end mb-5">
                {isAdmin && <Button onClick={openCreate} iconName="Plus" size="sm">Nova Empresa</Button>}
            </div>
            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[640px]">
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
                                    <td className="px-4 py-3">
                                        {isAdmin && (
                                            <div className="flex gap-1">
                                                <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-blue-50" title="Editar empresa">
                                                    <Icon name="Pencil" size={13} color="#1D4ED8" />
                                                </button>
                                                <button onClick={() => handleDelete(e)} className="p-1.5 rounded hover:bg-red-50" title="Excluir empresa">
                                                    <Icon name="Trash2" size={13} color="#DC2626" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {modal && (
                <ModalOverlay onClose={() => setModal(false)}>
                    <ModalHeader title={modal.mode === 'edit' ? 'Editar Empresa' : 'Nova Empresa'} icon="Building2" onClose={() => setModal(false)} />
                    <div className="p-5 space-y-4">
                        <Field label="Nome da empresa" required><input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Comercial Araguaia" /></Field>
                        <Field label="CNPJ"><input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className={inputCls} style={inputStyle} placeholder="00.000.000/0000-00" /></Field>
                        <Field label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                    </div>
                    <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">{modal.mode === 'edit' ? 'Salvar Alterações' : 'Cadastrar'}</Button>
                    </div>
                </ModalOverlay>
            )}
                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
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
                <div className="flex gap-2">
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar Excel
                    </button>
                </div>
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
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[640px]">
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
                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Despesas Extras (por veículo) ──────────────────────────────────────
function TabDespesasExtras({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [despesas, setDespesas]   = useState([]);
    const [veiculos, setVeiculos]   = useState([]);
    const [categorias, setCategorias] = useState(CATEGORIAS_DESPESA);
    const [loading, setLoading]     = useState(true);
    const [modal, setModal]         = useState(null);
    const [filtro, setFiltro]       = useState({ veiculoId: '', categoria: '', mes: '' });
    // Nova categoria inline
    const [novaCategoria, setNovaCategoria] = useState('');
    const [showNovaCategoria, setShowNovaCategoria] = useState(false);
    const [savingCategoria, setSavingCategoria] = useState(false);
    const xmlRef = useRef(null);
    const comprovanteRef = useRef(null);
    const permutaRef = useRef(null);
    const barcodeInputRef = useRef(null);
    const [barcodeMode, setBarcodeMode] = useState(false);
    const [barcodeBuffer, setBarcodeBuffer] = useState('');
    const [loadingNFe, setLoadingNFe] = useState(false);

    const emptyForm = () => ({
        veiculo_id: '', categoria: categorias[0] || 'Pneus', descricao: '', valor: '',
        data_despesa: new Date().toISOString().split('T')[0], nota_fiscal: '',
        fornecedor: '', observacoes: '',
        forma_pagamento: 'a_vista',
        tipo_pagamento: 'pix',
        comprovante_url: '',
        boletos: [],
        permuta_obs: '',
        permuta_doc_url: '',
        cheques: [],
        nf_itens: [],
    });
    const [form, setForm] = useState(emptyForm());
    const [novoBoleto, setNovoBoleto] = useState({ vencimento: '', valor: '' });
    const [novoCheque, setNovoCheque] = useState({ numero: '', banco: '', valor: '', vencimento: '' });

    const loadCategorias = useCallback(async () => {
        const cats = await fetchCategoriasDespesa();
        setCategorias(cats);
    }, []);

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

    useEffect(() => { loadCategorias(); }, [loadCategorias]);
    useEffect(() => { load(); }, [load]);

    // Salvar nova categoria criada inline pelo admin
    const handleSalvarNovaCategoria = async () => {
        const nome = novaCategoria.trim();
        if (!nome) { showToast('Digite o nome da categoria', 'error'); return; }
        if (categorias.includes(nome)) { showToast('Categoria já existe', 'error'); return; }
        setSavingCategoria(true);
        try {
            await createCategoriaDespesa(nome);
            await loadCategorias();
            setForm(f => ({ ...f, categoria: nome }));
            setNovaCategoria('');
            setShowNovaCategoria(false);
            showToast(`Categoria "${nome}" criada!`, 'success');
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingCategoria(false); }
    };

    const totalPeriodo = useMemo(() => despesas.reduce((s, d) => s + Number(d.valor || 0), 0), [despesas]);
    const totalPorCategoria = useMemo(() => {
        const acc = {};
        despesas.forEach(d => { acc[d.categoria] = (acc[d.categoria] || 0) + Number(d.valor || 0); });
        return Object.entries(acc).sort((a, b) => b[1] - a[1]);
    }, [despesas]);

    // Item 9: leitura de XML de NF
    const handleXmlNF = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parser = new DOMParser();
                const xml = parser.parseFromString(ev.target.result, 'application/xml');
                const itens = [];
                // Dados básicos da NF
                const nNF   = xml.querySelector('nNF')?.textContent || '';
                const dhEmi = xml.querySelector('dhEmi')?.textContent?.slice(0, 10) || '';
                const vnf   = xml.querySelector('vNF')?.textContent || '';
                // Emitente (fornecedor)
                const emitNome  = xml.querySelector('emit xNome')?.textContent || '';
                const emitCNPJ  = xml.querySelector('emit CNPJ')?.textContent || '';
                const fornecedor = emitNome || (emitCNPJ ? `CNPJ ${emitCNPJ}` : '');
                // Itens do produto
                const prods = xml.querySelectorAll('det prod');
                prods.forEach((p) => {
                    itens.push({
                        codigo:      p.querySelector('cProd')?.textContent  || '',
                        descricao:   p.querySelector('xProd')?.textContent  || '',
                        quantidade:  p.querySelector('qCom')?.textContent   || '',
                        unidade:     p.querySelector('uCom')?.textContent   || '',
                        valor_unit:  p.querySelector('vUnCom')?.textContent || '',
                        valor_total: p.querySelector('vProd')?.textContent  || '',
                    });
                });
                setForm(f => ({
                    ...f,
                    nota_fiscal:  nNF       || f.nota_fiscal,
                    valor:        vnf       || f.valor,
                    data_despesa: dhEmi     || f.data_despesa,
                    fornecedor:   fornecedor || f.fornecedor,
                    descricao:    (fornecedor && !f.descricao) ? `Compra — ${fornecedor}` : f.descricao,
                    nf_itens: itens,
                }));
                showToast(`NF importada: ${fornecedor || 'emissor não identificado'} · ${itens.length} item(s)`, 'success');
            } catch {
                showToast('Erro ao ler XML. Verifique o arquivo.', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Item 2 (extra): Leitor de código de barras / laser (NF em papel)
    // Leitores a laser digitam os caracteres muito rápido e encerram com Enter.
    // Capturamos o buffer e preenchemos o campo da NF automaticamente.
    const handleBarcodeInput = (e) => {
        setBarcodeBuffer(e.target.value);
    };

    // Busca dados completos da NF-e pela chave de acesso (44 dígitos)
    const buscarDadosNFe = async (chave) => {
        setLoadingNFe(true);
        try {
            // Decodifica campos fixos da chave de acesso NF-e (44 dígitos):
            // cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
            const cuf      = chave.substring(0, 2);
            const aamm     = chave.substring(2, 6);
            const cnpjEmit = chave.substring(6, 20);
            const nNF      = chave.substring(25, 34).replace(/^0+/, '') || chave.substring(25, 34);
            const serie    = chave.substring(22, 25).replace(/^0+/, '') || '1';
            const ano      = '20' + aamm.substring(0, 2);
            const mes      = aamm.substring(2, 4);
            const dataEmissao = `${ano}-${mes}-01`; // dia não consta na chave

            const cnpjFmt = cnpjEmit.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

            let fornecedor = '';
            let valor      = '';
            let itens      = [];
            let fonteUsada = '';

            // ── Tentativa 1: ReceitaWS — nome da empresa pelo CNPJ (gratuito, CORS OK) ──
            try {
                const r = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjEmit}`, {
                    signal: AbortSignal.timeout(5000),
                });
                if (r.ok) {
                    const j = await r.json();
                    if (j?.nome && j.status !== 'ERROR') {
                        fornecedor = j.nome;
                        fonteUsada = 'ReceitaWS';
                    }
                }
            } catch { /* timeout ou CORS — tenta próxima */ }

            // ── Tentativa 2: Publica.io — consulta NF-e completa (gratuito com limite) ──
            if (!fornecedor || !valor) {
                try {
                    const r = await fetch(
                        `https://api.nfse.io/nfe/${chave}`,
                        { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } }
                    );
                    if (r.ok) {
                        const j = await r.json();
                        if (j?.emitente?.razaoSocial) fornecedor = j.emitente.razaoSocial;
                        if (j?.total?.valorNota) valor = String(j.total.valorNota);
                        if (j?.itens?.length) {
                            itens = j.itens.map(it => ({
                                codigo:      it.codigo       || '',
                                descricao:   it.descricao    || '',
                                quantidade:  it.quantidade   || '',
                                unidade:     it.unidade      || '',
                                valor_unit:  it.valorUnitario || '',
                                valor_total: it.valorTotal    || '',
                            }));
                        }
                        if (fornecedor) fonteUsada = 'NF-e API';
                    }
                } catch { /* indisponível */ }
            }

            // ── Monta resultado com o que foi obtido ──
            const descricaoAuto = fornecedor ? `Compra — ${fornecedor}` : `NF ${nNF} · Série ${serie}`;

            setForm(f => ({
                ...f,
                nota_fiscal:  nNF,
                data_despesa: dataEmissao,
                fornecedor:   fornecedor || f.fornecedor || cnpjFmt,
                valor:        valor      || f.valor,
                descricao:    f.descricao || descricaoAuto,
                nf_itens:     itens.length ? itens : f.nf_itens,
            }));

            // Feedback para o usuário
            if (fornecedor && valor) {
                showToast(`✅ NF ${nNF} — ${fornecedor} — ${BRL(Number(valor))}`, 'success');
            } else if (fornecedor) {
                showToast(`✅ NF ${nNF} — ${fornecedor} (valor não obtido — preencha manualmente)`, 'success');
            } else {
                // Sem API disponível — mostra o que foi extraído da chave
                showToast(
                    `NF ${nNF} lida. Fornecedor: CNPJ ${cnpjFmt}. Importe o XML para dados completos.`,
                    'info'
                );
            }

        } catch (err) {
            const nNF = chave.length === 44
                ? chave.substring(25, 34).replace(/^0+/, '')
                : chave;
            setForm(f => ({ ...f, nota_fiscal: nNF }));
            showToast(`NF ${nNF} lida. Importe o XML para dados completos.`, 'info');
        } finally {
            setLoadingNFe(false);
        }
    };

    const handleBarcodeKeyDown = async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const codigo = barcodeBuffer.trim();
            if (!codigo) return;
            setBarcodeBuffer('');
            setBarcodeMode(false);

            if (codigo.length === 44 && /^\d{44}$/.test(codigo)) {
                // Chave de acesso completa → consulta SEFAZ/ReceitaWS
                await buscarDadosNFe(codigo);
            } else {
                // Código curto ou formato desconhecido → só número
                setForm(f => ({ ...f, nota_fiscal: codigo }));
                showToast(`Código lido: ${codigo}`, 'success');
            }
            setTimeout(() => document.getElementById('despesa-valor')?.focus(), 100);
        }
        if (e.key === 'Escape') {
            setBarcodeMode(false);
            setBarcodeBuffer('');
        }
    };

    const handleComprovanteChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setForm(f => ({ ...f, comprovante_url: ev.target.result }));
        reader.readAsDataURL(file);
    };

    const handlePermutaDocChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setForm(f => ({ ...f, permuta_doc_url: ev.target.result }));
        reader.readAsDataURL(file);
    };

    const adicionarBoleto = () => {
        if (!novoBoleto.vencimento || !novoBoleto.valor) { showToast('Preencha vencimento e valor do boleto', 'error'); return; }
        setForm(f => ({ ...f, boletos: [...(f.boletos || []), { ...novoBoleto, pago: false }] }));
        setNovoBoleto({ vencimento: '', valor: '' });
    };
    const removerBoleto = (idx) => setForm(f => ({ ...f, boletos: f.boletos.filter((_, i) => i !== idx) }));

    // ── Dar baixa num boleto diretamente da tabela (sem abrir o modal) ──────
    const darBaixaBoleto = async (despesa, boletoIdx) => {
        const novosBoletos = (despesa.boletos || []).map((b, i) =>
            i === boletoIdx ? { ...b, pago: true, data_pagamento: new Date().toISOString().split('T')[0] } : b
        );
        try {
            await updateDespesaExtra(despesa.id, { ...despesa, boletos: novosBoletos });
            // Atualiza localmente sem recarregar tudo
            setDespesas(prev => prev.map(d =>
                d.id === despesa.id ? { ...d, boletos: novosBoletos } : d
            ));
            showToast('Boleto marcado como pago!', 'success');
        } catch (e) {
            showToast('Erro ao dar baixa: ' + e.message, 'error');
        }
    };

    const adicionarCheque = () => {
        if (!novoCheque.numero || !novoCheque.valor) { showToast('Preencha número e valor do cheque', 'error'); return; }
        setForm(f => ({ ...f, cheques: [...(f.cheques || []), { ...novoCheque }] }));
        setNovoCheque({ numero: '', banco: '', valor: '', vencimento: '' });
    };
    const removerCheque = (idx) => setForm(f => ({ ...f, cheques: f.cheques.filter((_, i) => i !== idx) }));

    // ── Painel expansível por despesa ──────────────────────────────────────
    const [expandedDespesa, setExpandedDespesa] = useState(null);
    const toggleDespesa = (id) => setExpandedDespesa(prev => prev === id ? null : id);

    // ── Alertas de vencimento (boletos vencendo hoje ou vencidos) ──────────
    const hoje = new Date().toISOString().split('T')[0];
    const boletosAlerta = useMemo(() => {
        const alertas = [];
        despesas.forEach(d => {
            if (d.forma_pagamento !== 'a_prazo' || d.tipo_pagamento !== 'boleto') return;
            (d.boletos || []).forEach((b, idx) => {
                if (b.pago) return;
                if (b.vencimento && b.vencimento <= hoje) {
                    alertas.push({ despesa: d, boleto: b, idx, atrasado: b.vencimento < hoje });
                }
            });
        });
        return alertas;
    }, [despesas, hoje]);

    const handleSubmit = async () => {
        if (!form.categoria || !form.valor || !form.data_despesa) {
            showToast('Categoria, valor e data são obrigatórios', 'error'); return;
        }
        try {
            if (modal.mode === 'create') await createDespesaExtra(form);
            else await updateDespesaExtra(modal.data.id, form);
            showToast('Despesa salva!', 'success'); setModal(null); load();
        } catch (e) {
            // Mostra o erro real do banco para facilitar diagnóstico
            const msg = e?.message || e?.details || JSON.stringify(e);
            showToast('Erro ao salvar: ' + msg, 'error');
            console.error('[Despesa] Erro ao salvar:', e);
        }
    };

    const handleDelete = async (id) => {
        if (!await confirm({ title: 'Excluir despesa?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir' })) return;
        try { await deleteDespesaExtra(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        if (!despesas.length) { showToast('Nenhuma despesa no período selecionado.', 'error'); return; }
        const rows = despesas.map(d => ({
            'Data': FMT_DATE(d.data_despesa), 'Placa': d.veiculo?.placa || '—',
            'Categoria': d.categoria, 'Fornecedor': d.fornecedor || '',
            'Descrição': d.descricao || '', 'NF': d.nota_fiscal || '',
            'Forma Pgto': d.forma_pagamento === 'a_vista' ? 'À Vista' : 'A Prazo',
            'Tipo Pgto': d.tipo_pagamento || '', 'Valor (R$)': Number(d.valor || 0),
            'Observações': d.observacoes || '',
        }));
        rows.push({ 'Data': 'TOTAL', 'Valor (R$)': totalPeriodo });
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [12,12,22,28,28,12,12,14,14,30].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Despesas');
        XLSX.writeFile(wb, `despesas_extras_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const openCreate = () => { setForm(emptyForm()); setModal({ mode: 'create' }); };
    const openEdit = (d) => {
        setForm({
            veiculo_id: d.veiculo_id || '', categoria: d.categoria, descricao: d.descricao || '',
            valor: d.valor, data_despesa: d.data_despesa, nota_fiscal: d.nota_fiscal || '', observacoes: d.observacoes || '',
            forma_pagamento: d.forma_pagamento || 'a_vista', tipo_pagamento: d.tipo_pagamento || 'pix',
            comprovante_url: d.comprovante_url || '', boletos: d.boletos || [],
            permuta_obs: d.permuta_obs || '', permuta_doc_url: d.permuta_doc_url || '',
            cheques: d.cheques || [], nf_itens: d.nf_itens || [],
        });
        setModal({ mode: 'edit', data: d });
    };

    // Badge de pagamento
    const pgBadge = (d) => {
        if (d.forma_pagamento === 'a_prazo') {
            const label = d.tipo_pagamento === 'boleto' ? 'Boleto' : d.tipo_pagamento === 'permuta' ? 'Permuta' : 'Cheque';
            return <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium">{label}</span>;
        }
        const label = d.tipo_pagamento === 'pix' ? 'PIX' : d.tipo_pagamento === 'dinheiro' ? 'Dinheiro' : 'Transf.';
        return <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">{label}</span>;
    };

    return (
        <div>
            <div className="flex flex-wrap gap-2 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <select value={filtro.veiculoId} onChange={e => setFiltro(f => ({ ...f, veiculoId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos veículos</option>
                        {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                    </select>
                    <select value={filtro.categoria} onChange={e => setFiltro(f => ({ ...f, categoria: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todas categorias</option>
                        {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="month" value={filtro.mes} onChange={e => setFiltro(f => ({ ...f, mes: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
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

            {/* ── Alertas de boletos vencendo hoje/vencidos ── */}
            {boletosAlerta.length > 0 && (
                <div className="mb-4 rounded-xl border-2 overflow-hidden" style={{ borderColor: '#FCA5A5' }}>
                    <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: '#FEF2F2' }}>
                        <Icon name="AlertTriangle" size={16} color="#DC2626" />
                        <span className="text-sm font-semibold text-red-700">
                            {boletosAlerta.filter(a => a.atrasado).length > 0
                                ? `${boletosAlerta.filter(a => a.atrasado).length} boleto(s) vencido(s)!`
                                : ''
                            }
                            {boletosAlerta.filter(a => !a.atrasado).length > 0
                                ? ` ${boletosAlerta.filter(a => !a.atrasado).length} boleto(s) vencem hoje!`
                                : ''
                            }
                        </span>
                    </div>
                    <div className="divide-y" style={{ backgroundColor: '#FFF5F5' }}>
                        {boletosAlerta.map((alerta, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${alerta.atrasado ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                                        {alerta.atrasado ? 'VENCIDO' : 'HOJE'}
                                    </span>
                                    <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {alerta.despesa.descricao || alerta.despesa.categoria}
                                    </span>
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                        {alerta.despesa.veiculo?.placa || '—'} · Venc. {new Date(alerta.boleto.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                                <span className="font-data font-bold text-red-700">{BRL(alerta.boleto.valor)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[740px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Data','Placa','Categoria','Fornecedor','Descrição','NF','Pagamento','Valor',''].map(h => <th key={h} className="px-3 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {despesas.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma despesa registrada</td></tr>
                            : despesas.map((d, i) => {
                                const isExp = expandedDespesa === d.id;
                                const temParcelas = d.forma_pagamento === 'a_prazo' && (d.boletos?.length > 0 || d.cheques?.length > 0);
                                const boletosVencidos = (d.boletos || []).filter(b => !b.pago && b.vencimento && b.vencimento < hoje).length;
                                const boletosHoje = (d.boletos || []).filter(b => !b.pago && b.vencimento && b.vencimento === hoje).length;
                                return (
                                    <React.Fragment key={d.id}>
                                        <tr className="border-t hover:bg-gray-50 cursor-pointer" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}
                                            onClick={() => temParcelas && toggleDespesa(d.id)}>
                                            <td className="px-3 py-3 whitespace-nowrap">{FMT_DATE(d.data_despesa)}</td>
                                            <td className="px-3 py-3 font-data">{d.veiculo?.placa || '—'}</td>
                                            <td className="px-3 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium">{d.categoria}</span></td>
                                            <td className="px-3 py-3 text-xs max-w-[130px] truncate font-medium" style={{ color: 'var(--color-text-primary)' }}>{d.fornecedor || '—'}</td>
                                            <td className="px-3 py-3 text-xs max-w-[130px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.descricao || '—'}</td>
                                            <td className="px-3 py-3 text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{d.nota_fiscal || '—'}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    {pgBadge(d)}
                                                    {boletosVencidos > 0 && <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700 font-bold">⚠ {boletosVencidos} vencido{boletosVencidos > 1 ? 's' : ''}</span>}
                                                    {boletosHoje > 0 && <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-bold">📅 hoje</span>}
                                                    {temParcelas && <Icon name={isExp ? 'ChevronUp' : 'ChevronDown'} size={13} color="var(--color-muted-foreground)" />}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 font-data font-semibold text-red-600">{BRL(d.valor)}</td>
                                            <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                                <div className="flex gap-1">
                                                    {isAdmin && <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-blue-50"><Icon name="Pencil" size={13} color="#1D4ED8" /></button>}
                                                    {isAdmin && <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={13} color="#DC2626" /></button>}
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Painel de parcelas expansível */}
                                        {isExp && temParcelas && (
                                            <tr style={{ backgroundColor: '#FAFBFF' }}>
                                                <td colSpan={9} className="px-6 py-3">
                                                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                                                        Parcelas / Boletos ({(d.boletos || []).length})
                                                    </p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                        {(d.boletos || []).map((b, bi) => {
                                                            const venc = b.vencimento;
                                                            const atrasado = venc && venc < hoje && !b.pago;
                                                            const venceHoje = venc && venc === hoje && !b.pago;
                                                            return (
                                                                <div key={bi} className="flex items-center justify-between px-3 py-2 rounded-lg border text-xs"
                                                                    style={{ borderColor: b.pago ? '#BBF7D0' : atrasado ? '#FCA5A5' : venceHoje ? '#FCD34D' : '#E5E7EB', backgroundColor: b.pago ? '#F0FDF4' : atrasado ? '#FFF5F5' : venceHoje ? '#FFFBEB' : '#fff' }}>
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Parcela {bi + 1}</span>
                                                                        <span className="ml-2" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                            Venc: {venc ? new Date(venc + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                                                        </span>
                                                                        {atrasado && <span className="ml-1 font-bold text-red-600">⚠ VENCIDO</span>}
                                                                        {venceHoje && <span className="ml-1 font-bold text-amber-600">📅 Hoje</span>}
                                                                        {b.pago && (
                                                                            <span className="ml-1 text-green-700 font-medium">
                                                                                ✓ Pago{b.data_pagamento ? ` em ${new Date(b.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                                        <span className="font-data font-bold" style={{ color: b.pago ? '#15803D' : atrasado ? '#DC2626' : '#111' }}>{BRL(b.valor)}</span>
                                                                        {!b.pago && isAdmin && (
                                                                            <button
                                                                                onClick={e => { e.stopPropagation(); darBaixaBoleto(d, bi); }}
                                                                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-white transition-colors hover:opacity-90"
                                                                                style={{ backgroundColor: '#059669' }}
                                                                                title="Marcar como pago"
                                                                            >
                                                                                <Icon name="Check" size={11} color="#fff" /> Pago
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {(d.cheques || []).map((ch, ci) => (
                                                            <div key={'ch' + ci} className="flex items-center justify-between px-3 py-2 rounded-lg border text-xs" style={{ borderColor: '#E5E7EB', backgroundColor: '#fff' }}>
                                                                <div>
                                                                    <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cheque {ci + 1}</span>
                                                                    {ch.numero && <span className="ml-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>#{ch.numero}</span>}
                                                                    {ch.vencimento && <span className="ml-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Venc: {new Date(ch.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                                                                </div>
                                                                <span className="font-data font-bold">{BRL(ch.valor)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {modal && isAdmin && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <ModalHeader title={modal.mode === 'create' ? 'Nova Despesa' : 'Editar Despesa'} icon="Receipt" onClose={() => setModal(null)} />
                    <div className="p-5 space-y-4 overflow-y-auto flex-1"
                        style={{ overscrollBehavior: 'contain' }}>
                        <div className="p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                            <p className="text-xs font-semibold text-blue-700 mb-2">📄 Nota Fiscal — Importar dados</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {/* XML digital */}
                                <button type="button" onClick={() => xmlRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
                                    <Icon name="FileCode" size={12} /> Ler XML da NF
                                </button>
                                <input ref={xmlRef} type="file" accept=".xml" onChange={handleXmlNF} className="hidden" />
                                {/* Código de barras / laser */}
                                <button type="button"
                                    onClick={() => { setBarcodeMode(b => !b); setBarcodeBuffer(''); setTimeout(() => barcodeInputRef.current?.focus(), 50); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                    style={barcodeMode
                                        ? { backgroundColor: '#1D4ED8', color: '#fff', borderColor: '#1D4ED8' }
                                        : { borderColor: '#93C5FD', color: '#1D4ED8', backgroundColor: 'white' }}>
                                    <Icon name="ScanLine" size={12} /> {barcodeMode ? 'Aguardando leitura...' : 'Ler código de barras'}
                                </button>
                            </div>
                            {/* Campo captura do leitor laser */}
                            {barcodeMode && (
                                <div className="mt-2">
                                    <p className="text-xs text-blue-600 mb-1.5">
                                        🔫 Aponte o leitor para o código de barras da NF impressa. Fornecedor, valor e data serão preenchidos automaticamente.
                                    </p>
                                    <input
                                        ref={barcodeInputRef}
                                        type="text"
                                        value={barcodeBuffer}
                                        onChange={handleBarcodeInput}
                                        onKeyDown={handleBarcodeKeyDown}
                                        className={inputCls}
                                        style={{ ...inputStyle, borderColor: '#3B82F6', boxShadow: '0 0 0 3px rgba(59,130,246,0.15)' }}
                                        placeholder="Aguardando leitura do scanner..."
                                        autoFocus
                                        autoComplete="off"
                                        disabled={loadingNFe}
                                    />
                                    {loadingNFe && (
                                        <div className="flex items-center gap-2 mt-2 text-xs text-blue-600">
                                            <div className="animate-spin h-3 w-3 rounded-full border-2 border-blue-600" style={{ borderTopColor: 'transparent' }} />
                                            Consultando dados da NF na SEFAZ...
                                        </div>
                                    )}
                                    <button type="button" onClick={() => { setBarcodeMode(false); setBarcodeBuffer(''); }}
                                        className="text-xs text-blue-600 underline mt-1">Cancelar (Esc)</button>
                                </div>
                            )}
                            {form.nf_itens?.length > 0 && (
                                <div className="mt-2 overflow-x-auto">
                                    <p className="text-xs text-blue-600 font-medium mb-1">{form.nf_itens.length} item(s) da NF:</p>
                                    <table className="w-full text-xs">
                                        <thead><tr className="text-blue-800">{['Código','Descrição','Qtd','Un','V.Unit','V.Total'].map(h=><th key={h} className="text-left px-1 py-0.5 border-b border-blue-200">{h}</th>)}</tr></thead>
                                        <tbody>
                                            {form.nf_itens.map((it, idx) => (
                                                <tr key={idx} className="border-b border-blue-100">
                                                    <td className="px-1 py-1 font-data">{it.codigo}</td>
                                                    <td className="px-1 py-1 max-w-[140px] truncate">{it.descricao}</td>
                                                    <td className="px-1 py-1 text-right font-data">{it.quantidade}</td>
                                                    <td className="px-1 py-1">{it.unidade}</td>
                                                    <td className="px-1 py-1 text-right font-data">{BRL(it.valor_unit)}</td>
                                                    <td className="px-1 py-1 text-right font-data text-blue-700">{BRL(it.valor_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* dados básicos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <Field label="Categoria" required>
                                    <div className="flex gap-2">
                                        <select value={form.categoria}
                                            onChange={e => {
                                                if (e.target.value === '__nova__') {
                                                    setShowNovaCategoria(true);
                                                } else {
                                                    setForm(f => ({ ...f, categoria: e.target.value }));
                                                    setShowNovaCategoria(false);
                                                }
                                            }}
                                            className={inputCls} style={inputStyle}>
                                            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                                            {isAdmin && <option value="__nova__">➕ Nova categoria...</option>}
                                        </select>
                                    </div>
                                    {/* Input inline para nova categoria */}
                                    {showNovaCategoria && isAdmin && (
                                        <div className="flex gap-2 mt-2">
                                            <input
                                                autoFocus
                                                value={novaCategoria}
                                                onChange={e => setNovaCategoria(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleSalvarNovaCategoria(); if (e.key === 'Escape') { setShowNovaCategoria(false); setNovaCategoria(''); } }}
                                                className={inputCls}
                                                style={{ ...inputStyle, borderColor: '#3B82F6' }}
                                                placeholder="Nome da nova categoria..."
                                            />
                                            <button type="button" onClick={handleSalvarNovaCategoria} disabled={savingCategoria}
                                                className="px-3 py-2 rounded-lg text-xs font-semibold text-white flex-shrink-0"
                                                style={{ backgroundColor: '#059669', opacity: savingCategoria ? 0.7 : 1 }}>
                                                {savingCategoria ? '...' : 'Salvar'}
                                            </button>
                                            <button type="button" onClick={() => { setShowNovaCategoria(false); setNovaCategoria(''); }}
                                                className="px-3 py-2 rounded-lg text-xs font-medium border flex-shrink-0"
                                                style={{ borderColor: 'var(--color-border)' }}>
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </Field>
                            </div>
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
                                <input id="despesa-valor" type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                            </Field>
                            <Field label="Fornecedor">
                                <input value={form.fornecedor||''} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Auto Peças Silva Ltda" />
                            </Field>
                            <Field label="Nº Nota Fiscal">
                                <input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 12345" />
                            </Field>
                            <div className="sm:col-span-2">
                                <Field label="Descrição">
                                    <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 4 pneus traseiros Bridgestone" />
                                </Field>
                            </div>
                        </div>

                        {/* item 8: forma de pagamento */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Forma de Pagamento</p>
                            <div className="flex gap-2">
                                {[['a_vista','💳 À Vista'], ['a_prazo','📋 A Prazo']].map(([v, l]) => (
                                    <button key={v} type="button" onClick={() => setForm(f => ({ ...f, forma_pagamento: v, tipo_pagamento: v === 'a_vista' ? 'pix' : 'boleto' }))}
                                        className="flex-1 py-2 rounded-lg text-sm font-medium border transition-colors"
                                        style={form.forma_pagamento === v ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' } : { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                        {l}
                                    </button>
                                ))}
                            </div>

                            {/* À Vista */}
                            {form.forma_pagamento === 'a_vista' && (
                                <div className="space-y-3 p-3 rounded-xl border" style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }}>
                                    <p className="text-xs font-semibold text-green-700">Tipo de pagamento</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {[['transferencia_m','Transferência M'], ['pix','PIX'], ['dinheiro','Dinheiro']].map(([v, l]) => (
                                            <button key={v} type="button" onClick={() => setForm(f => ({ ...f, tipo_pagamento: v }))}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                                style={form.tipo_pagamento === v ? { backgroundColor: '#059669', color: '#fff', borderColor: '#059669' } : { borderColor: '#BBF7D0', color: '#065F46', backgroundColor: 'white' }}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium mb-2 text-green-700">Comprovante (opcional)</p>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => comprovanteRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-green-50 transition-colors" style={{ borderColor: '#BBF7D0' }}>
                                                <Icon name="Paperclip" size={13} /> Anexar comprovante
                                            </button>
                                            {form.comprovante_url && <span className="text-xs text-green-700 flex items-center gap-1"><Icon name="CheckCircle2" size={12} /> Anexado</span>}
                                            <input ref={comprovanteRef} type="file" accept="image/*,.pdf" onChange={handleComprovanteChange} className="hidden" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* A Prazo */}
                            {form.forma_pagamento === 'a_prazo' && (
                                <div className="space-y-3 p-3 rounded-xl border" style={{ borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }}>
                                    <p className="text-xs font-semibold text-amber-700">Tipo de pagamento a prazo</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {[['boleto','Boleto'], ['permuta','Permuta'], ['cheque','Cheque']].map(([v, l]) => (
                                            <button key={v} type="button" onClick={() => setForm(f => ({ ...f, tipo_pagamento: v }))}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                                style={form.tipo_pagamento === v ? { backgroundColor: '#D97706', color: '#fff', borderColor: '#D97706' } : { borderColor: '#FED7AA', color: '#92400E', backgroundColor: 'white' }}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Boleto */}
                                    {form.tipo_pagamento === 'boleto' && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-amber-800">Boletos / Parcelas</p>
                                            {(form.boletos || []).map((b, idx) => (
                                                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border" style={{ borderColor: '#FED7AA' }}>
                                                    <span className="text-xs text-amber-700 font-medium">Parcela {idx + 1}</span>
                                                    <span className="text-xs font-data">{FMT_DATE(b.vencimento)}</span>
                                                    <span className="text-xs font-data font-semibold text-amber-800">{BRL(b.valor)}</span>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${b.pago ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.pago ? 'Pago' : 'Pendente'}</span>
                                                    <button type="button" onClick={() => removerBoleto(idx)} className="ml-auto p-1 rounded hover:bg-red-50"><Icon name="X" size={11} color="#DC2626" /></button>
                                                </div>
                                            ))}
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                <Field label="Vencimento"><input type="date" value={novoBoleto.vencimento} onChange={e => setNovoBoleto(b => ({ ...b, vencimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                                <Field label="Valor (R$)"><input type="number" step="0.01" value={novoBoleto.valor} onChange={e => setNovoBoleto(b => ({ ...b, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                            </div>
                                            <button type="button" onClick={adicionarBoleto} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50">
                                                <Icon name="Plus" size={12} /> Adicionar boleto
                                            </button>
                                        </div>
                                    )}

                                    {/* Permuta */}
                                    {form.tipo_pagamento === 'permuta' && (
                                        <div className="space-y-2">
                                            <Field label="Observações da permuta">
                                                <textarea value={form.permuta_obs} onChange={e => setForm(f => ({ ...f, permuta_obs: e.target.value }))} className={inputCls} style={inputStyle} rows={3} placeholder="Descreva os termos da permuta..." />
                                            </Field>
                                            <div className="flex items-center gap-2">
                                                <button type="button" onClick={() => permutaRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-amber-50 transition-colors" style={{ borderColor: '#FED7AA' }}>
                                                    <Icon name="Paperclip" size={13} /> Anexar documento
                                                </button>
                                                {form.permuta_doc_url && <span className="text-xs text-amber-700 flex items-center gap-1"><Icon name="CheckCircle2" size={12} /> Anexado</span>}
                                                <input ref={permutaRef} type="file" accept="image/*,.pdf" onChange={handlePermutaDocChange} className="hidden" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Cheque */}
                                    {form.tipo_pagamento === 'cheque' && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-amber-800">Cheques utilizados</p>
                                            {(form.cheques || []).map((ch, idx) => (
                                                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border text-xs" style={{ borderColor: '#FED7AA' }}>
                                                    <span className="font-medium text-amber-800">#{ch.numero}</span>
                                                    {ch.banco && <span className="text-amber-700">{ch.banco}</span>}
                                                    <span className="font-data font-semibold">{BRL(ch.valor)}</span>
                                                    {ch.vencimento && <span className="text-gray-500">{FMT_DATE(ch.vencimento)}</span>}
                                                    <button type="button" onClick={() => removerCheque(idx)} className="ml-auto p-1 rounded hover:bg-red-50"><Icon name="X" size={11} color="#DC2626" /></button>
                                                </div>
                                            ))}
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                <Field label="Nº Cheque"><input value={novoCheque.numero} onChange={e => setNovoCheque(c => ({ ...c, numero: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 000123" /></Field>
                                                <Field label="Banco"><input value={novoCheque.banco} onChange={e => setNovoCheque(c => ({ ...c, banco: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Bradesco" /></Field>
                                                <Field label="Valor (R$)"><input type="number" step="0.01" value={novoCheque.valor} onChange={e => setNovoCheque(c => ({ ...c, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                                <Field label="Vencimento"><input type="date" value={novoCheque.vencimento} onChange={e => setNovoCheque(c => ({ ...c, vencimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                            </div>
                                            <button type="button" onClick={adicionarCheque} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50">
                                                <Icon name="Plus" size={12} /> Adicionar cheque
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <Field label="Observações">
                            <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                        </Field>
                    </div>
                    {/* Footer fixo — fora da área scrollável */}
                    <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check" className="flex-1">Salvar despesa</Button>
                    </div>
                </ModalOverlay>
            )}
                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Diárias de Motoristas ───────────────────────────────────────────────
function TabDiarias({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
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
        if (!await confirm({ title: 'Excluir diária?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir' })) return;
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
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
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
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[640px]">
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
                        {/* item 10: para carretas não é necessário vincular viagem */}
                        <div className="flex items-end">
                            <div className="w-full p-3 rounded-lg text-xs" style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                                <p className="text-indigo-700 font-medium">ℹ️ Módulo Carretas</p>
                                <p className="text-indigo-600 mt-0.5">Diárias deste módulo não precisam vínculo de viagem.</p>
                            </div>
                        </div>
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
                    <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
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
    const [veiculos,      setVeiculos]      = useState([]);
    const [filtroPlaca,   setFiltroPlaca]   = useState(''); // item 7
    const [dados,         setDados]         = useState(null);
    const [loading,       setLoading]       = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [e, m, v] = await Promise.all([fetchEmpresas(), fetchTodosMotoristas(), fetchCarretasVeiculos()]);
                setEmpresas(e); setMotoristas(m.filter(m => m.tipo_veiculo === 'carreta' || m.role === 'carreteiro')); setVeiculos(v);
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

            const [carregamentos, abastecimentos, viagens, despesasExtras, diariasLancadas, romaneiosCarreta] = await Promise.all([
                fetchCarregamentos(filtros),
                fetchAbastecimentos({ dataInicio, dataFim }),
                fetchViagens({ dataInicio, dataFim }),
                fetchDespesasExtras({ dataInicio, dataFim }),
                fetchDiarias({ dataInicio, dataFim }),
                fetchRomaneiosCarreta({ dataInicio, dataFim }).catch(() => []),
            ]);

            // ── Receitas (fretes de carregamentos) ────────────────────────
            const receitaCarregamentos = carregamentos.reduce((s, c) => s + Number(c.valor_frete_calculado || 0), 0);
            const receitaPorEmpresa = {};
            carregamentos.forEach(c => {
                const nome = c.empresa?.nome || 'Sem empresa';
                receitaPorEmpresa[nome] = (receitaPorEmpresa[nome] || 0) + Number(c.valor_frete_calculado || 0);
            });

            // ── Receitas de Romaneios de Carreta ──────────────────────────
            const receitaRomaneiosCarreta = romaneiosCarreta.reduce((s, r) => s + Number(r.valor_frete || 0), 0);
            const romaneiosPorDestino = {};
            romaneiosCarreta.forEach(r => {
                const dest = r.destino || 'Sem destino';
                romaneiosPorDestino[dest] = (romaneiosPorDestino[dest] || 0) + Number(r.valor_frete || 0);
            });

            // ── Receita total = carregamentos + romaneios de carreta ───────
            const receitaTotal = receitaCarregamentos + receitaRomaneiosCarreta;

            // ── Despesas combustível ───────────────────────────────────────
            const valorDiesel        = abastecimentos.reduce((s, a) => s + Number(a.valor_diesel || 0), 0);
            const valorArla          = abastecimentos.reduce((s, a) => s + Number(a.valor_arla   || 0), 0);
            const despesaCombustivel = valorDiesel + valorArla;
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
            // despesaTotal = TODAS as saídas: combustível + bônus + diárias + despesas extras
            const despesaTotal  = despesaCombustivel + bonusTotal + totalDiariasLancadas + totalDespesasExtras;
            const margemBruta   = receitaTotal - despesaCombustivel;   // receita − só combustível
            const margemLiquida = receitaTotal - despesaTotal;         // receita − tudo
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
                receitaTotal, receitaCarregamentos, receitaRomaneiosCarreta,
                receitaPorEmpresa, romaneiosPorDestino,
                despesaCombustivel, litrosDiesel, litrosArla, valorDiesel, valorArla,
                bonusTotal, despesaTotal,
                margemBruta, margemLiquida, margemPct,
                consolidadoMotoristas,
                totalCarregamentos: carregamentos.length,
                totalViagens: viagens.length,
                viagensFinalizadas: viagensFinalizadas.length,
                totalDespesasExtras, despesasPorCategoria,
                totalDiariasLancadas,
                totalRomaneiosCarreta: romaneiosCarreta.length,
                // raw data
                _carregamentos: carregamentos,
                _abastecimentos: abastecimentos,
                _viagens: viagens,
                _despesasExtras: despesasExtras,
                _diarias: diariasLancadas,
                _romaneiosCarreta: romaneiosCarreta,
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
            ['Receita Total', dados.receitaTotal, ''],
            ['  → Fretes (Carregamentos)', dados.receitaCarregamentos, ''],
            ...Object.entries(dados.receitaPorEmpresa).map(([nome, val]) => [`      ↳ ${nome}`, val, '']),
            ['  → Romaneios de Carreta', dados.receitaRomaneiosCarreta, ''],
            ...Object.entries(dados.romaneiosPorDestino || {}).map(([dest, val]) => [`      ↳ ${dest}`, val, '']),
            ['', '', ''],
            ['DESPESAS', '', ''],
            ['Combustível — Diesel', dados.valorDiesel, ''],
            [`  → Litros Diesel`, dados.litrosDiesel.toFixed(1) + ' L', ''],
            ['Combustível — Arla 32', dados.valorArla, ''],
            [`  → Litros Arla`, dados.litrosArla.toFixed(1) + ' L', ''],
            ['Total Combustível', dados.despesaCombustivel, ''],
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
            ['Romaneios de Carreta', dados.totalRomaneiosCarreta || 0, ''],
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(resumo);
        ws1['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumo Financeiro');

        // Aba 2 — Por Motorista
        const rowsM = [
            ['Motorista', 'Carregamentos', 'Receita Frete (R$)', 'Viagens Finalizadas', 'Bônus (R$)', 'Total Motorista (R$)'],
            ...dados.consolidadoMotoristas.map(m => [
                m.nome, m.carregamentos, m.frete, m.viagens, m.bonus, m.frete + m.bonus,
            ]),
            ['TOTAL', dados.totalCarregamentos, dados.receitaCarregamentos, dados.viagensFinalizadas, dados.bonusTotal, dados.receitaCarregamentos + dados.bonusTotal],
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(rowsM);
        ws2['!cols'] = [{ wch: 22 },{ wch: 15 },{ wch: 20 },{ wch: 20 },{ wch: 14 },{ wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Por Motorista');

        // Aba 3 — Abastecimentos (diesel e arla separados)
        const rowsAbst = [
            ['Data', 'Motorista', 'Placa', 'Posto', 'Diesel (L)', 'R$ Diesel', 'Arla (L)', 'R$ Arla', 'Total R$'],
            ...(dados._abastecimentos || []).map(a => [
                FMT_DATE(a.data_abastecimento), a.motorista?.name || '', a.veiculo?.placa || '',
                a.posto || '', Number(a.litros_diesel || 0), Number(a.valor_diesel || 0),
                Number(a.litros_arla || 0), Number(a.valor_arla || 0), Number(a.valor_total || 0),
            ]),
            ['TOTAL', '', '', '', dados.litrosDiesel, dados.valorDiesel, dados.litrosArla, dados.valorArla, dados.despesaCombustivel],
        ];
        const ws3 = XLSX.utils.aoa_to_sheet(rowsAbst);
        ws3['!cols'] = [12,20,12,18,10,14,10,14,14].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws3, 'Abastecimentos');

        // Aba 4 — Romaneios de Carreta
        if ((dados._romaneiosCarreta || []).length > 0) {
            const rowsRom = [
                ['Número','Status','Motorista','Placa','Destino','Empresa','Data Saída','Tonelagem','Valor Frete (R$)','Aprovado'],
                ...(dados._romaneiosCarreta || []).map(r => [
                    r.numero, r.status, r.motorista?.name || '', r.veiculo?.placa || '',
                    r.destino || '', r.empresa || '',
                    r.data_saida ? new Date(r.data_saida+'T00:00:00').toLocaleDateString('pt-BR') : '',
                    Number(r.toneladas || 0), Number(r.valor_frete || 0),
                    r.aprovado ? 'Sim' : 'Não',
                ]),
                ['TOTAL','','','','','','', dados._romaneiosCarreta.reduce((s,r)=>s+Number(r.toneladas||0),0), dados.receitaRomaneiosCarreta, ''],
            ];
            const wsRom = XLSX.utils.aoa_to_sheet(rowsRom);
            wsRom['!cols'] = [16,18,22,12,20,22,14,12,16,10].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, wsRom, 'Romaneios Carreta');
        }

        const nome = `relatorio_financeiro_carretas_${dados.periodo.replace(/\s/g,'_')}.xlsx`;
        XLSX.writeFile(wb, nome);
        showToast('Relatório exportado com sucesso!', 'success');
    };

    // item 7: relatório por placa com export completo
    const dadosPorPlaca = useMemo(() => {
        if (!dados || !filtroPlaca) return null;
        const veic = veiculos.find(v => v.id === filtroPlaca);
        const carrg = (dados._carregamentos || []).filter(c => c.veiculo_id === filtroPlaca);
        const absts = (dados._abastecimentos || []).filter(a => a.veiculo_id === filtroPlaca);
        const viags = (dados._viagens || []).filter(v => v.veiculo_id === filtroPlaca);
        const viagIds = new Set(viags.map(v => v.id));
        // Despesas: pelo veiculo_id direto OU pela viagem vinculada ao veículo
        const desps = (dados._despesasExtras || []).filter(d =>
            d.veiculo_id === filtroPlaca || (d.viagem_id && viagIds.has(d.viagem_id))
        );
        const diar  = (dados._diarias || []).filter(d => {
            // diárias vinculadas ao veículo via viagem
            const viagIds = viags.map(v => v.id);
            return d.viagem_id && viagIds.includes(d.viagem_id);
        });
        // Receitas: fretes de carregamentos + romaneios de carreta vinculados a este veículo
        const romaneiosPlaca = (dados._romaneiosCarreta || []).filter(r => r.veiculo_id === filtroPlaca);
        const receitaCarrg   = carrg.reduce((s, c) => s + Number(c.valor_frete_calculado || 0), 0);
        const receitaRom     = romaneiosPlaca.reduce((s, r) => s + Number(r.valor_frete || 0), 0);
        const receita        = receitaCarrg + receitaRom;
        const vDiesel     = absts.reduce((s, a) => s + Number(a.valor_diesel || 0), 0);
        const vArla       = absts.reduce((s, a) => s + Number(a.valor_arla || 0), 0);
        const combustivel = vDiesel + vArla;
        const lDiesel     = absts.reduce((s, a) => s + Number(a.litros_diesel || 0), 0);
        const lArla       = absts.reduce((s, a) => s + Number(a.litros_arla || 0), 0);
        const bonus       = viags.filter(v => v.status === 'Entrega finalizada').reduce((s, v) => s + calcularBonusCarreteiro(v.destino), 0);
        const despExtra   = desps.reduce((s, d) => s + Number(d.valor || 0), 0);
        const diarias     = diar.reduce((s, d) => s + Number(d.valor_total || 0), 0);
        const totalDesp   = combustivel + bonus + despExtra + diarias;
        const margem      = receita - totalDesp;
        return { veic, carrg, romaneiosPlaca, absts, viags, desps, diar, receita, receitaCarrg, receitaRom, combustivel, vDiesel, vArla, lDiesel, lArla, bonus, despExtra, diarias, totalDesp, margem };
    }, [dados, filtroPlaca, veiculos]);

    const exportarPorPlaca = () => {
        if (!dadosPorPlaca) { showToast('Selecione uma placa e gere o relatório primeiro', 'error'); return; }
        const { veic, carrg, absts, viags, desps, receita, combustivel, vDiesel, vArla, lDiesel, lArla, bonus, despExtra, diarias, totalDesp, margem } = dadosPorPlaca;
        const wb = XLSX.utils.book_new();

        // Aba Resumo
        const resumo = [
            [`RELATÓRIO POR VEÍCULO — ${veic?.placa || filtroPlaca}`, ''],
            [`Modelo: ${veic?.modelo || ''}`, ''],
            ['Período:', dados.periodo],
            ['', ''],
            ['RECEITAS', ''],
            ['Receita de Fretes', receita],
            ['', ''],
            ['DESPESAS', ''],
            ['Diesel', vDiesel], [`  → ${lDiesel.toFixed(1)} L`, ''],
            ['Arla 32', vArla], [`  → ${lArla.toFixed(1)} L`, ''],
            ['Total Combustível', combustivel],
            ['Bônus Motoristas', bonus],
            ['Diárias', diarias],
            ['Despesas Extras', despExtra],
            ['Total Despesas', totalDesp],
            ['', ''],
            ['MARGEM LÍQUIDA', margem],
            ['Margem %', receita > 0 ? `${((margem / receita) * 100).toFixed(2)}%` : '0%'],
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(resumo);
        ws1['!cols'] = [{ wch: 40 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumo');

        // Aba Viagens
        if (viags.length) {
            const rowsV = [
                ['Nº Viagem', 'Status', 'Motorista', 'Data Saída', 'Destino', 'Toneladas', 'Bônus (R$)'],
                ...viags.map(v => [v.numero, v.status, v.motorista?.name || '', FMT_DATE(v.data_saida), v.destino || '', v.toneladas || 0, calcularBonusCarreteiro(v.destino)]),
                ['TOTAL', '', '', '', '', '', bonus],
            ];
            const wsV = XLSX.utils.aoa_to_sheet(rowsV);
            wsV['!cols'] = [12,18,20,12,20,10,12].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, wsV, 'Viagens');
        }

        // Aba Fretes
        if (carrg.length) {
            const rowsC = [
                ['Data', 'Pedido', 'NF', 'Empresa', 'Destino', 'Motorista', 'Qtd', 'Unidade', 'Frete (R$)'],
                ...carrg.map(c => [FMT_DATE(c.data_carregamento), c.numero_pedido || '', c.numero_nota_fiscal || '', c.empresa?.nome || '', c.destino || '', c.motorista?.name || '', c.quantidade || 0, c.unidade_quantidade || '', Number(c.valor_frete_calculado || 0)]),
                ['TOTAL', '', '', '', '', '', '', '', receita],
            ];
            const wsC = XLSX.utils.aoa_to_sheet(rowsC);
            wsC['!cols'] = [12,12,10,18,20,20,8,8,14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, wsC, 'Fretes');
        }

        // Aba Abastecimentos
        if (absts.length) {
            const rowsA = [
                ['Data', 'Motorista', 'Posto', 'Diesel (L)', 'R$ Diesel', 'Arla (L)', 'R$ Arla', 'Total R$'],
                ...absts.map(a => [FMT_DATE(a.data_abastecimento), a.motorista?.name || '', a.posto || '', Number(a.litros_diesel || 0), Number(a.valor_diesel || 0), Number(a.litros_arla || 0), Number(a.valor_arla || 0), Number(a.valor_total || 0)]),
                ['TOTAL', '', '', lDiesel, vDiesel, lArla, vArla, combustivel],
            ];
            const wsA = XLSX.utils.aoa_to_sheet(rowsA);
            wsA['!cols'] = [12,20,18,10,14,10,14,14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, wsA, 'Abastecimentos');
        }

        // Aba Despesas Extras
        if (desps.length) {
            const rowsD = [
                ['Data', 'Categoria', 'Descrição', 'NF', 'Forma Pgto', 'Valor (R$)'],
                ...desps.map(d => [FMT_DATE(d.data_despesa), d.categoria, d.descricao || '', d.nota_fiscal || '', d.forma_pagamento === 'a_prazo' ? `A Prazo (${d.tipo_pagamento || ''})` : `À Vista (${d.tipo_pagamento || ''})`, Number(d.valor || 0)]),
                ['TOTAL', '', '', '', '', despExtra],
            ];
            const wsD = XLSX.utils.aoa_to_sheet(rowsD);
            wsD['!cols'] = [12,22,30,12,18,14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, wsD, 'Despesas Extras');
        }

        XLSX.writeFile(wb, `relatorio_placa_${veic?.placa || filtroPlaca}_${dados.periodo.replace(/\s/g,'_')}.xlsx`);
        showToast('Relatório por placa exportado!', 'success');
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
                    <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
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
                                <span className="font-data font-bold text-green-700">{BRL(dados.receitaTotal)}</span>
                            </div>
                            {/* Fretes de carregamentos */}
                            {dados.receitaCarregamentos > 0 && (
                                <div className="flex justify-between py-1.5 pl-3">
                                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Receita de Fretes (Carregamentos)</span>
                                    <span className="font-data font-semibold text-green-700">{BRL(dados.receitaCarregamentos)}</span>
                                </div>
                            )}
                            {Object.entries(dados.receitaPorEmpresa).map(([nome, val]) => (
                                <div key={nome} className="flex justify-between py-1 pl-6">
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ {nome}</span>
                                    <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(val)}</span>
                                </div>
                            ))}
                            {/* Fretes de romaneios de carreta */}
                            {dados.receitaRomaneiosCarreta > 0 && (
                                <>
                                    <div className="flex justify-between py-1.5 pl-3">
                                        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                            Receita Romaneios Carreta
                                            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{dados.totalRomaneiosCarreta} rom.</span>
                                        </span>
                                        <span className="font-data font-semibold text-green-700">{BRL(dados.receitaRomaneiosCarreta)}</span>
                                    </div>
                                    {Object.entries(dados.romaneiosPorDestino).map(([dest, val]) => (
                                        <div key={dest} className="flex justify-between py-1 pl-6">
                                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ {dest}</span>
                                            <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(val)}</span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* Despesas */}
                            <div className="flex justify-between py-2 border-b mt-2" style={{ borderColor: '#F1F5F9' }}>
                                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Despesas</span>
                            </div>
                            <div className="flex justify-between py-1.5 pl-3">
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Combustível (Total)</span>
                                <span className="font-data font-semibold text-amber-700">({BRL(dados.despesaCombustivel)})</span>
                            </div>
                            {/* item 6: diesel e arla separados com valores */}
                            <div className="flex justify-between py-1 pl-6">
                                <span className="text-xs text-blue-700 font-medium">↳ 🛢️ Diesel: {dados.litrosDiesel.toFixed(1)} L</span>
                                <span className="text-xs font-data text-blue-700 font-semibold">{BRL(dados.valorDiesel)}</span>
                            </div>
                            {dados.litrosArla > 0 && (
                                <div className="flex justify-between py-1 pl-6">
                                    <span className="text-xs text-emerald-700 font-medium">↳ 💧 Arla 32: {dados.litrosArla.toFixed(1)} L</span>
                                    <span className="text-xs font-data text-emerald-700 font-semibold">{BRL(dados.valorArla)}</span>
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
                        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
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

                    {/* ── Relatório por Placa ──────────────────────────── */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                            <div className="flex items-center gap-2">
                                <Icon name="Truck" size={16} color="var(--color-muted-foreground)" />
                                <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Relatório por Placa</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <select value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)} className="px-3 py-1.5 rounded-lg border text-xs" style={inputStyle}>
                                    <option value="">Selecione a placa...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo || ''}</option>)}
                                </select>
                                {dadosPorPlaca && (
                                    <button onClick={exportarPorPlaca} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                                        <Icon name="FileDown" size={13} /> Exportar Excel
                                    </button>
                                )}
                            </div>
                        </div>
                        {!filtroPlaca ? (
                            <div className="p-8 text-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                Selecione uma placa para ver o relatório detalhado
                            </div>
                        ) : !dadosPorPlaca ? (
                            <div className="p-8 text-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum dado encontrado para esta placa no período</div>
                        ) : (
                            <div className="p-5 space-y-4">
                                {/* KPI cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { l: 'Receita Fretes', v: BRL(dadosPorPlaca.receita), c: '#065F46', bg: '#D1FAE5', i: 'TrendingUp' },
                                        { l: 'Total Combustível', v: BRL(dadosPorPlaca.combustivel), c: '#B45309', bg: '#FEF9C3', i: 'Fuel',
                                          sub: `🛢️ ${BRL(dadosPorPlaca.vDiesel)} · 💧 ${BRL(dadosPorPlaca.vArla)}` },
                                        { l: 'Total Despesas', v: BRL(dadosPorPlaca.totalDesp), c: '#DC2626', bg: '#FEE2E2', i: 'Receipt' },
                                        { l: 'Margem Líquida', v: BRL(dadosPorPlaca.margem), c: dadosPorPlaca.margem >= 0 ? '#1D4ED8' : '#DC2626', bg: dadosPorPlaca.margem >= 0 ? '#DBEAFE' : '#FEE2E2', i: dadosPorPlaca.margem >= 0 ? 'TrendingUp' : 'TrendingDown' },
                                    ].map(k => (
                                        <div key={k.l} className="rounded-xl border p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <div className="rounded-lg flex items-center justify-center" style={{ width: 24, height: 24, backgroundColor: k.bg }}>
                                                    <Icon name={k.i} size={12} color={k.c} />
                                                </div>
                                                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                            </div>
                                            <p className="text-base font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                                            {k.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{k.sub}</p>}
                                        </div>
                                    ))}
                                </div>
                                {/* DRE por placa */}
                                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="px-4 py-2 border-b text-xs font-semibold" style={{ backgroundColor: '#F8FAFC', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                        DRE — {dadosPorPlaca.veic?.placa} · {dadosPorPlaca.veic?.modelo || ''} · {dadosPorPlaca.viags.length} viagens · {dadosPorPlaca.carrg.length} fretes
                                    </div>
                                    <div className="p-4 space-y-1 text-sm">
                                        <div className="flex justify-between py-1 font-semibold text-green-700">
                                            <span>Receita Total</span><span className="font-data">{BRL(dadosPorPlaca.receita)}</span>
                                        </div>
                                        {dadosPorPlaca.receitaCarrg > 0 && <div className="flex justify-between py-0.5 pl-3 text-xs text-green-600"><span>↳ Fretes de carregamento</span><span className="font-data">{BRL(dadosPorPlaca.receitaCarrg)}</span></div>}
                                        {dadosPorPlaca.receitaRom > 0 && <div className="flex justify-between py-0.5 pl-3 text-xs text-green-600"><span>↳ Romaneios de carreta</span><span className="font-data">{BRL(dadosPorPlaca.receitaRom)}</span></div>}
                                        <div className="flex justify-between py-1 text-amber-700">
                                            <span>(-) Diesel {dadosPorPlaca.lDiesel.toFixed(1)}L</span><span className="font-data">({BRL(dadosPorPlaca.vDiesel)})</span>
                                        </div>
                                        <div className="flex justify-between py-1 text-emerald-700">
                                            <span>(-) Arla 32 {dadosPorPlaca.lArla.toFixed(1)}L</span><span className="font-data">({BRL(dadosPorPlaca.vArla)})</span>
                                        </div>
                                        {dadosPorPlaca.bonus > 0 && <div className="flex justify-between py-1 text-purple-700"><span>(-) Bônus Motoristas</span><span className="font-data">({BRL(dadosPorPlaca.bonus)})</span></div>}
                                        {dadosPorPlaca.diarias > 0 && <div className="flex justify-between py-1 text-indigo-700"><span>(-) Diárias</span><span className="font-data">({BRL(dadosPorPlaca.diarias)})</span></div>}
                                        {dadosPorPlaca.despExtra > 0 && <div className="flex justify-between py-1 text-orange-700"><span>(-) Despesas Extras</span><span className="font-data">({BRL(dadosPorPlaca.despExtra)})</span></div>}
                                        <div className="flex justify-between py-2 px-3 rounded-lg font-bold mt-2" style={{ backgroundColor: dadosPorPlaca.margem >= 0 ? '#EFF6FF' : '#FEF2F2', border: `1px solid ${dadosPorPlaca.margem >= 0 ? '#BFDBFE' : '#FECACA'}` }}>
                                            <span style={{ color: dadosPorPlaca.margem >= 0 ? '#1D4ED8' : '#DC2626' }}>Margem Líquida</span>
                                            <span className="font-data" style={{ color: dadosPorPlaca.margem >= 0 ? '#1D4ED8' : '#DC2626' }}>{BRL(dadosPorPlaca.margem)} ({dadosPorPlaca.receita > 0 ? ((dadosPorPlaca.margem / dadosPorPlaca.receita) * 100).toFixed(1) : 0}%)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
            <Toast toast={toast} />
        </div>
    );
}
// ─── BACKUP DE SEGURANÇA ─────────────────────────────────────────────────────
function BackupSeguranca({ showToast }) {
    const [loading, setLoading] = useState(false);
    const [progresso, setProgresso] = useState('');
    const [ultimoBackup, setUltimoBackup] = useState(() => {
        try { return localStorage.getItem('logiflow_ultimo_backup') || null; } catch { return null; }
    });

    const TABELAS = [
        { key: 'viagens',        label: 'Viagens',          fn: () => fetchViagens({}) },
        { key: 'carregamentos',  label: 'Carregamentos',     fn: () => fetchCarregamentos({}) },
        { key: 'abastecimentos', label: 'Abastecimentos',    fn: () => fetchAbastecimentos({}) },
        { key: 'checklists',     label: 'Checklists',        fn: () => fetchChecklists({}) },
        { key: 'despesas',       label: 'Despesas Extras',   fn: () => fetchDespesasExtras({}) },
        { key: 'diarias',        label: 'Diárias',           fn: () => fetchDiarias({}) },
        { key: 'ordens_servico', label: 'Ordens de Serviço', fn: () => fetchOrdensServico({}) },
        { key: 'veiculos',       label: 'Veículos',          fn: () => fetchCarretasVeiculos() },
        { key: 'postos',         label: 'Postos',            fn: () => fetchPostos().catch(() => []) },
    ];

    const gerarBackupJSON = async () => {
        setLoading(true);
        const backup = {
            versao: '1.0',
            app: 'LogiFlow',
            gerado_em: new Date().toISOString(),
            tabelas: {},
            totais: {},
        };
        try {
            for (const tabela of TABELAS) {
                setProgresso(`Exportando ${tabela.label}...`);
                const dados = await tabela.fn();
                backup.tabelas[tabela.key] = dados;
                backup.totais[tabela.key]  = dados.length;
            }
            setProgresso('Gerando arquivo...');

            // Serializa e faz download do JSON
            const json    = JSON.stringify(backup, null, 2);
            const blob    = new Blob([json], { type: 'application/json' });
            const url     = URL.createObjectURL(blob);
            const a       = document.createElement('a');
            const dataStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            a.href        = url;
            a.download    = `logiflow_backup_${dataStr}.json`;
            a.click();
            URL.revokeObjectURL(url);

            const agora = new Date().toLocaleString('pt-BR');
            localStorage.setItem('logiflow_ultimo_backup', agora);
            setUltimoBackup(agora);

            const total = Object.values(backup.totais).reduce((s, n) => s + n, 0);
            showToast(`✅ Backup gerado! ${total} registros exportados.`, 'success');
        } catch (e) {
            showToast('Erro ao gerar backup: ' + e.message, 'error');
        } finally {
            setLoading(false);
            setProgresso('');
        }
    };

    const gerarBackupExcel = async () => {
        setLoading(true);
        const wb = XLSX.utils.book_new();

        // Campos que contêm base64 ou JSON muito grande — substituir por indicador no Excel
        // (esses dados ficam íntegros no backup JSON)
        const CAMPOS_BASE64  = ['foto_url', 'comprovante_url', 'permuta_doc_url', 'pdf_url'];
        const CAMPOS_JSON    = ['nf_itens', 'boletos', 'cheques', 'itens'];
        const LIMITE_EXCEL   = 32000; // margem de segurança abaixo do limite de 32767

        const sanitizarValor = (k, v) => {
            if (v === null || v === undefined) return '';
            // Campos base64 — só indica presença
            if (CAMPOS_BASE64.includes(k)) return v ? '[imagem anexada]' : '';
            // Arrays/objetos JSON — resume em texto curto
            if (CAMPOS_JSON.includes(k)) {
                if (Array.isArray(v)) return v.length > 0 ? `[${v.length} item(s)]` : '';
                if (typeof v === 'object') return Object.keys(v).length > 0 ? `[${Object.keys(v).length} campo(s)]` : '';
                return '';
            }
            // Objetos aninhados (joins do Supabase) — aplana campos simples
            if (typeof v === 'object' && !Array.isArray(v)) {
                return Object.entries(v)
                    .filter(([, val]) => typeof val !== 'object')
                    .map(([key, val]) => `${key}:${val}`)
                    .join(' | ');
            }
            // String muito longa — trunca
            const str = String(v);
            return str.length > LIMITE_EXCEL ? str.substring(0, LIMITE_EXCEL) + '...[truncado]' : str;
        };

        try {
            for (const tabela of TABELAS) {
                setProgresso(`Exportando ${tabela.label}...`);
                const dados = await tabela.fn();
                if (dados.length === 0) continue;

                const rows = dados.map(row => {
                    const flat = {};
                    Object.entries(row).forEach(([k, v]) => {
                        flat[k] = sanitizarValor(k, v);
                    });
                    return flat;
                });

                const ws = XLSX.utils.json_to_sheet(rows);
                XLSX.utils.book_append_sheet(wb, ws, tabela.label.substring(0, 31));
            }

            // Aba de resumo
            const meta = [
                ['LogiFlow — Backup de Dados (Excel — visualização)', ''],
                ['Gerado em', new Date().toLocaleString('pt-BR')],
                ['Nota', 'Imagens e dados binários são indicados como [imagem anexada]. Use o Backup JSON para dados completos.'],
                ['', ''],
                ['Tabela', 'Registros'],
            ];
            const dataForMeta = await Promise.all(TABELAS.map(t => t.fn().catch(() => [])));
            TABELAS.forEach((t, i) => meta.push([t.label, dataForMeta[i].length]));
            const wsMeta = XLSX.utils.aoa_to_sheet(meta);
            wsMeta['!cols'] = [{ wch: 28 }, { wch: 60 }];
            XLSX.utils.book_append_sheet(wb, wsMeta, 'Resumo');

            setProgresso('Gerando arquivo...');
            const dataStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            XLSX.writeFile(wb, `logiflow_backup_${dataStr}.xlsx`);

            const agora = new Date().toLocaleString('pt-BR');
            localStorage.setItem('logiflow_ultimo_backup', agora);
            setUltimoBackup(agora);
            showToast('✅ Backup Excel gerado com sucesso!', 'success');
        } catch (e) {
            showToast('Erro: ' + e.message, 'error');
        } finally {
            setLoading(false);
            setProgresso('');
        }
    };

    return (
        <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: '#BFDBFE', backgroundColor: '#F8FAFF' }}>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                    <Icon name="ShieldCheck" size={18} color="#1D4ED8" />
                </div>
                <div>
                    <h3 className="font-heading font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Backup de Segurança</h3>
                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Exporta todos os dados do banco para arquivo local</p>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Admin</span>
            </div>

            {/* O que é exportado */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                {[
                    { label: 'Viagens',        icon: 'Navigation'    },
                    { label: 'Carregamentos',  icon: 'Package'       },
                    { label: 'Abastecimentos', icon: 'Fuel'          },
                    { label: 'Checklists',     icon: 'ClipboardCheck'},
                    { label: 'Despesas',       icon: 'Receipt'       },
                    { label: 'Diárias',        icon: 'CalendarDays'  },
                    { label: 'Ordens Serv.',   icon: 'Wrench'        },
                    { label: 'Veículos',       icon: 'Truck'         },
                    { label: 'Postos',         icon: 'MapPin'        },
                ].map(t => (
                    <div key={t.label} className="flex items-center gap-1.5 p-2 rounded-lg bg-white border text-xs"
                        style={{ borderColor: '#DBEAFE', color: '#1D4ED8' }}>
                        <Icon name={t.icon} size={11} color="#1D4ED8" />
                        {t.label}
                    </div>
                ))}
            </div>

            {/* Progresso */}
            {loading && progresso && (
                <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-xs text-blue-700" style={{ backgroundColor: '#EFF6FF' }}>
                    <div className="w-4 h-4 rounded-full border-2 border-blue-600 animate-spin" style={{ borderTopColor: 'transparent' }} />
                    {progresso}
                </div>
            )}

            {/* Último backup */}
            {ultimoBackup && !loading && (
                <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-xs" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <Icon name="CheckCircle2" size={13} color="#059669" />
                    <span className="text-green-700">Último backup gerado: <strong>{ultimoBackup}</strong></span>
                </div>
            )}

            {/* Aviso */}
            <div className="p-3 rounded-lg mb-4 text-xs" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <p className="text-amber-700 font-medium mb-1">⚠️ Recomendações de backup:</p>
                <ul className="text-amber-600 space-y-0.5 ml-2">
                    <li>• Faça backup <strong>semanalmente</strong> ou antes de mudanças grandes</li>
                    <li>• Salve o arquivo no <strong>Google Drive, OneDrive ou HD externo</strong></li>
                    <li>• Mantenha ao menos os últimos <strong>4 backups</strong> (1 mês)</li>
                    <li>• O JSON pode ser reimportado; o Excel serve para visualização e auditoria</li>
                </ul>
            </div>

            {/* Botões */}
            <div className="flex flex-wrap gap-3">
                <button onClick={gerarBackupJSON} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
                    style={{ backgroundColor: '#1D4ED8', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                    <Icon name="Download" size={15} color="white" />
                    {loading ? 'Gerando...' : 'Backup JSON (completo)'}
                </button>
                <button onClick={gerarBackupExcel} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity border"
                    style={{ borderColor: '#1D4ED8', color: '#1D4ED8', backgroundColor: 'white', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                    <Icon name="FileSpreadsheet" size={15} color="#1D4ED8" />
                    Backup Excel (visualização)
                </button>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--color-muted-foreground)' }}>
                O arquivo JSON é o backup completo e pode ser usado para restauração. O Excel serve para auditoria e leitura humana.
            </p>
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
        if (!vinculo.motorista_id && !vinculo.veiculo_id) { showToast('Selecione ao menos motorista ou placa', 'error'); return; }
        setExporting(true);
        try {
            const filtros = {};
            if (vinculo.motorista_id) filtros.motoristaId = vinculo.motorista_id;
            if (vinculo.veiculo_id)   filtros.veiculoId   = vinculo.veiculo_id;
            const [vgns, absts, carrgs, desps, diar] = await Promise.all([
                fetchViagens(filtros),
                fetchAbastecimentos(filtros),
                fetchCarregamentos(filtros),
                fetchDespesasExtras(filtros),
                fetchDiarias(filtros),
            ]);
            const mot = motoristas.find(m => m.id === vinculo.motorista_id);
            const vei = veiculos.find(v => v.id === vinculo.veiculo_id);
            const wb = XLSX.utils.book_new();

            // Aba 1 — Resumo
            const totalBonus = vgns.filter(v => v.status === 'Entrega finalizada').reduce((s, v) => s + calcularBonusCarreteiro(v.destino), 0);
            const totalFrete = carrgs.reduce((s, c) => s + Number(c.valor_frete_calculado || 0), 0);
            const totalDiesel = absts.reduce((s, a) => s + Number(a.valor_diesel || 0), 0);
            const totalArla = absts.reduce((s, a) => s + Number(a.valor_arla || 0), 0);
            const totalComb = totalDiesel + totalArla;
            const lDiesel = absts.reduce((s, a) => s + Number(a.litros_diesel || 0), 0);
            const lArla = absts.reduce((s, a) => s + Number(a.litros_arla || 0), 0);
            const totalDesp = desps.reduce((s, d) => s + Number(d.valor || 0), 0);
            const totalDiar = diar.reduce((s, d) => s + Number(d.valor_total || 0), 0);
            const resumo = [
                [`RELATÓRIO COMPLETO${mot ? ' — ' + mot.name : ''}${vei ? ' — ' + vei.placa : ''}`, ''],
                ['Gerado em:', new Date().toLocaleDateString('pt-BR')],
                ['', ''],
                ['RECEITAS', ''],
                ['Receita Total Fretes', totalFrete],
                ['', ''],
                ['DESPESAS', ''],
                ['Diesel', totalDiesel], [`  → ${lDiesel.toFixed(1)} L`, ''],
                ['Arla 32', totalArla],  [`  → ${lArla.toFixed(1)} L`, ''],
                ['Total Combustível', totalComb],
                ['Bônus Motoristas', totalBonus],
                ['Diárias', totalDiar],
                ['Despesas Extras (veículos)', totalDesp],
                ['Total Despesas', totalComb + totalBonus + totalDiar + totalDesp],
                ['', ''],
                ['MARGEM LÍQUIDA', totalFrete - (totalComb + totalBonus + totalDiar + totalDesp)],
                ['', ''],
                ['OPERACIONAL', ''],
                ['Total de Viagens', vgns.length],
                ['Viagens Finalizadas', vgns.filter(v => v.status === 'Entrega finalizada').length],
                ['Total Carregamentos', carrgs.length],
            ];
            const ws0 = XLSX.utils.aoa_to_sheet(resumo);
            ws0['!cols'] = [{ wch: 40 }, { wch: 18 }];
            XLSX.utils.book_append_sheet(wb, ws0, 'Resumo');

            // Aba 2 — Viagens + Bonificações (completa)
            const rowsVgns = vgns.map(v => ({
                'Nº Viagem': v.numero, 'Status': v.status, 'Motorista': v.motorista?.name || '',
                'Placa': v.veiculo?.placa || '', 'Destino': v.destino || '',
                'Data Saída': FMT_DATE(v.data_saida), 'Toneladas': v.toneladas || '',
                'Responsável': v.responsavel_cadastro || '',
                'Bônus (R$)': calcularBonusCarreteiro(v.destino),
                'Observações': v.observacoes || '',
            }));
            totalBonus && rowsVgns.push({ 'Nº Viagem': 'TOTAL', 'Bônus (R$)': totalBonus });
            const ws1 = XLSX.utils.json_to_sheet(rowsVgns);
            ws1['!cols'] = [12,16,20,10,20,12,10,14,12,25].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws1, 'Viagens e Bônus');

            // Aba 3 — Abastecimentos (diesel e arla separados)
            const rowsAbst = absts.map(a => ({
                'Data': FMT_DATE(a.data_abastecimento), 'Horário': a.horario || '',
                'Motorista': a.motorista?.name || '', 'Placa': a.veiculo?.placa || '',
                'Posto': a.posto || '',
                'Diesel (L)': Number(a.litros_diesel || 0), 'R$ Diesel': Number(a.valor_diesel || 0),
                'Arla (L)':   Number(a.litros_arla   || 0), 'R$ Arla':   Number(a.valor_arla   || 0),
                'Total R$':   Number(a.valor_total   || 0),
                'Observações': a.observacoes || '',
            }));
            rowsAbst.push({ 'Data': 'TOTAL', 'Diesel (L)': lDiesel, 'R$ Diesel': totalDiesel, 'Arla (L)': lArla, 'R$ Arla': totalArla, 'Total R$': totalComb });
            const ws2 = XLSX.utils.json_to_sheet(rowsAbst);
            ws2['!cols'] = [12,8,20,10,18,10,14,10,14,14,25].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws2, 'Abastecimentos');

            // Aba 4 — Carregamentos / Fretes (completa)
            const rowsCarr = carrgs.map(c => ({
                'Data': FMT_DATE(c.data_carregamento), 'Pedido': c.numero_pedido || '',
                'NF': c.numero_nota_fiscal || '', 'Empresa': c.empresa?.nome || '',
                'Motorista': c.motorista?.name || '', 'Placa': c.veiculo?.placa || '',
                'Destino': c.destino || '', 'Tipo Cálculo': c.tipo_calculo_frete || '',
                'Quantidade': c.quantidade || 0, 'Unidade': c.unidade_quantidade || '',
                'Valor Base': Number(c.valor_base_frete || 0), 'Frete (R$)': Number(c.valor_frete_calculado || 0),
            }));
            rowsCarr.push({ 'Data': 'TOTAL', 'Frete (R$)': totalFrete });
            const ws3 = XLSX.utils.json_to_sheet(rowsCarr);
            ws3['!cols'] = [12,12,10,18,20,10,20,14,10,8,12,14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws3, 'Carregamentos');

            // Aba 5 — Despesas Extras (completa)
            if (desps.length) {
                const rowsD = desps.map(d => ({
                    'Data': FMT_DATE(d.data_despesa), 'Placa': d.veiculo?.placa || '',
                    'Categoria': d.categoria, 'Descrição': d.descricao || '',
                    'NF': d.nota_fiscal || '', 'Forma Pgto': d.forma_pagamento === 'a_prazo' ? 'A Prazo' : 'À Vista',
                    'Tipo Pgto': d.tipo_pagamento || '',
                    'Valor (R$)': Number(d.valor || 0), 'Observações': d.observacoes || '',
                }));
                rowsD.push({ 'Data': 'TOTAL', 'Valor (R$)': totalDesp });
                const ws4 = XLSX.utils.json_to_sheet(rowsD);
                ws4['!cols'] = [12,10,22,30,12,12,14,14,25].map(w => ({ wch: w }));
                XLSX.utils.book_append_sheet(wb, ws4, 'Despesas Extras');
            }

            // Aba 6 — Diárias
            if (diar.length) {
                const rowsDi = diar.map(d => ({
                    'Data': FMT_DATE(d.data_inicio), 'Motorista': d.motorista?.name || '',
                    'Dias': d.quantidade_dias, 'Valor/Dia (R$)': Number(d.valor_dia || 0),
                    'Total (R$)': Number(d.valor_total || 0), 'Descrição': d.descricao || '',
                }));
                rowsDi.push({ 'Data': 'TOTAL', 'Total (R$)': totalDiar });
                const ws5 = XLSX.utils.json_to_sheet(rowsDi);
                ws5['!cols'] = [12,20,8,14,14,30].map(w => ({ wch: w }));
                XLSX.utils.book_append_sheet(wb, ws5, 'Diárias');
            }

            const nomeArq = `relatorio_completo_${mot?.name || ''}${vei ? '_' + vei.placa : ''}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`;
            XLSX.writeFile(wb, nomeArq);
            showToast('Relatório exportado com sucesso!', 'success');
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
                    <Field label="Motorista (ou use só a placa)">
                        <select value={vinculo.motorista_id} onChange={e => setVinculo(v => ({ ...v, motorista_id: e.target.value }))}
                            className={inputCls} style={inputStyle}>
                            <option value="">Todos os motoristas</option>
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
                    <p className="text-purple-700 font-medium mb-1">O relatório Excel conterá 6 abas completas:</p>
                    <p className="text-purple-600">📊 Resumo &nbsp;|&nbsp; 📋 Viagens e Bônus &nbsp;|&nbsp; ⛽ Abastecimentos (Diesel+Arla) &nbsp;|&nbsp; 📦 Carregamentos &nbsp;|&nbsp; 🧾 Despesas Extras &nbsp;|&nbsp; 📅 Diárias</p>
                </div>
                <Button onClick={exportarRelatorio} iconName={exporting ? 'Loader' : 'Download'} disabled={exporting || (!vinculo.motorista_id && !vinculo.veiculo_id)}>
                    {exporting ? 'Gerando...' : 'Exportar Relatório Completo Excel'}
                </Button>
            </div>

            {/* ── Backup de Segurança ───────────────────────────────────── */}
            {isAdmin && <BackupSeguranca showToast={showToast} />}

                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
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

    // Fix 4: Quando abre o PDF, empurra um estado no histórico para que o botão
    // Voltar do navegador feche o viewer em vez de sair da página.
    useEffect(() => {
        if (viewPdf) {
            window.history.pushState({ pdfOpen: true }, '');
            const onPop = () => setViewPdf(null);
            window.addEventListener('popstate', onPop);
            return () => window.removeEventListener('popstate', onPop);
        }
    }, [viewPdf]);

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
                <div className="flex gap-2 items-center">
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    {isAdmin && <Button onClick={() => { setForm({ veiculo_id: '', mecanico_id: '', descricao: '', prioridade: 'Normal', pdf_url: '' }); setPdfFile(null); setModal(true); }} iconName="Plus" size="sm">Nova OS</Button>}
                </div>
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
                    <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
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
                    {/* Barra superior discreta — apenas título e fechar */}
                    <div style={{
                        position: 'relative', zIndex: 10000, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 16px', backgroundColor: '#111827',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}>
                        <span style={{ color: '#9CA3AF', fontSize: 13 }}>Ordem de Serviço — PDF</span>
                        <button
                            onClick={() => { setViewPdf(null); window.history.back(); }}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 32, borderRadius: 6,
                                backgroundColor: '#374151', color: '#D1D5DB',
                                border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1,
                            }}
                            title="Fechar">
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
                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Romaneios de Carreta ───────────────────────────────────────────────
function TabRomaneioCarreta({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [romaneios, setRomaneios] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [veiculos,  setVeiculos]  = useState([]);
    const [motoristas,setMotoristas]= useState([]);
    const [loading,   setLoading]   = useState(true);
    const [modal,     setModal]     = useState(null);   // null | { mode, data? }
    const [viewModal, setViewModal] = useState(null);   // romaneio para visualização
    const [filtro,    setFiltro]    = useState({ status: '', mes: '' });

    const BRL_LOC = v => Number(v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const FMT_LOC = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

    const STATUS_CARRETA = ['Aguardando','Carregando','Em Trânsito','Entrega finalizada','Cancelado'];
    const STATUS_CFG = {
        'Aguardando':        { bg: '#FEF9C3', text: '#B45309' },
        'Carregando':        { bg: '#DBEAFE', text: '#1D4ED8' },
        'Em Trânsito':       { bg: '#D1FAE5', text: '#065F46' },
        'Entrega finalizada':{ bg: '#F0FDF4', text: '#15803D' },
        'Cancelado':         { bg: '#FEE2E2', text: '#991B1B' },
    };

    const TIPOS_FRETE = [
        { value: 'fixo',         label: 'Valor fixo (R$)' },
        { value: 'por_tonelada', label: 'Por tonelada (R$/ton)' },
    ];

    const emptyForm = () => ({
        status: 'Aguardando', motorista_id: '', veiculo_id: '',
        data_saida: new Date().toISOString().split('T')[0], data_chegada: '',
        destino: '', toneladas: '', empresa: '', valor_frete: '',
        tipo_calculo_frete: 'fixo', observacoes: '',
    });
    const [form,  setForm]  = useState(emptyForm());
    const [itens, setItens] = useState([]);
    const [novoItem, setNovoItem] = useState({ material_id: '', descricao: '', quantidade: '', unidade: 'ton', peso_total: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.status) f.status = filtro.status;
            if (filtro.mes) {
                const [ano, m] = filtro.mes.split('-').map(Number);
                f.dataInicio = filtro.mes + '-01';
                f.dataFim = filtro.mes + '-' + String(new Date(ano, m, 0).getDate()).padStart(2,'0');
            }
            const [r, mat, v, mot] = await Promise.all([
                fetchRomaneiosCarreta(f),
                fetchMaterials(),
                fetchCarretasVeiculos(),
                fetchCarreteiros(),
            ]);
            setRomaneios(r); setMaterials(mat); setVeiculos(v); setMotoristas(mot);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    // Calcula frete baseado no tipo
    const calcularFrete = (f, it) => {
        if (f.tipo_calculo_frete === 'por_tonelada') {
            const tons = it.reduce((s, i) => s + Number(i.toneladas || i.quantidade || 0), 0) || Number(f.toneladas || 0);
            return (Number(f.valor_frete || 0) * tons).toFixed(2);
        }
        return f.valor_frete || '0';
    };

    const freteCalculado = useMemo(() => calcularFrete(form, itens), [form, itens]); // eslint-disable-line

    // Item handlers
    const addItem = () => {
        if (!novoItem.material_id && !novoItem.descricao) { showToast('Selecione um material ou informe a descrição', 'error'); return; }
        if (!novoItem.quantidade) { showToast('Informe a quantidade', 'error'); return; }
        const mat = materials.find(m => String(m.id) === String(novoItem.material_id));
        const pesoCalc = mat?.peso && novoItem.quantidade ? (Number(novoItem.quantidade) * Number(mat.peso)).toFixed(3) : novoItem.peso_total;
        setItens(prev => [...prev, {
            ...novoItem,
            descricao: novoItem.descricao || mat?.nome || '',
            unidade: novoItem.unidade || mat?.unidade || 'ton',
            peso_total: pesoCalc || '',
        }]);
        setNovoItem({ material_id: '', descricao: '', quantidade: '', unidade: 'ton', peso_total: '' });
    };
    const removeItem = (idx) => setItens(prev => prev.filter((_, i) => i !== idx));

    const handleSave = async () => {
        if (!form.destino) { showToast('Destino é obrigatório', 'error'); return; }
        try {
            const payload = { ...form };
            if (form.tipo_calculo_frete === 'por_tonelada') {
                payload.valor_frete = freteCalculado;
            }
            if (modal.mode === 'create') {
                await createRomaneioCarreta(payload, itens);
                showToast('Romaneio criado!', 'success');
            } else {
                await updateRomaneioCarreta(modal.data.id, payload, itens);
                showToast('Romaneio atualizado!', 'success');
            }
            setModal(null); setForm(emptyForm()); setItens([]); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleAprovar = async (r) => {
        try {
            await aprovarRomaneioCarreta(r.id, profile?.id);
            showToast('Romaneio aprovado!', 'success'); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (id) => {
        if (!await confirm({ title: 'Excluir romaneio?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir' })) return;
        try { await deleteRomaneioCarreta(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const openCreate = () => { setForm(emptyForm()); setItens([]); setModal({ mode: 'create' }); };
    const openEdit = (r) => {
        setForm({
            status: r.status, motorista_id: r.motorista_id || '', veiculo_id: r.veiculo_id || '',
            data_saida: r.data_saida || '', data_chegada: r.data_chegada || '',
            destino: r.destino || '', toneladas: r.toneladas || '', empresa: r.empresa || '',
            valor_frete: r.valor_frete || '', tipo_calculo_frete: r.tipo_calculo_frete || 'fixo',
            observacoes: r.observacoes || '',
        });
        setItens((r.carretas_romaneio_itens || []).map(it => ({
            material_id: it.material_id || '',
            descricao: it.descricao || it.material?.nome || '',
            quantidade: it.quantidade || '',
            unidade: it.unidade || 'ton',
            peso_total: it.peso_total || '',
        })));
        setModal({ mode: 'edit', data: r });
    };

    // Exportar romaneio como PDF via janela de impressão
    const imprimirRomaneio = (r) => {
        const itensHtml = (r.carretas_romaneio_itens || []).map((it, i) => `
            <tr>
                <td>${i+1}</td>
                <td>${it.material?.nome || it.descricao || '—'}</td>
                <td>${Number(it.quantidade||0).toLocaleString('pt-BR')} ${it.unidade || ''}</td>
                <td>${it.peso_total ? Number(it.peso_total).toLocaleString('pt-BR') + ' ton' : '—'}</td>
            </tr>
        `).join('');
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>Romaneio ${r.numero}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
            h1 { font-size: 22px; margin: 0; } h2 { font-size: 16px; color: #444; }
            .header { border-bottom: 2px solid #1D4ED8; padding-bottom: 12px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; }
            .field { } .label { font-size: 11px; color: #666; text-transform: uppercase; } .value { font-size: 14px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background: #1D4ED8; color: white; padding: 8px; text-align: left; font-size: 12px; }
            td { padding: 7px 8px; border-bottom: 1px solid #eee; font-size: 13px; }
            tr:nth-child(even) td { background: #F8FAFF; }
            .totais { margin-top: 20px; padding: 12px; background: #F0F9FF; border-radius: 8px; }
            .frete { font-size: 18px; font-weight: bold; color: #1D4ED8; }
            .assinaturas { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 60px; }
            .assinatura { border-top: 1px solid #999; padding-top: 8px; text-align: center; font-size: 12px; color: #555; }
            @media print { body { padding: 20px; } }
        </style></head><body>
        <div class="header">
            <div style="display:flex;justify-content:space-between;align-items:start">
                <div>
                    <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px">ROMANEIO DE CARRETA</div>
                    <h1>${r.numero}</h1>
                    <h2>Ferragens / Materiais — Carreta</h2>
                </div>
                <div style="text-align:right">
                    <div style="font-size:12px;color:#666">Emitido em: ${new Date().toLocaleDateString('pt-BR')}</div>
                    <div style="font-size:14px;font-weight:600;margin-top:4px;padding:4px 12px;background:${STATUS_CFG[r.status]?.bg||'#f5f5f5'};color:${STATUS_CFG[r.status]?.text||'#333'};border-radius:20px;display:inline-block">${r.status}</div>
                </div>
            </div>
        </div>
        <div class="grid">
            <div class="field"><div class="label">Motorista</div><div class="value">${r.motorista?.name || '—'}</div></div>
            <div class="field"><div class="label">Veículo / Placa</div><div class="value">${r.veiculo?.placa || '—'} ${r.veiculo?.modelo ? '· ' + r.veiculo.modelo : ''}</div></div>
            <div class="field"><div class="label">Destino</div><div class="value">${r.destino || '—'}</div></div>
            <div class="field"><div class="label">Empresa</div><div class="value">${r.empresa || '—'}</div></div>
            <div class="field"><div class="label">Data de Saída</div><div class="value">${r.data_saida ? new Date(r.data_saida+'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div></div>
            <div class="field"><div class="label">Data de Chegada</div><div class="value">${r.data_chegada ? new Date(r.data_chegada+'T00:00:00').toLocaleDateString('pt-BR') : 'Em trânsito'}</div></div>
            <div class="field"><div class="label">Tonelagem Total</div><div class="value">${r.toneladas ? Number(r.toneladas).toLocaleString('pt-BR') + ' ton' : '—'}</div></div>
        </div>
        <h3 style="margin-bottom:4px;color:#1D4ED8">Itens Transportados</h3>
        <table>
            <thead><tr><th>#</th><th>Material / Produto</th><th>Quantidade</th><th>Peso</th></tr></thead>
            <tbody>${itensHtml || '<tr><td colspan="4" style="text-align:center;color:#999">Nenhum item cadastrado</td></tr>'}</tbody>
        </table>
        <div class="totais">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-size:12px;color:#666">Valor do Frete</div>
                    <div class="frete">${Number(r.valor_frete||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                </div>
                <div style="text-align:right">
                    ${r.aprovado ? '<div style="color:#059669;font-weight:bold">✓ APROVADO</div>' : '<div style="color:#D97706">Aguardando aprovação</div>'}
                </div>
            </div>
        </div>
        ${r.observacoes ? `<div style="margin-top:16px;padding:10px;background:#FFF7ED;border-radius:6px;font-size:13px"><strong>Observações:</strong> ${r.observacoes}</div>` : ''}
        <div class="assinaturas">
            <div class="assinatura">Motorista: ${r.motorista?.name || '_______________'}</div>
            <div class="assinatura">Responsável / Admin</div>
            <div class="assinatura">Conferente / Destinatário</div>
        </div>
        <script>window.print(); window.onafterprint = () => window.close();</script>
        </body></html>`;

        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
    };

    const totalRomaneios = romaneios.length;
    const totalFrete = romaneios.reduce((s, r) => s + Number(r.valor_frete || 0), 0);
    const totalTon = romaneios.reduce((s, r) => s + Number(r.toneladas || 0), 0);
    const pendentes = romaneios.filter(r => !r.aprovado).length;

    return (
        <div>
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <select value={filtro.status} onChange={e => setFiltro(f => ({ ...f, status: e.target.value }))}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos os status</option>
                        {STATUS_CARRETA.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="month" value={filtro.mes} onChange={e => setFiltro(f => ({ ...f, mes: e.target.value }))}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                </div>
                {isAdmin && <Button onClick={openCreate} iconName="Plus" size="sm">Novo Romaneio</Button>}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                    { l: 'Total Romaneios', v: totalRomaneios, c: '#1D4ED8', bg: '#EFF6FF', i: 'FileText' },
                    { l: 'Frete Total',     v: BRL_LOC(totalFrete), c: '#059669', bg: '#D1FAE5', i: 'DollarSign' },
                    { l: 'Tonelagem',       v: totalTon.toLocaleString('pt-BR',{maximumFractionDigits:1}) + ' ton', c: '#D97706', bg: '#FEF9C3', i: 'Package' },
                    { l: 'Pendentes aprovação', v: pendentes, c: '#DC2626', bg: '#FEE2E2', i: 'Clock' },
                ].map(k => (
                    <div key={k.l} className="bg-white rounded-xl border p-3 sm:p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}>
                                <Icon name={k.i} size={14} color={k.c} />
                            </div>
                        </div>
                        <p className="text-lg font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                    </div>
                ))}
            </div>

            {/* Lista */}
            {loading ? (
                <div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
            ) : romaneios.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="FileText" size={40} color="var(--color-muted-foreground)" />
                    <p className="text-sm mt-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum romaneio encontrado</p>
                    {isAdmin && <Button onClick={openCreate} iconName="Plus" size="sm" className="mt-4">Criar primeiro romaneio</Button>}
                </div>
            ) : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[800px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Número','Status','Motorista','Placa','Destino','Saída','Tonelagem','Frete','Aprovado',''].map(h =>
                                <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                            )}</tr>
                        </thead>
                        <tbody>
                            {romaneios.map((r, i) => {
                                const sc = STATUS_CFG[r.status] || STATUS_CFG['Aguardando'];
                                const itsCount = r.carretas_romaneio_itens?.length || 0;
                                return (
                                    <tr key={r.id} className="border-t hover:bg-gray-50 cursor-pointer" style={{ borderColor: 'var(--color-border)', backgroundColor: i%2===0?'#fff':'#F8FAFC' }}
                                        onClick={() => setViewModal(r)}>
                                        <td className="px-3 py-3 font-data font-bold text-blue-700 whitespace-nowrap">{r.numero}</td>
                                        <td className="px-3 py-3">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.status}</span>
                                        </td>
                                        <td className="px-3 py-3 font-medium">{r.motorista?.name || '—'}</td>
                                        <td className="px-3 py-3 font-data">{r.veiculo?.placa || '—'}</td>
                                        <td className="px-3 py-3">{r.destino || '—'}</td>
                                        <td className="px-3 py-3 whitespace-nowrap">{FMT_LOC(r.data_saida)}</td>
                                        <td className="px-3 py-3 font-data">{r.toneladas ? Number(r.toneladas).toLocaleString('pt-BR') + ' ton' : '—'}</td>
                                        <td className="px-3 py-3 font-data font-semibold text-green-700">{BRL_LOC(r.valor_frete)}</td>
                                        <td className="px-3 py-3">
                                            {r.aprovado
                                                ? <span className="flex items-center gap-1 text-xs text-green-700"><Icon name="CheckCircle2" size={13} color="#059669" />Aprovado</span>
                                                : isAdmin
                                                    ? <button onClick={e => { e.stopPropagation(); handleAprovar(r); }} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 hover:bg-amber-200">
                                                        <Icon name="Clock" size={11} />Aprovar
                                                    </button>
                                                    : <span className="text-xs text-amber-600">Pendente</span>
                                            }
                                        </td>
                                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                            <div className="flex gap-1">
                                                <button onClick={() => imprimirRomaneio(r)} className="p-1.5 rounded hover:bg-blue-50" title="Imprimir / PDF"><Icon name="Printer" size={13} color="#1D4ED8" /></button>
                                                {isAdmin && <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-gray-50"><Icon name="Pencil" size={13} color="var(--color-muted-foreground)" /></button>}
                                                {isAdmin && <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={13} color="#DC2626" /></button>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ backgroundColor: '#F0FDF4', borderTop: '2px solid #BBF7D0' }}>
                                <td colSpan={6} className="px-3 py-2 text-xs font-bold text-green-800">TOTAIS</td>
                                <td className="px-3 py-2 font-data font-bold text-green-700">{totalTon.toLocaleString('pt-BR',{maximumFractionDigits:1})} ton</td>
                                <td className="px-3 py-2 font-data font-bold text-green-700">{BRL_LOC(totalFrete)}</td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* Modal criar/editar */}
            {modal && isAdmin && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: '68px' }}
                    onClick={e => e.target === e.currentTarget && setModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: 'calc(100dvh - 76px)' }}>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="FileText" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                                    {modal.mode === 'create' ? 'Novo Romaneio de Carreta' : `Editar ${modal.data?.numero}`}
                                </h2>
                            </div>
                            <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {/* Dados básicos */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Status" required>
                                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls} style={inputStyle}>
                                        {STATUS_CARRETA.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </Field>
                                <Field label="Motorista">
                                    <select value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione o motorista...</option>
                                        {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="Veículo / Carreta">
                                    <select value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione a carreta...</option>
                                        {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                    </select>
                                </Field>
                                <Field label="Empresa">
                                    <select value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione a empresa...</option>
                                        <option value="Comercial Araguaia">Comercial Araguaia</option>
                                        <option value="Aços Confiance">Aços Confiance</option>
                                        <option value="Confiance">Confiance</option>
                                    </select>
                                </Field>
                                <Field label="Destino" required>
                                    <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Cidade de destino" />
                                </Field>
                                <Field label="Tonelagem total">
                                    <input type="number" step="0.001" value={form.toneladas} onChange={e => setForm(f => ({ ...f, toneladas: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 28.500" />
                                </Field>
                                <Field label="Data de Saída">
                                    <input type="date" value={form.data_saida} onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))} className={inputCls} style={inputStyle} />
                                </Field>
                                <Field label="Data de Chegada">
                                    <input type="date" value={form.data_chegada} onChange={e => setForm(f => ({ ...f, data_chegada: e.target.value }))} className={inputCls} style={inputStyle} />
                                </Field>
                            </div>

                            {/* Frete */}
                            <div className="p-4 rounded-xl border" style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }}>
                                <p className="text-xs font-semibold text-green-700 mb-3">💰 Valor do Frete</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Tipo de cálculo">
                                        <select value={form.tipo_calculo_frete} onChange={e => setForm(f => ({ ...f, tipo_calculo_frete: e.target.value }))} className={inputCls} style={inputStyle}>
                                            {TIPOS_FRETE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </Field>
                                    <Field label={form.tipo_calculo_frete === 'por_tonelada' ? 'Preço por tonelada (R$/ton)' : 'Valor do frete (R$)'}>
                                        <input type="number" step="0.01" value={form.valor_frete} onChange={e => setForm(f => ({ ...f, valor_frete: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                                    </Field>
                                </div>
                                {form.tipo_calculo_frete === 'por_tonelada' && Number(form.valor_frete) > 0 && (
                                    <div className="mt-2 p-2 rounded-lg bg-white text-sm text-green-700 font-semibold">
                                        Frete estimado: {BRL_LOC(freteCalculado)} ({form.toneladas||'0'} ton × {BRL_LOC(form.valor_frete)})
                                    </div>
                                )}
                            </div>

                            {/* Itens — produtos */}
                            <div>
                                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>📦 Itens / Materiais transportados</p>
                                {itens.length > 0 && (
                                    <div className="bg-white rounded-xl border mb-3 overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                                        <table className="w-full text-xs min-w-[500px]">
                                            <thead className="border-b" style={{ backgroundColor: '#F8FAFC', borderColor: 'var(--color-border)' }}>
                                                <tr>{['Material','Qtd','Unidade','Peso',''].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                                            </thead>
                                            <tbody>
                                                {itens.map((it, idx) => (
                                                    <tr key={idx} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                        <td className="px-3 py-2 font-medium">{it.descricao || materials.find(m => m.id === it.material_id)?.nome || '—'}</td>
                                                        <td className="px-3 py-2 font-data">{Number(it.quantidade).toLocaleString('pt-BR')}</td>
                                                        <td className="px-3 py-2">{it.unidade}</td>
                                                        <td className="px-3 py-2 font-data">{it.peso_total ? Number(it.peso_total).toLocaleString('pt-BR') + ' ton' : '—'}</td>
                                                        <td className="px-3 py-2">
                                                            <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50"><Icon name="Trash2" size={12} color="#DC2626" /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {/* Adicionar item */}
                                <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-muted-foreground)' }}>Adicionar item</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
                                        <div className="sm:col-span-2">
                                            <select value={novoItem.material_id} onChange={e => {
                                                const mat = materials.find(m => String(m.id) === String(e.target.value));
                                                const qtd = Number(novoItem.quantidade) || 0;
                                                const pesoCalc = mat?.peso && qtd > 0 ? (qtd * Number(mat.peso)).toFixed(3) : '';
                                                setNovoItem(n => ({ ...n, material_id: e.target.value, descricao: mat?.nome || n.descricao, unidade: mat?.unidade || n.unidade, peso_total: pesoCalc }));
                                            }} className={inputCls} style={inputStyle}>
                                                <option value="">Selecione o material...</option>
                                                {materials.map(m => <option key={m.id} value={m.id}>{m.nome} ({m.unidade})</option>)}
                                            </select>
                                        </div>
                                        <input type="number" step="0.001" value={novoItem.quantidade} onChange={e => {
                                            const qtd = Number(e.target.value) || 0;
                                            const mat = materials.find(m => String(m.id) === String(novoItem.material_id));
                                            const pesoCalc = mat?.peso && qtd > 0 ? (qtd * Number(mat.peso)).toFixed(3) : novoItem.peso_total;
                                            setNovoItem(n => ({ ...n, quantidade: e.target.value, peso_total: pesoCalc }));
                                        }} className={inputCls} style={inputStyle} placeholder="Quantidade" />
                                        <div className="relative">
                                            <input value={novoItem.unidade} onChange={e => setNovoItem(n => ({ ...n, unidade: e.target.value }))} className={inputCls} style={{ ...inputStyle, paddingRight: novoItem.material_id ? '2rem' : undefined }} placeholder="Unidade" />
                                            {novoItem.material_id && (
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-1 rounded" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>auto</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Linha de peso calculado */}
                                    {novoItem.material_id && novoItem.quantidade && (
                                        <div className="mb-2 flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs" style={{ backgroundColor: '#F0FDF4', color: '#065F46' }}>
                                            <Icon name="Scale" size={12} color="#059669" />
                                            {(() => {
                                                const mat = materials.find(m => String(m.id) === String(novoItem.material_id));
                                                return mat?.peso
                                                    ? <>Peso unitário: <strong>{Number(mat.peso).toLocaleString('pt-BR')} kg/{mat.unidade}</strong> → Peso total estimado: <strong>{novoItem.peso_total ? Number(novoItem.peso_total).toLocaleString('pt-BR') + ' kg' : '—'}</strong></>
                                                    : <span>Peso unitário não cadastrado para este material</span>;
                                            })()}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <input value={novoItem.descricao} onChange={e => setNovoItem(n => ({ ...n, descricao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Descrição alternativa (se não selecionar material)" />
                                        <button onClick={addItem} className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                                            <Icon name="Plus" size={14} color="white" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <Field label="Observações">
                                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                            </Field>
                        </div>
                        <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleSave} iconName="Check" size="sm">
                                {modal.mode === 'create' ? 'Criar Romaneio' : 'Salvar alterações'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de visualização (clicando na linha) */}
            {viewModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingTop: '68px' }}
                    onClick={e => e.target === e.currentTarget && setViewModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: 'calc(100dvh - 76px)' }}>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                            <div>
                                <p className="font-data font-bold text-xl text-blue-700">{viewModal.numero}</p>
                                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{viewModal.motorista?.name || '—'} · {viewModal.veiculo?.placa || '—'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => imprimirRomaneio(viewModal)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                    <Icon name="Printer" size={13} /> Imprimir
                                </button>
                                <button onClick={() => setViewModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                    <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                {[
                                    { l: 'Status', v: <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: STATUS_CFG[viewModal.status]?.bg, color: STATUS_CFG[viewModal.status]?.text }}>{viewModal.status}</span> },
                                    { l: 'Destino', v: viewModal.destino || '—' },
                                    { l: 'Empresa', v: viewModal.empresa || '—' },
                                    { l: 'Data Saída', v: FMT_LOC(viewModal.data_saida) },
                                    { l: 'Data Chegada', v: FMT_LOC(viewModal.data_chegada) },
                                    { l: 'Tonelagem', v: viewModal.toneladas ? Number(viewModal.toneladas).toLocaleString('pt-BR') + ' ton' : '—' },
                                    { l: 'Frete', v: <span className="font-data font-bold text-green-700">{BRL_LOC(viewModal.valor_frete)}</span> },
                                    { l: 'Aprovado', v: viewModal.aprovado ? <span className="text-green-600">✓ Sim</span> : <span className="text-amber-600">Pendente</span> },
                                ].map(({ l, v }) => (
                                    <div key={l} className="p-3 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid var(--color-border)' }}>
                                        <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>{l}</p>
                                        <div className="font-medium">{v}</div>
                                    </div>
                                ))}
                            </div>
                            {/* Itens */}
                            {(viewModal.carretas_romaneio_itens || []).length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>📦 Itens transportados</p>
                                    <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        <table className="w-full text-sm">
                                            <thead className="text-xs border-b" style={{ backgroundColor: '#F8FAFC', borderColor: 'var(--color-border)' }}>
                                                <tr>{['Material','Quantidade','Peso'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
                                            </thead>
                                            <tbody>
                                                {viewModal.carretas_romaneio_itens.map((it, i) => (
                                                    <tr key={it.id} className="border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: i%2===0?'#fff':'#F8FAFC' }}>
                                                        <td className="px-3 py-2 font-medium">{it.material?.nome || it.descricao || '—'}</td>
                                                        <td className="px-3 py-2 font-data">{Number(it.quantidade||0).toLocaleString('pt-BR')} {it.unidade}</td>
                                                        <td className="px-3 py-2 font-data">{it.peso_total ? Number(it.peso_total).toLocaleString('pt-BR') + ' ton' : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            {viewModal.observacoes && (
                                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                                    <span className="font-medium text-amber-700">Obs:</span> {viewModal.observacoes}
                                </div>
                            )}
                            {isAdmin && !viewModal.aprovado && (
                                <button onClick={() => { handleAprovar(viewModal); setViewModal(null); }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700">
                                    <Icon name="CheckCircle2" size={16} color="white" /> Aprovar Romaneio
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {ConfirmDialog}
            <Toast toast={toast} />
        </div>
    );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
// ─── TAB: Histórico de Rotas por Motorista ───────────────────────────────────
function TabHistoricoViagens({ isAdmin }) {
    const { toast, showToast } = useToast();
    const [viagens, setViagens]     = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [veiculos, setVeiculos]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [filtroMotorista, setFiltroMotorista] = useState('');
    const [filtroVeiculo, setFiltroVeiculo]     = useState('');
    const [filtroPeriodo, setFiltroPeriodo]     = useState('12'); // meses

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const mesesAtras = new Date();
            mesesAtras.setMonth(mesesAtras.getMonth() - Number(filtroPeriodo));
            const dataInicio = mesesAtras.toISOString().slice(0, 10);

            const filtros = { dataInicio };
            if (filtroMotorista) filtros.motoristaId = filtroMotorista;
            if (filtroVeiculo)   filtros.veiculoId   = filtroVeiculo;

            const [v, m, ve] = await Promise.all([
                fetchViagens(filtros),
                fetchTodosMotoristas(),
                fetchCarretasVeiculos(),
            ]);
            setViagens(v); setMotoristas(m); setVeiculos(ve);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtroMotorista, filtroVeiculo, filtroPeriodo]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    // ── Agregações ────────────────────────────────────────────────────────────
    const { porMotorista, destinosGlobais, alertasRotas } = useMemo(() => {
        const mapa = {}; // motoristaId → { nome, destinos: {cidade→{count,datas,status}} }

        viagens.forEach(v => {
            const mid  = v.motorista_id || '__sem__';
            const nome = v.motorista?.name || 'Sem motorista';
            const dest = (v.destino || '').trim();
            if (!dest) return;

            if (!mapa[mid]) mapa[mid] = { nome, destinos: {}, totalViagens: 0, placa: v.veiculo?.placa };
            mapa[mid].totalViagens++;

            const cidadeLow = dest.toLowerCase();
            if (!mapa[mid].destinos[cidadeLow]) {
                mapa[mid].destinos[cidadeLow] = { cidade: dest, count: 0, datas: [], status: [] };
            }
            mapa[mid].destinos[cidadeLow].count++;
            if (v.data_saida) mapa[mid].destinos[cidadeLow].datas.push(v.data_saida);
            mapa[mid].destinos[cidadeLow].status.push(v.status);
        });

        // Ordena destinos por frequência (desc)
        const porMotorista = Object.values(mapa)
            .sort((a, b) => b.totalViagens - a.totalViagens)
            .map(m => ({
                ...m,
                destinos: Object.values(m.destinos).sort((a, b) => b.count - a.count),
            }));

        // Destinos globais (todas as viagens)
        const globalMap = {};
        viagens.forEach(v => {
            const dest = (v.destino || '').trim().toLowerCase();
            if (!dest) return;
            globalMap[dest] = (globalMap[dest] || 0) + 1;
        });
        const destinosGlobais = Object.entries(globalMap)
            .sort((a, b) => b[1] - a[1])
            .map(([cidade, count]) => ({ cidade, count }));

        // Alertas: motoristas com cidade repetida ≥ 3x nas últimas viagens
        const alertasRotas = [];
        porMotorista.forEach(m => {
            m.destinos.forEach(d => {
                if (d.count >= 3) {
                    const ultimaData = d.datas.sort().reverse()[0];
                    alertasRotas.push({ motorista: m.nome, cidade: d.cidade, count: d.count, ultimaData });
                }
            });
        });

        return { porMotorista, destinosGlobais, alertasRotas };
    }, [viagens]);

    // ── Filtro de motorista selecionado ───────────────────────────────────────
    const dadosFiltrados = useMemo(() => {
        if (!filtroMotorista) return porMotorista;
        return porMotorista.filter(m => {
            const mot = motoristas.find(x => x.id === filtroMotorista);
            return m.nome === mot?.name;
        });
    }, [porMotorista, filtroMotorista, motoristas]);

    // ── Exportar Excel ────────────────────────────────────────────────────────
    const exportar = () => {
        if (!viagens.length) { showToast('Nenhum dado para exportar', 'error'); return; }
        const wb = XLSX.utils.book_new();

        // Aba 1 — Destinos por motorista
        const rowsM = [];
        porMotorista.forEach(m => {
            m.destinos.forEach((d, idx) => {
                rowsM.push({
                    'Motorista':       idx === 0 ? m.nome : '',
                    'Total Viagens':   idx === 0 ? m.totalViagens : '',
                    'Destino':         d.cidade,
                    'Frequência':      d.count,
                    '% do Total':      m.totalViagens > 0 ? `${((d.count / m.totalViagens) * 100).toFixed(1)}%` : '0%',
                    'Última Viagem':   d.datas.sort().reverse()[0] ? FMT_DATE(d.datas.sort().reverse()[0]) : '—',
                    'Alerta':          d.count >= 3 ? '⚠️ Rota frequente' : '',
                });
            });
            rowsM.push({});
        });
        const ws1 = XLSX.utils.json_to_sheet(rowsM);
        ws1['!cols'] = [22,14,22,12,12,14,20].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws1, 'Por Motorista');

        // Aba 2 — Destinos globais (ranking)
        const rowsG = destinosGlobais.map((d, i) => ({
            'Ranking': i + 1,
            'Destino': d.cidade,
            'Total de Viagens': d.count,
        }));
        const ws2 = XLSX.utils.json_to_sheet(rowsG);
        ws2['!cols'] = [10, 25, 18].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws2, 'Ranking Destinos');

        // Aba 3 — Alertas
        if (alertasRotas.length) {
            const ws3 = XLSX.utils.json_to_sheet(alertasRotas.map(a => ({
                'Motorista': a.motorista,
                'Cidade repetida': a.cidade,
                'Vezes':      a.count,
                'Última viagem': FMT_DATE(a.ultimaData),
            })));
            ws3['!cols'] = [22, 22, 10, 14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws3, 'Alertas Rotas Frequentes');
        }

        // Aba 4 — Viagens detalhadas
        const rowsV = viagens.map(v => ({
            'Motorista':   v.motorista?.name || '',
            'Placa':       v.veiculo?.placa || '',
            'Nº Viagem':   v.numero || '',
            'Status':      v.status || '',
            'Data Saída':  FMT_DATE(v.data_saida),
            'Destino':     v.destino || '',
            'Toneladas':   v.toneladas || '',
        }));
        const ws4 = XLSX.utils.json_to_sheet(rowsV);
        ws4['!cols'] = [20, 12, 12, 18, 12, 22, 10].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws4, 'Viagens Detalhadas');

        XLSX.writeFile(wb, `historico_rotas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado com sucesso!', 'success');
    };

    // ── Cor do heatmap por frequência ─────────────────────────────────────────
    const heatColor = (count, max) => {
        if (max === 0) return { bg: '#F8FAFC', text: '#64748B' };
        const ratio = count / max;
        if (ratio >= 0.8) return { bg: '#FEE2E2', text: '#991B1B' };  // vermelho — muito frequente
        if (ratio >= 0.5) return { bg: '#FEF9C3', text: '#B45309' };  // amarelo — frequente
        if (ratio >= 0.25) return { bg: '#DCFCE7', text: '#166534' }; // verde — moderado
        return { bg: '#F0F9FF', text: '#0369A1' };                     // azul — raro
    };

    return (
        <div>
            {/* ── Toolbar ── */}
            <div className="flex flex-wrap gap-2 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    {isAdmin && (
                        <select value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)}
                            className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todos os motoristas</option>
                            {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    )}
                    <select value={filtroVeiculo} onChange={e => setFiltroVeiculo(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todas as placas</option>
                        {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                    </select>
                    <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="3">Últimos 3 meses</option>
                        <option value="6">Últimos 6 meses</option>
                        <option value="12">Último ano</option>
                        <option value="24">Últimos 2 anos</option>
                        <option value="60">Tudo</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <div className="flex flex-col gap-5">

                    {/* ── Alertas de rotas frequentes ── */}
                    {alertasRotas.length > 0 && (
                        <div className="rounded-xl border p-4" style={{ borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <Icon name="AlertTriangle" size={16} color="#D97706" />
                                <p className="text-sm font-semibold text-amber-800">
                                    {alertasRotas.length} alerta{alertasRotas.length > 1 ? 's' : ''} de rota frequente
                                </p>
                                <span className="text-xs text-amber-600 ml-auto">Motoristas com ≥3 viagens ao mesmo destino</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {alertasRotas.slice(0, 6).map((a, i) => (
                                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-orange-100">
                                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                                            <span className="text-xs font-bold text-orange-700">{a.count}×</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold truncate text-amber-900">{a.motorista}</p>
                                            <p className="text-xs text-orange-700 truncate">→ {a.cidade}</p>
                                        </div>
                                        {a.ultimaData && (
                                            <p className="text-xs text-amber-500 ml-auto flex-shrink-0">{FMT_DATE(a.ultimaData)}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Ranking de destinos globais ── */}
                    {destinosGlobais.length > 0 && (
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                                <Icon name="BarChart2" size={16} color="var(--color-muted-foreground)" />
                                <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                    Ranking de Destinos {filtroMotorista ? `— ${motoristas.find(m => m.id === filtroMotorista)?.name}` : '(todos os motoristas)'}
                                </h3>
                                <span className="ml-auto text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{destinosGlobais.length} destino{destinosGlobais.length > 1 ? 's' : ''}</span>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {destinosGlobais.slice(0, 16).map((d, i) => {
                                        const maxCount = destinosGlobais[0]?.count || 1;
                                        const pct = (d.count / maxCount) * 100;
                                        const cor = heatColor(d.count, maxCount);
                                        return (
                                            <div key={d.cidade} className="flex items-center gap-3">
                                                <span className="w-5 text-xs font-data text-right flex-shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
                                                    {i + 1}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{d.cidade}</span>
                                                        <span className="text-xs font-data font-semibold ml-2 flex-shrink-0 px-1.5 py-0.5 rounded-full"
                                                            style={{ backgroundColor: cor.bg, color: cor.text }}>
                                                            {d.count}×
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                        <div className="h-full rounded-full transition-all"
                                                            style={{ width: `${pct}%`, backgroundColor: cor.text }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {destinosGlobais.length > 16 && (
                                    <p className="text-xs text-center mt-3" style={{ color: 'var(--color-muted-foreground)' }}>
                                        +{destinosGlobais.length - 16} destinos · exporte para ver todos
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Detalhamento por motorista ── */}
                    {dadosFiltrados.length === 0 ? (
                        <div className="bg-white rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="MapPin" size={36} color="var(--color-muted-foreground)" />
                            <p className="text-sm mt-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum histórico encontrado</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Ajuste os filtros ou o período</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {dadosFiltrados.map(m => {
                                const maxCount = m.destinos[0]?.count || 1;
                                return (
                                    <div key={m.nome} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        {/* Header do motorista */}
                                        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                                    {m.nome[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{m.nome}</p>
                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        {m.totalViagens} viagem{m.totalViagens !== 1 ? 's' : ''} · {m.destinos.length} destino{m.destinos.length !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Badge do destino mais frequente */}
                                            {m.destinos[0] && (
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Destino mais frequente</p>
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                        {m.destinos[0].cidade}
                                                        <span className="ml-1.5 text-xs font-data text-orange-600">({m.destinos[0].count}×)</span>
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Heatmap de destinos */}
                                        <div className="p-5">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {m.destinos.map(d => {
                                                    const cor = heatColor(d.count, maxCount);
                                                    const ultimaData = d.datas.length > 0
                                                        ? d.datas.sort().reverse()[0]
                                                        : null;
                                                    const finalizadas = d.status.filter(s => s === 'Entrega finalizada').length;
                                                    return (
                                                        <div key={d.cidade}
                                                            className="flex items-center gap-3 p-3 rounded-xl border"
                                                            style={{ borderColor: cor.bg === '#F8FAFC' ? 'var(--color-border)' : cor.bg, backgroundColor: cor.bg }}>
                                                            <div className="flex-shrink-0 text-center">
                                                                <p className="text-lg font-bold font-data leading-none" style={{ color: cor.text }}>{d.count}</p>
                                                                <p className="text-xs font-medium" style={{ color: cor.text }}>viag.</p>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{d.cidade}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    {ultimaData && (
                                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                            Última: {FMT_DATE(ultimaData)}
                                                                        </p>
                                                                    )}
                                                                    {finalizadas > 0 && (
                                                                        <span className="text-xs text-green-600">✓{finalizadas}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {d.count >= 3 && (
                                                                <div className="flex-shrink-0" title="Rota frequente — considere redistribuir">
                                                                    <Icon name="AlertTriangle" size={14} color="#D97706" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Legenda do heatmap */}
                                        <div className="flex items-center gap-3 px-5 py-2 border-t text-xs" style={{ borderColor: 'var(--color-border)', backgroundColor: '#FAFAFA' }}>
                                            <span style={{ color: 'var(--color-muted-foreground)' }}>Frequência:</span>
                                            {[
                                                { bg: '#F0F9FF', text: '#0369A1', label: 'Raro' },
                                                { bg: '#DCFCE7', text: '#166534', label: 'Moderado' },
                                                { bg: '#FEF9C3', text: '#B45309', label: 'Frequente' },
                                                { bg: '#FEE2E2', text: '#991B1B', label: 'Muito frequente' },
                                            ].map(c => (
                                                <div key={c.label} className="flex items-center gap-1">
                                                    <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: c.bg, borderColor: c.text + '40' }} />
                                                    <span style={{ color: 'var(--color-muted-foreground)' }}>{c.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
                        {typeof ConfirmDialog !== "undefined" && ConfirmDialog}
            <Toast toast={toast} />
        </div>
    );
}

// ─── Constantes da página principal ─────────────────────────────────────────
const TABS = [
    { id: 'viagens',          label: 'Viagens',            icon: 'Navigation',    group: 'Operação' },
    { id: 'romaneios_carreta',label: 'Romaneios Carreta',  icon: 'FileText',      group: 'Operação' },
    { id: 'veiculos',      label: 'Veículos',          icon: 'Truck',         group: 'Operação' },
    { id: 'abastecimentos',label: 'Abastecimentos',    icon: 'Fuel',          group: 'Operação' },
    { id: 'checklist',     label: 'Checklist',         icon: 'ClipboardCheck',group: 'Operação' },
    { id: 'carregamentos', label: 'Carregamentos',     icon: 'Package',       group: 'Operação' },
    { id: 'historico',     label: 'Histórico Rotas',   icon: 'MapPin',        group: 'Operação' },
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
                            {tab === 'viagens'          && <TabViagens        isAdmin={admin} profile={profile} />}
                            {tab === 'romaneios_carreta' && <TabRomaneioCarreta isAdmin={admin} profile={profile} />}
                            {tab === 'veiculos'       && <TabVeiculos       isAdmin={admin} />}
                            {tab === 'abastecimentos' && <TabAbastecimentos  isAdmin={admin} profile={profile} />}
                            {tab === 'checklist'      && <TabChecklist      isAdmin={admin} profile={profile} />}
                            {tab === 'carregamentos'  && <TabCarregamentos   isAdmin={admin} />}
                            {tab === 'historico'      && <TabHistoricoViagens isAdmin={admin} />}
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
