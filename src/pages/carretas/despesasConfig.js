import {
    CATEGORIAS_DESPESA, fetchCategoriasDespesaCarretas, createCategoriaDespesaCarretas,
    renameCategoriaDespesaCarretas, deleteCategoriaDespesaCarretas, fetchDespesasExtras,
    createDespesaExtra, updateDespesaExtra, deleteDespesaExtra,
    pagarBoletoCarreta, revogarBoletoCarreta, pagarParcelaCartaoCarreta, revogarParcelaCartaoCarreta,
    despesasCarretasService,
} from 'services/carretas';

// Configuração das despesas de CARRETAS para o módulo compartilhado components/Despesas.
export const despesasCarretasConfig = {
    icone: 'Receipt',
    comVeiculo: true,
    campoVeiculo: 'veiculo_id',
    campoDescricaoVeiculo: 'modelo',
    tabela: 'carretas_despesas_extras',
    origemBoletos: 'carretas',
    categoriasPadrao: CATEGORIAS_DESPESA,
    categoriaPadrao: 'Pneus',
    servico: {
        fetchCategorias: fetchCategoriasDespesaCarretas,
        createCategoria: createCategoriaDespesaCarretas,
        renameCategoria: renameCategoriaDespesaCarretas,
        deleteCategoria: deleteCategoriaDespesaCarretas,
        fetchDespesas: fetchDespesasExtras,
        createDespesa: createDespesaExtra,
        updateDespesa: updateDespesaExtra,
        deleteDespesa: deleteDespesaExtra,
        fetchDespesaPorId: despesasCarretasService.fetchDespesaPorId,
        salvarBoletos: despesasCarretasService.salvarBoletos,
        pagarBoleto: pagarBoletoCarreta,
        revogarBoleto: revogarBoletoCarreta,
        pagarParcelaCartao: pagarParcelaCartaoCarreta,
        revogarParcelaCartao: revogarParcelaCartaoCarreta,
    },
    textos: {
        tituloNovaDespesa: 'Nova Despesa',
        placeholderFornecedor: 'Ex: Auto Peças Silva Ltda',
        placeholderDescricao: 'Ex: 4 pneus traseiros Bridgestone',
        placeholderDescricaoNf: 'Ex: NF de peças',
    },
};
