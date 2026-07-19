// Deduz se um item de romaneio é uma "telha de zinco" (corte por metro) e sua
// peça/metragem — mesmo em registros antigos, criados antes de as colunas
// is_telha_zinco/comprimento_telha/metros_totais existirem em romaneio_itens.
// Nesse caso, calcula o comprimento por peça a partir do peso já gravado:
//   comprimento (m) = (peso_total / quantidade) / peso_base_metro_do_material
export function getTelhaInfo(item) {
    const mat = item?.materials || {};
    const isTelha = !!item?.is_telha_zinco || !!mat.is_telha_zinco;
    if (!isTelha) return { isTelha: false, compTelha: 0, metros: 0 };

    let compTelha = Number(item.comprimento_telha) || 0;
    let metros    = Number(item.metros_totais) || 0;
    const qtd     = Number(item.quantidade) || 0;

    if (!compTelha && qtd > 0) {
        const pesoBaseMetro = Number(mat.peso_base_metro) || 3.8;
        const pesoUnitImplicito = Number(item.peso_total) / qtd;
        if (pesoBaseMetro > 0 && pesoUnitImplicito > 0) {
            compTelha = pesoUnitImplicito / pesoBaseMetro;
        }
    }
    if (!metros && compTelha && qtd > 0) metros = compTelha * qtd;

    return { isTelha: true, compTelha, metros };
}
