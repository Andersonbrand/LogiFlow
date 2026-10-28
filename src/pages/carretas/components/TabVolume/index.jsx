import React, {   } from 'react';

import * as XLSX from 'xlsx';

import { AppIcon as Icon, useConfirm,  PrettySelect, Button, CidadesAdicionaisField, Toast, DeleteButton } from 'components';
import { useToast } from 'hooks/useToast';
import { calcularFrete,               TIPOS_CALCULO_FRETE } from 'services/carretas';
import { } from 'services/settingsService';
import {   } from 'services/fornecedoresService';
import { } from 'services/romaneio';
import { } from 'services/vehicleService';

import { TIPOS, inputStyle, inputCls } from './utils/constants';
import { parseTipo, calcCaptacaoDistribuicao,  FMT, BRL } from './utils/helpers';
import { useVolumeDados, useCarregamentosFrota, useCarregamentosTerceiro, useCarregamentosRetira, useFornecedoresVolume } from './hooks';
import DashboardVolume from './components/DashboardVolume';
import TabelaCarregamentos from './components/TabelaCarregamentos';
import TabelaTerceiros from './components/TabelaTerceiros';
import TabelaRetira from './components/TabelaRetira';
import DestinoSelect from './components/DestinoSelect';
import OrigemDropdown from './components/OrigemDropdown';
import ComboSelect from './components/ComboSelect';

