import { calcularMargemFrete } from 'services/custosFrotaService';
import { MUNICIPIOS_BA } from '../data/bahiaGeo';
import { POLOS } from './regioes';
import { parseTipo } from '../../TabVolume/utils/helpers';

// Grafias abreviadas/erradas comuns nos lançamentos → município real
const ALIASES = { 'livramento': 'livramento de nossa senhora', 'ibitira': 'ibitiara', 'malhada de pedra': 'malhada de pedras', 'palmas de m. alto': 'palmas de monte alto', 'palmas de m alto': 'palmas de monte alto' };

export const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** "Candiba, BA" / "Arapiranga, Rio de Contas" / "Urandi (por Matina)" → chave do município (ou null). */
export function chaveMunicipio(texto) {
    const limpo = String(texto || '').replace(/\([^)]*\)/g, ' ');
    const segmentos = limpo.split(/[,/\-–]/).map(semAcento).filter(Boolean);
    for (const s of segmentos) { const k = MUNICIPIOS_BA[s] ? s : ALIASES[s]; if (k && MUNICIPIOS_BA[k]) return k; }
    const todo = semAcento(limpo);
    return MUNICIPIOS_BA[todo] ? todo : (ALIASES[todo] || null);
}

export function poloMaisProximo(chave) {
    const m = MUNICIPIOS_BA[chave];
    if (!m) return null;
    let melhor = null, menor = Infinity;
    for (const p of POLOS) {
        const a = MUNICIPIOS_BA[p.ancora];
        if (!a) continue;
        const d = (a[3] - m[3]) ** 2 + ((a[4] - m[4]) * 0.97) ** 2;
        if (d < menor) { menor = d; melhor = p; }
    }
    return melhor;
}

const vazio = (chave, nome) => ({
    chave, nome, viagens: 0, sacos: 0, sacosPreco: 0, frete: 0, venda: 0, custoProduto: 0, freteMargem: 0, rodagemMargem: 0, custoRodagem: 0,
    viagensSemPreco: 0, viagensCustoEstimado: 0, viagensSemCusto: 0, ultimaData: '', clientes: {},
});

/**
 * Agrega os carregamentos da frota própria por cidade/polo.
 *  receita de frete = valor_frete_calculado do carregamento
 *  preço de venda   = sacos × valor_venda (tabela de Fretes da Frota)
 *  custo do produto = sacos × custo médio do produto (Fretes → Custos)
 *  custo de rodagem = custo da viagem na tabela de Custos de Rodagem (carreta); sem cadastro → km×2×custo/km
 *  margem bruta     = preço de venda − (custo do produto + frete)  [só viagens com preço de venda]
 *  (o custo de rodagem já é abatido da receita de frete do transporte; aqui é só informativo)
 */
