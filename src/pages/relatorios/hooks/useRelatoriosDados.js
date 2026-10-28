import { useState, useCallback, useEffect } from 'react';
import { fetchRomaneios } from 'services/romaneio';
import { fetchVehicles } from 'services/vehicleService';
import { fetchDespesasCaminhoes } from 'services/despesas/caminhoesDespesas';
import { fetchMotoristasCaminhao, fetchDiarias, fetchAbastecimentos } from 'services/carretas';
import { fetchDadosMargemFrete } from 'services/custosFrotaService';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import { mesAtualLocal } from '../utils/helpers';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRelatoriosDados({ showToast }) {
const [romaneios, setRomaneios] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [despesasCaminhoes, setDespesasCaminhoes] = useState([]);
    const [diariasAvulsasCaminhao, setDiariasAvulsasCaminhao] = useState([]);
    const [abastecimentosCaminhao, setAbastecimentosCaminhao] = useState([]);
    const [dadosMargemCaminhao, setDadosMargemCaminhao] = useState(null);
    const [loading, setLoading] = useState(true);
    // Período padrão = mês (atual). Só muda quando o usuário escolhe outro mês ou um atalho (7d/30d/90d/1 ano).
    const [periodo, setPeriodo] = useState('mes'); // 'mes' | '7' | '30' | '90' | '365'
    const [mesRef, setMesRef] = useState(() => mesAtualLocal());
    const [dreMesInicio, setDreMesInicio] = useState(() => new Date().toISOString().slice(0, 7));
    const [dreMesFim, setDreMesFim] = useState(() => new Date().toISOString().slice(0, 7));
    const [tab, setTab] = useState('operacional');
    const [empresaFiltro, setEmpresaFiltro] = useState('Comercial Araguaia');
    const [mesFiltro, setMesFiltro] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [rom, veh, desp, motorCaminhao] = await Promise.all([
                fetchRomaneios(), fetchVehicles(), fetchDespesasCaminhoes(), fetchMotoristasCaminhao(),
            ]);
            setRomaneios(rom); setVehicles(veh); setDespesasCaminhoes(desp);
            fetchDadosMargemFrete('caminhao').then(setDadosMargemCaminhao).catch(() => setDadosMargemCaminhao(null));
            // Busca diárias avulsas lançadas por motoristas de caminhão
            // (excluindo carreteiros para não duplicar a DRE)
            const idsCaminhao = (motorCaminhao || []).map(m => m.id);
            const diavs = idsCaminhao.length > 0
                ? await fetchDiarias({ motoristasIds: idsCaminhao })
                : [];
            setDiariasAvulsasCaminhao(diavs);
            // Custo real de combustível: vem dos registros de abastecimento feitos
            // por cada motorista de caminhão (cadastro de motorista), não da previsão
            // de consumo lançada dentro do romaneio.
            const todosAbast = await fetchAbastecimentos();
            const idsCaminhaoSet = new Set(idsCaminhao);
            setAbastecimentosCaminhao((todosAbast || []).filter(a => idsCaminhaoSet.has(a.motorista_id)));
        } catch (err) { showToast('Erro: ' + err.message, 'error'); }
        finally { setLoading(false); }
    }, []); // eslint-disable-line

    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    // Recarrega romaneios ao trocar empresa ou mês na aba Por Empresa
    useEffect(() => {
        if (tab !== 'empresas') return;
        fetchRomaneios()
            .then(setRomaneios)
            .catch(err => showToast('Erro ao atualizar: ' + err.message, 'error'));
    }, [tab, empresaFiltro, mesFiltro]);

    return { romaneios, vehicles, despesasCaminhoes, diariasAvulsasCaminhao, abastecimentosCaminhao, dadosMargemCaminhao, loading, periodo, setPeriodo, mesRef, setMesRef, dreMesInicio, setDreMesInicio, dreMesFim, setDreMesFim, tab, setTab, empresaFiltro, setEmpresaFiltro, mesFiltro, setMesFiltro };
}