const fmtMes = m => {
    if (!m) return '';
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

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
function TipoSelector({ value, onChange, options }) {
    const keys = options || Object.keys(TIPOS);
    return (
        <div className="grid grid-cols-2 gap-2">
            {keys.map(key => {
                const t = TIPOS[key];
                if (!t) return null;
                return (
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
                );
            })}
        </div>
    );
}

// ─── Select de Destino com auto-preenchimento de frete ───────────────────────
export default function TabVolume({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const { hoje, mes, setMes, dia, setDia, periodoCustom, setPeriodoCustom, usarPeriodo, setUsarPeriodo, empresaFiltro, setEmpresaFiltro, carregamentos, empresas, fornecedores, veiculos, veiculosProprios, veiculosTerceiros, motoristasProprios, motoristasTerceiros, motoristasCaminhoes, veiculosCaminhoes, loading, subAba, setSubAba, carregamentosTerceiros, carregamentosRetira, fretesFretas, fretosTerceiros, fretesEstoque, load, totais } = useVolumeDados({ isAdmin, showToast });

    const { modal, setModal, form, setForm, paradasForm, setParadasForm, saving, veiculoSelecionado, freteEstoqueRef, valorBaseEstoque, previewFrete, captacaoConfig, previewCaptacaoTotal, previewDistribuicao, previewPctDistribuicao, openCreate, openEdit, handleSave, handleDelete } = useCarregamentosFrota({ confirm, fretesEstoque, load, showToast, veiculos });

    const { modalTerceiro, setModalTerceiro, formTerceiro, setFormTerceiro, paradasFormTerceiro, setParadasFormTerceiro, savingTerceiro, openCreateTerceiro, openEditTerceiro, handleSaveTerceiro, handleDeleteTerceiro, handleTogglePagoTerceiro, handleTogglePagoEmMassaTerceiro } = useCarregamentosTerceiro({ confirm, load, showToast });

    const { modalRetira, setModalRetira, formRetira, setFormRetira, savingRetira, openCreateRetira, openEditRetira, handleSaveRetira, handleDeleteRetira } = useCarregamentosRetira({ confirm, load, showToast });

    const { modalFornec, setModalFornec, formFornec, setFormFornec, savingFornec, handleSaveFornec } = useFornecedoresVolume({ confirm, load, showToast });

    // ── Exportar ──────────────────────────────────────────────────────────────
    const exportar = () => {
        if (!carregamentos.length) { showToast('Nenhum dado para exportar.', 'error'); return; }
        try {
            const rows = carregamentos.map(r => {
                const { tipo, nome } = parseTipo(r);
                const cd = calcCaptacaoDistribuicao(r, captacaoConfig.valorPorSaco) || { captacao: 0, distribuicao: 0 };
                return {
                    'Data': FMT(r.data_carregamento),
                    'Tipo': TIPOS[tipo]?.label || tipo || '—',
                    'Fornecedor/Origem': nome || '—',
                    'Tipo de Cimento': r.tipo_cimento || '—',
                    'Placa': r.veiculo?.placa || r.placa_terceiro || r.veiculo_id || '—',
                    'Motorista': r.motorista?.name || r.motorista_id || '—',
                    'Pedido': r.numero_pedido || '—',
                    'NF': r.numero_nota_fiscal || '—',
                    'Destino': r.destino || '—',
                    'Quantidade': Number(r.quantidade) || 0,
                    'Unidade': r.unidade_quantidade || 'saco',
                    'Tipo Frete': r.tipo_calculo_frete || '',
                    'Valor Base Frete': Number(r.valor_base_frete || 0),
                    'Frete Calculado (R$)': Number(r.valor_frete_calculado || 0),
                    'Valor de Captação (R$)': Number(cd.captacao || 0),
                    'Valor de Distribuição (R$)': Number(cd.distribuicao || 0),
                };
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Volume');
            // Summary sheet
            const sumRows = Object.entries(TIPOS).map(([key, t]) => ({
                'Tipo': t.label,
                'Volume (sacos)': totais[key] || 0,
                'Participação (%)': totais.totalGeral > 0 ? ((totais[key] / totais.totalGeral) * 100).toFixed(1) + '%' : '0%',
            }));
            sumRows.push({ 'Tipo': 'TOTAL', 'Volume (sacos)': totais.totalGeral, 'Participação (%)': '100%' });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sumRows), 'Resumo');
            // Totais de frete/captação/distribuição — soma de tudo que foi exportado
            const totalFreteExp = rows.reduce((s, r) => s + r['Frete Calculado (R$)'], 0);
            const totalCaptacaoExp = rows.reduce((s, r) => s + r['Valor de Captação (R$)'], 0);
            const totalDistribuicaoExp = rows.reduce((s, r) => s + r['Valor de Distribuição (R$)'], 0);
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
                { 'Total de Registros': rows.length, 'Frete Total (R$)': totalFreteExp, 'Captação Total (R$)': totalCaptacaoExp, 'Distribuição Total (R$)': totalDistribuicaoExp },
            ]), 'Totais Frete');
            XLSX.writeFile(wb, `volume_carretas_${mes || dia || 'periodo'}.xlsx`);
        } catch (e) {
            showToast('Erro ao exportar: ' + e.message, 'error');
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div>
            {/* ── Filtros e ações ── */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div className="flex flex-wrap items-start gap-3">
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
                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Período (data inicial a final)</label>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setUsarPeriodo(v => !v)}
                                className="px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap"
                                style={usarPeriodo
                                    ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                                    : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                {usarPeriodo ? '✓ Período ativo' : 'Usar período'}
                            </button>
                            {usarPeriodo && (
                                <>
                                    <input type="date" value={periodoCustom.inicio}
                                        onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))}
                                        className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data inicial" />
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>até</span>
                                    <input type="date" value={periodoCustom.fim}
                                        onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))}
                                        className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data final" />
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Empresa</label>
                        <PrettySelect value={empresaFiltro} onChange={e => setEmpresaFiltro(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todas as empresas</option>
                            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </PrettySelect>
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
                    captacaoPorSaco={captacaoConfig.valorPorSaco}
                />
            ) : subAba === 'terceiros' ? (
                <TabelaTerceiros
                    carregamentos={carregamentosTerceiros}
                    isAdmin={isAdmin}
                    onNovo={openCreateTerceiro}
                    onEdit={openEditTerceiro}
                    onDelete={handleDeleteTerceiro}
                    onTogglePago={handleTogglePagoTerceiro}
                    onTogglePagoEmMassa={handleTogglePagoEmMassaTerceiro}
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
                    mes={mes}
                />
            ) : null}

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

                        {form.tipo === 'ESTOQUE' ? (
                            <>
                                <div className="flex items-start gap-2 p-3 rounded-xl border" style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}>
                                    <Icon name="Info" size={14} color="#C2410C" className="flex-shrink-0 mt-0.5" />
                                    <p className="text-xs" style={{ color: '#9A3412' }}>
                                        Carga retirada do estoque próprio (não veio direto do fornecedor) — por isso não
                                        entra no volume de sacos do dashboard. Gera bônus para o motorista normalmente,
                                        calculado pelo destino (mesma regra da aba Bonificações), e o frete é calculado
                                        pela tabela "Frete Estoque" (Fretes → Frete Estoque) × quantidade de sacos.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Data" required>
                                        <input type="date" value={form.data_carregamento} onChange={e => setForm(f => ({ ...f, data_carregamento: e.target.value }))} className={inputCls} style={inputStyle} />
                                    </Field>
                                    <Field label="Veículo (placa)" required>
                                        <PrettySelect value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                            <option value="">Selecione...</option>
                                            {veiculosProprios.map(v => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
                                        </PrettySelect>
                                    </Field>
                                </div>
                                <Field label="Motorista" required>
                                    <PrettySelect value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione...</option>
                                        {motoristasProprios.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </PrettySelect>
                                </Field>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Quantidade (sacos)" required={modal?.mode !== 'edit'}>
                                        <input type="number" min="0" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 800" />
                                    </Field>
                                    <Field label="Frete calculado">
                                        <div className="px-3 py-2 rounded-lg border text-sm font-semibold" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F0FDF4', color: '#059669' }}>
                                            {(Number(form.quantidade || 0) * valorBaseEstoque).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </div>
                                        {form.destino && (
                                            <p className="text-[11px] mt-1" style={{ color: freteEstoqueRef ? '#059669' : '#B45309' }}>
                                                {freteEstoqueRef
                                                    ? `${Number(freteEstoqueRef.frete_por_saco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/saco (tabela Frete Estoque)`
                                                    : 'Destino não encontrado na tabela Frete Estoque — cadastre a cidade em Fretes → Frete Estoque.'}
                                            </p>
                                        )}
                                    </Field>
                                </div>
                                <Field label="Destino" required>
                                    <DestinoSelect
                                        value={form.destino}
                                        onChange={v => setForm(f => ({ ...f, destino: v }))}
                                        onFreteAutoFill={v => setForm(f => ({ ...f, tipo_calculo_frete: 'por_saco', valor_base_frete: String(v) }))}
                                        fretes={fretesEstoque}
                                        placeholder="Cidade de destino"
                                    />
                                </Field>
                                <CidadesAdicionaisField
                                    cidades={[...new Set((fretesEstoque || []).map(f => f.cidade).filter(Boolean))]}
                                    value={paradasForm}
                                    onChange={setParadasForm}
                                    label="Cidades adicionais desta viagem"
                                />
                                <Field label="Tipo de cimento" required>
                                    <PrettySelect value={form.tipo_cimento} onChange={e => setForm(f => ({ ...f, tipo_cimento: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione...</option>
                                        <option value="Montes Claros">Montes Claros</option>
                                        <option value="Liz">Liz</option>
                                        <option value="Ambas">Ambas (Montes Claros + Liz)</option>
                                    </PrettySelect>
                                </Field>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Data" required>
                                        <input type="date" value={form.data_carregamento} onChange={e => setForm(f => ({ ...f, data_carregamento: e.target.value }))} className={inputCls} style={inputStyle} />
                                    </Field>
                                    <Field label="Quantidade (sacos)" required>
                                        <input type="number" min="0" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 1200" />
                                    </Field>
                                </div>
                                <Field label="Fornecedor / Origem" required>
                                    <OrigemDropdown value={form.empresa_origem} onChange={v => setForm(f => ({ ...f, empresa_origem: v }))} fornecedores={fornecedores} />
                                </Field>
                                {/* Origem do carregamento: frota de carretas (padrão) ou, raramente,
                                    um caminhão da frota que carregou avulso (ex: Montes Claros) — não
                                    gera bônus de carreteiro, só conta no volume de sacos e no frete. */}
                                <div className="flex gap-2 p-1 rounded-lg border w-fit" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB' }}>
                                    {[
                                        { v: 'carreta', label: 'Frota de Carretas' },
                                        { v: 'caminhao', label: 'Caminhão (frota própria)' },
                                    ].map(op => (
                                        <button key={op.v} type="button"
                                            onClick={() => setForm(f => ({ ...f, origem_frota: op.v, veiculo_id: '', motorista_id: '', placa_caminhao_avulso: '' }))}
                                            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                                            style={form.origem_frota === op.v
                                                ? { backgroundColor: 'white', color: '#D97706', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: 600 }
                                                : { color: 'var(--color-muted-foreground)' }}>
                                            {op.label}
                                        </button>
                                    ))}
                                </div>
                                {form.origem_frota === 'caminhao' && (
                                    <div className="flex items-start gap-2 p-3 rounded-xl border" style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}>
                                        <Icon name="Info" size={14} color="#C2410C" className="flex-shrink-0 mt-0.5" />
                                        <p className="text-xs" style={{ color: '#9A3412' }}>
                                            Carregamento avulso feito por um caminhão da frota (não é uma carreta). Não gera
                                            bonificação de carreteiro — só entra no volume de sacos e no valor de frete do setor.
                                        </p>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    {form.origem_frota === 'caminhao' ? (
                                        <Field label="Placa do caminhão" required>
                                            <PrettySelect value={form.placa_caminhao_avulso} onChange={e => setForm(f => ({ ...f, placa_caminhao_avulso: e.target.value }))} className={inputCls} style={inputStyle}>
                                                <option value="">Selecione...</option>
                                                {veiculosCaminhoes.map(v => <option key={v.id} value={v.placa}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
                                            </PrettySelect>
                                        </Field>
                                    ) : (
                                        <Field label="Veículo (placa)" required>
                                            <PrettySelect value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                                <option value="">Selecione...</option>
                                                {veiculosProprios.map(v => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
                                            </PrettySelect>
                                        </Field>
                                    )}
                                    <Field label="Motorista" required>
                                        <PrettySelect value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                            <option value="">Selecione...</option>
                                            {(form.origem_frota === 'caminhao' ? motoristasCaminhoes : motoristasProprios).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </PrettySelect>
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Nº Pedido" required>
                                        <input value={form.numero_pedido} onChange={e => setForm(f => ({ ...f, numero_pedido: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 123456" />
                                    </Field>
                                    <Field label="Nota Fiscal" required>
                                        <input value={form.numero_nota_fiscal} onChange={e => setForm(f => ({ ...f, numero_nota_fiscal: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 381469" />
                                    </Field>
                                </div>
                                <Field label="Destino" required>
                                    <DestinoSelect
                                        value={form.destino}
                                        onChange={v => setForm(f => ({ ...f, destino: v }))}
                                        onFreteAutoFill={v => setForm(f => ({ ...f, tipo_calculo_frete: 'por_saco', valor_base_frete: String(v) }))}
                                        fretes={fretesFretas}
                                        placeholder="Cidade ou estoque"
                                    />
                                </Field>
                                <CidadesAdicionaisField
                                    cidades={[...new Set((fretesFretas || []).map(f => f.cidade).filter(Boolean))]}
                                    value={paradasForm}
                                    onChange={setParadasForm}
                                    label="Cidades adicionais desta viagem"
                                />
                                <Field label="Empresa (frete)" required>
                                    <PrettySelect value={form.empresa_id} onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione...</option>
                                        {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                                    </PrettySelect>
                                </Field>
                                {/* ── Bloco de Frete ── */}
                                <div className="col-span-full p-4 rounded-xl border" style={{ borderColor: '#C4B5FD', backgroundColor: '#FAF5FF' }}>
                                    <p className="text-xs font-semibold text-purple-700 mb-3">💰 Cálculo de Frete</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Tipo de cálculo" required>
                                            <PrettySelect value={form.tipo_calculo_frete} onChange={e => setForm(f => ({ ...f, tipo_calculo_frete: e.target.value }))} className={inputCls} style={inputStyle}>
                                                {TIPOS_CALCULO_FRETE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </PrettySelect>
                                        </Field>
                                        <Field label={
                                            form.tipo_calculo_frete === 'percentual' ? 'Percentual (%)' :
                                            form.tipo_calculo_frete === 'por_km' ? 'Preço diesel (R$/L)' : 'Valor base (R$)'
                                        } required>
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
                                    {previewFrete > 0 && captacaoConfig.valorPorSaco > 0 && (
                                        <div className="mt-2 p-2.5 rounded-lg text-xs" style={{ backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE' }}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span style={{ color: '#6D28D9' }}>↳ Captação (MOC → Estoque){form.tipo === 'ESTOQUE' ? ' — já em estoque' : ''}</span>
                                                <span className="font-mono font-semibold" style={{ color: '#6D28D9' }}>{BRL(previewCaptacaoTotal)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span style={{ color: '#059669' }}>↳ Distribuição</span>
                                                <span className="font-mono font-semibold" style={{ color: '#059669' }}>
                                                    {BRL(previewDistribuicao)} <span className="opacity-70">({previewPctDistribuicao.toFixed(0)}%)</span>
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

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
                            <TipoSelector value={formTerceiro.tipo} onChange={v => setFormTerceiro(f => ({ ...f, tipo: v }))} options={['ARA_GBI_FOB', 'ARA_BARR_FOB', 'CIF_GBI', 'CIF_BARR']} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Data" required>
                                <input type="date" value={formTerceiro.data_carregamento} onChange={e => setFormTerceiro(f => ({ ...f, data_carregamento: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Quantidade (sacos)" required>
                                <input type="number" min="0" value={formTerceiro.quantidade} onChange={e => setFormTerceiro(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 1200" />
                            </Field>
                        </div>
                        <Field label="Motorista Terceirizado" required>
                            <ComboSelect
                                value={formTerceiro.motorista_id}
                                onChange={v => setFormTerceiro(f => ({ ...f, motorista_id: v }))}
                                options={motoristasTerceiros.map(m => ({ value: m.id, label: m.name }))}
                                placeholder="Selecione o motorista..."
                                emptyLabel="Nenhum motorista encontrado"
                            />
                            {motoristasTerceiros.length === 0 && (
                                <p className="text-xs mt-1 text-amber-600">⚠ Nenhum motorista com flag "terceirizado" cadastrado em Configurações.</p>
                            )}
                        </Field>
                        <Field label="Placa do Veículo Terceirizado" required>
                            <ComboSelect
                                value={formTerceiro.veiculo_id}
                                onChange={v => setFormTerceiro(f => ({ ...f, veiculo_id: v }))}
                                options={veiculosTerceiros.map(v => ({ value: v.id, label: v.placa, sub: v.modelo || '' }))}
                                placeholder="Selecione a placa..."
                                emptyLabel="Nenhum veículo encontrado"
                            />
                            {veiculosTerceiros.length === 0 && (
                                <p className="text-xs mt-1 text-amber-600">⚠ Nenhum veículo com flag "terceirizado" cadastrado em Veículos.</p>
                            )}
                        </Field>
                        <Field label="Empresa (frete)" required>
                            <PrettySelect value={formTerceiro.empresa_id} onChange={e => setFormTerceiro(f => ({ ...f, empresa_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione a empresa...</option>
                                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                            </PrettySelect>
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Tipo de Cálculo do Frete" required>
                                <PrettySelect value={formTerceiro.tipo_calculo_frete} onChange={e => setFormTerceiro(f => ({ ...f, tipo_calculo_frete: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {TIPOS_CALCULO_FRETE.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </PrettySelect>
                            </Field>
                            <Field label={formTerceiro.tipo_calculo_frete === 'por_saco' ? 'R$ por saco' : formTerceiro.tipo_calculo_frete === 'por_tonelada' ? 'R$ por tonelada' : formTerceiro.tipo_calculo_frete === 'percentual' ? '% do valor' : formTerceiro.tipo_calculo_frete === 'por_carga' ? 'Valor fixo (R$)' : 'Valor base'} required>
                                <input type="number" min="0" step="0.01" value={formTerceiro.valor_base_frete} onChange={e => setFormTerceiro(f => ({ ...f, valor_base_frete: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 9,52" />
                            </Field>
                        </div>
                        {formTerceiro.tipo_calculo_frete && formTerceiro.valor_base_frete && formTerceiro.quantidade && (
                            <div className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }}>
                                💰 Frete calculado: {Number(calcularFrete(formTerceiro.tipo_calculo_frete, formTerceiro.quantidade, formTerceiro.valor_base_frete, null)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                        )}
                        <Field label="Fornecedor / Origem" required>
                            <OrigemDropdown value={formTerceiro.empresa_origem} onChange={v => setFormTerceiro(f => ({ ...f, empresa_origem: v }))} fornecedores={fornecedores} />
                        </Field>
                        <Field label="Destino" required>
                            <DestinoSelect
                                value={formTerceiro.destino}
                                onChange={v => setFormTerceiro(f => ({ ...f, destino: v }))}
                                onFreteAutoFill={v => setFormTerceiro(f => ({ ...f, tipo_calculo_frete: 'por_saco', valor_base_frete: String(v) }))}
                                fretes={fretosTerceiros}
                                placeholder="Cidade ou estoque"
                            />
                        </Field>
                        <CidadesAdicionaisField
                            cidades={[...new Set((fretosTerceiros || []).map(f => f.cidade).filter(Boolean))]}
                            value={paradasFormTerceiro}
                            onChange={setParadasFormTerceiro}
                            label="Cidades adicionais desta viagem"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nº Pedido" required>
                                <input value={formTerceiro.numero_pedido} onChange={e => setFormTerceiro(f => ({ ...f, numero_pedido: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 123456" />
                            </Field>
                            <Field label="Nota Fiscal" required>
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
                            <TipoSelector value={formRetira.tipo} onChange={v => setFormRetira(f => ({ ...f, tipo: v }))} options={['ARA_GBI_FOB', 'ARA_BARR_FOB', 'CIF_GBI', 'CIF_BARR']} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Data" required>
                                <input type="date" value={formRetira.data_carregamento} onChange={e => setFormRetira(f => ({ ...f, data_carregamento: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Quantidade (sacos)" required>
                                <input type="number" min="0" value={formRetira.quantidade} onChange={e => setFormRetira(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 800" />
                            </Field>
                        </div>
                        <Field label="Cliente / Origem" required>
                            <OrigemDropdown value={formRetira.empresa_origem} onChange={v => setFormRetira(f => ({ ...f, empresa_origem: v }))} fornecedores={fornecedores} />
                        </Field>
                        {/* Veículos e Motoristas — apenas frota própria (não terceiros) */}
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Veículo Terceirizado" required>
                                <PrettySelect value={formRetira.veiculo_id} onChange={e => setFormRetira(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculosTerceiros.map(v => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
                                </PrettySelect>
                            </Field>
                            <Field label="Nome do Cliente" required>
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
                            <Field label="Nota Fiscal" required>
                                <input value={formRetira.numero_nota_fiscal} onChange={e => setFormRetira(f => ({ ...f, numero_nota_fiscal: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 381469" />
                            </Field>
                        </div>
                        <Field label="Nº Pedido" required>
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
                                    <DeleteButton onClick={() => onDelete(f.id)} />
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
