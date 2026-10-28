import React, { useState, useEffect, useRef, } from 'react';
import { fetchVehicles } from 'services/vehicleService';
import { fetchMaterials } from 'services/materialService';
import { fetchMotoristas, fetchMotoristasComId, fetchDestinos } from 'services/romaneio';
import { fetchPostos } from 'services/carretas';
import { getTelhaInfo } from 'utils/telhaUtils';
import {  calcularFretePedidoMulti,   FRETE_CATEGORIAS } from 'config/freteConfig';
import { AppIcon as Icon, Button } from 'components';
import { n, brl } from './utils/helpers';
import { EMPTY_FORM, EMPTY_PEDIDO } from './utils/constants';
import TabDados from './components/TabDados';
import TabPedidos from './components/TabPedidos';
import TabFinanceiro from './components/TabFinanceiro';
import { useRomaneioRotaCusto, useRomaneioPedidos } from './hooks';

export default function RomaneioFormModal({ isOpen, onClose, onSave, editingRomaneio, vehicles: vehiclesProp=[], materials: materialsProp=[] }) {
    const [form, setForm]           = useState(EMPTY_FORM);
    const [pedidos, setPedidos]     = useState([]);
    const [tab, setTab]             = useState('dados');
    const [errors, setErrors]       = useState({});
    const [loading, setLoading]     = useState(false);
    const [motoristas, setMotoristas] = useState([]);
    const [motoristasComId, setMotoristasComId] = useState([]);
    const [destinos, setDestinos]   = useState([]);

    // Estado interno de vehicles/materials — usa props quando disponíveis,
    // mas busca do banco se as props chegarem vazias (Supabase acordando lento)
    const [vehicles, setVehicles]   = useState(vehiclesProp);
    const [materials, setMaterials] = useState(materialsProp);
    const [loadingRefs, setLoadingRefs] = useState(false);

    // Sincroniza props → estado interno quando props são atualizadas
    useEffect(() => { if (vehiclesProp.length > 0) setVehicles(vehiclesProp); }, [vehiclesProp]);
    useEffect(() => { if (materialsProp.length > 0) setMaterials(materialsProp); }, [materialsProp]);

    // Quando modal abre e props chegaram vazias, busca diretamente do banco
    useEffect(() => {
        if (!isOpen) return;
        const precisaBuscar = vehiclesProp.length === 0 || materialsProp.length === 0;
        if (!precisaBuscar) return;
        setLoadingRefs(true);
        Promise.all([
            vehiclesProp.length === 0 ? fetchVehicles() : Promise.resolve(vehiclesProp),
            materialsProp.length === 0 ? fetchMaterials() : Promise.resolve(materialsProp),
        ]).then(([veh, mat]) => {
            setVehicles(veh);
            setMaterials(mat);
        }).catch(err => {
            console.warn('Modal: erro ao buscar veículos/materiais:', err.message);
        }).finally(() => setLoadingRefs(false));
    }, [isOpen]); const { setNovoPedido, novoItem, setNovoItem, expandedPedido, setExpanded, addItemToPedido, removeItemFromPedido, addPedido, removePedido, updatePedidoField, addCategoriaExtra, updateCategoriaExtra, removeCategoriaExtra, totais } = useRomaneioPedidos({ form, materials, pedidos, setPedidos });
    // Guard: rastreia o id do romaneio já carregado — evita re-população por Realtime
    const loadedRomaneioIdRef = useRef(null);
    
     // índice do pedido expandido
    const [paradas, setParadas]         = useState([]);   const { rotaInfo, setRotaInfo, calcRota, custoStatus, setCustoStatus, postos, setPostos, postoSelecionado, setPostoSelecionado, precoDiesel, setPrecoDiesel, usarPedagio, setUsarPedagio, pedagioPor100km, setPedagioPor100km, freteBreakdown, getMapsUrl, calcularRotaIA } = useRomaneioRotaCusto({ form, paradas, pedidos, setForm, vehicles }); 
                               // R$/100km configurável

    useEffect(() => {
        fetchMotoristas().then(setMotoristas);
        fetchMotoristasComId().then(setMotoristasComId);
        fetchDestinos().then(setDestinos);
        fetchPostos().then(p => setPostos(p)).catch(() => {});
    }, []);

    useEffect(() => {
        if (!isOpen) {
            loadedRomaneioIdRef.current = null;
            return;
        }
        // Guard: usa id|numero como chave — evita re-população por Realtime durante save
        // Mas permite re-popular quando romaneio muda de verdade (ex: promoção de rascunho
        // muda o número de RASC-xxx para ROM-001, então o guard libera corretamente)
        const incomingKey = `${editingRomaneio?.id ?? '__new__'}|${editingRomaneio?.numero ?? ''}`;
        if (loadedRomaneioIdRef.current === incomingKey) return;
        loadedRomaneioIdRef.current = incomingKey;

        // Configuração de rota/combustível salva no romaneio (posto, diesel, pedágio, resultado da rota)
        let cfg = editingRomaneio?.rota_config;
        if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = null; } }
        cfg = cfg && typeof cfg === 'object' ? cfg : null;

        if (editingRomaneio) {
            setForm({
                motorista:         editingRomaneio.motorista         || '',
                motorista_id:      editingRomaneio.motorista_id      || '',
                placa:             editingRomaneio.placa             || '',
                destino:           editingRomaneio.destino           || '',
                status:            editingRomaneio.status            || 'Aguardando',
                saida:             editingRomaneio.saida ? (() => {
                    // Converte UTC do banco para horário local (Brasília UTC-3) para exibir corretamente no input
                    const d = new Date(editingRomaneio.saida);
                    const offset = d.getTimezoneOffset(); // minutos de diferença
                    const local = new Date(d.getTime() - offset * 60000);
                    return local.toISOString().slice(0, 16);
                })() : '',
                chegada:           editingRomaneio.chegada ? (() => {
                    const d = new Date(editingRomaneio.chegada);
                    const offset = d.getTimezoneOffset();
                    const local = new Date(d.getTime() - offset * 60000);
                    return local.toISOString().slice(0, 16);
                })() : '',
                observacoes:       editingRomaneio.observacoes       || '',
                vehicle_id:        editingRomaneio.vehicle_id        || '',
                distancia_km:      editingRomaneio.distancia_km      || '',
                custo_combustivel: editingRomaneio.custo_combustivel || '',
                custo_pedagio:     editingRomaneio.custo_pedagio     || '',
                custo_motorista:   editingRomaneio.custo_motorista   || '',
                dias_diaria:       editingRomaneio.dias_diaria || '1',
                valor_diaria_dia:  editingRomaneio.valor_diaria_dia || editingRomaneio.custo_motorista || '',
                diaria_descricao:  editingRomaneio.diaria_descricao || '',
                diaria_mes_referencia: editingRomaneio.diaria_mes_referencia || '',
                _litros_estimados: cfg?.litros_estimados || 0,
            });
            // Rebuild pedidos from romaneio_pedidos if editing
            const pedidosExistentes = editingRomaneio.romaneio_pedidos || [];
            if (pedidosExistentes.length > 0) {
                // Deduplicar pedidos: por id E por conteúdo (numero_pedido + valor_pedido + cidade_destino)
                // Pedidos antigos podem ter ids diferentes mas serem duplicatas reais
                // (criados por um bug anterior que inseria 2x ao salvar)
                const seenIds = new Set();
                const seenContent = new Set();
                const pedidosUnicos = pedidosExistentes.filter(p => {
                    if (p.id) {
                        if (seenIds.has(p.id)) return false;
                        seenIds.add(p.id);
                    }
                    const contentKey = `${(p.numero_pedido || '').trim()}|${p.valor_pedido}|${(p.cidade_destino || '').trim().toLowerCase()}`;
                    if (contentKey !== '||' && seenContent.has(contentKey)) return false;
                    seenContent.add(contentKey);
                    return true;
                });
                const todosItens = editingRomaneio.romaneio_itens || [];
                const itensVinculados = new Set();
                const pedidosMapped = pedidosUnicos.map(p => {
                    const itensDoPedido = todosItens
                        .filter(i => i.pedido_id === p.id)
                        .map(i => {
                            itensVinculados.add(i.id);
                            const { isTelha, compTelha, metros } = getTelhaInfo(i);
                            return {
                                material_id: i.material_id, quantidade: i.quantidade,
                                peso_total: i.peso_total,
                                nome: i.materials?.nome || '', unidade: i.materials?.unidade || '',
                                peso_unit: i.peso_unit || (i.quantidade ? i.peso_total / i.quantidade : 0) || i.materials?.peso || 0,
                                is_telha_zinco: isTelha, comprimento_telha: compTelha || null, metros_totais: metros || null,
                            };
                        });
                    return {
                        id: p.id,
                        numero_pedido:   p.numero_pedido,
                        cidade_destino:  p.cidade_destino || '',
                        valor_pedido:    String(p.valor_pedido || ''),
                        categoria_frete: p.categoria_frete || 'Ferragens',
                        categorias_extra: Array.isArray(p.categorias_extra) ? p.categorias_extra : [],
                        empresa:         p.empresa || 'Comercial Araguaia',
                        nome_cliente:    p.nome_cliente || '',
                        nome_vendedor:   p.nome_vendedor || '',
                        observacao:      p.observacao || '',
                        itens: itensDoPedido,
                    };
                });
                // Itens órfãos (sem pedido_id válido): adicionar ao primeiro pedido
                const itensOrfaos = todosItens
                    .filter(i => !itensVinculados.has(i.id))
                    .map(i => {
                        const { isTelha, compTelha, metros } = getTelhaInfo(i);
                        return {
                            material_id: i.material_id, quantidade: i.quantidade,
                            peso_total: i.peso_total,
                            nome: i.materials?.nome || '', unidade: i.materials?.unidade || '',
                            peso_unit: i.peso_unit || (i.quantidade ? i.peso_total / i.quantidade : 0) || i.materials?.peso || 0,
                            is_telha_zinco: isTelha, comprimento_telha: compTelha || null, metros_totais: metros || null,
                        };
                    });
                if (itensOrfaos.length > 0 && pedidosMapped.length > 0) {
                    pedidosMapped[0].itens = [...pedidosMapped[0].itens, ...itensOrfaos];
                }
                setPedidos(pedidosMapped);
            } else {
                // Legacy: no pedidos — show items as one default pedido
                const itensHerdados = (editingRomaneio.romaneio_itens || []).map(i => {
                    const { isTelha, compTelha, metros } = getTelhaInfo(i);
                    return {
                        material_id: i.material_id, quantidade: i.quantidade, peso_total: i.peso_total,
                        nome: i.materials?.nome || '', unidade: i.materials?.unidade || '',
                        peso_unit: i.peso_unit || (i.quantidade ? i.peso_total / i.quantidade : 0) || i.materials?.peso || 0,
                        is_telha_zinco: isTelha, comprimento_telha: compTelha || null, metros_totais: metros || null,
                    };
                });
                setPedidos(itensHerdados.length > 0 ? [{
                    numero_pedido:'', valor_pedido:'', categoria_frete:'Ferragens',
                    nome_cliente:'', nome_vendedor:'', itens: itensHerdados
                }] : []);
            }
            // Restaura as paradas intermediárias salvas (campo "paradas" vem como
            // texto JSON do banco). Sem isso, o formulário sempre abria com a
            // lista vazia e, ao salvar, sobrescrevia o banco só com as paradas
            // adicionadas naquela sessão de edição — apagando as demais.
            let paradasCarregadas = [];
            try {
                const raw = editingRomaneio.paradas;
                paradasCarregadas = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
                if (!Array.isArray(paradasCarregadas)) paradasCarregadas = [];
            } catch { paradasCarregadas = []; }
            setParadas(paradasCarregadas);
        } else {
            setForm(EMPTY_FORM);
            setPedidos([]);
            setParadas([]);
        }
        setNovoPedido(EMPTY_PEDIDO);
        setNovoItem({ material_id:'', quantidade:1, comprimento_telha:'' });
        setErrors({});
        setTab('dados');
        setExpanded(null);
        // Restaura o que foi calculado/escolhido antes (ou usa os padrões num romaneio novo)
        setRotaInfo(cfg?.rota_info || null);
        setCustoStatus(Array.isArray(cfg?.custo_status) ? cfg.custo_status : null);
        setPostoSelecionado(cfg?.posto_id ? String(cfg.posto_id) : '');
        setPrecoDiesel(cfg?.preco_diesel != null ? String(cfg.preco_diesel) : '6.50');
        setUsarPedagio(cfg?.usar_pedagio ?? true);
        setPedagioPor100km(cfg?.pedagio_por_100km != null ? String(cfg.pedagio_por_100km) : '8.00');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, editingRomaneio?.id]);

    
    const setF = (k, v) => {
        setForm(prev => {
            const next = { ...prev, [k]: v };
            if (k === 'vehicle_id') {
                const veh = vehicles.find(v2 => String(v2.id) === v);
                if (veh) next.placa = veh.placa;
            }
            // Recalcular litros e custo combustível ao mudar veículo ou distância
            if (k === 'vehicle_id' || k === 'distancia_km') {
                const vid  = k === 'vehicle_id'  ? v : prev.vehicle_id;
                const dist = k === 'distancia_km' ? v : prev.distancia_km;
                const veh  = vehicles.find(vx => String(vx.id) === String(vid));
                const consumo = veh?.consumo_km ? Number(veh.consumo_km) : null;
                const distNum = Number(dist);
                if (consumo && consumo > 0 && distNum > 0) {
                    const litros  = distNum / consumo;
                    const diesel  = Number(precoDiesel) || 6.50;
                    next._litros_estimados = Math.round(litros);
                    next.custo_combustivel = (litros * diesel).toFixed(2);
                }
            }
            // Recalcular a diária do motorista (custo_motorista) automaticamente
            // a partir de "quantidade de dias" × "valor por dia"
            if (k === 'dias_diaria' || k === 'valor_diaria_dia') {
                const dias  = Number(k === 'dias_diaria'      ? v : prev.dias_diaria)      || 0;
                const valor = Number(k === 'valor_diaria_dia' ? v : prev.valor_diaria_dia) || 0;
                const total = dias * valor;
                next.custo_motorista = total ? String(total) : '';
            }
            return next;
        });
        setErrors(prev => ({ ...prev, [k]:'' }));
    };

    
    
    
    
    
    
    
    
    
    
    
    
    const validate = () => {
        const e = {};
        if (!form.motorista.trim()) e.motorista = 'Motorista é obrigatório';
        if (!form.destino.trim())   e.destino   = 'Destino é obrigatório';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) { setTab('dados'); return; }
        setLoading(true);
        // Timeout de segurança: libera o botão após 30s mesmo sem resposta do banco
        const safetyTimer = setTimeout(() => {
            setLoading(false);
        }, 30000);
        try {
            const allItens = pedidos.flatMap((p, pIdx) =>
                p.itens.map(i => ({
                    material_id:    i.material_id,
                    quantidade:     i.quantidade,
                    peso_total:     i.peso_total,
                    pedido_index:   pIdx,
                    is_telha_zinco:    i.is_telha_zinco || false,
                    comprimento_telha: i.comprimento_telha ?? null,
                    metros_totais:     i.metros_totais ?? null,
                    peso_unit:         i.peso_unit ?? null,
                }))
            );
            await onSave({
                ...form,
                peso_total:             totais.pesoTotal,
                vehicle_id:             form.vehicle_id || null,
                distancia_km:           n(form.distancia_km), // total ida+volta (o que está no campo)
                rota_config: {
                    km_total:          true,
                    posto_id:          postoSelecionado || null,
                    preco_diesel:      Number(precoDiesel) || null,
                    usar_pedagio:      usarPedagio,
                    pedagio_por_100km: Number(pedagioPor100km) || null,
                    litros_estimados:  form._litros_estimados || null,
                    rota_info:         rotaInfo && !rotaInfo.erro ? rotaInfo : null,
                    custo_status:      rotaInfo && !rotaInfo.erro ? (custoStatus || null) : null,
                },
                paradas:                JSON.stringify(paradas.filter(p => p && p.trim())),
                custo_combustivel:      n(form.custo_combustivel),
                custo_pedagio:          n(form.custo_pedagio),
                custo_motorista:        n(form.custo_motorista),
                dias_diaria:            n(form.dias_diaria) || null,
                valor_diaria_dia:       n(form.valor_diaria_dia) || null,
                diaria_descricao:       form.diaria_descricao || null,
                diaria_mes_referencia:  form.diaria_mes_referencia || null,
                valor_frete:            totais.freteCalculado,
                valor_frete_calculado:  totais.freteCalculado,
                valor_total_carga:      totais.valorTotalCarga,
                _pedidos: pedidos.map(p => ({
                    numero_pedido:   p.numero_pedido || '',
                    cidade_destino:  p.cidade_destino || '',
                    valor_pedido:    n(p.valor_pedido),
                    categoria_frete: p.categoria_frete || 'Outros',
                    categorias_extra: (p.categorias_extra || []).filter(e => n(e.valor) > 0).map(e => ({ categoria: e.categoria, valor: n(e.valor) })),
                    empresa:         p.empresa || 'Comercial Araguaia',
                    nome_cliente:    (p.nome_cliente || '').trim(),
                    nome_vendedor:   (p.nome_vendedor || '').trim(),
                    observacao:      (p.observacao || '').trim() || null,
                    percentual_frete: FRETE_CATEGORIAS.find(f => f.categoria === p.categoria_frete)?.percentual || 0.05,
                    frete_calculado: calcularFretePedidoMulti(p).total,
                })),
            }, allItens);
        } catch (err) {
            // Erro explícito — mostra mensagem e libera o botão
            alert('Erro ao salvar romaneio: ' + (err.message || 'Verifique sua conexão e tente novamente.'));
        } finally {
            clearTimeout(safetyTimer);
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0" style={{ borderColor:'var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width:36, height:36, backgroundColor:'var(--color-primary)' }}>
                            <Icon name="FileText" size={18} color="#fff" />
                        </div>
                        <div>
                            <h2 className="font-heading font-bold text-base sm:text-lg" style={{ color:'var(--color-text-primary)' }}>
                                {editingRomaneio ? 'Editar Romaneio' : 'Novo Romaneio'}
                            </h2>
                            <p className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                {editingRomaneio?.numero || 'Preencha os dados da viagem'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0">
                        <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                    </button>
                </div>

                {/* Tabs — scroll horizontal no mobile */}
                <div className="flex border-b overflow-x-auto flex-shrink-0" style={{ borderColor:'var(--color-border)', scrollbarWidth:'none' }}>
                    {[
                        ['dados',      'Viagem', 'Truck'],
                        ['pedidos',    `Pedidos (${pedidos.length})`, 'ShoppingCart'],
                        ['financeiro', 'Financeiro', 'DollarSign'],
                    ].map(([key, label, icon]) => (
                        <button key={key} onClick={() => setTab(key)}
                            className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium font-caption border-b-2 transition-colors whitespace-nowrap flex-shrink-0
                                ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <Icon name={icon} size={13} color="currentColor" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 min-h-0 px-4 sm:px-6 py-4 sm:py-5">

                    {/* ── TAB: DADOS ──────────────────────────────── */}
                    {tab === 'dados' && (
                        <TabDados
                    calcRota={calcRota}
                    calcularRotaIA={calcularRotaIA}
                    custoStatus={custoStatus}
                    destinos={destinos}
                    errors={errors}
                    form={form}
                    getMapsUrl={getMapsUrl}
                    loadingRefs={loadingRefs}
                    motoristasComId={motoristasComId}
                    paradas={paradas}
                    pedagioPor100km={pedagioPor100km}
                    postoSelecionado={postoSelecionado}
                    postos={postos}
                    precoDiesel={precoDiesel}
                    rotaInfo={rotaInfo}
                    setF={setF}
                    setForm={setForm}
                    setParadas={setParadas}
                    setPedagioPor100km={setPedagioPor100km}
                    setPostoSelecionado={setPostoSelecionado}
                    setPrecoDiesel={setPrecoDiesel}
                    setUsarPedagio={setUsarPedagio}
                    usarPedagio={usarPedagio}
                    vehicles={vehicles}
                />
                    )}

                    {/* ── TAB: PEDIDOS ────────────────────────────── */}
                    {tab === 'pedidos' && (
                        <TabPedidos
                    addCategoriaExtra={addCategoriaExtra}
                    addItemToPedido={addItemToPedido}
                    addPedido={addPedido}
                    expandedPedido={expandedPedido}
                    loadingRefs={loadingRefs}
                    materials={materials}
                    novoItem={novoItem}
                    pedidos={pedidos}
                    removeCategoriaExtra={removeCategoriaExtra}
                    removeItemFromPedido={removeItemFromPedido}
                    removePedido={removePedido}
                    setExpanded={setExpanded}
                    setNovoItem={setNovoItem}
                    setPedidos={setPedidos}
                    totais={totais}
                    updateCategoriaExtra={updateCategoriaExtra}
                    updatePedidoField={updatePedidoField}
                />
                    )}

                    {/* ── TAB: FINANCEIRO ─────────────────────────── */}
                    {tab === 'financeiro' && (
                        <TabFinanceiro
                    calcularRotaIA={calcularRotaIA}
                    form={form}
                    freteBreakdown={freteBreakdown}
                    rotaInfo={rotaInfo}
                    setF={setF}
                    totais={totais}
                    vehicles={vehicles}
                />
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-t flex flex-col xs:flex-row justify-between items-start xs:items-center gap-2 flex-shrink-0" style={{ borderColor:'var(--color-border)' }}>
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                            {pedidos.length} pedido(s) · {totais.pesoTotal.toLocaleString('pt-BR',{maximumFractionDigits:0})} kg
                        </span>
                        {totais.freteCalculado > 0 && (
                            <span className="text-xs font-data font-semibold text-green-600">
                                Frete: {brl(totais.freteCalculado)}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2 w-full xs:w-auto">
                        <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1 xs:flex-none">Cancelar</Button>
                        <Button variant="default" onClick={handleSubmit} loading={loading} iconName="Save" iconSize={15} className="flex-1 xs:flex-none">
                            {editingRomaneio ? 'Salvar' : 'Criar'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export { EMPRESAS } from './components/TabPedidos';