export function agregarMapa({ carregamentos, fretes, custoConfig, dadosMargem }) {
    const porCidade = new Map();
    const naoLocalizados = new Map();
    const fora = { estoque: { viagens: 0, sacos: 0, frete: 0 }, outros: { viagens: 0, sacos: 0, frete: 0 } };
    const custoProduto = Number(custoConfig?.custoMedioProduto || 0) + Number(custoConfig?.custoOperacional || 0); // produto + operacional (total do painel de Custos)

    // linha de frete (cidade da tabela) → chave do município
    const freteDaChave = new Map();
    (fretes || []).forEach(f => {
        const k = chaveMunicipio(f.cidade);
        if (!k) return;
        const exata = semAcento(String(f.cidade).replace(/\([^)]*\)/g, '').replace(/,?\s*ba$/i, '')) === k;
        if (!freteDaChave.has(k) || (exata && !freteDaChave.get(k).__exata)) freteDaChave.set(k, { ...f, __exata: exata });
    });

    const garantir = (chave) => {
        if (!porCidade.has(chave)) porCidade.set(chave, vazio(chave, MUNICIPIOS_BA[chave][0]));
        return porCidade.get(chave);
    };

    (carregamentos || []).forEach(c => {
        const destino = String(c.destino || '').trim();
        const qtd = Number(c.quantidade || 0);
        const frete = Number(c.valor_frete_calculado || 0);
        // Tipo "Carregamento no Estoque" (retirada do estoque próprio): não conta como volume, igual à aba Volume de carregamento.
        // Só o frete/viagem entra nos totais (a aba Volume soma o frete de todos os registros).
        if (parseTipo(c).tipo === 'ESTOQUE') { fora.estoque.viagens += 1; fora.estoque.frete += frete; return; }
        // Destino "Estoque": é só o nome cadastrado na tabela de fretes — o estoque fica em Guanambi.
        const destinoEfetivo = semAcento(destino.split(',')[0]) === 'estoque' ? 'Guanambi, BA' : destino;
        const chave = destinoEfetivo ? chaveMunicipio(destinoEfetivo) : null;
        if (!chave) {
            fora.outros.viagens += 1; fora.outros.frete += frete; fora.outros.sacos += qtd;
            if (destino) naoLocalizados.set(destino, (naoLocalizados.get(destino) || 0) + 1);
            return;
        }
        const a = garantir(chave);
        const sacos = qtd;
        const linha = freteDaChave.get(chave);
        const precoSaco = Number(linha?.valor_venda || 0);

        a.viagens += 1; a.sacos += sacos; a.frete += frete;
        const comPreco = precoSaco > 0 && sacos > 0;
        if (comPreco) {
            a.venda += sacos * precoSaco;
            a.sacosPreco += sacos;
            a.custoProduto += sacos * custoProduto;
            a.freteMargem += frete;
        } else a.viagensSemPreco += 1;

        // custo de rodagem da viagem
        const m = dadosMargem ? calcularMargemFrete({ destinoTexto: destinoEfetivo, valorFrete: frete, ...dadosMargem }) : null;
        let rod = 0;
        if (m) rod = m.custoTotal;
        else if (Number(linha?.km) > 0 && dadosMargem?.custoPorKm) { rod = Number(linha.km) * 2 * dadosMargem.custoPorKm; a.viagensCustoEstimado += 1; }
        else a.viagensSemCusto += 1;
        a.custoRodagem += rod;
        if (comPreco) a.rodagemMargem += rod;

        if (c.data_carregamento && c.data_carregamento > a.ultimaData) a.ultimaData = c.data_carregamento;
        const cli = (c.nome_cliente || c.empresa?.nome || '').trim();
        if (cli) a.clientes[cli] = (a.clientes[cli] || 0) + sacos;
    });

    // cidades da tabela de fretes sem carregamento → "sem atendimento"
    (fretes || []).forEach(f => { const k = chaveMunicipio(f.cidade); if (k) garantir(k); });

    const cidades = Array.from(porCidade.values()).map(a => {
        const m = MUNICIPIOS_BA[a.chave];
        const polo = poloMaisProximo(a.chave);
        const linha = freteDaChave.get(a.chave);
        const temVenda = a.venda > 0;
        const custosMargem = a.custoProduto + a.freteMargem;
        return {
            ...a, x: m[1], y: m[2], lat: m[3], lng: m[4], polo: polo?.id || null,
            km: linha?.km != null ? Number(linha.km) : null,
            precoSaco: linha?.valor_venda != null ? Number(linha.valor_venda) : null,
            atendida: a.viagens > 0,
            margemReal: temVenda ? a.venda - custosMargem : null,
            margemRealPct: temVenda ? ((a.venda - custosMargem) / a.venda) * 100 : null,
            margemPorSaco: temVenda && a.sacos > 0 ? (a.venda - custosMargem) / a.sacos : null,
        };
    });

    const regioes = POLOS.map(p => {
        const doPolo = cidades.filter(c => c.polo === p.id);
        const soma = k => doPolo.reduce((s, c) => s + (c[k] || 0), 0);
        const venda = soma('venda');
        const custosMargem = soma('custoProduto') + soma('freteMargem');
        return {
            ...p, cidades: doPolo.length, atendidas: doPolo.filter(c => c.atendida).length,
            viagens: soma('viagens'), sacos: soma('sacos'), sacosPreco: soma('sacosPreco'), frete: soma('frete'), venda,
            custoProduto: soma('custoProduto'), custoRodagem: soma('custoRodagem'),
            margemReal: venda > 0 ? venda - custosMargem : null,
            margemRealPct: venda > 0 ? ((venda - custosMargem) / venda) * 100 : null,
        };
    });

    const totalVenda = cidades.reduce((s, c) => s + c.venda, 0);
    const totalCustosMargem = cidades.reduce((s, c) => s + c.custoProduto + c.freteMargem, 0);
    const totais = {
        viagens: cidades.reduce((s, c) => s + c.viagens, 0) + fora.estoque.viagens + fora.outros.viagens,
        sacos: cidades.reduce((s, c) => s + c.sacos, 0) + fora.outros.sacos,
        sacosPreco: cidades.reduce((s, c) => s + c.sacosPreco, 0),
        frete: cidades.reduce((s, c) => s + c.frete, 0) + fora.estoque.frete + fora.outros.frete,
        freteCidades: cidades.reduce((s, c) => s + c.frete, 0),
        fora,
        venda: totalVenda,
        custoProduto: cidades.reduce((s, c) => s + c.custoProduto, 0),
        custoRodagem: cidades.reduce((s, c) => s + c.custoRodagem, 0),
        margemReal: totalVenda > 0 ? totalVenda - totalCustosMargem : null,
        atendidas: cidades.filter(c => c.atendida).length,
        total: cidades.length,
        viagensSemPreco: cidades.reduce((s, c) => s + c.viagensSemPreco, 0),
        viagensCustoEstimado: cidades.reduce((s, c) => s + c.viagensCustoEstimado, 0),
        viagensSemCusto: cidades.reduce((s, c) => s + c.viagensSemCusto, 0),
    };
    return { cidades, regioes, totais, naoLocalizados: Array.from(naoLocalizados, ([destino, qtd]) => ({ destino, qtd })) };
}

export const METRICAS = [
    { id: 'sacos',        label: 'Volume (sacos)',     fmt: 'num',  campo: 'sacos' },
    { id: 'viagens',      label: 'Viagens',            fmt: 'num',  campo: 'viagens' },
    { id: 'frete',        label: 'Receita de frete',   fmt: 'brl',  campo: 'frete' },
    { id: 'venda',        label: 'Preço de venda',     fmt: 'brl',  campo: 'venda' },
    { id: 'custoRodagem', label: 'Custo de rodagem',   fmt: 'brl',  campo: 'custoRodagem' },
    { id: 'margemReal',   label: 'Margem bruta',        fmt: 'brl',  campo: 'margemReal' },
];
