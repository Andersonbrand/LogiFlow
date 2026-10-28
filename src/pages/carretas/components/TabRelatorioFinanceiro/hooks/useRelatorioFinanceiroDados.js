import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchEmpresas, fetchTodosMotoristas, fetchVeiculosProprios, fetchCarreteirosPropriosOnly, fetchCarregamentos, fetchAbastecimentos, fetchViagens, fetchDespesasExtras, fetchDiarias, fetchRomaneios, fetchBonificacoesExtras, calcularBonusCarreteiro } from 'services/carretas';
import { fetchDadosMargemFrete, calcularAbatimentoCustosFrota } from 'services/custosFrotaService';
import { fetchCaminhoesPlacas } from 'services/vehicleService';
import { somarDespesasPorVencimento, agruparDespesasPorCategoriaVencimento } from 'utils/despesasParcelasUtils';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRelatorioFinanceiroDados({ bonusConfig, captacaoConfig, showToast }) {
const hoje = new Date();

const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

const [periodoInicio, setPeriodoInicio] = useState(mesAtual);

const [periodoFim,    setPeriodoFim]    = useState(mesAtual);

const [empresa,       setEmpresa]       = useState('');

const [empresas,      setEmpresas]      = useState([]);

const [motoristas,    setMotoristas]    = useState([]);

const [veiculos,      setVeiculos]      = useState([]);

const [filtroPlaca,   setFiltroPlaca]   = useState('');

// item 7
    const [dados,         setDados]         = useState(null);

const [loading,       setLoading]       = useState(false);

useEffect(() => {
        (async () => {
            try {
                const [e, m, v] = await Promise.all([fetchEmpresas(), fetchTodosMotoristas(), fetchVeiculosProprios()]);
                setEmpresas(e); setMotoristas(m.filter(x => x && (x.tipo_veiculo === 'carreta' || x.role === 'carreteiro'))); setVeiculos(v);
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

            const filtros = { dataInicio, dataFim, is_terceiro: false };
            if (empresa) filtros.empresaId = empresa;

            // Busca IDs de carreteiros para filtrar as diárias — evita que diárias de
            // motoristas de caminhão sejam contabilizadas na DRE das carretas
            const carreteiros = await fetchCarreteirosPropriosOnly();
            const idsCarretas = carreteiros.map(x => x.id);
            const filtrosDiarias = { dataInicio, dataFim };
            if (idsCarretas.length > 0) filtrosDiarias.motoristasIds = idsCarretas;

            const [carregamentos, abastecimentosRaw, viagens, despesasExtras, diariasLancadas, romaneiosCarga, bonificacoesExtras, dadosMargem, camPlacasDre] = await Promise.all([
                fetchCarregamentos(filtros),
                fetchAbastecimentos({ dataInicio, dataFim, apenasCarretas: true }),
                fetchViagens({ dataInicio, dataFim }),
                fetchDespesasExtras({}),
                fetchDiarias(filtrosDiarias),
                fetchRomaneios({ dataInicio, dataFim }),
                fetchBonificacoesExtras({ dataInicio, dataFim }),
                fetchDadosMargemFrete('carreta').catch(() => null),
                fetchCaminhoesPlacas().catch(() => []),
            ]);
            const placasCaminhaoDre = new Set((camPlacasDre || []).map(c => (c.placa || '').toUpperCase().trim()));
            const abastecimentos = (abastecimentosRaw || []).filter(r => {
                const placa = (r.veiculo?.placa || r.veiculo_caminhao_placa || '').toUpperCase().trim();
                return !placa || !placasCaminhaoDre.has(placa);
            });

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

            // ── Custo de Rodagem estimado (abate a receita por veículo/destino) ──
            const fretesParaCusto = [
                ...carregamentos.map(c => ({ destino: c.destino, valor_frete: c.valor_frete_calculado, placa: c.veiculo?.placa })),
                ...romaneiosCarga.filter(r => r.status !== 'Cancelado').map(r => ({ destino: r.destino, valor_frete: r.valor_frete, placa: r.veiculo?.placa })),
            ];
            const abatimentoCustos = dadosMargem
                ? calcularAbatimentoCustosFrota(fretesParaCusto, dadosMargem)
                : { custoTotalEstimado: 0, porVeiculo: {}, semMatch: 0, totalFretes: fretesParaCusto.length };
            const custoRodagemEstimado = abatimentoCustos.custoTotalEstimado;

            // ── Despesas combustível ───────────────────────────────────────
            const valorDiesel        = abastecimentos.reduce((s, a) => s + Number(a.valor_diesel || 0), 0);
            const valorArla          = abastecimentos.reduce((s, a) => s + Number(a.valor_arla   || 0), 0);
            const despesaCombustivel = valorDiesel + valorArla;
            const litrosDiesel       = abastecimentos.reduce((s, a) => s + Number(a.litros_diesel || 0), 0);
            const litrosArla         = abastecimentos.reduce((s, a) => s + Number(a.litros_arla   || 0), 0);

            // ── Despesas extras por veículo ──────────────────────────────────
            // Abate pela data de VENCIMENTO de cada boleto/parcela, não pela
            // data de emissão da NF — uma despesa a prazo pode ter parcelas
            // vencendo em meses diferentes do lançamento.
            const totalDespesasExtras = somarDespesasPorVencimento(despesasExtras, dataInicio, dataFim);
            const despesasPorCategoria = agruparDespesasPorCategoriaVencimento(despesasExtras, dataInicio, dataFim);

            // ── Diárias lançadas ─────────────────────────────────────────────
            const totalDiariasLancadas = diariasLancadas.reduce((s, d) => s + Number(d.valor_total || 0), 0);

            // ── Bônus por motorista ────────────────────────────────────────
            const viagensFinalizadas = viagens.filter(v => v.status === 'Entrega finalizada');
            const bonusPorMotorista = {};

            // Bônus de viagens: calculado por carregamento (igual à aba Bonificações).
            // Exclui carregamentos avulsos de caminhão da frota (fora da frota de
            // carretas — ex: Montes Claros), que não geram bônus.
            carregamentos
                .filter(c => !(!c.veiculo_id && c.placa_terceiro))
                .forEach(c => {
                const id   = c.motorista_id || 'sem_id';
                const nome = c.motorista?.name || 'Sem motorista';
                if (!bonusPorMotorista[id]) bonusPorMotorista[id] = { nome, viagens: 0, bonusViagens: 0, bonusExtras: 0 };
                bonusPorMotorista[id].viagens++;
                bonusPorMotorista[id].bonusViagens += calcularBonusCarreteiro(c.destino, bonusConfig);
            });

            // Bônus extras registrados manualmente
            bonificacoesExtras.forEach(e => {
                const id   = e.motorista_id || 'sem_id';
                const nome = e.motorista?.name || 'Sem motorista';
                if (!bonusPorMotorista[id]) bonusPorMotorista[id] = { nome, viagens: 0, bonusViagens: 0, bonusExtras: 0 };
                bonusPorMotorista[id].bonusExtras += Number(e.valor || 0);
            });

            const bonusTotalViagens = Object.values(bonusPorMotorista).reduce((s, m) => s + m.bonusViagens, 0);
            const bonusTotalExtras  = Object.values(bonusPorMotorista).reduce((s, m) => s + m.bonusExtras, 0);
            const bonusTotal        = bonusTotalViagens + bonusTotalExtras;

            // ── Margens ───────────────────────────────────────────────────
            const despesaTotal  = despesaCombustivel + bonusTotal + totalDiariasLancadas + totalDespesasExtras + custoRodagemEstimado;
            const margemBruta   = receitaTotal - (despesaCombustivel + bonusTotal + totalDiariasLancadas); // receita − custos operacionais
            const margemLiquida = receitaTotal - despesaTotal;                // receita − combustível − bônus − diárias − despesas extras − custo de rodagem
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
                bonus:         (bonusPorMotorista[id]?.bonusViagens || 0) + (bonusPorMotorista[id]?.bonusExtras || 0),
                bonusViagens:  bonusPorMotorista[id]?.bonusViagens || 0,
                bonusExtras:   bonusPorMotorista[id]?.bonusExtras  || 0,
                carregamentos: fretePorMotorista[id]?.carregamentos || 0,
                frete:         fretePorMotorista[id]?.frete   || 0,
            })).sort((a, b) => b.frete - a.frete);

            // ── Captação x Distribuição (frete de cimento — frota própria) ─
            // Capta​ção = frete usado para buscar o cimento em MOC e trazer até o
            // Estoque (valor fixo por saco, configurável em Fretes > Fretes da Frota).
            // Distribuição = Receita de Carregamentos − Captação total do período.
            const totalSacosCarregamentos = carregamentos.reduce((s, c) => s + (Number(c.quantidade) || 0), 0);
            const valorCaptacaoTotal      = totalSacosCarregamentos * Number(captacaoConfig.valorPorSaco || 0);
            const valorDistribuicaoTotal  = Math.max(0, receitaCarregamentos - valorCaptacaoTotal);
            const percentualDistribuicao  = receitaCarregamentos > 0 ? (valorDistribuicaoTotal / receitaCarregamentos) * 100 : 0;

            setDados({
                periodo: `${periodoInicio === periodoFim ? periodoInicio : `${periodoInicio} a ${periodoFim}`}`,
                periodoDataInicio: dataInicio, periodoDataFim: dataFim,
                receitaTotal, receitaCarregamentos, receitaRomaneios,
                totalRomaneios: romaneiosCarga.filter(r => r.status !== 'Cancelado').length,
                receitaPorEmpresa,
                totalSacosCarregamentos, valorCaptacaoTotal, valorDistribuicaoTotal, percentualDistribuicao,
                valorCaptacaoPorSaco: Number(captacaoConfig.valorPorSaco || 0),
                _romaneios: romaneiosCarga,
                despesaCombustivel, litrosDiesel, litrosArla, valorDiesel, valorArla,
                bonusTotal, bonusTotalViagens, bonusTotalExtras, despesaTotal,
                margemBruta, margemLiquida, margemPct,
                consolidadoMotoristas,
                totalCarregamentos: carregamentos.length,
                totalViagens: viagens.length,
                viagensFinalizadas: viagensFinalizadas.length,
                totalDespesasExtras, despesasPorCategoria,
                totalDiariasLancadas,
                custoRodagemEstimado,
                custoRodagemPorVeiculo: abatimentoCustos.porVeiculo,
                custoRodagemSemMatch: abatimentoCustos.semMatch,
                custoRodagemTotalFretes: abatimentoCustos.totalFretes,
                // raw data for placa filter (item 7)
                _carregamentos: carregamentos,
                _abastecimentos: abastecimentos,
                _viagens: viagens,
                _despesasExtras: despesasExtras,
                _diarias: diariasLancadas,
            });
        } catch (e) { showToast('Erro ao calcular: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [periodoInicio, periodoFim, empresa, captacaoConfig.valorPorSaco, bonusConfig]);

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
        const bonus       = viags.filter(v => v.status === 'Entrega finalizada').reduce((s, v) => s + calcularBonusCarreteiro(v.destino, bonusConfig), 0);
        const despExtra   = somarDespesasPorVencimento(desps, dados.periodoDataInicio, dados.periodoDataFim);
        const diarias     = diar.reduce((s, d) => s + Number(d.valor_total || 0), 0);
        const custoRodagem = dados.custoRodagemPorVeiculo?.[veic?.placa]?.custo || 0;
        const totalDesp   = combustivel + bonus + despExtra + diarias + custoRodagem;
        const margem      = receita - totalDesp;
        return { veic, carrg, roms, absts, viags, desps, diar, receita, receitaCarrg, receitaRoms, combustivel, vDiesel, vArla, lDiesel, lArla, bonus, despExtra, diarias, custoRodagem, totalDesp, margem };
    }, [dados, filtroPlaca, veiculos]);

    return { periodoInicio, setPeriodoInicio, periodoFim, setPeriodoFim, empresa, setEmpresa, empresas, veiculos, filtroPlaca, setFiltroPlaca, dados, loading, calcularRelatorio, dadosPorPlaca };
}
