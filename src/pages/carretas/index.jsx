import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import TabRomaneios from './TabRomaneios';
import TabVolume from './TabVolume';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { useConfirm } from 'components/ui/ConfirmDialog';
import { fetchCorredores, CORREDORES_PADRAO } from 'utils/corredoresService';
import {
    fetchViagens, createViagem, updateViagem, deleteViagem,
    fetchCarretasVeiculos, createCarretaVeiculo, updateCarretaVeiculo, deleteCarretaVeiculo,
    fetchAbastecimentos, createAbastecimento, deleteAbastecimento,
    fetchChecklists, createChecklist, aprovarChecklist, registrarManutencaoChecklist,
    deleteChecklist,
    fetchCarregamentos, createCarregamento, updateCarregamento, deleteCarregamento,
    fetchEmpresas, createEmpresa, deleteEmpresa,
    fetchCarreteiros, fetchTodosMotoristas,
    fetchAllRegistrosViagem,
    fetchConfigAbastecimento, saveConfigAbastecimento,
    CHECKLIST_ITENS, TIPOS_CALCULO_FRETE, calcularFrete, calcularBonusCarreteiro,
    aprovarChecklistComNotificacao, reprovarChecklistComNotificacao,
    fetchOrdensServico, createOrdemServico, updateOrdemServico, deleteOrdemServico,
    fetchMecanicos,
    fetchDespesasExtras, createDespesaExtra, updateDespesaExtra, deleteDespesaExtra,
    fetchDiarias, createDiaria, updateDiaria, deleteDiaria,
    CATEGORIAS_DESPESA,
    CIDADES_BONUS_BAIXO, BONUS_BAIXO, BONUS_ALTO,
    fetchPostos, createPosto, updatePosto, deletePosto,
    STATUS_ROMANEIO_COLORS,
    fetchRomaneios,
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
                style={{ maxHeight: 'calc(100vh - 32px)' }}>
                {children}
            </div>
        </div>
    );
}

