import { useState, useMemo } from 'react';
import { calcularFretePedidoMulti, calcularFretePedido, getCategoriaConfig } from 'config/freteConfig';
import { n } from '../utils/helpers';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRomaneioRotaCusto({ form, paradas, pedidos, setForm, vehicles }) {
// cidades intermediárias
    const [rotaInfo, setRotaInfo]       = useState(null);

// resultado do cálculo de rota
    const [calcRota, setCalcRota]       = useState(false);



// loading custos IA (diesel + pedágio)
    const [custoStatus, setCustoStatus] = useState(null);

// mensagem sobre preenchimento dos custos
    const [postos, setPostos]           = useState([]);

// postos cadastrados pelo admin
    const [postoSelecionado, setPostoSelecionado] = useState('');

// posto selecionado para cálculo
    const [precoDiesel, setPrecoDiesel] = useState('6.50');

// R$/litro configurável pelo usuário
    const [usarPedagio, setUsarPedagio] = useState(true);

// toggle pedágio na rota
    const [pedagioPor100km, setPedagioPor100km] = useState('8.00');



// ── Breakdown do frete por categoria (considerando categorias extras) ──
    const freteBreakdown = useMemo(() => {
        const map = {};
        pedidos.forEach(p => {
            const { valorPrincipal, fretePrincipal } = calcularFretePedidoMulti(p);
            if (!map[p.categoria_frete]) map[p.categoria_frete] = { valor:0, pedidos:0 };
            map[p.categoria_frete].valor += fretePrincipal;
            map[p.categoria_frete].pedidos++;
            (p.categorias_extra || []).forEach(e => {
                if (!n(e.valor)) return;
                const freteExtra = calcularFretePedido(e.valor, e.categoria);
                if (!map[e.categoria]) map[e.categoria] = { valor:0, pedidos:0 };
                map[e.categoria].valor += freteExtra;
                map[e.categoria].pedidos += 0; // já contado no pedido principal, evita duplicar contagem de pedidos
            });
        });
        return Object.entries(map).map(([cat, d]) => ({ cat, ...d, cfg: getCategoriaConfig(cat) }));
    }, [pedidos]);

// ── Validação e submit ─────────────────────────────────────

    // Monta URL do Google Maps com todas as cidades
    const getMapsUrl = (origem, stops, destino) => {
        const cidades = [origem, ...stops, destino].filter(Boolean);
        return `https://www.google.com/maps/dir/${cidades.map(c => encodeURIComponent(c)).join('/')}`;
    };

// Chama a IA para estimar distância, preço do diesel e pedágios — tudo em uma requisição
    const calcularRotaIA = async () => {
        const cidadeOrigem = 'Guanambi, BA';
        const todasCidades = [cidadeOrigem, ...paradas, form.destino].filter(Boolean);
        if (todasCidades.length < 2) return;

        const veiculo = vehicles.find(v => String(v.id) === String(form.vehicle_id));
        const consumoKm = veiculo?.consumo_km ? Number(veiculo.consumo_km) : null;

        setCalcRota(true);
        setCustoStatus(null);
        try {
            // Chama a Edge Function do Supabase (evita CORS — chave API fica segura no servidor)
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/calcular-rota`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON}`,
                },
                body: JSON.stringify({
                    cidades: todasCidades,
                    consumoKm: consumoKm || null,
                    precoDiesel: Number(precoDiesel) || 6.50,
                    pedagioPor100km: usarPedagio ? (Number(pedagioPor100km) || 8.00) : 0,
                }),
            });

            if (!resp.ok) {
                const corpo = await resp.json().catch(() => null);
                throw new Error(corpo?.error || `HTTP ${resp.status}`);
            }
            const info = await resp.json();
            if (info.error) throw new Error(info.error);

            setRotaInfo(info);

            // Preenche distância
            const distKm = info.distanciaTotal; // distância de IDA
            const distIdaVolta = distKm ? distKm * 2 : null; // total ida + volta para cálculo de combustível
            const statusMsgs = [];
            const dieselUsado = Number(precoDiesel) || 6.50;

            // Atualiza distância + combustível + pedágio em um único setForm para evitar race condition
            setForm(prev => {
                const next = { ...prev };

                // Distância — campo guarda o TOTAL (ida+volta), o mesmo valor usado no combustível.
                // A distância só de ida continua em rotaInfo.distanciaTotal (card verde).
                if (distIdaVolta) next.distancia_km = String(distIdaVolta);

                // Combustível — calculado sobre IDA+VOLTA (caminhão retorna vazio)
                if (consumoKm && consumoKm > 0 && distIdaVolta) {
                    const litros = distIdaVolta / consumoKm;
                    next.custo_combustivel  = (litros * dieselUsado).toFixed(2);
                    next._litros_estimados  = Math.round(litros);
                }

                // Pedágio — só preenche se toggle estiver ativo (também ida+volta)
                if (usarPedagio && info.pedagioEstimado > 0) {
                    next.custo_pedagio = String((info.pedagioEstimado * 2).toFixed(2));
                } else {
                    next.custo_pedagio = '';
                }

                return next;
            });

            // Mensagens de status
            if (!consumoKm) {
                statusMsgs.push('Cadastre o consumo km/l do veículo para calcular o combustível automaticamente.');
            } else if (distIdaVolta && consumoKm > 0) {
                const litros = distIdaVolta / consumoKm;
                statusMsgs.push(`Diesel S10: R$ ${dieselUsado.toFixed(2)}/l · ${Math.round(litros)} litros (ida+volta) · R$ ${(litros * dieselUsado).toFixed(2)}`);
            }
            if (info.pedagioEstimado > 0) {
                statusMsgs.push(`Pedágios (${info.rodoviasPrincipais || 'rota'}): R$ ${(info.pedagioEstimado * 2).toFixed(2)} (ida+volta)`);
            } else {
                statusMsgs.push('Sem pedágios identificados na rota.');
            }

            setCustoStatus(statusMsgs);
        } catch (e) {
            // Erro na API: exibe mensagem e sugere preenchimento manual
            // Mostra a mensagem real devolvida pela função (inclui QUAL cidade falhou)
            const msgErro = e?.message || 'Erro ao calcular rota.';
            console.error('calcular-rota:', e);
            setRotaInfo({
                distanciaTotal: null,
                rota: todasCidades,
                tempoEstimado: null,
                observacao: msgErro + ' Verifique a rota no Google Maps e preencha a distância manualmente.',
                erro: true,
            });
            setCustoStatus(['Não foi possível buscar dados automáticos. Preencha os custos manualmente.']);
        } finally {
            setCalcRota(false);
        }
    };

    return { rotaInfo, setRotaInfo, calcRota, custoStatus, setCustoStatus, postos, setPostos, postoSelecionado, setPostoSelecionado, precoDiesel, setPrecoDiesel, usarPedagio, setUsarPedagio, pedagioPor100km, setPedagioPor100km, freteBreakdown, getMapsUrl, calcularRotaIA };
}
