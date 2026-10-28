import {
    CATEGORIAS_DESPESA_ADM, fetchCategoriasDespesaAdm, createCategoriaDespesaAdm,
    renameCategoriaDespesaAdm, deleteCategoriaDespesaAdm, fetchDespesasAdmTransporte,
    createDespesaAdmTransporte, updateDespesaAdmTransporte, deleteDespesaAdmTransporte, fetchDespesaAdmPorId,
    salvarBoletosDespesaAdm, pagarBoletoAdmTransporte, revogarBoletoAdmTransporte,
    pagarParcelaCartaoAdmTransporte, revogarParcelaCartaoAdmTransporte,
} from 'services/despesas/admTransporteDespesas';

// Configuração da tela de despesas ADMINISTRATIVAS (transporte) para o módulo compartilhado components/Despesas.
export const despesasAdmConfig = {
    icone: 'ShoppingCart',
    comVeiculo: false,
    tabela: 'transporte_despesas_adm',
    origemBoletos: 'adm',
    categoriasPadrao: CATEGORIAS_DESPESA_ADM,
    categoriaPadrao: undefined, // usa a primeira categoria da lista
    servico: {
        fetchCategorias: fetchCategoriasDespesaAdm,
        createCategoria: createCategoriaDespesaAdm,
        renameCategoria: renameCategoriaDespesaAdm,
        deleteCategoria: deleteCategoriaDespesaAdm,
        fetchDespesas: fetchDespesasAdmTransporte,
        createDespesa: createDespesaAdmTransporte,
        updateDespesa: updateDespesaAdmTransporte,
        deleteDespesa: deleteDespesaAdmTransporte,
        fetchDespesaPorId: fetchDespesaAdmPorId,
        salvarBoletos: salvarBoletosDespesaAdm,
        pagarBoleto: pagarBoletoAdmTransporte,
        revogarBoleto: revogarBoletoAdmTransporte,
        pagarParcelaCartao: pagarParcelaCartaoAdmTransporte,
        revogarParcelaCartao: revogarParcelaCartaoAdmTransporte,
    },
    textos: {
        titulo: 'Despesas Administrativas — Transporte',
        subtitulo: 'Controle de compras e despesas administrativas do setor de transporte',
        placeholderBusca: 'NF, nº boleto, fornecedor...',
        nenhumaDespesa: 'Nenhuma despesa administrativa registrada',
        tituloNovaDespesa: 'Nova Despesa Administrativa',
        placeholderFornecedor: 'Ex: Fórum Papelaria',
        placeholderDescricao: 'Ex: 10 resmas de papel A4, canetas, grampeadores',
        placeholderDescricaoNf: 'Ex: Compra de pneus',
        arquivoExcel: 'despesas_adm_transporte',
        abaExcel: 'Desp. Adm. Transporte',
    },
};