function ModalHeader({ title, icon, onClose }) {
    return (
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
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
    const [registrosMotoristas, setRegistrosMotoristas] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | {mode:'create'|'edit', data?}
    const [filterStatus, setFilterStatus] = useState('');
    const [abaViagens, setAbaViagens] = useState('admin'); // 'admin' | 'motoristas'
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

            const [v, ve, m, regs] = await Promise.all([
                fetchViagens(filtros),
                fetchCarretasVeiculos(),
                isAdmin ? fetchTodosMotoristas() : Promise.resolve([]),
                isAdmin ? fetchAllRegistrosViagem() : Promise.resolve([]),
            ]);
            setViagens(v); setVeiculos(ve); setMotoristas(m);
            setRegistrosMotoristas(regs);
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
        const ok = await confirm({ title: 'Excluir viagem?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteViagem(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const exportar = () => {
        if (!viagens.length && !registrosMotoristas.length) { showToast('Nenhum dado encontrado para exportar.', 'error'); return; }
        const wb = XLSX.utils.book_new();
        if (viagens.length) {
            const rows = viagens.map(v => ({
                'Número': v.numero, 'Status': v.status,
                'Motorista': v.motorista?.name || '', 'Placa': v.veiculo?.placa || '',
                'Data Saída': FMT_DATE(v.data_saida), 'Destino': v.destino || '',
                'Responsável': v.responsavel_cadastro || '', 'Obs': v.observacoes || '',
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Viagens Admin');
        }
        if (registrosMotoristas.length) {
            const rows2 = registrosMotoristas.map(r => ({
                'Motorista': r.motorista?.name || '', 'Placa': r.veiculo?.placa || '',
                'Data Carregamento': FMT_DATE(r.data_carregamento), 'NF': r.numero_nota_fiscal || '',
                'Destino': r.destino || '', 'Data Descarga': FMT_DATE(r.data_descarga), 'Obs': r.observacoes || '',
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows2), 'Registros Motoristas');
        }
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
                /* ── Visão admin: abas Viagens Admin + Registros Motoristas ── */
                <div>
                    {/* Sub-abas */}
                    <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-muted)', width: 'fit-content' }}>
                        <button
                            onClick={() => setAbaViagens('admin')}
                            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                            style={abaViagens === 'admin'
                                ? { backgroundColor: '#fff', color: 'var(--color-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                                : { color: 'var(--color-muted-foreground)' }}>
                            <span className="flex items-center gap-1.5">
                                <Icon name="ClipboardList" size={13} />
                                Viagens Cadastradas
                                <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{viagens.length}</span>
                            </span>
                        </button>
                        <button
                            onClick={() => setAbaViagens('motoristas')}
                            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                            style={abaViagens === 'motoristas'
                                ? { backgroundColor: '#fff', color: 'var(--color-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                                : { color: 'var(--color-muted-foreground)' }}>
                            <span className="flex items-center gap-1.5">
                                <Icon name="Truck" size={13} />
                                Lançados pelos Motoristas
                                {registrosMotoristas.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>{registrosMotoristas.length}</span>
                                )}
                            </span>
                        </button>
                    </div>

                    {abaViagens === 'admin' ? (
                        /* ── Tabela de viagens cadastradas pelo admin ── */
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
                        /* ── Tabela de registros lançados pelos motoristas de carreta ── */
                        <div>
                            <div className="flex items-center gap-2 mb-3 p-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                <Icon name="Info" size={14} color="#15803D" />
                                <p className="text-xs" style={{ color: '#15803D' }}>
                                    Registros lançados diretamente pelos motoristas de carreta na página deles. Use esses dados para confirmar destinos e atualizar o status das viagens cadastradas.
                                </p>
                            </div>
                            <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                                <table className="w-full text-sm min-w-[750px]">
                                    <thead className="text-xs border-b" style={{ backgroundColor: '#F0FDF4', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                        <tr>
                                            {['Motorista','Placa','Data Carregamento','Nota Fiscal','Destino','Data Descarga','Observações'].map(h => (
                                                <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {registrosMotoristas.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="text-center py-12" style={{ color: 'var(--color-muted-foreground)' }}>
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Icon name="Truck" size={28} color="var(--color-muted-foreground)" />
                                                        <span className="text-sm">Nenhum registro lançado pelos motoristas ainda</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : registrosMotoristas.map((r, i) => (
                                            <tr key={r.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                <td className="px-3 py-3 font-medium whitespace-nowrap">{r.motorista?.name || '—'}</td>
                                                <td className="px-3 py-3 font-data whitespace-nowrap">{r.veiculo?.placa || '—'}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{FMT_DATE(r.data_carregamento)}</td>
                                                <td className="px-3 py-3 font-data whitespace-nowrap text-blue-700">{r.numero_nota_fiscal || '—'}</td>
                                                <td className="px-3 py-3 max-w-[160px] truncate font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{r.data_descarga ? FMT_DATE(r.data_descarga) : <span style={{ color: 'var(--color-muted-foreground)' }}>Em trânsito</span>}</td>
                                                <td className="px-3 py-3 max-w-[180px] truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{r.observacoes || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
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
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
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
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
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
        const ok = await confirm({ title: 'Excluir veículo?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
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
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
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
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
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
        const ok = await confirm({ title: 'Excluir abastecimento?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
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
        const ok = await confirm({ title: 'Excluir posto?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
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
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
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
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal gerenciar postos (admin) */}
            {modalPostos && isAdmin && (
                <ModalOverlay onClose={() => { setModalPostos(false); setEditPosto(null); setFormPosto({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' }); }}>
                    <ModalHeader title="Gerenciar Postos de Combustível" icon="MapPin" onClose={() => { setModalPostos(false); setEditPosto(null); setFormPosto({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' }); }} />
                    <div className="p-5 overflow-y-auto flex-1">
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
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}

// ─── TAB: Checklist ───────────────────────────────────────────────────────────
function TabChecklist({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [checklists, setChecklists] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [modalManut, setModalManut] = useState(null);
    const [obsManut, setObsManut] = useState('');
    const [filtro, setFiltro] = useState('pendentes');
    const [form, setForm] = useState({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '' });
    const [fotoPreview, setFotoPreview] = useState(null);
    const [modalFoto, setModalFoto] = useState(null); // url para visualizar
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

    // Converte foto para base64 para armazenar (ou pode ser URL do Storage)
    const handleFotoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast('Foto muito grande (máx 5MB)', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setFotoPreview(ev.target.result);
            setForm(f => ({ ...f, foto_url: ev.target.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!form.veiculo_id) { showToast('Selecione o veículo', 'error'); return; }
        const semana = new Date(); semana.setDate(semana.getDate() - semana.getDay() + 1);
        try {
            await createChecklist({ ...form, motorista_id: profile.id, semana_ref: semana.toISOString().split('T')[0] });
            showToast('Checklist enviado!', 'success'); setModal(null); setFotoPreview(null); load();
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
    const handleDeleteChecklist = async (id) => {
        const ok = await confirm({
            title: 'Excluir Checklist?',
            message: 'O checklist será removido permanentemente. Esta ação não pode ser desfeita.',
            confirmLabel: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        try { await deleteChecklist(id); showToast('Checklist excluído.', 'warning'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
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
                    {/* item 4: refresh */}
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                </div>
                <Button onClick={() => { setForm({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '' }); setFotoPreview(null); setModal(true); }} iconName="ClipboardCheck" size="sm">Novo Checklist</Button>
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="flex flex-col gap-4">
                    {checklists.length === 0 && <div className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum checklist encontrado</div>}
                    {checklists.map(c => {
                        const itens = c.itens || {};
                        const ok = Object.values(itens).filter(Boolean).length;
                        const total = CHECKLIST_ITENS.length;
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
                                        {c.foto_url && (
                                            <button onClick={() => setModalFoto(c.foto_url)} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors whitespace-nowrap">
                                                <Icon name="Camera" size={11} />Foto
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
                                {(c.problemas || c.necessidades || c.observacoes_livres) && (
                                    <div className="text-xs space-y-1 mb-3 p-3 rounded-lg bg-gray-50">
                                        {c.problemas && <p><span className="font-medium text-red-600">⚠ Problemas:</span> {c.problemas}</p>}
                                        {c.necessidades && <p><span className="font-medium text-amber-600">🔧 Necessidades:</span> {c.necessidades}</p>}
                                        {c.observacoes_livres && <p><span className="font-medium text-gray-500">Obs:</span> {c.observacoes_livres}</p>}
                                    </div>
                                )}
                                {c.obs_manutencao && (
                                    <div className="text-xs p-3 rounded-lg mb-3" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                        <span className="font-medium text-orange-700">Manutenção registrada:</span> {c.obs_manutencao}
                                    </div>
                                )}
                                {isAdmin && !c.aprovado && (
                                    <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                        <button onClick={() => handleAprovar(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"><Icon name="CheckCircle2" size={13} />Aprovar</button>
                                        <button onClick={() => { setModalManut(c.id); setObsManut(''); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-300 text-orange-700 hover:bg-orange-50 transition-colors"><Icon name="Wrench" size={13} />Registrar Manutenção</button>
                                        <button onClick={() => handleDeleteChecklist(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors ml-auto"><Icon name="Trash2" size={13} />Excluir</button>
                                    </div>
                                )}
                                {isAdmin && c.aprovado && (
                                    <div className="flex justify-end pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                        <button onClick={() => handleDeleteChecklist(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors"><Icon name="Trash2" size={13} />Excluir</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal novo checklist */}
            {modal && (
                <ModalOverlay onClose={() => { setModal(null); setFotoPreview(null); }}>
                    <ModalHeader title="Checklist Semanal" icon="ClipboardCheck" onClose={() => { setModal(null); setFotoPreview(null); }} />
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
                        {/* item 3: foto de necessidades/problemas */}
                        <Field label="Necessidades / peças">
                            <textarea value={form.necessidades} onChange={e => setForm(f => ({ ...f, necessidades: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Pneus, cintas, etc..." />
                        </Field>
                        <div className="space-y-2">
                            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                📷 Foto do problema/necessidade <span className="text-gray-400 font-normal">(opcional)</span>
                            </label>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => fotoRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                                    <Icon name="Camera" size={15} color="var(--color-muted-foreground)" />
                                    {fotoPreview ? 'Trocar foto' : 'Tirar/Anexar foto'}
                                </button>
                                {fotoPreview && (
                                    <button type="button" onClick={() => { setFotoPreview(null); setForm(f => ({ ...f, foto_url: '' })); }} className="text-xs text-red-500 hover:text-red-700">Remover</button>
                                )}
                                <input ref={fotoRef} type="file" accept="image/*" capture="environment" onChange={handleFotoChange} className="hidden" />
                            </div>
                            {fotoPreview && (
                                <div className="relative inline-block mt-2">
                                    <img src={fotoPreview} alt="Preview" className="rounded-lg border object-cover" style={{ maxHeight: 180, maxWidth: '100%', borderColor: 'var(--color-border)' }} />
                                </div>
                            )}
                        </div>
                        <Field label="Observações livres"><textarea value={form.observacoes_livres} onChange={e => setForm(f => ({ ...f, observacoes_livres: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => { setModal(null); setFotoPreview(null); }} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Send">Enviar Checklist</Button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal manutenção */}
            {modalManut && (
                <ModalOverlay onClose={() => setModalManut(null)}>
                    <ModalHeader title="Registrar Manutenção" icon="Wrench" onClose={() => setModalManut(null)} />
                    <div className="p-5 overflow-y-auto flex-1">
                        <Field label="Descreva a manutenção necessária" required>
                            <textarea value={obsManut} onChange={e => setObsManut(e.target.value)} className={inputCls} style={inputStyle} rows={4} placeholder="Detalhes da manutenção..." />
                        </Field>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModalManut(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleManutencao} size="sm" iconName="Wrench">Registrar</Button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal visualizar foto */}
            {modalFoto && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} onClick={() => setModalFoto(null)}>
                    <div className="relative max-w-2xl w-full">
                        <button onClick={() => setModalFoto(null)} className="absolute -top-10 right-0 text-white opacity-80 hover:opacity-100 flex items-center gap-1 text-sm">
                            <Icon name="X" size={16} color="white" /> Fechar
                        </button>
                        <img src={modalFoto} alt="Foto do checklist" className="rounded-xl w-full object-contain max-h-[80vh]" />
                    </div>
                </div>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
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
        const ok = await confirm({ title: 'Excluir carregamento?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
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
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
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
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}

// ─── TAB: Empresas ────────────────────────────────────────────────────────────
function TabEmpresas({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
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
        const ok = await confirm({ title: 'Excluir empresa?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteEmpresa(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div>
            <div className="flex justify-end mb-5">
                {isAdmin && <Button onClick={() => { setForm({ nome: '', cnpj: '', observacoes: '' }); setModal(true); }} iconName="Plus" size="sm">Nova Empresa</Button>}
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
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
                        <Field label="Nome da empresa" required><input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Comercial Araguaia" /></Field>
                        <Field label="CNPJ"><input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className={inputCls} style={inputStyle} placeholder="00.000.000/0000-00" /></Field>
                        <Field label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
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
            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Despesas Extras (por veículo) ──────────────────────────────────────

// ─── Modal de Cadastro de Fornecedores (Carretas) ─────────────────────────────
function ModalFornecedoresCarretas({ onClose, onSelect }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [fornecedores, setFornecedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | {mode:'create'|'edit', data?}
    const [busca, setBusca] = useState('');
    const emptyForm = { nome: '', cnpj: '', telefone: '', email: '', endereco: '', categoria: '', observacoes: '' };
    const [form, setForm] = useState(emptyForm);

    const load = async () => {
        try { setFornecedores(await fetchFornecedoresCarretas()); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []); // eslint-disable-line

    const handleSave = async () => {
        if (!form.nome.trim()) { showToast('Nome é obrigatório', 'error'); return; }
        try {
            if (modal?.mode === 'edit') await updateFornecedorCarretas(modal.data.id, form);
            else await createFornecedorCarretas(form);
            showToast('Fornecedor salvo!', 'success');
            setModal(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir fornecedor?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteFornecedorCarretas(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const filtrados = fornecedores.filter(f =>
        !busca || f.nome.toLowerCase().includes(busca.toLowerCase()) || (f.cnpj || '').includes(busca)
    );

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl"
                style={{ maxHeight: 'calc(100vh - 48px)' }}>

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                            <Icon name="Building2" size={18} color="#1D4ED8" />
                        </div>
                        <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>Fornecedores</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                </div>

                {/* Search + New */}
                <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <input value={busca} onChange={e => setBusca(e.target.value)}
                        placeholder="Buscar por nome ou CNPJ..."
                        className={inputCls + ' flex-1'} style={inputStyle} />
                    <button onClick={() => { setForm(emptyForm); setModal({ mode: 'create' }); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}>
                        <Icon name="Plus" size={13} color="white" /> Novo
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
                    ) : filtrados.length === 0 ? (
                        <div className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                            {busca ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado ainda'}
                        </div>
                    ) : (
                        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                            {filtrados.map(f => (
                                <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                                        <Icon name="Building2" size={15} color="#1D4ED8" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{f.nome}</p>
                                        <div className="flex items-center gap-3 flex-wrap mt-0.5">
                                            {f.cnpj && <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{f.cnpj}</span>}
                                            {f.telefone && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{f.telefone}</span>}
                                            {f.categoria && <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">{f.categoria}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {onSelect && (
                                            <button onClick={() => { onSelect(f); onClose(); }}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
                                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                                Selecionar
                                            </button>
                                        )}
                                        <button onClick={() => { setForm({ nome: f.nome, cnpj: f.cnpj||'', telefone: f.telefone||'', email: f.email||'', endereco: f.endereco||'', categoria: f.categoria||'', observacoes: f.observacoes||'' }); setModal({ mode: 'edit', data: f }); }}
                                            className="p-1.5 rounded hover:bg-blue-50"><Icon name="Pencil" size={13} color="#1D4ED8" /></button>
                                        <button onClick={() => handleDelete(f.id)}
                                            className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={13} color="#DC2626" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Inline form */}
                {modal && (
                    <div className="border-t p-5 space-y-3 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {modal.mode === 'create' ? 'Novo Fornecedor' : 'Editar Fornecedor'}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Nome *</label>
                                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Razão social ou nome fantasia" autoFocus />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>CNPJ</label>
                                <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className={inputCls} style={inputStyle} placeholder="00.000.000/0000-00" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Telefone</label>
                                <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className={inputCls} style={inputStyle} placeholder="(00) 00000-0000" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>E-mail</label>
                                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} style={inputStyle} placeholder="contato@empresa.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Categoria habitual</label>
                                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {CATEGORIAS_DESPESA.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Endereço</label>
                                <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Rua, número, cidade" />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                            <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleSave} size="sm" iconName="Check">Salvar</Button>
                        </div>
                    </div>
                )}

                <Toast toast={toast} />
                {ConfirmDialog}
            </div>
        </div>
    );
}

function TabDespesasExtras({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [despesas, setDespesas]   = useState([]);
    const [veiculos, setVeiculos]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [modal, setModal]         = useState(null);
    const [showFornecedores, setShowFornecedores] = useState(false);
    const [filtro, setFiltro]       = useState({ veiculoId: '', categoria: '', mes: '' });
    const [categoriasExtras, setCategoriasExtras] = useState(() => {
        try { return JSON.parse(localStorage.getItem('carretas_categorias_extras') || '[]'); } catch { return []; }
    });
    const [novaCategoria, setNovaCategoria] = useState('');
    const [showNovaCategoria, setShowNovaCategoria] = useState(false);
    const xmlRef = useRef(null);
    const comprovanteRef = useRef(null);
    const permutaRef = useRef(null);
    const barcodeInputRef = useRef(null);
    const [barcodeMode, setBarcodeMode] = useState(false);
    const [barcodeBuffer, setBarcodeBuffer] = useState('');
    const [loadingNFe, setLoadingNFe] = useState(false);

    const todasCategorias = useMemo(() => [...CATEGORIAS_DESPESA, ...categoriasExtras], [categoriasExtras]);

    const adicionarCategoria = () => {
        const cat = novaCategoria.trim();
        if (!cat) { showToast('Digite o nome da categoria', 'error'); return; }
        if (todasCategorias.includes(cat)) { showToast('Categoria já existe', 'error'); return; }
        const novas = [...categoriasExtras, cat];
        setCategoriasExtras(novas);
        localStorage.setItem('carretas_categorias_extras', JSON.stringify(novas));
        setForm(f => ({ ...f, categoria: cat }));
        setNovaCategoria('');
        setShowNovaCategoria(false);
        showToast(`Categoria "${cat}" criada!`, 'success');
    };

    const emptyForm = () => ({
        veiculo_id: '', categoria: 'Pneus', descricao: '', valor: '',
        data_despesa: new Date().toISOString().split('T')[0], nota_fiscal: '',
        fornecedor: '', observacoes: '',
        notas_fiscais: [], // múltiplas NFs: [{numero, fornecedor, data, descricao, valor, nf_itens}]
        // item 8: pagamento
        forma_pagamento: 'a_vista',
        tipo_pagamento: 'pix',
        comprovante_url: '',
        boletos: [],
        permuta_obs: '',
        permuta_doc_url: '',
        cheques: [],
        parcelas_cartao: [],
        // item 9: itens da NF
        nf_itens: [],
    });
    const [form, setForm] = useState(emptyForm());
    const [novoBoleto, setNovoBoleto] = useState({ vencimento: '', valor: '' });
    const [novoCheque, setNovoCheque] = useState({ numero: '', banco: '', valor: '', vencimento: '' });

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
                const novaNF = { numero: nNF, fornecedor, valor: vnf, data: dhEmi, descricao: '', nf_itens: itens };
                setForm(f => {
                    const novasNFs = [...(f.notas_fiscais || []), novaNF];
                    const somaValor = novasNFs.reduce((s, n) => s + Number(n.valor || 0), 0);
                    return {
                        ...f,
                        nota_fiscal:  f.nota_fiscal || nNF,
                        valor:        somaValor > 0 ? String(somaValor) : f.valor,
                        data_despesa: f.data_despesa || dhEmi,
                        fornecedor:   f.fornecedor || fornecedor,
                        descricao:    (fornecedor && !f.descricao) ? `Compra — ${fornecedor}` : f.descricao,
                        nf_itens: [...(f.nf_itens || []), ...itens],
                        notas_fiscais: novasNFs,
                    };
                });
                showToast(`NF ${nNF} importada: ${fornecedor || 'emissor não identificado'} · ${itens.length} item(s)`, 'success');
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
    // usando a API pública da ReceitaWS / NFe.io / nfe.fazenda.gov.br
    const buscarDadosNFe = async (chave) => {
        setLoadingNFe(true);
        try {
            // Extrai campos da chave de acesso NF-e (44 dígitos):
            // cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
            const nNF = chave.substring(25, 34).replace(/^0+/, '') || chave.substring(25, 34);
            const cnpjEmit = chave.substring(6, 20);
            const serie = chave.substring(22, 25).replace(/^0+/, '') || '1';

            // Tenta buscar via API da ReceitaWS (CORS-friendly, gratuita)
            let dados = null;
            try {
                const resp = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjEmit}`, {
                    headers: { 'Accept': 'application/json' }
                });
                if (resp.ok) {
                    const json = await resp.json();
                    if (json && json.nome) {
                        dados = { fornecedor: json.nome, cnpj: cnpjEmit };
                    }
                }
            } catch { /* silencioso — tenta próxima fonte */ }

            // Monta os dados extraídos da própria chave (sempre disponíveis)
            const aamm = chave.substring(2, 6);
            const ano  = '20' + aamm.substring(0, 2);
            const mes  = aamm.substring(2, 4);
            const dataEmissao = `${ano}-${mes}-01`; // aproximada (dia não está na chave)

            setForm(f => ({
                ...f,
                nota_fiscal: nNF,
                data_despesa: dataEmissao,
                fornecedor: dados?.fornecedor
                    ? dados.fornecedor
                    : f.fornecedor || `CNPJ ${cnpjEmit.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`,
                descricao: f.descricao || `NF ${nNF} · Série ${serie}`,
            }));

            const msg = dados?.fornecedor
                ? `✅ NF ${nNF} — ${dados.fornecedor}`
                : `NF ${nNF} lida. Consulte o XML para dados completos.`;
            showToast(msg, dados?.fornecedor ? 'success' : 'info');

        } catch (err) {
            // Fallback mínimo: preenche só o número
            const nNF = chave.length === 44
                ? chave.substring(25, 34).replace(/^0+/, '') || chave
                : chave;
            setForm(f => ({ ...f, nota_fiscal: nNF }));
            showToast(`NF ${nNF} lida (sem dados adicionais)`, 'info');
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

    const adicionarCheque = () => {
        if (!novoCheque.numero || !novoCheque.valor) { showToast('Preencha número e valor do cheque', 'error'); return; }
        setForm(f => ({ ...f, cheques: [...(f.cheques || []), { ...novoCheque }] }));
        setNovoCheque({ numero: '', banco: '', valor: '', vencimento: '' });
    };
    const removerCheque = (idx) => setForm(f => ({ ...f, cheques: f.cheques.filter((_, i) => i !== idx) }));

    const handleSubmit = async () => {
        if (!form.categoria || !form.valor || !form.data_despesa) { showToast('Categoria, valor e data são obrigatórios', 'error'); return; }
        try {
            const payload = { ...form, notas_fiscais: form.notas_fiscais||[], parcelas_cartao: form.parcelas_cartao||[] };
            if (modal.mode === 'create') await createDespesaExtra(payload);
            else await updateDespesaExtra(modal.data.id, payload);
            showToast('Despesa salva!', 'success'); setModal(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir despesa?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
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
            cheques: d.cheques || [], parcelas_cartao: d.parcelas_cartao || [],
            notas_fiscais: d.notas_fiscais || [], nf_itens: d.nf_itens || [],
        });
        setModal({ mode: 'edit', data: d });
    };

    // Badge de pagamento
    const pgBadge = (d) => {
        if (d.forma_pagamento === 'a_prazo') {
            const label = d.tipo_pagamento === 'boleto' ? 'Boleto'
                : d.tipo_pagamento === 'cartao_prazo' ? '💳 Cartão Parc.'
                : d.tipo_pagamento === 'permuta' ? 'Permuta' : 'Cheque';
            const isCard = d.tipo_pagamento === 'cartao_prazo';
            return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${isCard ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>{label}</span>;
        }
        const label = d.tipo_pagamento === 'pix' ? 'PIX'
            : d.tipo_pagamento === 'dinheiro' ? 'Dinheiro'
            : d.tipo_pagamento === 'cartao' ? '💳 Cartão'
            : 'Transf.';
        const isCard = d.tipo_pagamento === 'cartao';
        return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${isCard ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{label}</span>;
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
                        {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
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

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[740px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Data','Placa','Categoria','Fornecedor','Descrição','NF','Pagamento','Valor',''].map(h => <th key={h} className="px-3 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {despesas.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma despesa registrada</td></tr>
                            : despesas.map((d, i) => (
                                <tr key={d.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-3 py-3 whitespace-nowrap">{FMT_DATE(d.data_despesa)}</td>
                                    <td className="px-3 py-3 font-data">{d.veiculo?.placa || '—'}</td>
                                    <td className="px-3 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium">{d.categoria}</span></td>
                                    <td className="px-3 py-3 text-xs max-w-[130px] truncate font-medium" style={{ color: 'var(--color-text-primary)' }}>{d.fornecedor || '—'}</td>
                                    <td className="px-3 py-3 text-xs max-w-[130px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.descricao || '—'}</td>
                                    <td className="px-3 py-3 text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{d.nota_fiscal || '—'}</td>
                                    <td className="px-3 py-3">{pgBadge(d)}</td>
                                    <td className="px-3 py-3 font-data font-semibold text-red-600">{BRL(d.valor)}</td>
                                    <td className="px-3 py-3">
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

            {modal && isAdmin && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <ModalHeader title={modal.mode === 'create' ? 'Nova Despesa' : 'Editar Despesa'} icon="Receipt" onClose={() => setModal(null)} />
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">

                        {/* Notas Fiscais */}
                        <div className="p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-blue-700">
                                    📄 Notas Fiscais
                                    {(form.notas_fiscais||[]).length > 0 && (
                                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-medium">
                                            {(form.notas_fiscais||[]).length}
                                        </span>
                                    )}
                                </p>
                                <button type="button"
                                    onClick={() => setForm(f => ({ ...f, notas_fiscais: [...(f.notas_fiscais||[]), { numero:'', fornecedor:'', data:'', descricao:'', valor:'', nf_itens:[], _manual:true }] }))}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-blue-300 text-blue-700 hover:bg-blue-100">
                                    <Icon name="Plus" size={11} /> Adicionar NF manual
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {/* XML digital */}
                                <button type="button" onClick={() => xmlRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
                                    <Icon name="FileCode" size={12} /> {(form.notas_fiscais||[]).length > 0 ? 'Importar outro XML' : 'Importar XML da NF'}
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
                            {/* Cards das NFs — um por nota */}
                            {(form.notas_fiscais||[]).length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {(form.notas_fiscais||[]).map((nf, nfIdx) => (
                                        <div key={nfIdx} className="rounded-xl border border-blue-200 bg-white overflow-hidden">
                                            <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border-b border-blue-100">
                                                <span className="text-xs font-semibold text-blue-800">
                                                    NF {nfIdx+1} {nf._manual ? '— digitação manual' : '— XML'}
                                                </span>
                                                <button type="button"
                                                    onClick={() => setForm(f => {
                                                        const novas = f.notas_fiscais.filter((_,i) => i !== nfIdx);
                                                        const soma = novas.reduce((s,n) => s + Number(n.valor||0), 0);
                                                        return { ...f, notas_fiscais: novas, valor: soma > 0 ? String(soma) : f.valor };
                                                    })}
                                                    className="p-1 rounded hover:bg-red-100">
                                                    <Icon name="X" size={12} color="#DC2626" />
                                                </button>
                                            </div>
                                            <div className="p-3 grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{color:'var(--color-text-secondary)'}}>Nº da NF</label>
                                                    <input value={nf.numero||''} placeholder="Ex: 35520"
                                                        onChange={e => setForm(f => { const a=[...f.notas_fiscais]; a[nfIdx]={...a[nfIdx],numero:e.target.value}; return {...f,notas_fiscais:a}; })}
                                                        className={inputCls} style={inputStyle} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{color:'var(--color-text-secondary)'}}>
                                                        Valor (R$)
                                                        {!nf._manual && nf.valor && <span className="ml-1 text-emerald-600 font-normal text-xs">auto</span>}
                                                    </label>
                                                    <input type="number" step="0.01" value={nf.valor||''} placeholder="0,00"
                                                        onChange={e => setForm(f => {
                                                            const a=[...f.notas_fiscais];
                                                            a[nfIdx]={...a[nfIdx],valor:e.target.value};
                                                            const soma=a.reduce((s,n)=>s+Number(n.valor||0),0);
                                                            return {...f,notas_fiscais:a,valor:soma>0?String(soma):f.valor};
                                                        })}
                                                        className={inputCls} style={inputStyle} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{color:'var(--color-text-secondary)'}}>
                                                        Fornecedor
                                                        {!nf._manual && nf.fornecedor && <span className="ml-1 text-emerald-600 font-normal text-xs">auto</span>}
                                                    </label>
                                                    <input value={nf.fornecedor||''} placeholder="Nome do fornecedor"
                                                        onChange={e => setForm(f => { const a=[...f.notas_fiscais]; a[nfIdx]={...a[nfIdx],fornecedor:e.target.value}; return {...f,notas_fiscais:a}; })}
                                                        className={inputCls} style={inputStyle} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{color:'var(--color-text-secondary)'}}>
                                                        Data de emissão
                                                        {!nf._manual && nf.data && <span className="ml-1 text-emerald-600 font-normal text-xs">auto</span>}
                                                    </label>
                                                    <input type="date" value={nf.data||''}
                                                        onChange={e => setForm(f => { const a=[...f.notas_fiscais]; a[nfIdx]={...a[nfIdx],data:e.target.value}; return {...f,notas_fiscais:a}; })}
                                                        className={inputCls} style={inputStyle} />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-medium mb-1" style={{color:'var(--color-text-secondary)'}}>Tipo / Descrição (ex: NF de peças, NF de serviços)</label>
                                                    <input value={nf.descricao||''} placeholder="Ex: Nota fiscal de serviços"
                                                        onChange={e => setForm(f => { const a=[...f.notas_fiscais]; a[nfIdx]={...a[nfIdx],descricao:e.target.value}; return {...f,notas_fiscais:a}; })}
                                                        className={inputCls} style={inputStyle} />
                                                </div>
                                            </div>
                                            {nf.nf_itens?.length > 0 && (
                                                <div className="px-3 pb-3 overflow-x-auto">
                                                    <p className="text-xs text-blue-600 font-medium mb-1">{nf.nf_itens.length} item(s) do XML:</p>
                                                    <table className="w-full text-xs">
                                                        <thead><tr className="text-blue-700">{['Cód','Descrição','Qtd','Un','V.Total'].map(h=><th key={h} className="text-left px-1 py-0.5 border-b border-blue-100 font-medium">{h}</th>)}</tr></thead>
                                                        <tbody>
                                                            {nf.nf_itens.map((it,i) => (
                                                                <tr key={i} className="border-b border-blue-50">
                                                                    <td className="px-1 py-1 font-data">{it.codigo}</td>
                                                                    <td className="px-1 py-1 max-w-[130px] truncate">{it.descricao}</td>
                                                                    <td className="px-1 py-1 font-data text-right">{it.quantidade}</td>
                                                                    <td className="px-1 py-1">{it.unidade}</td>
                                                                    <td className="px-1 py-1 font-data text-right text-blue-700">{BRL(it.valor_total)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {/* Resumo: valor total das NFs */}
                                    {(form.notas_fiscais||[]).filter(n=>n.valor).length > 1 && (
                                        <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{backgroundColor:'#EFF6FF',border:'1px solid #BFDBFE'}}>
                                            <span className="text-xs font-semibold text-blue-700">Valor total ({(form.notas_fiscais||[]).length} NFs)</span>
                                            <span className="text-sm font-bold font-data text-blue-800">
                                                {BRL((form.notas_fiscais||[]).reduce((s,n)=>s+Number(n.valor||0),0))}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* dados básicos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Categoria" required>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className={inputCls} style={inputStyle}>
                                            {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        {isAdmin && (
                                            <button type="button" onClick={() => setShowNovaCategoria(s => !s)}
                                                className="flex-shrink-0 px-2.5 py-2 rounded-lg border text-xs font-medium hover:bg-blue-50 transition-colors"
                                                style={{ borderColor: '#93C5FD', color: '#1D4ED8' }}
                                                title="Adicionar nova categoria">
                                                <Icon name={showNovaCategoria ? 'X' : 'Plus'} size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {showNovaCategoria && isAdmin && (
                                        <div className="flex gap-2 p-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                            <input
                                                value={novaCategoria}
                                                onChange={e => setNovaCategoria(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && adicionarCategoria()}
                                                className={inputCls + ' flex-1'}
                                                style={inputStyle}
                                                placeholder="Ex: Pedágio, Balança..."
                                                autoFocus
                                            />
                                            <button type="button" onClick={adicionarCategoria}
                                                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                                                Criar
                                            </button>
                                        </div>
                                    )}
                                </div>
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
                                <input id="despesa-valor" type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                            </Field>
                            <Field label="Fornecedor">
                                <div className="flex gap-2">
                                    <input
                                        value={form.fornecedor||''}
                                        onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
                                        className={inputCls + ' flex-1'} style={inputStyle}
                                        placeholder="Ex: Auto Peças Silva Ltda" />
                                    <button type="button"
                                        onClick={() => setShowFornecedores(true)}
                                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                                        title="Abrir cadastro de fornecedores">
                                        <Icon name="BookOpen" size={13} /> Cadastro
                                    </button>
                                </div>
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
                                        {[['pix','PIX'], ['dinheiro','Dinheiro'], ['transferencia_m','Transferência'], ['cartao','💳 Cartão à vista']].map(([v, l]) => (
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
                                        {[['boleto','Boleto'], ['cartao_prazo','💳 Cartão Parcelado'], ['cheque','Cheque'], ['permuta','Permuta']].map(([v, l]) => (
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

                                    {/* Cartão Parcelado */}
                                    {form.tipo_pagamento === 'cartao_prazo' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-medium text-amber-800">Parcelas do Cartão</p>
                                                {(form.parcelas_cartao||[]).length > 0 && (
                                                    <span className="text-xs font-data font-bold text-amber-700">
                                                        Total: {BRL((form.parcelas_cartao||[]).reduce((s,p)=>s+Number(p.valor||0),0))}
                                                    </span>
                                                )}
                                            </div>
                                            {(form.parcelas_cartao||[]).map((p, idx) => (
                                                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border text-xs" style={{ borderColor: '#FED7AA' }}>
                                                    <span className="text-amber-700 font-medium whitespace-nowrap">Parcela {idx+1}</span>
                                                    <span className="font-data">{FMT_DATE(p.vencimento)}</span>
                                                    <span className="font-data font-semibold text-amber-800">{BRL(p.valor)}</span>
                                                    {p.cartao && <span className="text-amber-600 truncate max-w-[80px]">{p.cartao}</span>}
                                                    <span className={`ml-auto px-1.5 py-0.5 rounded ${p.pago ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.pago ? 'Pago' : 'Pendente'}</span>
                                                    <button type="button" onClick={() => setForm(f => ({...f, parcelas_cartao: f.parcelas_cartao.filter((_,i)=>i!==idx)}))} className="p-1 rounded hover:bg-red-50"><Icon name="X" size={11} color="#DC2626" /></button>
                                                </div>
                                            ))}
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                <Field label="Vencimento"><input type="date" id="pc_venc" className={inputCls} style={inputStyle} /></Field>
                                                <Field label="Valor (R$)"><input type="number" step="0.01" id="pc_valor" className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                                <Field label="Cartão (opcional)" className="col-span-2">
                                                    <input id="pc_cartao" className={inputCls} style={inputStyle} placeholder="Ex: Nubank, Itaú..." />
                                                </Field>
                                            </div>
                                            <button type="button" onClick={() => {
                                                const venc = document.getElementById('pc_venc')?.value;
                                                const val  = document.getElementById('pc_valor')?.value;
                                                const cart = document.getElementById('pc_cartao')?.value || '';
                                                if (!venc || !val) return;
                                                setForm(f => ({...f, parcelas_cartao: [...(f.parcelas_cartao||[]), {vencimento:venc,valor:val,cartao:cart,pago:false}]}));
                                                ['pc_venc','pc_valor','pc_cartao'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
                                            }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50">
                                                <Icon name="Plus" size={12} /> Adicionar parcela
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
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
            {showFornecedores && (
                <ModalFornecedoresCarretas
                    onClose={() => setShowFornecedores(false)}
                    onSelect={f => {
                        setForm(prev => ({
                            ...prev,
                            fornecedor: f.nome,
                            ...(f.categoria && !prev.categoria ? { categoria: f.categoria } : {}),
                        }));
                    }}
                />
            )}
        </div>
    );
}

// ─── TAB: Diárias de Motoristas ───────────────────────────────────────────────
function TabDiarias({ isAdmin, profile }) {
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
        const ok = await confirm({ title: 'Excluir diária?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
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
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
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
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
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

            const [carregamentos, abastecimentos, viagens, despesasExtras, diariasLancadas, romaneiosCarga] = await Promise.all([
                fetchCarregamentos(filtros),
                fetchAbastecimentos({ dataInicio, dataFim }),
                fetchViagens({ dataInicio, dataFim }),
                fetchDespesasExtras({ dataInicio, dataFim }),
                fetchDiarias({ dataInicio, dataFim }),
                fetchRomaneios({ dataInicio, dataFim }),
            ]);

            // ── Receitas (fretes de carregamentos) ────────────────────────
            const receitaCarregamentos = carregamentos.reduce((s, c) => s + Number(c.valor_frete_calculado || 0), 0);

            // ── Receitas (fretes de romaneios de carga) ───────────────────
            const receitaRomaneios = romaneiosCarga
                .filter(r => r.status !== 'Cancelado')
                .reduce((s, r) => s + Number(r.valor_frete || 0), 0);

            const receitaTotal = receitaCarregamentos + receitaRomaneios;

            const receitaPorEmpresa = {};
            carregamentos.forEach(c => {
                const nome = c.empresa?.nome || 'Sem empresa';
                receitaPorEmpresa[nome] = (receitaPorEmpresa[nome] || 0) + Number(c.valor_frete_calculado || 0);
            });
            // Incluir romaneios na receita por empresa
            romaneiosCarga.filter(r => r.status !== 'Cancelado').forEach(r => {
                const nome = r.empresa || 'Sem empresa';
                receitaPorEmpresa[nome] = (receitaPorEmpresa[nome] || 0) + Number(r.valor_frete || 0);
            });

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
                receitaTotal, receitaCarregamentos, receitaRomaneios,
                totalRomaneios: romaneiosCarga.filter(r => r.status !== 'Cancelado').length,
                receitaPorEmpresa,
                _romaneios: romaneiosCarga,
                despesaCombustivel, litrosDiesel, litrosArla, valorDiesel, valorArla,
                bonusTotal, despesaTotal,
                margemBruta, margemLiquida, margemPct,
                consolidadoMotoristas,
                totalCarregamentos: carregamentos.length,
                totalViagens: viagens.length,
                viagensFinalizadas: viagensFinalizadas.length,
                totalDespesasExtras, despesasPorCategoria,
                totalDiariasLancadas,
                // raw data for placa filter (item 7)
                _carregamentos: carregamentos,
                _abastecimentos: abastecimentos,
                _viagens: viagens,
                _despesasExtras: despesasExtras,
                _diarias: diariasLancadas,
            });
        } catch (e) { showToast('Erro ao calcular: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [periodoInicio, periodoFim, empresa]); // eslint-disable-line

    const exportarExcel = () => {
        if (!dados) { showToast('Gere o relatório antes de exportar', 'error'); return; }

        const wb = XLSX.utils.book_new();

        // Aba 1 — Resumo Financeiro (item 6: diesel e arla separados)
        const resumo = [
            ['RELATÓRIO FINANCEIRO — TRANSPORTE CARRETAS', '', ''],
            ['Período:', dados.periodo, ''],
            ['', '', ''],
            ['RECEITAS', '', ''],
            ['Receita Total de Fretes', dados.receitaTotal, ''],
            ['  → Carregamentos', dados.receitaCarregamentos || 0, ''],
            ['  → Romaneios de Carga', dados.receitaRomaneios || 0, ''],
            ...Object.entries(dados.receitaPorEmpresa).map(([nome, val]) => [`  → Por empresa: ${nome}`, val, '']),
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
            ['TOTAL', dados.totalCarregamentos, dados.receitaTotal, dados.viagensFinalizadas, dados.bonusTotal, dados.receitaTotal + dados.bonusTotal],
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
        const desps = (dados._despesasExtras || []).filter(d => d.veiculo_id === filtroPlaca);
        const roms  = (dados._romaneios || []).filter(r => r.veiculo_id === filtroPlaca && r.status !== 'Cancelado');
        const diar  = (dados._diarias || []).filter(d => {
            // diárias vinculadas ao veículo via viagem
            const viagIds = viags.map(v => v.id);
            return d.viagem_id && viagIds.includes(d.viagem_id);
        });
        const receitaCarrg = carrg.reduce((s, c) => s + Number(c.valor_frete_calculado || 0), 0);
        const receitaRoms  = roms.reduce((s, r) => s + Number(r.valor_frete || 0), 0);
        const receita     = receitaCarrg + receitaRoms;
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
        return { veic, carrg, roms, absts, viags, desps, diar, receita, receitaCarrg, receitaRoms, combustivel, vDiesel, vArla, lDiesel, lArla, bonus, despExtra, diarias, totalDesp, margem };
    }, [dados, filtroPlaca, veiculos]);

    const exportarPorPlaca = () => {
        if (!dadosPorPlaca) { showToast('Selecione uma placa e gere o relatório primeiro', 'error'); return; }
        const { veic, carrg, roms, absts, viags, desps, receita, receitaCarrg, receitaRoms, combustivel, vDiesel, vArla, lDiesel, lArla, bonus, despExtra, diarias, totalDesp, margem } = dadosPorPlaca;
        const wb = XLSX.utils.book_new();

        // Aba Resumo
        const resumo = [
            [`RELATÓRIO POR VEÍCULO — ${veic?.placa || filtroPlaca}`, ''],
            [`Modelo: ${veic?.modelo || ''}`, ''],
            ['Período:', dados.periodo],
            ['', ''],
            ['RECEITAS', ''],
            ['Receita Total', receita],
            ['  → Carregamentos', receitaCarrg],
            ['  → Romaneios de Carga', receitaRoms],
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

        // Aba Romaneios de Carga
        if (roms && roms.length) {
            const rowsR = [
                ['Nº Romaneio', 'Status', 'Motorista', 'Empresa', 'Destino', 'Data Saída', 'Peso (t)', 'Valor Carga (R$)', 'Frete (R$)'],
                ...roms.map(r => [
                    r.numero, r.status, r.motorista?.name || '', r.empresa || '',
                    r.destino || '', FMT_DATE(r.data_saida),
                    Number(r.toneladas || 0), Number(r.valor_carga || 0), Number(r.valor_frete || 0),
                ]),
                ['TOTAL', '', '', '', '', '', '', '', receitaRoms],
            ];
            const wsR = XLSX.utils.aoa_to_sheet(rowsR);
            wsR['!cols'] = [14,16,20,18,20,12,10,16,14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, wsR, 'Romaneios');
        }

        // Aba Fretes
        if (carrg.length) {
            const rowsC = [
                ['Data', 'Pedido', 'NF', 'Empresa', 'Destino', 'Motorista', 'Qtd', 'Unidade', 'Frete (R$)'],
                ...carrg.map(c => [FMT_DATE(c.data_carregamento), c.numero_pedido || '', c.numero_nota_fiscal || '', c.empresa?.nome || '', c.destino || '', c.motorista?.name || '', c.quantidade || 0, c.unidade_quantidade || '', Number(c.valor_frete_calculado || 0)]),
                ['TOTAL', '', '', '', '', '', '', '', receitaCarrg],
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
                            { l: 'Receita Total',     v: BRL(dados.receitaTotal),     c: '#065F46', bg: '#D1FAE5', i: 'TrendingUp',  sub: `${dados.totalCarregamentos} carregamentos + ${dados.totalRomaneios || 0} romaneios` },
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
                            </div>
                            <div className="flex justify-between py-1.5 pl-3">
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Receita de Fretes</span>
                                <span className="font-data font-semibold text-green-700">{BRL(dados.receitaTotal)}</span>
                            </div>
                            {(dados.receitaCarregamentos > 0 || dados.receitaRomaneios > 0) && (
                                <>
                                    <div className="flex justify-between py-1 pl-6">
                                        <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ Carregamentos ({dados.totalCarregamentos})</span>
                                        <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(dados.receitaCarregamentos || 0)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 pl-6">
                                        <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ Romaneios de Carga ({dados.totalRomaneios || 0})</span>
                                        <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(dados.receitaRomaneios || 0)}</span>
                                    </div>
                                </>
                            )}
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
                            <div className="p-5 space-y-4 overflow-y-auto flex-1">
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
                                            <span>Receita de Fretes</span><span className="font-data">{BRL(dadosPorPlaca.receita)}</span>
                                        </div>
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

            <Toast toast={toast} />
        </div>
    );
}

// ─── TAB: Ordens de Serviço ───────────────────────────────────────────────────
function TabOrdensServico({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
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

    const handleDeleteOS = async (id) => {
        const ok = await confirm({ title: 'Excluir Ordem de Serviço?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteOrdemServico(id); showToast('OS excluída!', 'warning'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
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
                                    {isAdmin && (
                                        <button onClick={() => handleDeleteOS(o.id)}
                                            className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Excluir OS">
                                            <Icon name="Trash2" size={14} color="#DC2626" />
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
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
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
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
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
            <Toast toast={toast} />
            {ConfirmDialog}
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
            <Toast toast={toast} />
        </div>
    );
}

// ─── Constantes da página principal ─────────────────────────────────────────
const TABS = [
    { id: 'viagens',       label: 'Viagens',          icon: 'Navigation',    group: 'Operação' },
    { id: 'romaneios',     label: 'Romaneios',         icon: 'FileText',      group: 'Operação' },
    { id: 'veiculos',      label: 'Veículos',          icon: 'Truck',         group: 'Operação' },
    { id: 'abastecimentos',label: 'Abastecimentos',    icon: 'Fuel',          group: 'Operação' },
    { id: 'checklist',     label: 'Checklist',         icon: 'ClipboardCheck',group: 'Operação' },
    { id: 'carregamentos', label: 'Carregamentos',     icon: 'Package',       group: 'Operação' },
    { id: 'volume',        label: 'Volume',            icon: 'TrendingUp',    group: 'Operação' },
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
                            {tab === 'viagens'        && <TabViagens        isAdmin={admin} profile={profile} />}
                            {tab === 'romaneios'      && <TabRomaneios      isAdmin={admin} />}
                            {tab === 'veiculos'       && <TabVeiculos       isAdmin={admin} />}
                            {tab === 'abastecimentos' && <TabAbastecimentos  isAdmin={admin} profile={profile} />}
                            {tab === 'checklist'      && <TabChecklist      isAdmin={admin} profile={profile} />}
                            {tab === 'carregamentos'  && <TabCarregamentos   isAdmin={admin} />}
                            {tab === 'volume'         && <TabVolume         isAdmin={admin} />}
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
                        className="fixed inset-0 z-[140] lg:hidden"
                        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                        onClick={() => setDrawerOpen(false)}
                    />
                    {/* Painel deslizante da esquerda */}
                    <div className="fixed top-0 left-0 bottom-0 z-[150] lg:hidden flex flex-col overflow-y-auto shadow-2xl"
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
