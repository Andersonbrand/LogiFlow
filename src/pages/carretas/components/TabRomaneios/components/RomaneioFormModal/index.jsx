import React, { useState, useEffect, useMemo } from 'react';

import { useToast } from 'hooks/useToast';
import { parseParadas, PrettySelect, CidadesAdicionaisField, AppIcon as Icon, Button, Toast, Field, ModalHeader } from 'components';
import { calcularFretePedidoMulti, FRETE_CATEGORIAS } from 'config/freteConfig';
import { updateRomaneio, createRomaneio, STATUS_ROMANEIO } from 'services/carretas';

import ModalOverlay from '../ModalOverlay';
import { inputCls, inputStyle, TIPOS_CALCULO_FRETE_ROMANEIO } from '../../utils/constants';
import DestinoSelect from '../DestinoSelect';
import { BRL } from '../../utils/helpers';
import PedidoCardCarretas from '../PedidoCardCarretas';

// ─── Card de Pedido — cabeçalho (cliente/vendedor/frete) + materiais do pedido ─
const EMPTY_PEDIDO_CARRETAS = () => ({
    numero_pedido: '', cidade_destino: '', valor_pedido: '', categoria_frete: 'Cimento',
    categorias_extra: [], empresa: '', nome_cliente: '', nome_vendedor: '', itens: [], observacao: '',
});

