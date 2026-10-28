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
    const [fretes, setFretes] = useState([]);
    const [dadosMargem, setDadosMargem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setErro('');
        try {
            const [carr, fr, mg] = await Promise.all([
                fetchCarregamentos({ is_terceiro: false, dataInicio: periodo.inicio || undefined, dataFim: periodo.fim || undefined }),
                fetchFretesPorTipo('frota'),
                fetchDadosMargemFrete('carreta').catch(() => null),
            ]);
            if (fr.error) throw fr.error;
            setCarregamentos(carr);
            setFretes(fr.data || []);
            setDadosMargem(mg ? { custoPorKm: mg.custoPorKm, custoPorDia: mg.custoPorDia, margemPadrao: mg.margemPadrao, custosDestinos: mg.destinos } : null);
        } catch (e) {
            setErro(e?.message || 'Não foi possível carregar os dados do mapa.');
        } finally { setLoading(false); }
    }, [periodo.inicio, periodo.fim]);

    useEffect(() => { load(); }, [load]);

    const dados = useMemo(
        () => agregarMapa({ carregamentos, fretes, custoConfig, dadosMargem }),
        [carregamentos, fretes, custoConfig, dadosMargem],
    );
    return { ...dados, loading, erro, recarregar: load };
}
