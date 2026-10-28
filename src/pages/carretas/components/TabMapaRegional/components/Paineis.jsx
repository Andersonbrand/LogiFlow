import React from 'react';
import { AppIcon as Icon } from 'components';
import { fNum, fBRL, fBRL2, fPct, fData, fCompacto } from '../utils/format';

const card = 'rounded-2xl border bg-white';
const bord = { borderColor: 'var(--color-border)' };
const corMargem = v => (v == null ? '#64748B' : v >= 0 ? '#15803D' : '#B91C1C');

export function Kpi({ icon, label, valor, sub, cor = '#1D4ED8' }) {
    return (
        <div className={`${card} p-4 relative overflow-hidden`} style={bord}>
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10" style={{ background: cor }} />
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                <Icon name={icon} size={14} color={cor} />{label}
            </div>
            <p className="text-xl sm:text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{valor}</p>
            {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{sub}</p>}
        </div>
    );
}

export function KpisTotais({ t, regioes }) {
    const melhorFrete = [...regioes].sort((a, b) => b.frete - a.frete)[0];
    const maiorRodagem = [...regioes].sort((a, b) => b.custoRodagem - a.custoRodagem)[0];
    const precoMedio = t.sacosPreco > 0 ? t.venda / t.sacosPreco : null;
    const margemSaco = t.sacosPreco > 0 && t.margemReal != null ? t.margemReal / t.sacosPreco : null;
    const f = t.fora || { estoque: { viagens: 0, frete: 0 }, outros: { viagens: 0, frete: 0 } };
    const subFrete = [f.estoque.viagens > 0 ? `${f.estoque.viagens} viagens 'Carregamento no Estoque' (${fBRL(f.estoque.frete)}) só no frete` : '', f.outros.viagens > 0 ? `${f.outros.viagens} sem cidade no mapa` : ''].filter(Boolean).join(' · ');
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon="MapPin" label="Cidades atendidas" valor={`${t.atendidas} de ${t.total}`} sub={`${t.total - t.atendidas} sem atendimento`} cor="#1D4ED8" />
            <Kpi icon="Package" label="Volume entregue" valor={`${fNum(t.sacos)} sacos`} sub={`${fNum(t.viagens)} viagens`} cor="#0EA5E9" />
            <Kpi icon="DollarSign" label="Receita de frete" valor={fBRL(t.frete)} sub={subFrete || (melhorFrete?.frete > 0 ? `Maior: ${melhorFrete.nome.split(' · ')[1] || melhorFrete.nome}` : '')} cor="#16A34A" />
            <Kpi icon="Fuel" label="Custo de rodagem" valor={fBRL(t.custoRodagem)} sub={maiorRodagem?.custoRodagem > 0 ? `Maior: ${maiorRodagem.nome.split(' · ')[1] || maiorRodagem.nome}` : ''} cor="#F97316" />
            <Kpi icon="ShoppingCart" label="Preço médio de venda / saco" valor={fBRL2(precoMedio)} sub={`vendas ${fBRL(t.venda)} ÷ ${fNum(t.sacosPreco)} sacos`} cor="#6366F1" />
            <Kpi icon="TrendingUp" label="Margem bruta média / saco" valor={fBRL2(margemSaco)} sub={`total ${fBRL(t.margemReal)} ÷ ${fNum(t.sacosPreco)} sacos`} cor={t.margemReal != null && t.margemReal < 0 ? '#DC2626' : '#15803D'} />
            <Kpi icon="Percent" label="Margem bruta (%)" valor={t.margemReal != null ? fPct((t.margemReal / t.venda) * 100) : '—'} sub="venda − (produto + frete)" cor={t.margemReal != null && t.margemReal < 0 ? '#DC2626' : '#15803D'} />
            <Kpi icon="Package" label="Custo do produto" valor={fBRL(t.custoProduto)} sub="sacos × (produto + operacional)" cor="#8B5CF6" />
        </div>
    );
}

