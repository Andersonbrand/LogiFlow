import { createDespesasService } from './createDespesasService';

// Despesas de CAMINHÕES — usa a fábrica compartilhada com as tabelas próprias desta tela.
const VEICULO = '*, veiculo:vehicle_id(id, placa, tipo)';
const s = createDespesasService({
    tabela: 'caminhoes_despesas',
    tabelaCategorias: 'caminhoes_despesas_categorias',
    tabelaFornecedores: 'caminhoes_fornecedores',
    selectLista: VEICULO, selectCriar: VEICULO, selectAtualizar: VEICULO,
    filtros: { vehicleId: 'vehicle_id', empresa: 'empresa', categoria: 'categoria', formaPgto: 'forma_pagamento' },
});

export const CATEGORIAS_DESPESA_CAMINHOES = [
    'Pneus', 'Peças', 'Acessórios', 'Oficina / Mão de obra',
    'Depreciação', 'Seguro', 'IPVA / Licenciamento', 'Lavagem',
    'Pedágio', 'Multas', 'Combustível extra', 'Outros',
];

export const fetchCategoriasDespesaCaminhoes = s.fetchCategorias;
export const createCategoriaDespesaCaminhoes = s.createCategoria;
export const renameCategoriaDespesaCaminhoes = s.renameCategoria;
export const deleteCategoriaDespesaCaminhoes = s.deleteCategoria;

export const fetchDespesasCaminhoes = s.fetchDespesas;
export const createDespesaCaminhao = s.createDespesa;
export const updateDespesaCaminhao = s.updateDespesa;
export const deleteDespesaCaminhao = s.deleteDespesa;
export const fetchDespesaCaminhaoPorId = s.fetchDespesaPorId;
export const salvarBoletosDespesaCaminhao = s.salvarBoletos;

export const pagarBoletoCaminhao = s.pagarBoleto;
export const revogarBoletoCaminhao = s.revogarBoleto;
export const pagarParcelaCartaoCaminhao = s.pagarParcelaCartao;
export const revogarParcelaCartaoCaminhao = s.revogarParcelaCartao;

export const fetchFornecedoresCaminhoes = s.fetchFornecedores;
export const createFornecedorCaminhao = s.createFornecedor;
export const updateFornecedorCaminhao = s.updateFornecedor;
export const deleteFornecedorCaminhao = s.deleteFornecedor;
