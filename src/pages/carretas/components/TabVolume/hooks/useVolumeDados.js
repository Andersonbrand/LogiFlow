import { useState, useCallback, useEffect } from 'react';
import { fetchCarregamentos, fetchEmpresas, fetchCarretasVeiculos, fetchVeiculosProprios, fetchVeiculosTerceiros, fetchTodosMotoristas, fetchCarreteirosPropriosOnly, fetchMotoristasTerceiros, fetchFretesCidades } from 'services/carretas';
import { fetchFornecedores as fetchFornecedoresCarretas } from 'services/fornecedoresService';
import { fetchMotoristasComId } from 'services/romaneio';
import { fetchCaminhoesPlacas } from 'services/vehicleService';
import { parseTipo } from '../utils/helpers';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useVolumeDados({ isAdmin, showToast }) {
// Estado
    const hoje = new Date().toISOString().slice(0, 7);
    const [mes, setMes] = useState(hoje);
    const [dia, setDia] = useState(''); // dia específico — tem prioridade sobre mês
    const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' }); // período (data inicial a data final) — tem prioridade sobre mês/dia
    const [usarPeriodo, setUsarPeriodo] = useState(false);
    const [empresaFiltro, setEmpresaFiltro] = useState('');
    const [carregamentos, setCarregamentos] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [fornecedores, setFornecedores] = useState([]);
    const [veiculos, setVeiculos] = useState([]);         // todos (modal carregamento frota)
    const [veiculosProprios, setVeiculosProprios] = useState([]);  // frota própria (modal retira)
    const [veiculosTerceiros, setVeiculosTerceiros] = useState([]); // terceirizados (modal terceiro)
    const [motoristas, setMotoristas] = useState([]);       // todos (modal carregamento frota)
    const [motoristasProprios, setMotoristasProprios] = useState([]); // frota própria (modal retira)
    const [motoristasTerceiros, setMotoristasTerceiros] = useState([]); // terceirizados (modal terceiro)
    const [motoristasCaminhoes, setMotoristasCaminhoes] = useState([]); // motoristas de caminhão (frota, não-carreta) — carregamento avulso em Montes Claros
    const [veiculosCaminhoes, setVeiculosCaminhoes] = useState([]); // caminhões cadastrados (não-carreta) — mesmo uso acima
    const [loading, setLoading] = useState(true);
    const [subAba, setSubAba] = useState('dashboard'); // 'dashboard' | 'tabela' | 'terceiros' | 'retira'

    const [carregamentosTerceiros, setCarregamentosTerceiros] = useState([]);
    const [carregamentosRetira, setCarregamentosRetira] = useState([]);
    const [fretesFretas, setFretesFretas] = useState([]);
    const [fretosTerceiros, setFretesTerceiros] = useState([]);
    const [fretesEstoque, setFretesEstoque] = useState([]);

    // ── Load ─────────────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            let filters = {};
            if (usarPeriodo && periodoCustom.inicio && periodoCustom.fim) {
                filters.dataInicio = periodoCustom.inicio;
                filters.dataFim    = periodoCustom.fim;
            } else if (dia) {
                filters.dataInicio = dia;
                filters.dataFim    = dia;
            } else {
                const [yr, mo] = mes.split('-');
                const lastDay = new Date(+yr, +mo, 0).getDate();
                filters.dataInicio = `${mes}-01`;
                filters.dataFim    = `${mes}-${String(lastDay).padStart(2, '0')}`;
            }
            if (empresaFiltro) filters.empresaId = empresaFiltro;

            const [
                carr, emp, forn,
                ve, vePropr, veTer,
                mot, motPropr, motTer,
                carrTerc, fretFr, fretTerc, carrRet,
                motCaminhoes, veiCaminhoes, fretEstoq,
            ] = await Promise.all([
                fetchCarregamentos({ ...filters, is_terceiro: false, is_retira: false }),
                fetchEmpresas(),
                fetchFornecedoresCarretas(),
                // Veículos: todos (modal frota) + separados por tipo
                fetchCarretasVeiculos(),
                fetchVeiculosProprios(),
                fetchVeiculosTerceiros(),
                // Motoristas: todos (modal frota) + separados por tipo
                isAdmin ? fetchTodosMotoristas()     : Promise.resolve([]),
                isAdmin ? fetchCarreteirosPropriosOnly()  : Promise.resolve([]),
                isAdmin ? fetchMotoristasTerceiros() : Promise.resolve([]),
                fetchCarregamentos({ ...filters, is_terceiro: true }),
                fetchFretesCidades('frota'),
                fetchFretesCidades('terceiros'),
                fetchCarregamentos({ ...filters, is_retira: true }),
                // Motoristas/veículos de CAMINHÃO (frota, não-carreta) — usado só na
                // opção "Carregamento com caminhão" do modal (caso raro: caminhão
                // carregando em Montes Claros, sem gerar bônus de carreteiro).
                isAdmin ? fetchMotoristasComId() : Promise.resolve([]),
                isAdmin ? fetchCaminhoesPlacas()  : Promise.resolve([]),
                // Frete Estoque: distâncias/frete de Guanambi até as cidades atendidas,
                // usado só no destino do Carregamento no Estoque (não é FOB/CIF de fornecedor).
                fetchFretesCidades('liz'),
            ]);
            setCarregamentos(carr);
            setEmpresas(emp);
            setFornecedores(forn);
            setVeiculos(ve);
            setVeiculosProprios(vePropr);
            setVeiculosTerceiros(veTer);
            setMotoristas(mot);
            setMotoristasProprios(motPropr);
            setMotoristasTerceiros(motTer);
            setCarregamentosTerceiros(carrTerc);
            setFretesFretas(fretFr);
            setFretesTerceiros(fretTerc);
            setFretesEstoque(fretEstoq);
            setCarregamentosRetira(carrRet);
            setMotoristasCaminhoes(motCaminhoes);
            setVeiculosCaminhoes(veiCaminhoes);
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [mes, dia, usarPeriodo, periodoCustom, empresaFiltro, isAdmin]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    // ── Cálculo de totais ─────────────────────────────────────────────────────
    const totais = (() => {
        const t = { ARA_GBI_FOB: 0, ARA_BARR_FOB: 0, CIF_GBI: 0, CIF_BARR: 0, ESTOQUE: 0, total: 0, totalTerceiros: 0 };
        carregamentos.forEach(r => {
            const { tipo } = parseTipo(r);
            if (tipo === 'ESTOQUE') return; // Carregamento no Estoque não conta como volume no dashboard
            const qtd = Number(r.quantidade) || 0;
            if (tipo && t.hasOwnProperty(tipo)) t[tipo] += qtd;
            t.total += qtd;
        });
        // Terceiros e Retira: somar volume de FOB Guanambi e FOB Barreiras nos badges respectivos
        [...carregamentosTerceiros, ...carregamentosRetira].forEach(r => {
            const qtd = Number(r.quantidade) || 0;
            t.totalTerceiros += qtd;
            const { tipo } = parseTipo(r);
            if (tipo === 'ARA_GBI_FOB')  t.ARA_GBI_FOB  += qtd;
            if (tipo === 'ARA_BARR_FOB') t.ARA_BARR_FOB += qtd;
        });
        t.totalGeral = t.total + t.totalTerceiros;
        return t;
    })();

    return { hoje, mes, setMes, dia, setDia, periodoCustom, setPeriodoCustom, usarPeriodo, setUsarPeriodo, empresaFiltro, setEmpresaFiltro, carregamentos, empresas, fornecedores, veiculos, veiculosProprios, veiculosTerceiros, motoristasProprios, motoristasTerceiros, motoristasCaminhoes, veiculosCaminhoes, loading, subAba, setSubAba, carregamentosTerceiros, carregamentosRetira, fretesFretas, fretosTerceiros, fretesEstoque, load, totais };
}
