import { useState, useCallback, useEffect } from 'react';
import { usePagination } from 'components';
import { fetchViagens, fetchAbastecimentos, fetchChecklists, fetchVeiculosProprios, fetchConfigAbastecimento, fetchPostos, fetchEmpresas, fetchFretesCidades, fetchLocaisParada, fetchChecklistItens, fetchCarregamentos, fetchBonificacoesExtras, fetchRegistrosViagem, fetchNotificacoesCarreteiro, fetchPontosParada, fetchRomaneiosCarreteiro, fetchRomaneios } from 'services/carretas';
import { fetchRomaneiosPorMotorista } from 'services/romaneio';
import { supabase, subscribeTabela } from 'services/supabaseClient';
import { setIntervalVisivel } from 'utils/pollingVisivel';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useCarreteiroDados({ period, periodoCustom, profile, showToast, user }) {
// { inicio, fim } | null
    const [viagens, setViagens]   = useState([]);

const [carregamentos, setCarregamentos] = useState([]);

const [romaneiosPrincipais, setRomaneiosPrincipais] = useState([]);

const romaneiosPrincipaisPag = usePagination(romaneiosPrincipais, 10, [romaneiosPrincipais.length, period, periodoCustom]);

const [bonusExtras, setBonusExtras]     = useState([]);

const [abast, setAbast]       = useState([]);

const [checklists, setChecklists] = useState([]);

const [veiculos, setVeiculos] = useState([]);

// filtra registros/abastecimentos/checklist por placa, quando o motorista dirige mais de um veículo
    const [postos, setPostos]     = useState([]);

const [empresas, setEmpresas] = useState([]);

const [cidadesFrete, setCidadesFrete]   = useState([]);

const [locaisFabrica, setLocaisFabrica] = useState([]);

const [locaisOutro, setLocaisOutro]     = useState([]);

const [loading, setLoading]   = useState(true);

const [configAbast, setConfigAbast] = useState({ preco_diesel: 0, preco_arla: 0 });

const [registros, setRegistros] = useState([]);

const [notificacoes, setNotificacoes] = useState([]);

const [pontosParada, setPontosParada] = useState([]);

const [romaneiosCarreteiro, setRomaneiosCarreteiro] = useState([]);

const [romaneiosFerragem, setRomaneiosFerragem] = useState([]);

const [romsAbertos, setRomsAbertos] = useState([]);

const [checklistItens, setChecklistItens] = useState([]);

const load = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            let dateStr, dateFimStr = null;
            if (periodoCustom?.inicio && periodoCustom?.fim) {
                dateStr = periodoCustom.inicio;
                dateFimStr = periodoCustom.fim;
            } else if (period === 'mes') {
                const hoje = new Date();
                dateStr = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
            } else {
                const cut = new Date();
                cut.setDate(cut.getDate() - period);
                dateStr = cut.toISOString().split('T')[0];
            }
            const fimParam = dateFimStr ? { dataFim: dateFimStr } : {};
            const [v, a, c, ve, cfg, p, emps, cidades, fabricas, outros, itensCheck] = await Promise.all([
                fetchViagens({ motoristaId: user.id, dataInicio: dateStr, ...fimParam }),
                fetchAbastecimentos({ motoristaId: user.id, dataInicio: dateStr, ...fimParam }),
                fetchChecklists({ motoristaId: user.id }),
                fetchVeiculosProprios(),
                fetchConfigAbastecimento(),
                fetchPostos().catch(() => []),
                fetchEmpresas().catch(() => []),
                fetchFretesCidades().catch(() => []),
                fetchLocaisParada('Fábrica').catch(() => []),
                fetchLocaisParada('Outro').catch(() => []),
                fetchChecklistItens(true).catch(() => []),
            ]);
            setViagens(v); setAbast(a); setChecklists(c); setVeiculos(ve);
            setPostos(p);
            setEmpresas(emps || []);
            setCidadesFrete(cidades || []);
            setLocaisFabrica(fabricas || []);
            setLocaisOutro(outros || []);
            setConfigAbast(cfg || { preco_diesel: 0, preco_arla: 0 });
            setChecklistItens(itensCheck || []);

            // Carregamentos do motorista (nova fonte de dados para viagens e bônus)
            try {
                const [carreg, extras] = await Promise.all([
                    fetchCarregamentos({ motoristaId: user.id, dataInicio: dateStr, ...fimParam, is_terceiro: false }),
                    fetchBonificacoesExtras({ motorista_id: user.id, dataInicio: dateStr, ...fimParam }),
                ]);
                setCarregamentos(carreg || []);
                setBonusExtras(extras || []);
            } catch { setCarregamentos([]); setBonusExtras([]); }

            // Romaneios do sistema principal atribuídos a este motorista
            try {
                // Tenta pelo serviço primeiro
                const roms = await fetchRomaneiosPorMotorista(user.id, profile?.name);
                setRomaneiosPrincipais(dateFimStr ? (roms || []).filter(r => (r.created_at || r.saida || '') <= dateFimStr + 'T23:59:59') : (roms || []));
            } catch (eRom) {
                console.warn('[Carreteiro] fetchRomaneiosPorMotorista falhou, tentando query direta:', eRom?.message);
                // Fallback: query direta ao supabase
                try {
                    // Monta filtro: por nome E por UUID
                    const partes = [];
                    if (user?.id) partes.push('motorista_id.eq.' + user.id);
                    if (profile?.name) partes.push('motorista.ilike."' + profile.name + '"');
                    if (partes.length === 0) { setRomaneiosPrincipais([]); }
                    else {
                        let romQuery = supabase
                            .from('romaneios')
                            .select('id, numero, motorista, motorista_id, placa, destino, status, saida, valor_frete, valor_frete_calculado, created_at, romaneio_pedidos(id, numero_pedido)')
                            .or(partes.join(','))
                            .gte('created_at', dateStr);
                        if (dateFimStr) romQuery = romQuery.lte('created_at', dateFimStr + 'T23:59:59');
                        const { data: romsDir, error: errDir } = await romQuery.order('created_at', { ascending: false });
                        if (errDir) { console.error('[Carreteiro] Query direta erro:', errDir); setRomaneiosPrincipais([]); }
                        else { console.log('[Carreteiro] Romaneios OK:', romsDir?.length); setRomaneiosPrincipais(romsDir || []); }
                    }
                } catch (e2) { console.error('[Carreteiro] Fallback falhou:', e2); setRomaneiosPrincipais([]); }
            }

            // Carrega registros de viagem do motorista
            try {
                const regs = await fetchRegistrosViagem(user.id);
                setRegistros(regs || []);
            } catch { setRegistros([]); }
            // Carrega notificações do carreteiro
            try {
                const notifs = await fetchNotificacoesCarreteiro(user.id);
                setNotificacoes(notifs || []);
            } catch { setNotificacoes([]); }
            // Carrega pontos de parada
            try {
                const pontos = await fetchPontosParada(user.id);
                setPontosParada(pontos || []);
            } catch { setPontosParada([]); }
            // Carrega romaneios do admin vinculados a este motorista
            try {
                const [roms, romsAdminAbertos] = await Promise.all([
                    fetchRomaneiosCarreteiro(user.id),
                    fetchRomaneios({ status: 'Aguardando' }).catch(() => []),
                ]);
                setRomaneiosCarreteiro((roms || []).filter(r =>
                    r.tipo_carga !== 'ferragem' && !r.lancado_por_motorista
                ));
                setRomaneiosFerragem((roms || []).filter(r =>
                    r.tipo_carga === 'ferragem' || r.lancado_por_motorista
                ));
                // ROMs do admin disponíveis para vincular (sem motorista ainda ou do próprio motorista)
                setRomsAbertos((romsAdminAbertos || []).filter(r =>
                    !r.motorista_id || r.motorista_id === user.id
                ));
            } catch { setRomaneiosCarreteiro([]); setRomaneiosFerragem([]); }
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [user?.id, period, periodoCustom, profile?.name]);

