import React, { useState, useMemo } from 'react';
import { saldoCompra, agruparPneusPorLote, updatePneu, createPneu, deletePneu, substituirPneu } from 'services/pneusService';
import { usePagination, AppIcon as Icon, Button, PaginationBar, PrettySelect, SearchableSelect } from 'components';
import { FMT } from '../../utils/helpers';
import LinhaPneu from '../LinhaPneu';
import Field from '../Field';
import SelectComOpcaoNova from '../SelectComOpcaoNova';
import { inputCls, inputStyle, BANDAGEM_LABEL } from '../../utils/constants';
import GerenciarCatalogoModal from '../GerenciarCatalogoModal';

export default function PainelPneus({ pneus, compras, veiculos, caminhoes, motoristas, catalogo, isAdmin, showToast, confirm, load, handleAddCatalogo }) {
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos'); // todos | em_uso | substituido
    // Filtro de data (padrão: mês de exercício atual). Vazio = todos os registros.
    const [filtroMes, setFiltroMes] = useState(() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; });
    const [usarPeriodo, setUsarPeriodo] = useState(false);
    const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' });
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

    // Lista combinada de veículos (carretas + caminhões da página Veículos) para
    // o campo "Veículo" do formulário — usa prefixo cv:/vh: para diferenciar.
    const veiculoOptions = useMemo(() => ([
        ...veiculos.map(v => ({ value: `cv:${v.id}`, label: v.placa, sublabel: v.modelo ? `${v.modelo} · Carreta` : 'Carreta' })),
        ...caminhoes.map(v => ({ value: `vh:${v.id}`, label: v.placa, sublabel: v.modelo ? `${v.modelo} · Caminhão` : 'Caminhão' })),
    ]), [veiculos, caminhoes]);

    // Intervalo [ini, fim] em YYYY-MM-DD conforme o filtro ativo
    const intervaloData = useMemo(() => {
        if (usarPeriodo && (periodoCustom.inicio || periodoCustom.fim)) return { ini: periodoCustom.inicio || '0000-01-01', fim: periodoCustom.fim || '9999-12-31' };
        if (filtroMes) {
            const [y, m] = filtroMes.split('-').map(Number);
            return { ini: `${filtroMes}-01`, fim: `${filtroMes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` };
        }
        return null;
    }, [usarPeriodo, periodoCustom, filtroMes]);

    // O pneu entra no período se foi instalado OU substituído dentro dele.
    // "Em uso" ignora a data: é o estado atual da frota, não um evento do mês.
    const noPeriodo = (p) => {
        if (!intervaloData || filtroStatus === 'em_uso') return true;
        const dentro = (d) => !!d && String(d).slice(0, 10) >= intervaloData.ini && String(d).slice(0, 10) <= intervaloData.fim;
        return dentro(p.data_instalacao) || dentro(p.data_substituicao);
    };

    const filtrados = pneus.filter(p => {
        if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false;
        if (!noPeriodo(p)) return false;
        if (busca.trim()) {
            const q = busca.toLowerCase();
            return (
                (p.marca || '').toLowerCase().includes(q) ||
                (p.modelo || '').toLowerCase().includes(q) ||
                (p.numero_sequencial || '').toLowerCase().includes(q) ||
                (p.veiculo?.placa || '').toLowerCase().includes(q) ||
                (p.veiculo_caminhao_placa || '').toLowerCase().includes(q) ||
                (p.motorista?.name || '').toLowerCase().includes(q)
            );
        }
        return true;
    });

    // Trocas registradas em lote (várias posições marcadas de uma vez pelo
    // mecânico) aparecem agrupadas num único item expansível na tabela.
    const linhasAgrupadas = useMemo(() => agruparPneusPorLote(filtrados), [filtrados]);
    const pneusPag = usePagination(linhasAgrupadas, 20, [filtroStatus, busca, filtroMes, usarPeriodo, periodoCustom.inicio, periodoCustom.fim]);
    const [gruposExpandidos, setGruposExpandidos] = useState({});
    const toggleGrupo = (loteId) => setGruposExpandidos(s => ({ ...s, [loteId]: !s[loteId] }));

    const openCreate = () => { setForm(emptyForm()); setModal({ mode: 'create' }); };
    const openEdit = (p) => {
        setForm({
            marca: p.marca || '', modelo: p.modelo || '', medida: p.medida || '',
            categoria_bandagem: p.categoria_bandagem || 'mista',
            veiculo_id: p.veiculo_id ? `cv:${p.veiculo_id}` : (p.veiculo_caminhao_id ? `vh:${p.veiculo_caminhao_id}` : ''),
            motorista_id: p.motorista_id || '',
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
            const [tipo, id] = form.veiculo_id.split(':');
            const caminhaoSel = tipo === 'vh' ? caminhoes.find(c => String(c.id) === id) : null;
            const payload = {
                marca: form.marca, modelo: form.modelo || null, medida: form.medida || null,
                categoria_bandagem: form.categoria_bandagem || null,
                veiculo_id: tipo === 'cv' ? id : null,
                veiculo_caminhao_id: tipo === 'vh' ? id : null,
                veiculo_caminhao_placa: caminhaoSel?.placa || null,
                veiculo_caminhao_modelo: caminhaoSel?.modelo || null,
                motorista_id: form.motorista_id || null,
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

            {/* Filtro por mês / período */}
            <div className="flex flex-wrap items-center gap-2">
                <input type="month" value={filtroMes} onChange={e => { setFiltroMes(e.target.value); setUsarPeriodo(false); }}
                    className="px-3 py-1.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20" style={{ borderColor: 'var(--color-border)' }} title="Mês de exercício" />
                <button type="button" onClick={() => setUsarPeriodo(u => !u)}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                    style={usarPeriodo ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' } : { borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    {usarPeriodo ? '✓ Período ativo' : 'Usar período'}
                </button>
                {usarPeriodo && (
                    <>
                        <input type="date" value={periodoCustom.inicio} onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))}
                            className="px-2.5 py-1.5 rounded-lg border text-xs outline-none" style={{ borderColor: 'var(--color-border)' }} />
                        <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>até</span>
                        <input type="date" value={periodoCustom.fim} onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))}
                            className="px-2.5 py-1.5 rounded-lg border text-xs outline-none" style={{ borderColor: 'var(--color-border)' }} />
                    </>
                )}
                {(filtroMes || usarPeriodo) && (
                    <button type="button" onClick={() => { setFiltroMes(''); setUsarPeriodo(false); setPeriodoCustom({ inicio: '', fim: '' }); }}
                        className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                        title="Limpar data e ver todos os pneus">✕ Data</button>
                )}
                {filtroStatus === 'em_uso' && intervaloData && (
                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>"Em uso" mostra todos, independente do mês</span>
                )}
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
                                    {['Nº / Tipo', 'Veículo', 'Motorista', 'Marca / Modelo', 'Medida', 'Bandagem', 'Eixo', 'KM Instalação', 'KM Final', 'KM Rodado', 'Compra (NF)', 'Status', ''].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pneusPag.pageItems.map((item, idx) => item.grupo ? (
                                    <React.Fragment key={item.lote_id}>
                                        <tr className="border-t hover:bg-blue-50/30 transition-colors cursor-pointer"
                                            style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}
                                            onClick={() => toggleGrupo(item.lote_id)}>
                                            <td className="px-3 py-2.5" colSpan={12}>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Icon name={gruposExpandidos[item.lote_id] ? 'ChevronUp' : 'ChevronDown'} size={14} color="var(--color-muted-foreground)" />
                                                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                                                        <Icon name="Layers" size={12} color="#1D4ED8" />
                                                    </div>
                                                    <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                        {item.itens.length} pneus trocados
                                                    </span>
                                                    <span style={{ color: 'var(--color-muted-foreground)' }}>·</span>
                                                    <span className="font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                                        {item.itens[0].veiculo?.placa || item.itens[0].veiculo_caminhao_placa || '—'}
                                                    </span>
                                                    <span style={{ color: 'var(--color-muted-foreground)' }}>·</span>
                                                    <span style={{ color: 'var(--color-muted-foreground)' }}>{item.itens[0].motorista?.name || '—'}</span>
                                                    <span style={{ color: 'var(--color-muted-foreground)' }}>·</span>
                                                    <span className="font-data" style={{ color: 'var(--color-muted-foreground)' }}>{FMT(item.itens[0].data_instalacao)}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2.5" />
                                        </tr>
                                        {gruposExpandidos[item.lote_id] && item.itens.map(p => (
                                            <LinhaPneu key={p.id} p={p} isAdmin={isAdmin} indent
                                                onSubstituir={() => setModalSubstituir({ id: p.id, _km_final: '', _data: new Date().toISOString().slice(0, 10) })}
                                                onEditar={() => openEdit(p)} onExcluir={() => handleDelete(p)} />
                                        ))}
                                    </React.Fragment>
                                ) : (
                                    <LinhaPneu key={item.pneu.id} p={item.pneu} isAdmin={isAdmin} stripe={idx % 2 === 0}
                                        onSubstituir={() => setModalSubstituir({ id: item.pneu.id, _km_final: '', _data: new Date().toISOString().slice(0, 10) })}
                                        onEditar={() => openEdit(item.pneu)} onExcluir={() => handleDelete(item.pneu)} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationBar page={pneusPag.page} setPage={pneusPag.setPage} totalPages={pneusPag.totalPages}
                        totalItems={pneusPag.totalItems} pageSize={pneusPag.pageSize} itemLabel="registro" />
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
                                    <PrettySelect value={form.categoria_bandagem} onChange={e => setForm(f => ({ ...f, categoria_bandagem: e.target.value }))} className={inputCls} style={inputStyle}>
                                        {Object.keys(BANDAGEM_LABEL).map(k => <option key={k} value={k}>{BANDAGEM_LABEL[k]}</option>)}
                                    </PrettySelect>
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Veículo (frota própria)" required>
                                    <SearchableSelect
                                        value={form.veiculo_id}
                                        onChange={v => setForm(f => ({ ...f, veiculo_id: v }))}
                                        options={veiculoOptions}
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
                                    <PrettySelect value={form.eixo_trocado} onChange={e => setForm(f => ({ ...f, eixo_trocado: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione...</option>
                                        {catalogo.eixo.map(e => <option key={e} value={e}>{e}</option>)}
                                    </PrettySelect>
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
                                <PrettySelect value={form.compra_id} onChange={e => setForm(f => ({ ...f, compra_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Sem vínculo com compra</option>
                                    {comprasComSaldo.filter(c => c.saldo > 0 || c.id === form.compra_id).map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.marca}{c.modelo ? ` ${c.modelo}` : ''} — NF {c.despesa?.nota_fiscal || '—'} (saldo: {c.saldo})
                                        </option>
                                    ))}
                                </PrettySelect>
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