// ─── Modal Formulário Romaneio ─────────────────────────────────────────────────
export default function RomaneioFormModal({ modal, onClose, onSaved, motoristas, veiculos, empresas, materiais, fretesFretas = [], adminsFrete = [] }) {
    const { toast, showToast } = useToast();
    const isEdit = modal?.mode === 'edit';
    const rom = modal?.data;

    const emptyForm = () => ({
        status: 'Aguardando',
        motorista_id: '',
        vincularMotorista: true,
        veiculo_id: '',
        empresa: '',
        data_saida: new Date().toISOString().split('T')[0],
        data_chegada: '',
        destino: '',
        numero_nf: '',
        numero_pedido: '',
        valor_carga: '',
        tipo_calculo_frete: 'percentual_pedido',
        percentual_frete_fixo: '',
        frete_fixo_responsavel: '',
        frete_fixo_combinado_em: new Date().toISOString().split('T')[0],
        valor_frete: '',
        observacoes: '',
    });

    const [form, setForm] = useState(emptyForm());
    const [pedidos, setPedidos] = useState([]);
    const [paradas, setParadas] = useState([]); // cidades adicionais além do destino principal
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isEdit && rom) {
            setForm({
                status:               rom.status || 'Aguardando',
                motorista_id:         rom.motorista_id || '',
                vincularMotorista:    !!rom.motorista_id,
                veiculo_id:           rom.veiculo_id || '',
                empresa:              rom.empresa || '',
                data_saida:           rom.data_saida || '',
                data_chegada:         rom.data_chegada || '',
                destino:              rom.destino || '',
                numero_nf:            rom.numero_nf || '',
                numero_pedido:        rom.numero_pedido || '',
                valor_carga:          rom.valor_carga != null ? String(rom.valor_carga) : '',
                tipo_calculo_frete:   rom.tipo_calculo_frete || 'percentual_pedido',
                percentual_frete_fixo:    rom.percentual_frete_fixo != null ? String(rom.percentual_frete_fixo * 100) : '',
                frete_fixo_responsavel:   rom.frete_fixo_responsavel || '',
                frete_fixo_combinado_em:  rom.frete_fixo_combinado_em || new Date().toISOString().split('T')[0],
                valor_frete:          rom.valor_frete != null ? String(rom.valor_frete) : '',
                observacoes:          rom.observacoes || '',
            });
            setParadas(parseParadas(rom.paradas));
            const itemToForm = it => {
                const matPeso = it.material?.peso && Number(it.material.peso) > 0 ? Number(it.material.peso) : null;
                const pesoTotalSalvo = it.peso_total != null ? Number(it.peso_total) : null;
                const qtd = Number(it.quantidade || 1);
                const foiManual = matPeso && pesoTotalSalvo !== null ? Math.abs(pesoTotalSalvo - matPeso * qtd) > 0.01 : true;
                return {
                    material_id: it.material_id || '', descricao: it.descricao || '', quantidade: String(qtd),
                    unidade: it.unidade || 'sc', peso_unit: matPeso ? String(matPeso) : '',
                    peso_total: pesoTotalSalvo != null ? String(pesoTotalSalvo) : '', _pesoManual: foiManual,
                };
            };
            let pedidosCarregados = (rom.pedidos || []).map(p => ({
                id: p.id,
                numero_pedido: p.numero_pedido || '', cidade_destino: p.cidade_destino || '',
                valor_pedido: p.valor_pedido != null ? String(p.valor_pedido) : '',
                categoria_frete: p.categoria_frete || 'Cimento',
                categorias_extra: Array.isArray(p.categorias_extra) ? p.categorias_extra : [],
                empresa: p.empresa || '', nome_cliente: p.nome_cliente || '', nome_vendedor: p.nome_vendedor || '',
                observacao: p.observacao || '',
                itens: (rom.itens || []).filter(it => it.pedido_id === p.id).map(itemToForm),
            }));
            // Romaneio antigo (de antes de "Pedidos múltiplos" existir) — tinha
            // materiais soltos, sem pedido. Envolve tudo num pedido único pra não
            // perder nada, já convertendo pro novo formato ao salvar de novo.
            if (pedidosCarregados.length === 0 && (rom.itens || []).length > 0) {
                pedidosCarregados = [{
                    numero_pedido: rom.numero_pedido || '', cidade_destino: rom.destino || '',
                    valor_pedido: rom.valor_carga != null ? String(rom.valor_carga) : '',
                    categoria_frete: 'Cimento', categorias_extra: [],
                    empresa: rom.empresa || '', nome_cliente: '', nome_vendedor: '',
                    itens: (rom.itens || []).map(itemToForm),
                }];
            }
            setPedidos(pedidosCarregados);
        } else {
            setForm(emptyForm());
            setPedidos([]);
            setParadas([]);
        }
    }, [modal]); // eslint-disable-line

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const addPedido = () => setPedidos(p => [...p, { ...EMPTY_PEDIDO_CARRETAS(), empresa: form.empresa || '', _novo: true }]);
    const updatePedido = (idx, patch) => setPedidos(p => p.map((pd, i) => i === idx ? { ...pd, ...patch } : pd));
    const removePedido = (idx) => setPedidos(p => p.filter((_, i) => i !== idx));

    // Totais calculados a partir dos pedidos
    const totaisPedidos = useMemo(() => {
        const valorCarga = pedidos.reduce((s, p) => s + (Number(p.valor_pedido) || 0), 0);
        const pesoItens = pedidos.reduce((s, p) => s + p.itens.reduce((s2, it) => s2 + (Number(it.peso_total) || 0), 0), 0);
        // Frete "por pedido" — só usado de fato quando o modo do romaneio é
        // 'percentual_pedido'; nos outros dois modos o frete final vem de um
        // valor único pro romaneio inteiro (ver freteFinal em handleSave).
        const fretePorPedido = pedidos.reduce((s, p) => s + calcularFretePedidoMulti(p).total, 0);
        let frete = fretePorPedido;
        if (form.tipo_calculo_frete === 'percentual_fixo') {
            frete = valorCarga * (Number(form.percentual_frete_fixo || 0) / 100);
        } else if (form.tipo_calculo_frete === 'valor_fixo') {
            frete = Number(form.valor_frete || 0);
        }
        return { valorCarga, frete, fretePorPedido, pesoItens };
    }, [pedidos, form.tipo_calculo_frete, form.percentual_frete_fixo, form.valor_frete]);

    const handleSave = async () => {
        if (!form.destino) { showToast('Destino é obrigatório', 'error'); return; }
        if (form.tipo_calculo_frete === 'percentual_fixo' && !(Number(form.percentual_frete_fixo) > 0)) {
            showToast('Informe o percentual fixo do frete', 'error'); return;
        }
        if (form.tipo_calculo_frete === 'valor_fixo') {
            if (!(Number(form.valor_frete) > 0)) { showToast('Informe o valor fixo do frete', 'error'); return; }
            if (!form.frete_fixo_responsavel.trim()) { showToast('Informe quem combinou o valor fixo com o transporte', 'error'); return; }
        }
        setSaving(true);
        try {
            const itensPayloadFrom = (lista) => lista.filter(it => it.material_id || it.descricao).map(it => {
                const matIt = materiais.find(m => m.id === it.material_id);
                // Prioridade: peso_unit do item > peso do material > null
                const pu = it.peso_unit
                    ? Number(it.peso_unit)
                    : (matIt?.peso && Number(matIt.peso) > 0 ? Number(matIt.peso) : null);
                const pesoSalvo = (pu && !it._pesoManual && it.quantidade)
                    ? String(pu * Number(it.quantidade))
                    : it.peso_total;
                // Não persistir campos de controle interno no banco
                const { _pesoManual, peso_unit, ...itemClean } = it;
                return { ...itemClean, peso_total: pesoSalvo };
            });

            if (pedidos.length === 0) { showToast('Adicione pelo menos um pedido', 'error'); setSaving(false); return; }
            const pedidosPayload = pedidos.map(p => {
                const freteMulti = calcularFretePedidoMulti(p);
                return {
                    numero_pedido: p.numero_pedido || null,
                    cidade_destino: p.cidade_destino || null,
                    valor_pedido: Number(p.valor_pedido) || 0,
                    categoria_frete: p.categoria_frete || null,
                    categorias_extra: (p.categorias_extra || []).filter(e => Number(e.valor) > 0).map(e => ({ categoria: e.categoria, valor: Number(e.valor) })),
                    percentual_frete: FRETE_CATEGORIAS.find(f => f.categoria === p.categoria_frete)?.percentual || null,
                    frete_calculado: freteMulti.total,
                    empresa: p.empresa || null,
                    nome_cliente: (p.nome_cliente || '').trim() || null,
                    nome_vendedor: (p.nome_vendedor || '').trim() || null,
                    observacao: (p.observacao || '').trim() || null,
                };
            });
            // Itens ganham pedido_index (posição no array de pedidos) para o
            // service vincular ao pedido_id correto depois de inserir os pedidos.
            const itensPayload = pedidos.flatMap((p, pIdx) =>
                itensPayloadFrom(p.itens).map(it => ({ ...it, pedido_index: pIdx }))
            );
            const valorCargaFinal = totaisPedidos.valorCarga;
            const freteFinal = totaisPedidos.frete;

            // Soma o peso (kg) de todos os itens e converte para toneladas — é o campo
            // 'toneladas' que listas, exportações e relatórios financeiros usam para
            // exibir o peso do romaneio. Sem isso, a soma calculada nos itens ficava só
            // na prévia do modal e nunca era gravada no romaneio.
            const pesoItensKg = itensPayload.reduce((s, it) => s + (Number(it.peso_total) || 0), 0);
            const toneladasCalculadas = pesoItensKg > 0 ? pesoItensKg / 1000 : (rom?.toneladas ?? null);

            const payload = {
                status:              form.status,
                destino:             form.destino,
                data_saida:          form.data_saida   || undefined,
                data_chegada:        form.data_chegada || undefined,
                // "Sem motorista (só a carga)" precisa gravar null explicitamente —
                // undefined seria removido do payload logo abaixo e o motorista_id
                // antigo continuaria salvo no banco, mesmo aparecendo desmarcado na tela.
                motorista_id:        form.vincularMotorista === false ? null : (form.motorista_id || undefined),
                veiculo_id:          form.veiculo_id   || undefined,
                empresa:             form.empresa       || undefined,
                numero_nf:           form.numero_nf     || undefined,
                numero_pedido:       form.numero_pedido || undefined,
                valor_carga:         valorCargaFinal,
                tipo_calculo_frete:  form.tipo_calculo_frete,
                percentual_frete_fixo: form.tipo_calculo_frete === 'percentual_fixo'
                    ? Number(form.percentual_frete_fixo) / 100 : null,
                frete_fixo_responsavel: form.tipo_calculo_frete === 'valor_fixo'
                    ? form.frete_fixo_responsavel.trim() : null,
                frete_fixo_combinado_em: form.tipo_calculo_frete === 'valor_fixo'
                    ? (form.frete_fixo_combinado_em || null) : null,
                valor_frete:         freteFinal,
                observacoes:         form.observacoes   || undefined,
                toneladas:           toneladasCalculadas,
                paradas:             paradas.filter(p => p && p.trim()),
                itens: itensPayload,
                _pedidos: pedidosPayload,
            };
            // Remove undefined
            Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

            if (isEdit) await updateRomaneio(rom.id, payload);
            else        await createRomaneio(payload);

            showToast(isEdit ? 'Romaneio atualizado!' : 'Romaneio criado!', 'success');
            setTimeout(() => { onSaved(); onClose(); }, 800);
        } catch (e) {
            console.error(e);
            showToast('Erro: ' + (e.message || JSON.stringify(e)), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalOverlay onClose={onClose}>
            <ModalHeader
                title={isEdit ? `Editar Romaneio ${rom?.numero || ''}` : 'Novo Romaneio'}
                icon="FileText"
                onClose={onClose}
            />

            <div className="p-5 space-y-5 overflow-y-auto flex-1">

                {/* ── Bloco 1: Identificação ── */}
                <div className="p-4 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                    <p className="text-xs font-semibold text-blue-700 mb-3">🚛 Identificação do Romaneio</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {isEdit && (
                            <Field label="Status">
                                <PrettySelect value={form.status} onChange={e => set('status', e.target.value)}
                                    className={inputCls} style={inputStyle}>
                                    {STATUS_ROMANEIO.map(s => <option key={s} value={s}>{s}</option>)}
                                </PrettySelect>
                            </Field>
                        )}
                        <Field label="Placa do Veículo" required>
                            <PrettySelect value={form.veiculo_id} onChange={e => set('veiculo_id', e.target.value)}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione a placa...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Motorista">
                            <div className="flex items-center gap-2 mb-2">
                                <button type="button" onClick={() => set('vincularMotorista', true)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                    style={form.vincularMotorista !== false
                                        ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                                        : { backgroundColor: '#fff', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}>
                                    Vincular a um motorista
                                </button>
                                <button type="button" onClick={() => { set('vincularMotorista', false); set('motorista_id', ''); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                    style={form.vincularMotorista === false
                                        ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                                        : { backgroundColor: '#fff', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}>
                                    Sem motorista (só a carga)
                                </button>
                            </div>
                            {form.vincularMotorista !== false && (
                                <PrettySelect value={form.motorista_id} onChange={e => set('motorista_id', e.target.value)}
                                    className={inputCls} style={inputStyle}>
                                    <option value="">Selecione o motorista...</option>
                                    {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </PrettySelect>
                            )}
                        </Field>
                        <Field label="Destino de Entrega" required>
                            <DestinoSelect
                                value={form.destino}
                                onChange={v => set('destino', v)}
                                fretes={fretesFretas}
                            />
                        </Field>
                        <Field label="Empresa">
                            <PrettySelect value={form.empresa} onChange={e => set('empresa', e.target.value)}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {empresas.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Data de Saída">
                            <input type="date" value={form.data_saida} onChange={e => set('data_saida', e.target.value)}
                                className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Data de Chegada (prevista)">
                            <input type="date" value={form.data_chegada} onChange={e => set('data_chegada', e.target.value)}
                                className={inputCls} style={inputStyle} />
                        </Field>
                    </div>
                    <div className="mt-3">
                        <CidadesAdicionaisField
                            cidades={[...new Set((fretesFretas || []).map(f => f.cidade).filter(Boolean))]}
                            value={paradas}
                            onChange={setParadas}
                            label="Cidades adicionais desta viagem"
                        />
                    </div>
                </div>

                {/* ── Bloco 2: Frete total (padrão: soma automática dos pedidos; ou um modo fixo pro romaneio inteiro) ── */}
                <div className="p-4 rounded-xl border" style={{ borderColor: '#C4B5FD', backgroundColor: '#FAF5FF' }}>
                    <p className="text-xs font-semibold text-purple-700 mb-3">💰 Resumo do Frete</p>

                    <Field label="Modo de cálculo do frete">
                        <PrettySelect value={form.tipo_calculo_frete} onChange={e => set('tipo_calculo_frete', e.target.value)}
                            className={inputCls} style={inputStyle}>
                            {TIPOS_CALCULO_FRETE_ROMANEIO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </PrettySelect>
                    </Field>

                    {form.tipo_calculo_frete === 'percentual_fixo' && (
                        <div className="mt-3">
                            <Field label="Percentual fixo sobre o valor total da carga (%)">
                                <input type="number" min="0" step="0.01" value={form.percentual_frete_fixo}
                                    onChange={e => set('percentual_frete_fixo', e.target.value)}
                                    className={inputCls} style={inputStyle} placeholder="Ex: 5" />
                            </Field>
                        </div>
                    )}

                    {form.tipo_calculo_frete === 'valor_fixo' && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                            <Field label="Valor fixo do frete (R$)">
                                <input type="number" min="0" step="0.01" value={form.valor_frete}
                                    onChange={e => set('valor_frete', e.target.value)}
                                    className={inputCls} style={inputStyle} placeholder="Ex: 1200" />
                            </Field>
                            <Field label="Combinado com">
                                <PrettySelect value={form.frete_fixo_responsavel} onChange={e => set('frete_fixo_responsavel', e.target.value)}
                                    className={inputCls} style={inputStyle}>
                                    <option value="">Selecione o responsável...</option>
                                    {adminsFrete.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                                    {/* Mantém o valor salvo visível mesmo se o admin não estiver mais na lista (ex.: desativado depois) */}
                                    {form.frete_fixo_responsavel && !adminsFrete.some(a => a.name === form.frete_fixo_responsavel) && (
                                        <option value={form.frete_fixo_responsavel}>{form.frete_fixo_responsavel}</option>
                                    )}
                                </PrettySelect>
                            </Field>
                            <Field label="Data combinada">
                                <input type="date" value={form.frete_fixo_combinado_em}
                                    onChange={e => set('frete_fixo_combinado_em', e.target.value)}
                                    className={inputCls} style={inputStyle} />
                            </Field>
                        </div>
                    )}

                    <div className="mt-3 p-3 rounded-xl bg-purple-600 text-white flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <span className="text-sm font-medium block">Valor da carga: {BRL(totaisPedidos.valorCarga)}</span>
                            <span className="text-xs opacity-80">
                                {form.tipo_calculo_frete === 'percentual_pedido'
                                    ? `${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} — cada um com seu percentual de frete`
                                    : TIPOS_CALCULO_FRETE_ROMANEIO.find(t => t.value === form.tipo_calculo_frete)?.label}
                            </span>
                        </div>
                        <span className="text-lg font-bold font-data">{BRL(totaisPedidos.frete)} de frete</span>
                    </div>
                    {totaisPedidos.pesoItens > 0 && (
                        <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                            <p className="text-xs text-emerald-700 font-medium">
                                ⚖️ Peso total dos itens: <strong>{totaisPedidos.pesoItens.toLocaleString('pt-BR')} kg</strong>
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Bloco 3: Pedidos do Romaneio (cliente, vendedor, frete e materiais de cada um) ── */}
                <div>
                    {form.tipo_calculo_frete !== 'percentual_pedido' && (
                        <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                            <p className="text-xs text-amber-700">
                                ℹ️ O frete deste romaneio está no modo "{TIPOS_CALCULO_FRETE_ROMANEIO.find(t => t.value === form.tipo_calculo_frete)?.label}".
                                O percentual de cada pedido abaixo continua sendo salvo (útil pra relatórios por categoria), mas não é somado no frete total do romaneio.
                            </p>
                        </div>
                    )}
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            📦 Pedidos do Romaneio
                            {pedidos.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                    {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </p>
                        <button onClick={addPedido}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-300 text-purple-700 hover:bg-purple-50 transition-colors">
                            <Icon name="Plus" size={13} /> Adicionar Pedido
                        </button>
                    </div>
                    {pedidos.length === 0 ? (
                        <div className="text-center py-8 rounded-xl border-2 border-dashed cursor-pointer hover:bg-gray-50 transition-colors"
                            style={{ borderColor: 'var(--color-border)' }} onClick={addPedido}>
                            <Icon name="Package" size={28} color="var(--color-muted-foreground)" className="mx-auto" />
                            <p className="text-sm mt-2" style={{ color: 'var(--color-muted-foreground)' }}>Clique para adicionar o primeiro pedido</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pedidos.map((pedido, idx) => (
                                <PedidoCardCarretas key={idx} pedido={pedido} index={idx} materiais={materiais} empresas={empresas}
                                    onUpdate={updatePedido} onRemove={removePedido}
                                    defaultAberto={pedido._novo} />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Observações ── */}
                <Field label="Observações">
                    <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
                        className={inputCls} style={inputStyle} rows={3}
                        placeholder="Observações gerais sobre o romaneio..." />
                </Field>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0"
                style={{ borderColor: 'var(--color-border)' }}>
                <button onClick={onClose}
                    className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border)' }}>
                    Cancelar
                </button>
                <Button onClick={handleSave} size="sm" iconName={saving ? 'Loader' : 'Check'} disabled={saving}>
                    {saving ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar Romaneio')}
                </Button>
            </div>
            <Toast toast={toast} />
        </ModalOverlay>
    );
}
