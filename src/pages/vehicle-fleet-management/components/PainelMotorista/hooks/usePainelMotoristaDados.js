import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchAbastecimentos, fetchChecklists, fetchDiarias, fetchPostos, fetchConfigAbastecimento, fetchChecklistItens } from 'services/carretas';
import { supabase, subscribeTabela } from 'services/supabaseClient';
import { fetchCaminhoesPlacas } from 'services/vehicleService';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function usePainelMotoristaDados({ motorista, showToast }) {
const [loading, setLoading] = useState(true);

const [mes, setMes]         = useState(() => new Date().toISOString().slice(0, 7));

const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' });

// tem prioridade sobre mês
    const [usarPeriodo, setUsarPeriodo] = useState(false);

const [abast, setAbast]       = useState([]);

const [checklists, setChecklists] = useState([]);

const [diarias, setDiarias]   = useState([]);

const [romaneiosDiarias, setRomaneiosDiarias] = useState([]);

const [veiculosCaminhao, setVeiculosCaminhao] = useState([]);

const [postos, setPostos] = useState([]);

const [configAbast, setConfigAbast] = useState({ preco_diesel: 0, preco_arla: 0 });

const [checklistItens, setChecklistItens] = useState([]);

const load = useCallback(async () => {
        setLoading(true);
        try {
            const [ano, m] = mes.split('-').map(Number);
            const f = {
                motoristaId: motorista.id,
                dataInicio: (usarPeriodo && periodoCustom.inicio) ? periodoCustom.inicio : mes + '-01',
                dataFim: (usarPeriodo && periodoCustom.fim) ? periodoCustom.fim : mes + '-' + String(new Date(ano, m, 0).getDate()).padStart(2, '0'),
            };
            // Busca romaneios do período com diária (custo_motorista > 0)
            // cruzando por motorista_id OU nome do motorista (campo texto livre).
            // "Período" aqui é o mês/intervalo em que a DIÁRIA FOI LANÇADA
            // (diaria_criada_em — gravada automaticamente quando custo_motorista
            // passa de vazio/zero para >0), NÃO a data de saída do romaneio, que
            // pode nem estar preenchida ainda (ex.: romaneio "Carregando"). Isso
            // evita que uma diária lançada em agosto caia em julho só porque o
            // romaneio foi criado no fim de julho e a saída ainda não foi
            // confirmada. Fallback para saida/created_at cobre apenas romaneios
            // antigos, de antes dessa coluna existir.
            const dataFimTs = f.dataFim + 'T23:59:59';
            const romaneioRes = await supabase
                .from('romaneios')
                .select('id, numero, motorista, motorista_id, placa, destino, status, saida, created_at, diaria_criada_em, diaria_mes_referencia, custo_motorista, dias_diaria, valor_diaria_dia, diaria_descricao, assinatura_diaria_logistica, assinatura_diaria_logistica_at, assinatura_diaria_transporte, assinatura_diaria_transporte_at')
                .or(`motorista_id.eq.${motorista.id},motorista.ilike.${motorista.name}`)
                .gt('custo_motorista', 0)
                .order('created_at', { ascending: false });
            const romaneiosDiariasFiltrados = (romaneioRes.data || []).filter(r => {
                // Data de referência definida manualmente no romaneio manda mais que
                // qualquer detecção automática — é exatamente pra isso que ela existe.
                const dataRef = r.diaria_mes_referencia || r.diaria_criada_em || r.saida || r.created_at;
                if (!dataRef) return false;
                return dataRef >= f.dataInicio && dataRef <= dataFimTs;
            });

            const [a, ch, d, vc, ps, cfg, ci] = await Promise.all([
                fetchAbastecimentos(f),
                fetchChecklists({ motoristaId: motorista.id }),
                fetchDiarias({ motoristaId: motorista.id, dataInicio: f.dataInicio, dataFim: f.dataFim }),
                fetchCaminhoesPlacas(),
                fetchPostos().catch(() => []),
                fetchConfigAbastecimento().catch(() => ({ preco_diesel: 0, preco_arla: 0 })),
                fetchChecklistItens(true).catch(() => []),
            ]);
            setAbast(a); setChecklists(ch); setDiarias(d);
            setRomaneiosDiarias(romaneiosDiariasFiltrados);
            setVeiculosCaminhao(vc || []);
            setPostos(ps || []);
            setConfigAbast(cfg || { preco_diesel: 0, preco_arla: 0 });
            setChecklistItens(ci || []);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [motorista.id, motorista.name, mes, usarPeriodo, periodoCustom]);

// eslint-disable-line

    useEffect(() => {
        load();
        // Realtime: atualiza quando admin excluir romaneio ou checklist
        const unsubRom = subscribeTabela('romaneios', load);
        const unsubChk = subscribeTabela('carretas_checklists', load);
        return () => { unsubRom(); unsubChk(); };
    }, [load]);

// Totais
    const totaisAbast = useMemo(() => ({
        litrosDiesel: abast.reduce((s, a) => s + Number(a.litros_diesel||0), 0),
        valorDiesel:  abast.reduce((s, a) => s + Number(a.valor_diesel||0), 0),
        litrosArla:   abast.reduce((s, a) => s + Number(a.litros_arla||0), 0),
        valorArla:    abast.reduce((s, a) => s + Number(a.valor_arla||0), 0),
        total:        abast.reduce((s, a) => s + Number(a.valor_total||0), 0),
    }), [abast]);

const totalDiariasAvulsas = useMemo(() => diarias.reduce((s, d) => s + Number(d.valor_total||0), 0), [diarias]);

const totalDiariasRomaneios = useMemo(() => romaneiosDiarias.reduce((s, r) => s + Number(r.custo_motorista||0), 0), [romaneiosDiarias]);

const totalDiarias = useMemo(() => totalDiariasAvulsas + totalDiariasRomaneios, [totalDiariasAvulsas, totalDiariasRomaneios]);

    return { loading, mes, setMes, periodoCustom, setPeriodoCustom, usarPeriodo, setUsarPeriodo, abast, checklists, diarias, setDiarias, romaneiosDiarias, setRomaneiosDiarias, veiculosCaminhao, postos, configAbast, checklistItens, load, totaisAbast, totalDiariasAvulsas, totalDiariasRomaneios, totalDiarias };
}
