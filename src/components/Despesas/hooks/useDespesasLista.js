import { useState, useCallback, useEffect } from 'react';
import { fetchVehicles } from 'services/vehicleService';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

/**
 * Carrega as despesas (conforme filtros/período) e as categorias da tela de origem.
 * `config.servico` define de onde vêm os dados; `config.comVeiculo` liga o cadastro de veículos.
 */
export function useDespesasLista({ config, filtro, periodo, showToast }) {
    const { servico, comVeiculo, categoriasPadrao } = config;
    const [despesas, setDespesas] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categorias, setCategorias] = useState(() => [...categoriasPadrao]);

    const recarregarCategorias = useCallback(async () => {
        try { setCategorias(await servico.fetchCategorias()); }
        catch (e) { showToast('Erro ao carregar categorias: ' + e.message, 'error'); }
    }, [showToast]); // eslint-disable-line
    useEffect(() => { recarregarCategorias(); }, [recarregarCategorias]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (comVeiculo && filtro.vehicleId) f.vehicleId = filtro.vehicleId;
            if (filtro.categoria) f.categoria = filtro.categoria;
            if (filtro.formaPgto) f.formaPgto = filtro.formaPgto;
            if (periodo.inicio) f.dataInicio = periodo.inicio;
            if (periodo.fim) f.dataFim = periodo.fim;
            if (comVeiculo) {
                const [d, v] = await Promise.all([servico.fetchDespesas(f), fetchVehicles()]);
                setDespesas(d); setVeiculos(v);
            } else {
                setDespesas(await servico.fetchDespesas(f));
            }
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro, periodo]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    return { despesas, veiculos, loading, load, categorias, recarregarCategorias };
}