export function CardsRegioes({ regioes, destaque, onDestaque }) {
    const ordenadas = [...regioes].sort((a, b) => b.sacos - a.sacos);
    const maxSacos = Math.max(1, ...ordenadas.map(r => r.sacos));
    return (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {ordenadas.map(r => {
                const ativo = destaque === r.id;
                return (
                    <button key={r.id} type="button" data-repeat onClick={() => onDestaque(ativo ? null : r.id)}
                        className={`${card} p-4 text-left transition-all hover:shadow-md`}
                        style={{ ...bord, borderColor: ativo ? r.cor : 'var(--color-border)', boxShadow: ativo ? `0 0 0 3px ${r.cor}33` : undefined, opacity: r.cidades === 0 ? 0.5 : 1 }}>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.cor }} />
                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{r.nome}</p>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{r.atendidas} de {r.cidades} cidades atendidas</p>
                        <div className="h-1.5 rounded-full bg-gray-100 mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(r.sacos / maxSacos) * 100}%`, background: r.cor }} /></div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-xs">
                            <span style={{ color: 'var(--color-text-secondary)' }}>Volume</span><span className="text-right font-medium">{fNum(r.sacos)} sacos</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Frete</span><span className="text-right font-medium">{fBRL(r.frete)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Venda</span><span className="text-right font-medium">{fBRL(r.venda)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Produto</span><span className="text-right font-medium">{fBRL(r.custoProduto)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Rodagem</span><span className="text-right font-medium">{fBRL(r.custoRodagem)}</span>
                            <span className="font-semibold">Margem bruta</span>
                            <span className="text-right font-bold" style={{ color: corMargem(r.margemReal) }}>{fBRL(r.margemReal)}{r.margemRealPct != null ? ` · ${fPct(r.margemRealPct)}` : ''}</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

export function DetalheCidade({ cidade, polo, onFechar }) {
    if (!cidade) {
        return (
            <div className={`${card} p-5 text-center text-sm`} style={{ ...bord, color: 'var(--color-text-secondary)' }}>
                <Icon name="MousePointerClick" size={22} color="currentColor" />
                <p className="mt-2">Clique em uma cidade do mapa para ver o resultado das vendas e a margem bruta.</p>
            </div>
        );
    }
    const clientes = Object.entries(cidade.clientes).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const linhas = [
        ['Viagens', fNum(cidade.viagens)], ['Volume', `${fNum(cidade.sacos)} sacos`],
        ['Preço de venda', fBRL(cidade.venda)], ['Preço por saco (tabela)', cidade.precoSaco != null ? `R$ ${cidade.precoSaco.toFixed(2).replace('.', ',')}` : '—'], ['(−) Custo do produto', fBRL(cidade.custoProduto)],
        ['(−) Frete do transporte', fBRL(cidade.freteMargem)],
    ];
    return (
        <div className={`${card} p-5`} style={bord}>
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>{cidade.nome}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{polo?.nome || '—'}{cidade.km != null ? ` · ${cidade.km} km` : ''}</p>
                </div>
                <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 rounded hover:bg-gray-100"><Icon name="X" size={16} color="currentColor" /></button>
            </div>
            {!cidade.atendida ? (
                <p className="mt-4 text-sm px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>Sem carregamentos da frota própria no período — oportunidade de atendimento.</p>
            ) : (
                <>
                    <div className="mt-3 space-y-1.5 text-sm">
                        {linhas.map(([k, v]) => <div key={k} className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>{k}</span><span className="font-medium">{v}</span></div>)}
                        <div className="flex justify-between pt-2 border-t" style={bord}>
                            <span className="font-semibold">Margem bruta</span>
                            <span className="font-bold" style={{ color: corMargem(cidade.margemReal) }}>{fBRL(cidade.margemReal)}{cidade.margemRealPct != null ? ` · ${fPct(cidade.margemRealPct)}` : ''}</span>
                        </div>
                        {cidade.margemPorSaco != null && <div className="flex justify-between text-xs"><span style={{ color: 'var(--color-text-secondary)' }}>Margem bruta por saco</span><span>{fBRL(cidade.margemPorSaco).replace(/^R\$\s?/, 'R$ ')}</span></div>}
                        <div className="flex justify-between text-xs"><span style={{ color: 'var(--color-text-secondary)' }}>Última entrega</span><span>{fData(cidade.ultimaData)}</span></div>
                    </div>
                    {cidade.viagensSemPreco > 0 && <p className="mt-3 text-xs px-2 py-1.5 rounded bg-amber-50 text-amber-800">{cidade.viagensSemPreco} viagem(ns) sem preço de venda na tabela de fretes — fora do cálculo de venda.</p>}
                    {clientes.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs font-semibold mb-1">Principais clientes (sacos)</p>
                            {clientes.map(([n, q]) => <div key={n} className="flex justify-between text-xs"><span className="truncate pr-2">{n}</span><span>{fNum(q)}</span></div>)}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export function RankingCidades({ cidades, metrica, onSelecionar, selecionada }) {
    const lista = cidades.filter(c => c.atendida).sort((a, b) => (b[metrica.campo] ?? -Infinity) - (a[metrica.campo] ?? -Infinity)).slice(0, 10);
    const max = Math.max(1, ...lista.map(c => Math.abs(c[metrica.campo] || 0)));
    return (
        <div className={`${card} p-4`} style={bord}>
            <p className="text-sm font-semibold mb-3">Ranking de cidades · {metrica.label}</p>
            {lista.length === 0 && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Sem carregamentos no período.</p>}
            <div className="space-y-2">
                {lista.map((c, i) => (
                    <button key={c.chave} type="button" data-repeat onClick={() => onSelecionar(c.chave)} className="w-full text-left">
                        <div className="flex justify-between text-xs mb-0.5">
                            <span className={selecionada === c.chave ? 'font-bold' : ''}>{i + 1}. {c.nome}</span>
                            <span className="font-medium">{metrica.fmt === 'brl' ? fCompacto(c[metrica.campo]) : fNum(c[metrica.campo])}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(2, (Math.abs(c[metrica.campo] || 0) / max) * 100)}%` }} /></div>
                    </button>
                ))}
            </div>
        </div>
    );
}

export function SemAtendimento({ cidades, onSelecionar, naoLocalizados }) {
    const lista = cidades.filter(c => !c.atendida).sort((a, b) => a.nome.localeCompare(b.nome));
    return (
        <div className={`${card} p-4`} style={bord}>
            <p className="text-sm font-semibold mb-1">Cidades da tabela de fretes sem atendimento ({lista.length})</p>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>Sem carregamentos da frota própria no período selecionado.</p>
            <div className="flex flex-wrap gap-1.5">
                {lista.length === 0 && <span className="text-xs text-green-700">Todas as cidades da tabela foram atendidas 🎉</span>}
                {lista.map(c => (
                    <button key={c.chave} type="button" data-repeat onClick={() => onSelecionar(c.chave)} className="px-2.5 py-1 rounded-full text-xs border hover:bg-red-50" style={{ borderColor: '#FCA5A5', color: '#B91C1C' }}>{c.nome}</button>
                ))}
            </div>
            {naoLocalizados.length > 0 && (
                <p className="text-xs mt-3 px-2 py-1.5 rounded bg-amber-50 text-amber-800">
                    Destinos não localizados no mapa: {naoLocalizados.map(n => `${n.destino} (${n.qtd})`).join(', ')}.
                </p>
            )}
        </div>
    );
}