// eslint-disable-line

    useEffect(() => {
        load();
        // Realtime: atualiza automaticamente quando admin excluir viagem ou checklist
        const unsubViagens   = subscribeTabela('carretas_registros_viagem', load);
        const unsubChk       = subscribeTabela('carretas_checklists', load);
        const unsubCarreg    = subscribeTabela('carretas_carregamentos', load);
        const unsubRomaneios = subscribeTabela('romaneios', load);
        const unsubPontos    = subscribeTabela('carretas_pontos_parada', load);
        const unsubRomCar    = subscribeTabela('carretas_romaneios', load);
        // Polling bem espaçado como fallback — garante que status de romaneios
        // atualizado pelo admin apareça mesmo se o Realtime falhar (o Realtime
        // acima + o reload ao focar a aba já cobrem o caso comum).
        // Atualiza AMBAS as fontes: carretas_romaneios e romaneios (admin).
        const stopPoll = setIntervalVisivel(async () => {
            if (!user?.id) return;
            try {
                const [roms, romsAdmin] = await Promise.all([
                    fetchRomaneiosCarreteiro(user.id),
                    fetchRomaneiosPorMotorista(user.id, profile?.name).catch(() => []),
                ]);
                setRomaneiosCarreteiro((roms || []).filter(r => r.tipo_carga !== 'ferragem'));
                setRomaneiosFerragem((roms || []).filter(r => r.tipo_carga === 'ferragem'));
                setRomaneiosPrincipais(romsAdmin || []);
            } catch { /* silencioso */ }
        }, 5 * 60 * 1000); // só com a aba visível
        return () => { unsubViagens(); unsubChk(); unsubCarreg(); unsubRomaneios(); unsubPontos(); unsubRomCar(); stopPoll(); };
    }, [load]);

    return { viagens, carregamentos, romaneiosPrincipais, romaneiosPrincipaisPag, bonusExtras, abast, checklists, veiculos, postos, empresas, cidadesFrete, locaisFabrica, locaisOutro, loading, configAbast, registros, notificacoes, setNotificacoes, pontosParada, romaneiosCarreteiro, romaneiosFerragem, setRomaneiosFerragem, romsAbertos, checklistItens, load };
}
