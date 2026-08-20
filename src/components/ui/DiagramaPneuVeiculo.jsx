import React from 'react';
import { getConfiguracao, COR_TIPO_EIXO, LABEL_TIPO_EIXO } from 'utils/pneuDiagramaConfig';
import VeiculoSilhueta from 'components/ui/VeiculoSilhueta';

/**
 * Diagrama visual (SVG, ilustrativo) do veículo visto de cima, com um
 * círculo clicável em cada posição de pneu. Usado na tela do mecânico para
 * marcar em qual posição (ou posições) a troca foi feita.
 *
 * Segue o mesmo padrão da referência que o Anderson enviou: esboço lateral
 * do veículo no topo + esquema de eixos (vista de cima), com os eixos
 * coloridos por tipo (D = Direcional, T = Tração, A = Auxiliar) e, no caso
 * da carreta 9 eixos, separadores indicando Cavalo / 1º Reboque / 2º Reboque.
 *
 * props:
 *  - configuracao: chave de CONFIGURACOES_PNEUS (ex.: 'truck_3_eixos')
 *  - value: array com os ids das posições selecionadas (ou uma string única,
 *           por compatibilidade — sempre tratado como lista internamente)
 *  - onChange(idsArray): callback com a nova lista de posições selecionadas
 *    a cada clique (mesmo em modo single: chega sempre como array de 0 ou 1)
 *  - ocupadas: array opcional de ids já em uso (pneus 'em_uso' nesse veículo) — mostrados com um ponto de alerta
 *  - multi: quando true, permite marcar várias posições ao mesmo tempo
 *    (ex.: trocar todos os pneus do veículo numa única operação); em modo
 *    single (padrão), clicar numa posição substitui a seleção anterior
 */
