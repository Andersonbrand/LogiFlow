// ═══════════════════════════════════════════════════════════════════════════
// LogiFlow — Geração automática de parcelas (boletos/cartão/cheque) e
// detecção de lançamentos de despesa possivelmente duplicados.
//
// Usado nas 3 telas de despesa a prazo: Despesas (caminhões),
// Despesas Administrativas (transporte) e Despesas (dentro de Carretas).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gera um array de parcelas (boleto, cartão ou cheque) a partir do valor
 * total, quantidade de parcelas e regras de vencimento — sem exigir que o
 * admin digite cada parcela uma a uma. O resultado continua 100% editável
 * (cada campo pode ser alterado ou removido manualmente depois de gerado).
 *
 * @param {Object} opcoes
 * @param {number} opcoes.valorTotal            - valor total da despesa a prazo
 * @param {number} opcoes.quantidade            - número de parcelas
 * @param {string} opcoes.primeiroVencimento    - 'YYYY-MM-DD' da 1ª parcela
 * @param {number} [opcoes.intervaloDias=30]    - intervalo entre parcelas, em dias
 * @param {'boleto'|'cartao'|'cheque'} [opcoes.tipo='boleto']
 * @param {number} [opcoes.numeroBoletoInicial] - nº do 1º boleto (numeração sequencial)
 * @param {string} [opcoes.cartao]              - nome do cartão (quando tipo === 'cartao')
 * @returns {Array<object>} parcelas prontas para ir em `boletos` ou `parcelas_cartao`
 */
export function gerarParcelasAutomaticas({
    valorTotal,
    quantidade,
    primeiroVencimento,
    intervaloDias = 30,
    tipo = 'boleto',
    numeroBoletoInicial = null,
    cartao = '',
}) {
    const total = Number(valorTotal) || 0;
    const qtd = Math.max(1, Math.floor(Number(quantidade) || 1));
    if (!primeiroVencimento) throw new Error('Informe a data de vencimento da 1ª parcela.');

    // Divide em centavos pra evitar erro de arredondamento (ex: 100/3 = 33,33 x3 ≠ 100,00).
    // A diferença de centavos fica toda na última parcela.
    const totalCentavos = Math.round(total * 100);
    const baseCentavos = Math.floor(totalCentavos / qtd);
    const restoCentavos = totalCentavos - baseCentavos * qtd;

    const [ano, mes, dia] = primeiroVencimento.split('-').map(Number);

    const parcelas = [];
    for (let i = 0; i < qtd; i++) {
        const centavos = baseCentavos + (i === qtd - 1 ? restoCentavos : 0);
        const dataVenc = new Date(Date.UTC(ano, mes - 1, dia + intervaloDias * i));
        const vencimento = dataVenc.toISOString().slice(0, 10);

        const base = {
            valor: Number((centavos / 100).toFixed(2)),
            vencimento,
            pago: false,
            entregue_financeiro: false,
        };

        if (tipo === 'boleto') {
            parcelas.push({
                ...base,
                numero_boleto: numeroBoletoInicial ? String(numeroBoletoInicial + i) : String(i + 1).padStart(2, '0') + `/${String(qtd).padStart(2, '0')}`,
            });
        } else if (tipo === 'cartao') {
            parcelas.push({ ...base, cartao, parcela: `${i + 1}/${qtd}` });
        } else {
            parcelas.push({ ...base, numero: i + 1 });
        }
    }
    return parcelas;
}

/**
 * Soma de conferência: garante que a geração bateu centavo a centavo com o
 * valor total informado (útil pra exibir junto do botão "Gerar parcelas").
 */
export function somaParcelas(parcelas) {
    return (parcelas || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Detecção de lançamentos duplicados
// ═══════════════════════════════════════════════════════════════════════════

function normalizarTexto(v) {
    return String(v || '')
        .trim()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove acentos
}

function normalizarPlaca(v) {
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); // ABC-1234 / ABC1D23 → só letras/números
}

function diasEntre(d1, d2) {
    if (!d1 || !d2) return Infinity;
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    if (Number.isNaN(t1) || Number.isNaN(t2)) return Infinity;
    return Math.abs(t1 - t2) / 86400000;
}

/**
 * Compara uma despesa nova (ainda não salva) contra as despesas já
 * cadastradas, e retorna as que parecem ser o mesmo lançamento repetido —
 * mesma nota fiscal, ou mesmo fornecedor + placa/veículo + valor muito
 * próximo em data. Não bloqueia o salvamento sozinho: quem decide é o admin,
 * a função só sinaliza pra tela mostrar o alerta.
 *
 * @param {Array<object>} despesasExistentes - lista já carregada na tela
 * @param {object} novaDespesa - dados do formulário antes de salvar
 * @param {Object} [opcoes]
 * @param {string} [opcoes.excluirId] - id da própria despesa (ao editar, não comparar consigo mesma)
 * @param {number} [opcoes.janelaDias=5] - tolerância de dias para considerar "mesma época"
 * @returns {Array<{despesa: object, motivo: string, confianca: 'alta'|'media'}>}
 */
export function detectarPossiveisDuplicatas(despesasExistentes, novaDespesa, { excluirId, janelaDias = 5 } = {}) {
    const nf = normalizarTexto(novaDespesa.nota_fiscal);
    const fornecedor = normalizarTexto(novaDespesa.empresa || novaDespesa.fornecedor);
    const placa = normalizarPlaca(novaDespesa.placa || novaDespesa.veiculo?.placa);
    const valor = Number(novaDespesa.valor) || 0;
    const data = novaDespesa.data_despesa;

    const achados = [];

    for (const d of despesasExistentes || []) {
        if (excluirId && d.id === excluirId) continue;

        const dNf = normalizarTexto(d.nota_fiscal);
        const dFornecedor = normalizarTexto(d.empresa || d.fornecedor);
        const dPlaca = normalizarPlaca(d.placa || d.veiculo?.placa);
        const dValor = Number(d.valor) || 0;

        // Confiança ALTA: mesma nota fiscal + mesmo fornecedor (não pode ser coincidência)
        if (nf && dNf && nf === dNf && fornecedor && dFornecedor && fornecedor === dFornecedor) {
            achados.push({ despesa: d, motivo: `Mesma nota fiscal (${novaDespesa.nota_fiscal}) e mesmo fornecedor.`, confianca: 'alta' });
            continue;
        }

        // Confiança MÉDIA: mesmo fornecedor + mesma placa/veículo + valor idêntico + data próxima
        const mesmoValor = valor > 0 && Math.abs(dValor - valor) < 0.01;
        const mesmaEpoca = diasEntre(data, d.data_despesa) <= janelaDias;
        if (fornecedor && dFornecedor && fornecedor === dFornecedor && mesmoValor && mesmaEpoca) {
            if (placa && dPlaca && placa === dPlaca) {
                achados.push({ despesa: d, motivo: `Mesmo fornecedor, mesma placa (${novaDespesa.placa || ''}) e mesmo valor, em data próxima.`, confianca: 'alta' });
            } else {
                achados.push({ despesa: d, motivo: `Mesmo fornecedor e mesmo valor, em data próxima (${Math.round(diasEntre(data, d.data_despesa))} dia(s) de diferença).`, confianca: 'media' });
            }
        }
    }

    return achados;
}
