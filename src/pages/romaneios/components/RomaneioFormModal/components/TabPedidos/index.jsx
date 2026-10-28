import React from 'react';

import { AppIcon as Icon, PrettySelect } from 'components';
import { calcularFretePedidoMulti, getCategoriaConfig, fmtPct, FRETE_CATEGORIAS } from 'config/freteConfig';

import { n, brl } from '../../utils/helpers';

export const EMPRESAS = [
    { value: 'Comercial Araguaia', label: 'Comercial Araguaia', color: '#1E3A5F', bg: '#DBEAFE' },
    { value: 'Aços Confiance',     label: 'Aços Confiance',     color: '#065F46', bg: '#D1FAE5' },
    { value: 'Confiance',          label: 'Confiance',          color: '#92400E', bg: '#FEF3C7' },
];

// ─── tab === 'pedidos' ───
export default function TabPedidos({ addCategoriaExtra, addItemToPedido, addPedido, expandedPedido, loadingRefs, materials, novoItem, pedidos, removeCategoriaExtra, removeItemFromPedido, removePedido, setExpanded, setNovoItem, setPedidos, totais, updateCategoriaExtra, updatePedidoField }) {
    return (
        <div className="flex flex-col gap-4">
                            {pedidos.length === 0 && (
                                <div className="flex flex-col items-center text-center py-8 rounded-xl border-2 border-dashed" style={{ borderColor:'var(--color-border)' }}>
                                    <Icon name="ShoppingCart" size={36} color="var(--color-muted-foreground)" />
                                    <p className="text-sm mt-2 font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                        Nenhum pedido adicionado
                                    </p>
                                    <p className="text-xs mt-1 font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                        Adicione pedidos para calcular o frete automaticamente
                                    </p>
                                </div>
                            )}

                            {pedidos.map((pedido, pIdx) => {
                                const freteMulti = calcularFretePedidoMulti(pedido);
                                const pedidoFrete = freteMulti.total;
                                const temExtras = (pedido.categorias_extra || []).some(e => n(e.valor) > 0);
                                const cfg = getCategoriaConfig(pedido.categoria_frete);
                                const isExpanded = expandedPedido === pIdx;
                                const pesoPedido = pedido.itens.reduce((a, i) => a + n(i.peso_total), 0);
                                return (
                                    <div key={pIdx} className="rounded-xl border overflow-hidden"
                                        style={{ borderColor: isExpanded ? cfg.cor : 'var(--color-border)' }}>
                                        {/* Pedido header */}
                                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                                            style={{ backgroundColor: isExpanded ? cfg.bg : 'var(--color-muted)' }}
                                            onClick={() => setExpanded(isExpanded ? null : pIdx)}>
                                            <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
                                                style={{ backgroundColor: cfg.cor }}>
                                                {pIdx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-medium font-caption" style={{ color:'var(--color-text-primary)' }}>
                                                        {pedido.numero_pedido ? `Pedido ${pedido.numero_pedido}` : `Pedido ${pIdx + 1}`}
                                                    </span>
                                                    {(() => {
                                                        const emp = EMPRESAS.find(e => e.value === pedido.empresa);
                                                        return emp ? (
                                                            <span className="text-xs px-2 py-0.5 rounded-full font-caption font-semibold"
                                                                style={{ backgroundColor: emp.bg, color: emp.color }}>
                                                                {emp.label}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                    <span className="text-xs px-2 py-0.5 rounded-full font-caption"
                                                        style={{ backgroundColor: cfg.bg, color: cfg.cor }}>
                                                        {pedido.categoria_frete}
                                                    </span>
                                                    <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                                        {pedido.itens.length} item(s) · {pesoPedido.toLocaleString('pt-BR', { maximumFractionDigits:0 })} kg
                                                    </span>
                                                    {pedido.nome_cliente && (
                                                        <span className="text-xs font-caption truncate" style={{ color:'var(--color-text-secondary)' }}>
                                                            Cliente: {pedido.nome_cliente}
                                                        </span>
                                                    )}
                                                    {pedido.observacao && (
                                                        <span className="text-xs font-caption truncate flex items-center gap-1" style={{ color:'#B45309' }} title={pedido.observacao}>
                                                            <Icon name="MessageSquare" size={11} /> {pedido.observacao}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="text-xs font-data" style={{ color:'var(--color-muted-foreground)' }}>
                                                        Valor: {brl(pedido.valor_pedido)}
                                                    </span>
                                                    <span className="text-xs font-data font-semibold" style={{ color: cfg.cor }}>
                                                        Frete: {brl(pedidoFrete)} ({temExtras ? `${fmtPct(freteMulti.percentualEfetivo)} médio` : fmtPct(FRETE_CATEGORIAS.find(f=>f.categoria===pedido.categoria_frete)?.percentual||0)})
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button onClick={e => { e.stopPropagation(); removePedido(pIdx); }}
                                                    className="p-1.5 rounded-lg hover:bg-red-100 transition-colors">
                                                    <Icon name="Trash2" size={16} color="#DC2626" />
                                                </button>
                                                <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} color="var(--color-muted-foreground)" />
                                            </div>
                                        </div>

                                        {/* Pedido body */}
                                        {isExpanded && (
                                            <div className="px-4 py-4 flex flex-col gap-4 border-t" style={{ borderColor:'var(--color-border)' }}>
                                                {/* Fields row */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-caption mb-1" style={{ color:'var(--color-text-secondary)' }}>Nº do Pedido</label>
                                                        <input value={pedido.numero_pedido}
                                                            onChange={e => updatePedidoField(pIdx,'numero_pedido',e.target.value)}
                                                            placeholder="Ex: 37443"
                                                            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white font-data" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-caption mb-1" style={{ color:'var(--color-text-secondary)' }}>Cidade de Destino</label>
                                                        <input value={pedido.cidade_destino}
                                                            onChange={e => updatePedidoField(pIdx,'cidade_destino',e.target.value)}
                                                            placeholder="Ex: Paratinga"
                                                            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white font-data" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-caption mb-1" style={{ color:'var(--color-text-secondary)' }}>Cliente</label>
                                                        <input value={pedido.nome_cliente}
                                                            onChange={e => updatePedidoField(pIdx,'nome_cliente',e.target.value)}
                                                            placeholder="Nome do cliente"
                                                            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white font-data" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-caption mb-1" style={{ color:'var(--color-text-secondary)' }}>Vendedor</label>
                                                        <input value={pedido.nome_vendedor}
                                                            onChange={e => updatePedidoField(pIdx,'nome_vendedor',e.target.value)}
                                                            placeholder="Nome do vendedor"
                                                            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white font-data" />
                                                    </div>
                                                    {/* Empresa — seleção visual por botões */}
                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-caption mb-1.5" style={{ color:'var(--color-text-secondary)' }}>Empresa</label>
                                                        <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                                                            {EMPRESAS.map(emp => (
                                                                <button key={emp.value} type="button"
                                                                    onClick={() => updatePedidoField(pIdx, 'empresa', emp.value)}
                                                                    className="w-full py-2.5 rounded-lg text-xs font-semibold font-caption border-2 transition-all text-center"
                                                                    style={{
                                                                        borderColor: pedido.empresa === emp.value ? emp.color : '#E5E7EB',
                                                                        backgroundColor: pedido.empresa === emp.value ? emp.bg : 'white',
                                                                        color: pedido.empresa === emp.value ? emp.color : '#9CA3AF',
                                                                        minHeight: '44px',
                                                                    }}>
                                                                    {emp.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-caption mb-1" style={{ color:'var(--color-text-secondary)' }}>Valor do Pedido (R$)</label>
                                                        <input type="number" min="0" step="0.01" value={pedido.valor_pedido}
                                                            onChange={e => updatePedidoField(pIdx,'valor_pedido',e.target.value)}
                                                            placeholder="0,00"
                                                            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white font-data" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-caption mb-1" style={{ color:'var(--color-text-secondary)' }}>Categoria de Frete</label>
                                                        <PrettySelect value={pedido.categoria_frete}
                                                            onChange={e => updatePedidoField(pIdx,'categoria_frete',e.target.value)}
                                                            className="w-full h-9 px-2 rounded-lg border border-gray-200 text-xs bg-white">
                                                            {FRETE_CATEGORIAS.map(f => (
                                                                <option key={f.categoria} value={f.categoria}>{f.label} – {fmtPct(f.percentual)}</option>
                                                            ))}
                                                        </PrettySelect>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-caption mb-1" style={{ color:'var(--color-text-secondary)' }}>Observação do pedido</label>
                                                        <textarea value={pedido.observacao || ''}
                                                            onChange={e => updatePedidoField(pIdx,'observacao',e.target.value)}
                                                            rows={2} placeholder="Alguma observação sobre este pedido específico..."
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white font-data resize-none" />
                                                    </div>
                                                </div>

                                                {/* Categorias extras — quando o pedido mistura materiais de mais de uma
                                                    categoria de frete, cada uma com seu próprio percentual */}
                                                <div className="rounded-lg border p-3" style={{ borderColor:'#E5E7EB', backgroundColor:'#F9FAFB' }}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-xs font-medium font-caption" style={{ color:'var(--color-text-primary)' }}>
                                                            Outras categorias neste pedido
                                                        </label>
                                                        <button type="button" onClick={() => addCategoriaExtra(pIdx)}
                                                            className="flex items-center gap-1 text-xs font-semibold font-caption px-2 py-1 rounded-lg hover:bg-blue-50"
                                                            style={{ color: 'var(--color-primary)' }}>
                                                            <Icon name="Plus" size={12} /> Adicionar categoria
                                                        </button>
                                                    </div>
                                                    {(pedido.categorias_extra || []).length === 0 ? (
                                                        <p className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                                            Use isso quando o pedido tiver materiais de mais de uma categoria (ex: Telha 2% + Vergalhão 6% no mesmo pedido).
                                                        </p>
                                                    ) : (
                                                        <div className="flex flex-col gap-2">
                                                            <p className="text-[11px] font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                                                A categoria principal acima ({pedido.categoria_frete}) passa a valer sobre o restante do valor do pedido: {brl(freteMulti.valorPrincipal)}.
                                                            </p>
                                                            {pedido.categorias_extra.map((extra, eIdx) => (
                                                                <div key={eIdx} className="flex items-center gap-2">
                                                                    <PrettySelect value={extra.categoria}
                                                                        onChange={e => updateCategoriaExtra(pIdx, eIdx, 'categoria', e.target.value)}
                                                                        className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs bg-white">
                                                                        {FRETE_CATEGORIAS.map(f => (
                                                                            <option key={f.categoria} value={f.categoria}>{f.label} – {fmtPct(f.percentual)}</option>
                                                                        ))}
                                                                    </PrettySelect>
                                                                    <input type="number" min="0" step="0.01" value={extra.valor}
                                                                        onChange={e => updateCategoriaExtra(pIdx, eIdx, 'valor', e.target.value)}
                                                                        placeholder="Valor (R$)"
                                                                        className="w-32 h-9 px-3 rounded-lg border border-gray-200 text-xs bg-white font-data" />
                                                                    <button type="button" onClick={() => removeCategoriaExtra(pIdx, eIdx)}
                                                                        className="p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                                                                        <Icon name="X" size={14} color="#DC2626" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            {freteMulti.valorExtras > n(pedido.valor_pedido) && (
                                                                <p className="text-xs font-caption text-red-600 flex items-center gap-1">
                                                                    <Icon name="AlertTriangle" size={12} />
                                                                    A soma das categorias extras ultrapassa o valor do pedido.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Add material to pedido */}
                                                <div>
                                                    <label className="block text-xs font-caption mb-1.5" style={{ color:'var(--color-text-secondary)' }}>
                                                        Adicionar material a este pedido
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <PrettySelect value={novoItem.material_id}
                                                            onChange={e => setNovoItem(p => ({...p, material_id:e.target.value}))}
                                                            disabled={loadingRefs}
                                                            className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-xs bg-white disabled:opacity-60">
                                                            <option value="">{loadingRefs ? '⏳ Carregando materiais...' : materials.length === 0 ? 'Nenhum material cadastrado' : 'Selecionar material...'}</option>
                                                            {materials.map(m => (
                                                                <option key={m.id} value={m.id}>{m.nome} ({m.unidade})</option>
                                                            ))}
                                                        </PrettySelect>
                                                        {/* Campo comprimento só aparece se material for telha */}
                                                        {(() => {
                                                            const selMat = materials.find(m => String(m.id) === String(novoItem.material_id));
                                                            return selMat?.is_telha_zinco ? (
                                                                <input type="number" min="0.5" step="0.5" value={novoItem.comprimento_telha}
                                                                    onChange={e => setNovoItem(p => ({...p, comprimento_telha: e.target.value}))}
                                                                    placeholder="Comp. (m)"
                                                                    title="Comprimento de cada telha em metros"
                                                                    className="w-24 h-9 px-2 rounded-lg border border-blue-300 text-sm font-data text-center bg-blue-50" />
                                                            ) : null;
                                                        })()}
                                                        <input type="number" min="0.001" step="0.001" value={novoItem.quantidade}
                                                            onChange={e => setNovoItem(p => ({...p, quantidade:e.target.value}))}
                                                            placeholder={(() => { const m = materials.find(m2 => String(m2.id) === String(novoItem.material_id)); return m?.is_telha_zinco ? 'Metros totais' : 'Qtd'; })()}
                                                            className="w-20 h-9 px-2 rounded-lg border border-gray-200 text-sm font-data text-center bg-white" />
                                                        <button onClick={() => addItemToPedido(pIdx)}
                                                            className="h-9 px-3 rounded-lg text-white text-xs font-medium flex items-center gap-1 transition-colors"
                                                            style={{ backgroundColor:'var(--color-primary)' }}>
                                                            <Icon name="Plus" size={13} color="#fff" />
                                                            Add
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Items table */}
                                                {pedido.itens.length > 0 && (
                                                    <div className="rounded-lg border overflow-hidden" style={{ borderColor:'var(--color-border)' }}>
                                                        <table className="w-full text-xs">
                                                            <thead style={{ backgroundColor:'var(--color-muted)', color:'var(--color-muted-foreground)' }}>
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left font-caption font-medium">Material</th>
                                                                    <th className="px-3 py-2 text-center font-caption font-medium">Qtd</th>
                                                                    <th className="px-3 py-2 text-right font-caption font-medium">Peso Total</th>
                                                                    <th className="px-3 py-2 w-8"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {pedido.itens.map((item, iIdx) => (
                                                                    <tr key={iIdx} className="border-t" style={{ borderColor:'var(--color-border)' }}>
                                                                        <td className="px-3 py-2 font-caption">
                                                                            {item.nome}
                                                                            {item.is_telha_zinco && item.comprimento_telha ? (
                                                                                <span className="block text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                                    peça {Number(item.comprimento_telha).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}m · total {Number(item.metros_totais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}m
                                                                                </span>
                                                                            ) : null}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-center">
                                                                            <input type="number" min="0.001" step="0.001" value={item.quantidade}
                                                                                onChange={e => {
                                                                                    const qty = Number(e.target.value)||0;
                                                                                    setPedidos(prev => prev.map((p, pi) =>
                                                                                        pi !== pIdx ? p : {
                                                                                            ...p, itens: p.itens.map((it, ii) =>
                                                                                                ii !== iIdx ? it : {
                                                                                                    ...it, quantidade:qty, peso_total:qty*it.peso_unit,
                                                                                                    metros_totais: it.is_telha_zinco ? qty * Number(it.comprimento_telha || 0) : it.metros_totais,
                                                                                                }
                                                                                            )
                                                                                        }
                                                                                    ));
                                                                                }}
                                                                                className="w-16 text-center px-2 py-1 rounded border border-gray-200 font-data focus:outline-none" />
                                                                            {item.is_telha_zinco && <span className="block text-[10px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>peças</span>}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right font-data">
                                                                            {n(item.peso_total).toLocaleString('pt-BR',{minimumFractionDigits:2})} kg
                                                                        </td>
                                                                        <td className="px-2 py-2">
                                                                            <button onClick={() => removeItemFromPedido(pIdx, iIdx)}
                                                                                className="p-1 rounded hover:bg-red-50">
                                                                                <Icon name="X" size={12} color="#DC2626" />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        <div className="px-3 py-2 border-t flex justify-between text-xs font-data font-semibold"
                                                            style={{ borderColor:'var(--color-border)', color:'var(--color-text-primary)' }}>
                                                            <span>Peso total</span>
                                                            <span>{pesoPedido.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <button onClick={addPedido}
                                className="w-full py-3 rounded-xl border-2 border-dashed text-sm font-caption flex items-center justify-center gap-2 transition-colors hover:bg-blue-50 hover:border-blue-400"
                                style={{ borderColor:'var(--color-border)', color:'var(--color-primary)' }}>
                                <Icon name="Plus" size={16} color="currentColor" />
                                Adicionar Pedido
                            </button>

                            {/* Resumo carga */}
                            {pedidos.length > 0 && (
                                <div className="rounded-xl border p-4" style={{ backgroundColor:'var(--color-muted)', borderColor:'var(--color-border)' }}>
                                    <p className="text-xs font-caption font-semibold mb-2" style={{ color:'var(--color-text-secondary)' }}>RESUMO DA CARGA</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            ['Pedidos',       String(pedidos.length),                                    'ShoppingCart'],
                                            ['Peso Total',    totais.pesoTotal.toLocaleString('pt-BR',{maximumFractionDigits:0})+' kg', 'Weight'],
                                            ['Valor da Carga',brl(totais.valorTotalCarga),                               'DollarSign'],
                                        ].map(([label, val, icon]) => (
                                            <div key={label} className="text-center">
                                                <Icon name={icon} size={16} color="var(--color-primary)" className="mx-auto mb-1" />
                                                <p className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>{label}</p>
                                                <p className="text-sm font-data font-bold" style={{ color:'var(--color-text-primary)' }}>{val}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
    );
}
