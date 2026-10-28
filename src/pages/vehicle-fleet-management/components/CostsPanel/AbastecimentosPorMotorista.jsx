import React, { useMemo, useState } from 'react';

import { AppIcon as Icon, usePagination, PaginationBar } from 'components';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const NUM = v => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/**
 * Acesso rápido aos abastecimentos de cada motorista de caminhão (período do painel).
 * Mostra TODOS os motoristas — inclusive os sem lançamento — para o admin conferir quem
 * está lançando, e abre os registros de cada um sem sair do centro de custos.
 */
export default function AbastecimentosPorMotorista({ motoristas, abast, busca, onAbrirPainel }) {
    const [abertos, setAbertos] = useState({});
    const [soSemLancamento, setSoSemLancamento] = useState(false);

    const linhas = useMemo(() => {
        const map = new Map(motoristas.map(m => [m.id, { id: m.id, nome: m.name, motorista: m, registros: [] }]));
        abast.forEach(a => {
            const id = a.motorista_id || a.motorista?.id;
            if (!id) return;
            if (!map.has(id)) map.set(id, { id, nome: a.motorista?.name || 'Sem nome', motorista: { id, name: a.motorista?.name || 'Sem nome' }, registros: [] });
            map.get(id).registros.push(a);
        });
        return Array.from(map.values()).map(l => ({
            ...l,
            qtd: l.registros.length,
            litrosDiesel: l.registros.reduce((s, a) => s + Number(a.litros_diesel || 0), 0),
            litrosArla: l.registros.reduce((s, a) => s + Number(a.litros_arla || 0), 0),
            total: l.registros.reduce((s, a) => s + Number(a.valor_total || 0), 0),
            ultima: l.registros.reduce((mx, a) => (a.data_abastecimento && a.data_abastecimento > mx ? a.data_abastecimento : mx), ''),
        })).sort((a, b) => (b.qtd - a.qtd) || a.nome.localeCompare(b.nome));
    }, [motoristas, abast]);

    const filtradas = useMemo(() => linhas.filter(l =>
        (!busca || l.nome.toLowerCase().includes(busca.toLowerCase())) && (!soSemLancamento || l.qtd === 0)
    ), [linhas, busca, soSemLancamento]);
    const pag = usePagination(filtradas, 10, [filtradas.length, busca, soSemLancamento]);
    const semLancamento = linhas.filter(l => l.qtd === 0).length;

    return (
        <div className="rounded-xl border overflow-hidden mb-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
            <div className="px-4 py-3 border-b flex items-center gap-2 flex-wrap" style={{ borderColor: 'var(--color-border)' }}>
                <Icon name="Users" size={16} color="#1D4ED8" />
                <h3 className="text-sm font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>Abastecimentos por Motorista</h3>
                <button type="button" onClick={() => setSoSemLancamento(v => !v)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors"
                    style={soSemLancamento ? { backgroundColor: '#FEF2F2', color: '#B91C1C', borderColor: '#FECACA' } : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                    Sem lançamento no período ({semLancamento})
                </button>
            </div>
            {filtradas.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum motorista encontrado.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                        <thead>
                            <tr style={{ backgroundColor: '#F8FAFC' }}>
                                {['Motorista', 'Lançamentos', 'Diesel (L)', 'Arla (L)', 'Último', 'Total', ''].map((h, i) => (
                                    <th key={h + i} className={`px-4 py-2.5 text-xs font-semibold ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--color-muted-foreground)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pag.pageItems.map(l => (
                                <React.Fragment key={l.id}>
                                    <tr className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                        <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            <button type="button" onClick={() => l.qtd > 0 && setAbertos(s => ({ ...s, [l.id]: !s[l.id] }))}
                                                className="flex items-center gap-1.5 text-left" disabled={l.qtd === 0}>
                                                <Icon name={abertos[l.id] ? 'ChevronDown' : 'ChevronRight'} size={14} color={l.qtd ? 'var(--color-muted-foreground)' : '#CBD5E1'} />
                                                {l.nome}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            {l.qtd > 0 ? l.qtd : <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}>sem lançamento</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{l.qtd ? NUM(l.litrosDiesel) : '—'}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{l.qtd ? NUM(l.litrosArla) : '—'}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{l.ultima ? FMT(l.ultima) : '—'}</td>
                                        <td className="px-4 py-2.5 text-right font-semibold" style={{ color: '#059669' }}>{l.qtd ? BRL(l.total) : '—'}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            <button type="button" onClick={() => onAbrirPainel(l.motorista)} title="Abrir painel do motorista (editar/lançar)"
                                                className="p-1.5 rounded hover:bg-blue-50"><Icon name="ExternalLink" size={15} color="#1D4ED8" /></button>
                                        </td>
                                    </tr>
                                    {abertos[l.id] && (
                                        <tr style={{ backgroundColor: '#F8FAFC' }}>
                                            <td colSpan={7} className="px-4 py-3">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr style={{ color: 'var(--color-muted-foreground)' }}>
                                                            {['Data', 'Placa', 'Posto', 'Diesel (L)', 'R$ Diesel', 'Arla (L)', 'R$ Arla', 'Total'].map((h, i) => (
                                                                <th key={h} className={`py-1 font-medium ${i < 3 ? 'text-left' : 'text-right'}`}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {l.registros.map(a => (
                                                            <tr key={a.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                                <td className="py-1.5 whitespace-nowrap">{FMT(a.data_abastecimento)}</td>
                                                                <td className="py-1.5 font-medium text-blue-700">{a.veiculo_caminhao_placa || a.veiculo?.placa || '—'}</td>
                                                                <td className="py-1.5 max-w-[140px] truncate">{a.posto || '—'}</td>
                                                                <td className="py-1.5 text-right">{NUM(a.litros_diesel)}</td>
                                                                <td className="py-1.5 text-right">{BRL(a.valor_diesel)}</td>
                                                                <td className="py-1.5 text-right">{NUM(a.litros_arla)}</td>
                                                                <td className="py-1.5 text-right">{BRL(a.valor_arla)}</td>
                                                                <td className="py-1.5 text-right font-semibold" style={{ color: '#7C3AED' }}>{BRL(a.valor_total)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <PaginationBar {...pag} itemLabel="motorista" />
        </div>
    );
}
