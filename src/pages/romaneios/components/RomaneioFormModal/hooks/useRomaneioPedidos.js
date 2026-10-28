import { useState, useMemo } from 'react';
import { detectarCategoriaFrete, calcularFretePedidoMulti } from 'config/freteConfig';
import { n } from '../utils/helpers';
import { EMPTY_PEDIDO } from '../utils/constants';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRomaneioPedidos({ form, materials, pedidos, setPedidos }) {
// eslint-disable-line

    // Novo pedido sendo montado
    const [novoPedido, setNovoPedido]   = useState(EMPTY_PEDIDO);

const [novoItem, setNovoItem]       = useState({ material_id:'', quantidade:1, comprimento_telha:'' });

const [expandedPedido, setExpanded] = useState(null);

// ── Pedido helpers ──────────────────────────────────────────
    const addItemToPedido = (pedidoIdx) => {
        if (!novoItem.material_id) return;
        const mat = materials.find(m => String(m.id) === String(novoItem.material_id));
        if (!mat) return;

        const isTelha   = mat.is_telha_zinco;
        const qty       = Number(novoItem.quantidade) || 1;
        const compTelha = isTelha ? Number(novoItem.comprimento_telha) : null;

        // Bloqueia telha sem comprimento informado
        if (isTelha && (!compTelha || compTelha <= 0)) {
            alert('Informe o comprimento de cada telha (em metros) antes de adicionar.');
            return;
        }

        const pesoBase      = isTelha ? (Number(mat.peso_base_metro) || 3.80) : mat.peso;
        // qty para telha = metros totais; convertemos para nº de telhas
        const qtdTelhas     = isTelha ? Math.round(qty / compTelha) : qty;
        const pesoUnit      = isTelha ? pesoBase * compTelha : mat.peso;
        const pesoTotalItem = qtdTelhas * pesoUnit;

        setPedidos(prev => prev.map((p, i) => {
            if (i !== pedidoIdx) return p;
            const existing = p.itens.findIndex(it =>
                String(it.material_id) === String(mat.id) &&
                (!isTelha || Number(it.comprimento_telha) === compTelha)
            );
            if (existing >= 0) {
                // Merge: soma telhas calculadas (não metros) para manter unidade coerente
                const newItens = p.itens.map((it, j) => j !== existing ? it : {
                    ...it,
                    quantidade:  it.quantidade + qtdTelhas,
                    peso_total:  (it.quantidade + qtdTelhas) * it.peso_unit,
                    metros_totais: isTelha ? (it.metros_totais || 0) + qty : null,
                });
                return { ...p, itens: newItens };
            }
            const catFrete = mat.categoria_frete || detectarCategoriaFrete(mat.nome);
            return { ...p,
                categoria_frete: p.categoria_frete || catFrete,
                itens: [...p.itens, {
                    material_id:      mat.id,
                    quantidade:       isTelha ? qtdTelhas : qty,
                    peso_total:       pesoTotalItem,
                    nome:             mat.nome,
                    unidade:          mat.unidade,
                    peso_unit:        pesoUnit,
                    is_telha_zinco:   isTelha || false,
                    comprimento_telha: compTelha,
                    metros_totais:    isTelha ? qty : null,
                }],
            };
        }));
        setNovoItem({ material_id:'', quantidade:1, comprimento_telha:'' });
    };

const removeItemFromPedido = (pedidoIdx, itemIdx) => {
        setPedidos(prev => prev.map((p, i) =>
            i !== pedidoIdx ? p : { ...p, itens: p.itens.filter((_, j) => j !== itemIdx) }
        ));
    };

const addPedido = () => {
        setPedidos(prev => [...prev, { ...EMPTY_PEDIDO, itens:[] }]);
        setExpanded(pedidos.length);
    };

const removePedido = (idx) => {
        setPedidos(prev => prev.filter((_, i) => i !== idx));
        setExpanded(null);
    };

const updatePedidoField = (idx, k, v) => {
        setPedidos(prev => prev.map((p, i) => i !== idx ? p : { ...p, [k]: v }));
    };

// ── Categorias extras (mais de uma categoria de material por pedido) ──
    const addCategoriaExtra = (idx) => {
        setPedidos(prev => prev.map((p, i) => i !== idx ? p : {
            ...p,
            categorias_extra: [...(p.categorias_extra || []), { categoria: 'Outros', valor: '' }],
        }));
    };

const updateCategoriaExtra = (idx, extraIdx, k, v) => {
        setPedidos(prev => prev.map((p, i) => i !== idx ? p : {
            ...p,
            categorias_extra: (p.categorias_extra || []).map((e, j) => j !== extraIdx ? e : { ...e, [k]: v }),
        }));
    };

const removeCategoriaExtra = (idx, extraIdx) => {
        setPedidos(prev => prev.map((p, i) => i !== idx ? p : {
            ...p,
            categorias_extra: (p.categorias_extra || []).filter((_, j) => j !== extraIdx),
        }));
    };

// ── Totais calculados ──────────────────────────────────────
    const totais = useMemo(() => {
        const valorTotalCarga    = pedidos.reduce((a, p) => a + n(p.valor_pedido), 0);
        const freteCalculado     = pedidos.reduce((a, p) => a + calcularFretePedidoMulti(p).total, 0);
        const pesoTotal          = pedidos.flatMap(p => p.itens).reduce((a, i) => a + n(i.peso_total), 0);
        const totalItens         = pedidos.flatMap(p => p.itens).length;
        const custoOperacional   = n(form.custo_combustivel) + n(form.custo_pedagio) + n(form.custo_motorista);
        const margem             = freteCalculado - custoOperacional;
        return { valorTotalCarga, freteCalculado, pesoTotal, totalItens, custoOperacional, margem };
    }, [pedidos, form.custo_combustivel, form.custo_pedagio, form.custo_motorista]);

    return { setNovoPedido, novoItem, setNovoItem, expandedPedido, setExpanded, addItemToPedido, removeItemFromPedido, addPedido, removePedido, updatePedidoField, addCategoriaExtra, updateCategoriaExtra, removeCategoriaExtra, totais };
}