export default function DiagramaPneuVeiculo({ configuracao, value, onChange, ocupadas = [], multi = false }) {
    const cfg = getConfiguracao(configuracao);
    const selecionadas = Array.isArray(value) ? value : (value ? [value] : []);

    const toggle = (id) => {
        if (!multi) { onChange([id]); return; }
        onChange(selecionadas.includes(id) ? selecionadas.filter(v => v !== id) : [...selecionadas, id]);
    };
    const selecionarTodos = () => cfg && onChange(cfg.posicoes.map(p => p.id));
    const limparSelecao   = () => onChange([]);

    if (!cfg) {
        return (
            <div className="flex items-center justify-center py-8 rounded-xl border border-dashed text-xs text-center px-4"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                Selecione a configuração do veículo para ver o diagrama de pneus
            </div>
        );
    }

    const alturaMax = Math.max(...cfg.posicoes.map(p => p.y)) + 16;
    const viewBoxH = alturaMax + 10;

    // Posição y central de cada eixo (média dos pneus daquele eixo) — usada
    // pra desenhar a linha do chassi e as marcações D/T/A ao lado.
    const eixosUnicos = [...new Map(cfg.posicoes.map(p => [p.eixo, p])).values()]
        .map(p => ({ eixo: p.eixo, y: p.y, tipoEixo: p.tipoEixo }));

    // Linha divisória entre grupos (cavalo / reboque 1 / reboque 2) — no meio
    // do intervalo entre o último eixo de um grupo e o primeiro do próximo.
    const divisorias = (cfg.grupos || []).slice(1).map(g => {
        const eixoAnterior = eixosUnicos.find(e => e.eixo === g.eixoIni - 1);
        const eixoAtual = eixosUnicos.find(e => e.eixo === g.eixoIni);
        if (!eixoAnterior || !eixoAtual) return null;
        return (eixoAnterior.y + eixoAtual.y) / 2;
    }).filter(y => y != null);

    return (
        <div className="rounded-xl border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB' }}>
            {/* Esboço lateral do veículo (apoio visual, não clicável) */}
            {cfg.silhueta && (
                <div className="mb-2 px-2">
                    <VeiculoSilhueta tipo={cfg.silhueta} />
                    <p className="text-center text-[10px] font-medium mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                        {cfg.label} · {cfg.eixoConfig}
                    </p>
                </div>
            )}

            {multi && (
                <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-semibold" style={{ color: selecionadas.length ? '#059669' : 'var(--color-muted-foreground)' }}>
                        {selecionadas.length} pneu(s) selecionado(s)
                    </span>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={selecionarTodos}
                            className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-blue-50" style={{ color: '#2563EB' }}>
                            Selecionar todos
                        </button>
                        <button type="button" onClick={limparSelecao}
                            className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50" style={{ color: '#DC2626' }}>
                            Limpar
                        </button>
                    </div>
                </div>
            )}

            <svg viewBox={`-9 0 120 ${viewBoxH}`} className="w-full" style={{ maxHeight: 440 }}>
                {/* Chassi — linha central representando o comprimento do veículo */}
                <rect x="42" y="2" width="16" height={viewBoxH - 4} rx="3"
                    fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="0.5" />
                {/* Seta indicando a frente do veículo */}
                <polygon points="50,0 46,6 54,6" fill="#94A3B8" />
                <text x="50" y="10" fontSize="3" textAnchor="middle" fill="#94A3B8">FRENTE</text>

                {/* Separadores entre cavalo/reboques (carreta 9 eixos) */}
                {divisorias.map((y, i) => (
                    <line key={i} x1="0" y1={y} x2="100" y2={y} stroke="#CBD5E1" strokeWidth="0.6" strokeDasharray="2,1.5" />
                ))}
                {/* Nome de cada grupo (Cavalo / 1º Reboque / 2º Reboque) na margem
                    direita, na vertical — fora do chassi, pra não colidir com a
                    letra do tipo de eixo (D/T/A) que fica centralizada nele. */}
                {(cfg.grupos || []).length > 1 && cfg.grupos.map((g, i) => {
                    const eixoIni = eixosUnicos.find(e => e.eixo === g.eixoIni);
                    const eixoFim = eixosUnicos.find(e => e.eixo === g.eixoFim);
                    if (!eixoIni || !eixoFim) return null;
                    const yMid = (eixoIni.y + eixoFim.y) / 2;
                    return (
                        <text key={i} x="106" y={yMid} fontSize="2.6" textAnchor="middle" fill="#94A3B8" fontWeight="600"
                            transform={`rotate(-90 106 ${yMid})`}>
                            {g.nome}
                        </text>
                    );
                })}

                {/* Letra do tipo de eixo (D/T/A) ao lado do chassi, na altura de cada eixo */}
                {eixosUnicos.map(e => (
                    <text key={e.eixo} x="50" y={e.y + 1.2} fontSize="3" textAnchor="middle" fontWeight="700"
                        fill={COR_TIPO_EIXO[e.tipoEixo] || '#64748B'}>
                        {e.tipoEixo}
                    </text>
                ))}

                {cfg.posicoes.map(p => {
                    const selecionada = selecionadas.includes(p.id);
                    const ocupada = ocupadas.includes(p.id);
                    const corTipo = COR_TIPO_EIXO[p.tipoEixo] || '#64748B';
                    const corAnel = selecionada ? '#059669' : ocupada ? '#F59E0B' : corTipo;
                    const corMiolo = selecionada ? '#D1FAE5' : ocupada ? '#FEF3C7' : '#F1F5F9';
                    const r = selecionada ? 5.3 : 4.4;
                    return (
                        <g key={p.id} style={{ cursor: 'pointer' }} onClick={() => toggle(p.id)}>
                            {/* Banda de rodagem do pneu (borracha escura) */}
                            <circle cx={p.x} cy={p.y} r={r} fill="#1F2937" stroke={corAnel} strokeWidth={selecionada ? 1.5 : 1.1} />
                            {/* Sulcos da banda de rodagem — linhas radiais simulando o desenho do pneu */}
                            {Array.from({ length: 10 }).map((_, i) => {
                                const ang = (i / 10) * Math.PI * 2;
                                const rIn = r * 0.6, rOut = r * 0.9;
                                const x1 = p.x + Math.cos(ang) * rIn, y1 = p.y + Math.sin(ang) * rIn;
                                const x2 = p.x + Math.cos(ang) * rOut, y2 = p.y + Math.sin(ang) * rOut;
                                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#4B5563" strokeWidth="0.55" strokeLinecap="round" />;
                            })}
                            {/* Aro / miolo — muda de cor conforme o status da posição */}
                            <circle cx={p.x} cy={p.y} r={r * 0.48} fill={corMiolo} stroke={corAnel} strokeWidth="0.7" />
                            {selecionada && (
                                <circle cx={p.x} cy={p.y} r={1.3} fill="#059669" />
                            )}
                        </g>
                    );
                })}
            </svg>

            <div className="flex items-center gap-3 mt-2 px-1 flex-wrap">
                <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                    <span className="inline-block w-2.5 h-2.5 rounded-full border" style={{ borderColor: '#059669', backgroundColor: '#D1FAE5' }} /> Selecionado
                </span>
                <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                    <span className="inline-block w-2.5 h-2.5 rounded-full border" style={{ borderColor: '#F59E0B', backgroundColor: '#FEF3C7' }} /> Já em uso
                </span>
                {Object.entries(LABEL_TIPO_EIXO).map(([sigla, nome]) => (
                    <span key={sigla} className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                        <span className="inline-block w-2.5 h-2.5 rounded-full border" style={{ borderColor: COR_TIPO_EIXO[sigla] }} /> {sigla} — {nome}
                    </span>
                ))}
            </div>
            {selecionadas.length > 0 && (
                <p className="text-xs font-medium mt-2 px-1" style={{ color: '#059669' }}>
                    ✓ {selecionadas.map(id => cfg.posicoes.find(p => p.id === id)?.label).filter(Boolean).join(', ')}
                </p>
            )}
        </div>
    );
}
