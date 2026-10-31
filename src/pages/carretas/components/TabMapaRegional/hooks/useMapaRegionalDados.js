import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCarregamentos } from 'services/carretas/carregamentos';
import { fetchFretesPorTipo } from 'services/carretas/fretes';
import { fetchDadosMargemFrete } from 'services/custosFrotaService';
import { useCustoConfig } from 'services/settingsService';
import { agregarMapa } from '../utils/agregar';

/** Carrega carregamentos da frota própria + tabela de fretes + custos de rodagem e agrega por cidade/região. */
export function useMapaRegionalDados(periodo) {
    const { custoConfig } = useCustoConfig();
    const [carregamentos, setCarregamentos] = useState([]);
    const [carregamentosTer, setCarregamentosTer] = useState([]);
    const [fretes, setFretes] = useState([]);
    const [fretesTer, setFretesTer] = useState([]);
    const [dadosMargem, setDadosMargem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setErro('');
        try {
            const datas = { dataInicio: periodo.inicio || undefined, dataFim: periodo.fim || undefined };
            const [carr, fr, mg, carrTer, frTer] = await Promise.all([
                fetchCarregamentos({ is_terceiro: false, ...datas }),
                fetchFretesPorTipo('frota'),
                fetchDadosMargemFrete('carreta').catch(() => null),
                fetchCarregamentos({ is_terceiro: true, ...datas }),
                fetchFretesPorTipo('terceiros'),
            ]);
            if (fr.error) throw fr.error;
            setCarregamentos(carr);
            setCarregamentosTer(carrTer || []);
            setFretes(fr.data || []);
            setFretesTer(frTer?.data || []);
            setDadosMargem(mg ? { custoPorKm: mg.custoPorKm, custoPorDia: mg.custoPorDia, margemPadrao: mg.margemPadrao, custosDestinos: mg.destinos } : null);
        } catch (e) {
            setErro(e?.message || 'Não foi possível carregar os dados do mapa.');
        } finally { setLoading(false); }
    }, [periodo.inicio, periodo.fim]);

    useEffect(() => { load(); }, [load]);

    // Três visões: frota própria, terceiros (sem frete/rodagem) e as duas somadas (com a divisão por origem)
    const dados = useMemo(() => {
        const base = { fretes, fretesTerceiros: fretesTer, custoConfig, dadosMargem };
        const frota = agregarMapa({ ...base, carregamentos });
        const tercRecs = carregamentosTer.map(c => ({ ...c, __ter: true }));
        const terceiros = agregarMapa({ ...base, carregamentos: tercRecs });
        terceiros.cidades = terceiros.cidades.map(c => ({ ...c, precoSaco: c.precoSacoTer, km: c.km }));
        const todas = agregarMapa({ ...base, carregamentos: [...carregamentos, ...tercRecs] });
        return { frota, terceiros, todas };
    }, [carregamentos, carregamentosTer, fretes, fretesTer, custoConfig, dadosMargem]);
    return { dados, loading, erro, recarregar: load };
}
