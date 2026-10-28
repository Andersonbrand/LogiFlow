import React, { useState, useCallback, useEffect, useMemo } from 'react';

import { useToast } from 'hooks/useToast';
import { fetchCarreteirosPropriosOnly, fetchViagens, fetchRomaneios, fetchCarregamentos } from 'services/carretas';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import { AppIcon as Icon, Button, Toast } from 'components';

import TabDistribuicaoAco from '../TabDistribuicaoAco';
import Distribuicao from './components/Distribuicao';

// ─── TAB: Distribuição de Viagens ───────────────────────────────────────────
// Sorteia destinos entre os motoristas de carreta disponíveis (frota própria,
// excluindo terceiros e motoristas de caminhão), evitando que um motorista
// repita qualquer um dos seus 2 últimos destinos registrados no histórico de
// rotas (Viagens + Romaneios + Carregamentos), e tentando equilibrar o número
// de viagens entre todos.

function embaralhar(lista) {
    const arr = [...lista];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Cidades para as quais a distribuição deve priorizar o motorista que está
 *  há mais tempo sem entregar ali (rodízio), em vez do sorteio padrão. */
const CIDADES_PRIORITARIAS_RODIZIO = ['pindai', 'urandi', 'piloes', 'candiba'];

function normalizarCidade(nome) {
    return (nome || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .trim();
}

/** Para cada motorista, retorna a data do registro mais recente por cidade:
 *  { [motoristaId]: { [cidadeNormalizada]: 'YYYY-MM-DD' } }. Usado para saber
 *  quem está "há mais tempo sem ir" numa cidade específica. */
function ultimaDataPorMotoristaECidade(historico) {
    const resultado = {};
    (historico || []).forEach(v => {
        if (!v.motorista_id || !v.destino || !v.data_saida) return;
        const cidade = normalizarCidade(v.destino);
        if (!resultado[v.motorista_id]) resultado[v.motorista_id] = {};
        const atual = resultado[v.motorista_id][cidade];
        if (!atual || v.data_saida > atual) resultado[v.motorista_id][cidade] = v.data_saida;
    });
    return resultado;
}

/** Para cada motorista, retorna os até 2 destinos mais recentes (registro
 *  mais novo primeiro), com base nas datas de saída disponíveis no histórico
 *  combinado de viagens/romaneios/carregamentos. */
function ultimosDestinosPorMotorista(historico) {
    const porMotorista = {};
    (historico || []).forEach(v => {
        if (!v.motorista_id || !v.destino) return;
        if (!porMotorista[v.motorista_id]) porMotorista[v.motorista_id] = [];
        porMotorista[v.motorista_id].push({ destino: v.destino, data: v.data_saida || '' });
    });
    const resultado = {};
    Object.entries(porMotorista).forEach(([id, lista]) => {
        const ordenada = [...lista].sort((a, b) => {
            if (!a.data && !b.data) return 0;
            if (!a.data) return 1;
            if (!b.data) return -1;
            return new Date(b.data) - new Date(a.data);
        });
        // Remove cidades repetidas mantendo a mais recente, fica com até 2 distintas
        const distintos = [];
        const vistos = new Set();
        for (const item of ordenada) {
            const norm = item.destino.toLowerCase().trim();
            if (vistos.has(norm)) continue;
            vistos.add(norm);
            distintos.push(item.destino);
            if (distintos.length === 2) break;
        }
        resultado[id] = distintos;
    });
    return resultado;
}

/** Distribui `destinos` (lista de viagens a alocar — pode repetir cidade,
 *  cada ocorrência é uma viagem) entre `motoristas` ([{id,name}]), tentando:
 *  (1) equilibrar ao máximo o número de viagens por motorista — diferença de
 *  no máximo 1 viagem entre quem recebe mais e quem recebe menos;
 *  (2) para as cidades de rodízio (PINDAÍ, URANDI, PILÕES, CANDIBA), atribuir
 *  sempre ao motorista disponível que está há mais tempo sem entregar naquela
 *  cidade específica (quem nunca entregou lá tem prioridade máxima) — em vez
 *  de sorteio;
 *  (3) para as demais cidades, nunca atribuir a um motorista um destino que
 *  esteja entre os seus 2 últimos registrados — a menos que não exista
 *  nenhuma alternativa viável dentro da capacidade já calculada, caso em que
 *  a viagem é marcada como `repetido: true` para o usuário decidir
 *  manualmente se mantém ou não;
 *  (4) sorteio aleatório a cada execução para as cidades sem regra de
 *  rodízio (ordem de destinos e desempate de motoristas), então duas
 *  chamadas com os mesmos dados de entrada tendem a gerar resultados
 *  diferentes fora das cidades priorizadas. */
function gerarDistribuicaoAleatoria(motoristas, destinos, ultimosPorMotorista, datasPorMotoristaECidade = {}) {
    const n = motoristas.length;
    const total = destinos.length;
    if (n === 0 || total === 0) return [];

    // Capacidade justa: todos recebem `base` viagens; o resto (total % n) é
    // sorteado entre os motoristas, que ganham +1 viagem cada.
    const base  = Math.floor(total / n);
    const resto = total % n;
    const capacidade = {};
    motoristas.forEach(m => { capacidade[m.id] = base; });
    embaralhar(motoristas.map(m => m.id)).slice(0, resto).forEach(id => { capacidade[id] += 1; });

    const restritos = {};
    motoristas.forEach(m => {
        restritos[m.id] = new Set((ultimosPorMotorista[m.id] || []).map(d => d.toLowerCase().trim()));
    });

    // Processa primeiro os destinos de rodízio (regra determinística), depois
    // os demais em ordem aleatória — assim a prioridade de rodízio nunca é
    // prejudicada por destinos comuns terem consumido a vaga do motorista certo.
    const destinosEmbaralhados = embaralhar(destinos);
    const prioritarios = destinosEmbaralhados.filter(d => CIDADES_PRIORITARIAS_RODIZIO.includes(normalizarCidade(d)));
    const comuns = destinosEmbaralhados.filter(d => !CIDADES_PRIORITARIAS_RODIZIO.includes(normalizarCidade(d)));

    const resultado = [];

    prioritarios.forEach(destino => {
        const cidadeNorm = normalizarCidade(destino);
        let candidatos = motoristas.filter(m => capacidade[m.id] > 0);
        if (candidatos.length === 0) candidatos = motoristas; // segurança

        // Ordena por "há mais tempo sem entregar nessa cidade" — quem nunca
        // entregou lá (sem registro) vem primeiro; em seguida, data mais antiga.
        candidatos = [...candidatos].sort((a, b) => {
            const da = datasPorMotoristaECidade[a.id]?.[cidadeNorm];
            const db = datasPorMotoristaECidade[b.id]?.[cidadeNorm];
            if (!da && !db) return 0;
            if (!da) return -1; // nunca entregou lá — prioridade máxima
            if (!db) return 1;
            return da.localeCompare(db); // data mais antiga primeiro
        });

        const escolhido = candidatos[0];
        const repetido = restritos[escolhido.id]?.has(cidadeNorm) || false;
        capacidade[escolhido.id] = (capacidade[escolhido.id] || 0) - 1;
        resultado.push({ motoristaId: escolhido.id, motoristaNome: escolhido.name, destino, repetido, rodizio: true });
    });

    comuns.forEach(destino => {
        const norm = destino.toLowerCase().trim();

        // 1ª tentativa: tem vaga E não repete os 2 últimos destinos do motorista
        let candidatos = motoristas.filter(m => capacidade[m.id] > 0 && !restritos[m.id].has(norm));
        let repetido = false;

        // 2ª tentativa (fallback): relaxa a restrição de repetição, mantém só a vaga
        if (candidatos.length === 0) {
            candidatos = motoristas.filter(m => capacidade[m.id] > 0);
            repetido = true;
        }
        // 3ª tentativa (segurança): não deveria ocorrer, capacidade total = total de destinos
        if (candidatos.length === 0) { candidatos = motoristas; repetido = true; }

        const escolhido = candidatos[Math.floor(Math.random() * candidatos.length)];
        capacidade[escolhido.id] = (capacidade[escolhido.id] || 0) - 1;
        resultado.push({ motoristaId: escolhido.id, motoristaNome: escolhido.name, destino, repetido });
    });

    return resultado;
}

export default function TabDistribuicaoViagens() {
    const { toast, showToast } = useToast();
    const [motoristas, setMotoristas] = useState([]);
    const [historico, setHistorico]   = useState([]);
    const [loading, setLoading]       = useState(true);

    const [subTabDistrib, setSubTabDistrib] = useState('cimento'); // 'cimento' | 'aco'
    const [selecionados, setSelecionados] = useState([]); // ids dos motoristas escolhidos
    const [destinos, setDestinos]         = useState([]); // lista de viagens a distribuir (pode repetir cidade)
    const [novoDestino, setNovoDestino]   = useState('');
    const [distribuicao, setDistribuicao] = useState(null); // null | [{motoristaId, motoristaNome, destino, repetido}]

    const inputCls   = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
    const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            // Janela de 6 meses é suficiente para capturar os últimos registros
            // de qualquer motorista que ainda esteja ativo na operação.
            const seisMesesAtras = new Date();
            seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
            const dataInicio = seisMesesAtras.toISOString().slice(0, 10);

            const [m, v, roms, carr] = await Promise.all([
                fetchCarreteirosPropriosOnly(), // só motoristas de carreta da frota própria — exclui terceiros e caminhão
                fetchViagens({ dataInicio }),
                fetchRomaneios({ dataInicio }),
                fetchCarregamentos({ dataInicio, is_terceiro: false }),
            ]);

            const viagensNorm = (v || [])
                .filter(x => x.destino && x.motorista_id)
                .map(x => ({ motorista_id: x.motorista_id, destino: x.destino, data_saida: x.data_saida }));
            const romsNorm = (roms || [])
                .filter(r => r.destino && r.motorista_id)
                .map(r => ({ motorista_id: r.motorista_id, destino: r.destino, data_saida: r.data_saida }));
            const carrNorm = (carr || [])
                .filter(c => c.destino && c.motorista_id)
                .map(c => ({ motorista_id: c.motorista_id, destino: c.destino, data_saida: c.data_carregamento }));

            setMotoristas(m || []);
            setHistorico([...viagensNorm, ...romsNorm, ...carrNorm]);
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, []); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const ultimosPorMotorista = useMemo(() => ultimosDestinosPorMotorista(historico), [historico]);
    const datasPorMotoristaECidade = useMemo(() => ultimaDataPorMotoristaECidade(historico), [historico]);

    const destinosFrequentes = useMemo(() => {
        const contagem = {};
        historico.forEach(v => {
            const d = (v.destino || '').trim();
            if (!d) return;
            contagem[d] = (contagem[d] || 0) + 1;
        });
        return Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cidade]) => cidade);
    }, [historico]);

    const toggleMotorista = (id) => {
        setDistribuicao(null);
        setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    const selecionarTodos = () => { setDistribuicao(null); setSelecionados(motoristas.map(m => m.id)); };
    const limparSelecao   = () => { setDistribuicao(null); setSelecionados([]); };

    const adicionarDestino = (valor) => {
        const v = (valor ?? novoDestino).trim();
        if (!v) return;
        setDistribuicao(null);
        setDestinos(prev => [...prev, v]);
        setNovoDestino('');
    };
    const removerDestino = (idx) => { setDistribuicao(null); setDestinos(prev => prev.filter((_, i) => i !== idx)); };
    const limparDestinos = () => { setDistribuicao(null); setDestinos([]); };

    const motoristasSelecionados = motoristas.filter(m => selecionados.includes(m.id));

    const gerar = () => {
        if (motoristasSelecionados.length === 0) { showToast('Selecione ao menos um motorista.', 'error'); return; }
        if (destinos.length === 0) { showToast('Adicione ao menos um destino.', 'error'); return; }
        const resultado = gerarDistribuicaoAleatoria(
            motoristasSelecionados.map(m => ({ id: m.id, name: m.name })),
            destinos,
            ultimosPorMotorista,
            datasPorMotoristaECidade,
        );
        setDistribuicao(resultado);
        const qtdRepetidos = resultado.filter(r => r.repetido).length;
        if (qtdRepetidos > 0) {
            showToast(`Distribuição gerada — ${qtdRepetidos} viagem(ns) repetiram destino recente por falta de alternativa.`, 'warning');
        } else {
            showToast('Distribuição gerada!', 'success');
        }
    };

    const distribuicaoPorMotorista = useMemo(() => {
        if (!distribuicao) return [];
        const mapa = {};
        motoristasSelecionados.forEach(m => { mapa[m.id] = { motoristaId: m.id, motoristaNome: m.name, viagens: [] }; });
        distribuicao.forEach(d => {
            if (!mapa[d.motoristaId]) mapa[d.motoristaId] = { motoristaId: d.motoristaId, motoristaNome: d.motoristaNome, viagens: [] };
            mapa[d.motoristaId].viagens.push(d);
        });
        return Object.values(mapa).sort((a, b) => a.motoristaNome.localeCompare(b.motoristaNome, 'pt-BR'));
    }, [distribuicao, motoristasSelecionados]);

    const copiarResumo = async () => {
        if (!distribuicao) return;
        const linhas = distribuicaoPorMotorista.map(m => {
            const viagensTxt = m.viagens.length > 0
                ? m.viagens.map(v => `  • ${v.destino}${v.repetido ? ' (repetiu destino recente)' : ''}`).join('\n')
                : '  • Sem viagem nesta rodada';
            return `${m.motoristaNome}:\n${viagensTxt}`;
        }).join('\n\n');
        try {
            await navigator.clipboard.writeText(`Distribuição de viagens — ${new Date().toLocaleDateString('pt-BR')}\n\n${linhas}`);
            showToast('Resumo copiado!', 'success');
        } catch { showToast('Não foi possível copiar. Copie manualmente pela tela.', 'error'); }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Sub-abas: Cimento (padrão) vs Aço */}
            <div className="flex gap-1 p-1 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB', width: 'fit-content' }}>
                {[
                    { id: 'cimento', label: 'Distribuição de Viagens (Cimento)', icon: 'Shuffle' },
                    { id: 'aco', label: 'Distribuição de Aço', icon: 'RefreshCw' },
                ].map(t => (
                    <button key={t.id} onClick={() => setSubTabDistrib(t.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={subTabDistrib === t.id
                            ? { backgroundColor: 'white', color: '#DC2626', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: 600 }
                            : { color: 'var(--color-muted-foreground)' }}>
                        <Icon name={t.icon} size={14} color={subTabDistrib === t.id ? '#DC2626' : 'var(--color-muted-foreground)'} />
                        {t.label}
                    </button>
                ))}
            </div>

            {subTabDistrib === 'aco' ? <TabDistribuicaoAco /> : (<>
            {/* Explicação */}
            <div className="rounded-xl border p-4 flex items-start gap-3" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
                <Icon name="Shuffle" size={18} color="#1D4ED8" className="flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold" style={{ color: '#1D4ED8' }}>Sorteio de viagens entre motoristas de carreta</p>
                    <p className="text-xs mt-0.5" style={{ color: '#1E40AF' }}>
                        Selecione os motoristas disponíveis e os destinos do dia. A distribuição é gerada
                        aleatoriamente, equilibrando o número de viagens entre todos e evitando repetir os 2
                        últimos destinos registrados de cada motorista (considerando os últimos 6 meses de
                        viagens, romaneios e carregamentos).
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Coluna 1 — Motoristas (apenas frota própria, tipo carreta) */}
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                    <div className="flex items-center justify-between mb-3 gap-2">
                        <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            Motoristas disponíveis{' '}
                            <span className="font-normal" style={{ color: 'var(--color-muted-foreground)' }}>({selecionados.length}/{motoristas.length})</span>
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={selecionarTodos} className="text-xs font-medium hover:underline" style={{ color: '#1D4ED8' }}>Todos</button>
                            <span style={{ color: 'var(--color-border)' }}>|</span>
                            <button onClick={limparSelecao} className="text-xs font-medium hover:underline" style={{ color: 'var(--color-muted-foreground)' }}>Limpar</button>
                        </div>
                    </div>
                    {motoristas.length === 0 ? (
                        <p className="text-xs text-center py-6" style={{ color: 'var(--color-muted-foreground)' }}>
                            Nenhum motorista de carreta da frota própria cadastrado.
                        </p>
                    ) : (
                        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                            {motoristas.map(m => {
                                const ativo = selecionados.includes(m.id);
                                const ultimos = ultimosPorMotorista[m.id] || [];
                                return (
                                    <button key={m.id} type="button" onClick={() => toggleMotorista(m.id)}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors"
                                        style={{ borderColor: ativo ? '#1D4ED8' : 'var(--color-border)', backgroundColor: ativo ? '#EFF6FF' : 'transparent' }}>
                                        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border"
                                            style={{ backgroundColor: ativo ? '#1D4ED8' : 'transparent', borderColor: ativo ? '#1D4ED8' : 'var(--color-border)' }}>
                                            {ativo && <Icon name="Check" size={11} color="#fff" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{m.name}</p>
                                            <p className="text-[10px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                                                {ultimos.length > 0 ? `Últimos destinos: ${ultimos.join(', ')}` : 'Sem viagens recentes registradas'}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Coluna 2 — Destinos a distribuir */}
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                    <div className="flex items-center justify-between mb-3 gap-2">
                        <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            Destinos a distribuir <span className="font-normal" style={{ color: 'var(--color-muted-foreground)' }}>({destinos.length})</span>
                        </p>
                        {destinos.length > 0 && (
                            <button onClick={limparDestinos} className="text-xs font-medium hover:underline flex-shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>Limpar</button>
                        )}
                    </div>

                    <div className="flex gap-2 mb-3">
                        <input
                            type="text" value={novoDestino} onChange={e => setNovoDestino(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarDestino(); } }}
                            placeholder="Digite ou selecione uma cidade..."
                            className={inputCls} style={inputStyle} list="distribuicao-destinos-conhecidos" />
                        <datalist id="distribuicao-destinos-conhecidos">
                            {destinosFrequentes.map(d => <option key={d} value={d} />)}
                        </datalist>
                        <Button onClick={() => adicionarDestino()} iconName="Plus" size="sm">Adicionar</Button>
                    </div>

                    {destinosFrequentes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {destinosFrequentes.map(d => (
                                <button key={d} type="button" onClick={() => adicionarDestino(d)}
                                    className="text-[11px] px-2 py-1 rounded-full border hover:bg-gray-50 transition-colors"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    + {d}
                                </button>
                            ))}
                        </div>
                    )}

                    {destinos.length === 0 ? (
                        <p className="text-xs text-center py-6" style={{ color: 'var(--color-muted-foreground)' }}>
                            Nenhum destino adicionado ainda. Digite uma cidade acima (uma vez para cada viagem) ou clique em uma sugestão.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto pr-1">
                            {destinos.map((d, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                                    style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                    {d}
                                    <button onClick={() => removerDestino(idx)} className="hover:opacity-70">
                                        <Icon name="X" size={11} color="#92400E" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Botões de ação */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
                <Button onClick={gerar} iconName="Shuffle" size="lg"
                    disabled={selecionados.length === 0 || destinos.length === 0}>
                    {distribuicao ? 'Gerar novamente' : 'Gerar Distribuição Aleatória'}
                </Button>
                {distribuicao && (
                    <Button variant="outline" onClick={copiarResumo} iconName="Copy" size="lg">
                        Copiar resumo
                    </Button>
                )}
            </div>

            {/* Resultado */}
            {distribuicao && (
                <Distribuicao distribuicaoPorMotorista={distribuicaoPorMotorista} />
            )}
            </>)}
            <Toast toast={toast} />
        </div>
    );
}
