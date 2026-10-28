import React from 'react';

import { kmRodado } from 'services/pneusService';

import { BRL } from '../../utils/helpers';

// ─── Painel: Dashboard analítico ────────────────────────────────────────────
export default function PainelDashboard({ pneus, compras }) {
    const emUso = pneus.filter(p => p.status === 'em_uso');
    const substituidos = pneus.filter(p => p.status === 'substituido');
    const comKm = substituidos.map(p => ({ ...p, km: kmRodado(p) })).filter(p => p.km != null);

    const kmMedioGeral = comKm.length ? comKm.reduce((s, p) => s + p.km, 0) / comKm.length : 0;

    // Vida útil média e ranking por marca
    const porMarca = {};
    comKm.forEach(p => {
        if (!porMarca[p.marca]) porMarca[p.marca] = { marca: p.marca, totalKm: 0, qtd: 0 };
        porMarca[p.marca].totalKm += p.km;
        porMarca[p.marca].qtd += 1;
    });
    const rankingMarcas = Object.values(porMarca)
        .map(m => ({ ...m, media: m.totalKm / m.qtd }))
        .sort((a, b) => b.media - a.media);

    // Pneus mais utilizados (marca + modelo, contando todos os pneus, não só substituídos)
    const usoContagem = {};
    pneus.forEach(p => {
        const key = `${p.marca}${p.modelo ? ' — ' + p.modelo : ''}`;
        usoContagem[key] = (usoContagem[key] || 0) + 1;
    });
    const maisUtilizados = Object.entries(usoContagem).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Gasto por marca (soma do valor_total das compras daquela marca)
    const gastoPorMarca = {};
    compras.forEach(c => {
        gastoPorMarca[c.marca] = (gastoPorMarca[c.marca] || 0) + Number(c.valor_total || 0);
    });
    const rankingGasto = Object.entries(gastoPorMarca).sort((a, b) => b[1] - a[1]);

    // Maior volume de compra
    const rankingCompras = [...compras].sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0)).slice(0, 8);

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1E3A5F' }}>Pneus em uso</p>
                    <p className="text-2xl font-black" style={{ color: '#1D4ED8' }}>{emUso.length}</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4B5563' }}>Pneus substituídos</p>
                    <p className="text-2xl font-black" style={{ color: '#374151' }}>{substituidos.length}</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#065F46' }}>Vida útil média</p>
                    <p className="text-2xl font-black" style={{ color: '#059669' }}>{kmMedioGeral ? Math.round(kmMedioGeral).toLocaleString('pt-BR') : '—'}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#065F46' }}>km rodados por pneu</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#92400E' }}>Marca com melhor rendimento</p>
                    <p className="text-lg font-black truncate" style={{ color: '#D97706' }}>{rankingMarcas[0]?.marca || '—'}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#92400E' }}>{rankingMarcas[0] ? `${Math.round(rankingMarcas[0].media).toLocaleString('pt-BR')} km médios` : ''}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PainelTabela titulo="Vida útil média por marca (km rodados)" vazio="Sem pneus substituídos com KM registrado ainda."
                    linhas={rankingMarcas.map(m => [m.marca, `${Math.round(m.media).toLocaleString('pt-BR')} km`, `${m.qtd} pneu${m.qtd !== 1 ? 's' : ''}`])}
                    cabecalho={['Marca', 'Média km', 'Qtd.']} />

                <PainelTabela titulo="Pneus mais utilizados (marca / modelo)" vazio="Nenhum pneu cadastrado ainda."
                    linhas={maisUtilizados.map(([nome, qtd]) => [nome, `${qtd} unidade${qtd !== 1 ? 's' : ''}`])}
                    cabecalho={['Marca / Modelo', 'Quantidade']} />

                <PainelTabela titulo="Gasto por marca (compras vinculadas)" vazio="Nenhuma compra com valor lançado ainda."
                    linhas={rankingGasto.map(([marca, valor]) => [marca, BRL(valor)])}
                    cabecalho={['Marca', 'Valor total']} />

                <PainelTabela titulo="Maior volume de compra" vazio="Nenhuma compra registrada ainda."
                    linhas={rankingCompras.map(c => [`${c.marca}${c.modelo ? ' — ' + c.modelo : ''}`, `${c.quantidade} un.`, c.despesa?.nota_fiscal ? `NF ${c.despesa.nota_fiscal}` : '—'])}
                    cabecalho={['Marca / Modelo', 'Qtd.', 'NF']} />
            </div>
        </div>
    );
}

function PainelTabela({ titulo, cabecalho, linhas, vazio }) {
    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{titulo}</p>
            </div>
            {linhas.length === 0 ? (
                <p className="text-xs p-4" style={{ color: 'var(--color-muted-foreground)' }}>{vazio}</p>
            ) : (
                <table className="w-full text-xs">
                    <thead>
                        <tr>
                            {cabecalho.map(h => <th key={h} className="px-4 py-2 text-left font-semibold" style={{ color: 'var(--color-muted-foreground)' }}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {linhas.map((linha, i) => (
                            <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                {linha.map((v, j) => <td key={j} className={`px-4 py-2 ${j === 0 ? 'font-medium' : 'font-data'}`} style={{ color: j === 0 ? 'var(--color-text-primary)' : 'var(--color-muted-foreground)' }}>{v}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
