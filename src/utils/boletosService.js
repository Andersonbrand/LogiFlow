import { supabase } from './supabaseClient';

// Painel único de boletos: junta os boletos das 3 tabelas de despesas
// (carretas, caminhões e administrativas) em uma lista só, pra dar visão
// consolidada de vencimentos e permitir baixa individual ou em massa.

const MODULOS = [
    { origem: 'carretas',  label: 'Despesas — Carretas',       tabela: 'carretas_despesas_extras' },
    { origem: 'caminhoes', label: 'Despesas — Caminhões',      tabela: 'caminhoes_despesas' },
    { origem: 'adm',       label: 'Despesas — Administrativo', tabela: 'transporte_despesas_adm' },
];

export const ORIGEM_LABEL = MODULOS.reduce((acc, m) => { acc[m.origem] = m.label; return acc; }, {});

// Busca todas as despesas com boletos (nas 3 tabelas) e "achata" em uma
// lista de boletos individuais, cada um carregando os dados da despesa-mãe.
export async function fetchTodosBoletos() {
    const resultados = await Promise.all(MODULOS.map(async (m) => {
        const { data, error } = await supabase
            .from(m.tabela)
            .select('id, categoria, fornecedor, nota_fiscal, data_despesa, boletos')
            .not('boletos', 'is', null);
        if (error) throw error;
        return (data || [])
            .filter(d => Array.isArray(d.boletos) && d.boletos.length > 0)
            .flatMap(d => d.boletos.map((b, idx) => ({
                key: `${m.origem}-${d.id}-${idx}`,
                origem: m.origem,
                origemLabel: m.label,
                tabela: m.tabela,
                despesaId: d.id,
                idx,
                numero_boleto: b.numero_boleto || '',
                vencimento: b.vencimento || null,
                valor: Number(b.valor || 0),
                pago: !!b.pago,
                pago_em: b.pago_em || null,
                entregue_financeiro: !!b.entregue_financeiro,
                categoria: d.categoria || '',
                fornecedor: d.fornecedor || '',
                nota_fiscal: d.nota_fiscal || '',
                data_despesa: d.data_despesa || null,
            })));
    }));
    return resultados.flat().sort((a, b) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999'));
}

// Dá baixa em 1+ boletos de uma vez. Aceita itens como { origem, tabela, despesaId, idx }.
// Agrupa por despesa pra fazer 1 única leitura+gravação por despesa (evita
// sobrescrever concorrentemente o array de boletos da mesma despesa).
export async function pagarBoletosEmMassa(itens) {
    const grupos = new Map(); // `${tabela}:${despesaId}` -> { tabela, despesaId, idxs: Set }
    for (const it of itens) {
        const k = `${it.tabela}:${it.despesaId}`;
        if (!grupos.has(k)) grupos.set(k, { tabela: it.tabela, despesaId: it.despesaId, idxs: new Set() });
        grupos.get(k).idxs.add(it.idx);
    }
    let atualizados = 0;
    for (const { tabela, despesaId, idxs } of grupos.values()) {
        const { data: current, error: fetchErr } = await supabase
            .from(tabela).select('boletos').eq('id', despesaId).single();
        if (fetchErr) throw fetchErr;
        const boletos = [...(current?.boletos || [])];
        const agora = new Date().toISOString();
        idxs.forEach(idx => {
            if (boletos[idx] && !boletos[idx].pago) {
                boletos[idx] = { ...boletos[idx], pago: true, pago_em: agora };
                atualizados++;
            }
        });
        const { error } = await supabase.from(tabela).update({ boletos, updated_at: agora }).eq('id', despesaId);
        if (error) throw error;
    }
    return atualizados;
}

export async function pagarBoletoUnico(item) {
    return pagarBoletosEmMassa([item]);
}
