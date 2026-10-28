import { createDespesasService } from '../despesas';

// Despesas EXTRAS de CARRETAS (por veículo) — usa a fábrica compartilhada com as tabelas próprias desta tela.
const s = createDespesasService({
    tabela: 'carretas_despesas_extras',
    tabelaCategorias: 'carretas_despesas_categorias',
    tabelaFornecedores: 'carretas_fornecedores',
    selectLista: '*, veiculo:veiculo_id(id, placa, modelo)',
    selectCriar: '*, veiculo:veiculo_id(id, placa, modelo)',
    filtros: { veiculoId: 'veiculo_id', categoria: 'categoria' },
});

export const despesasCarretasService = s;

export const CATEGORIAS_DESPESA = [
    'Pneus', 'Peças', 'Acessórios', 'Oficina / Mão de obra',
    'Depreciação', 'Seguro', 'IPVA / Licenciamento', 'Lavagem', 'Outros',
];

export const fetchCategoriasDespesaCarretas = s.fetchCategorias;
export const createCategoriaDespesaCarretas = s.createCategoria;
export const renameCategoriaDespesaCarretas = s.renameCategoria;
export const deleteCategoriaDespesaCarretas = s.deleteCategoria;

export const fetchDespesasExtras = s.fetchDespesas;
export const createDespesaExtra = s.createDespesa;
export const updateDespesaExtra = s.updateDespesa;
export const deleteDespesaExtra = s.deleteDespesa;

export const pagarBoletoCarreta = s.pagarBoleto;
export const revogarBoletoCarreta = s.revogarBoleto;
export const pagarParcelaCartaoCarreta = s.pagarParcelaCartao;
export const revogarParcelaCartaoCarreta = s.revogarParcelaCartao;

export const fetchFornecedoresCarretas = s.fetchFornecedores;
export const createFornecedorCarretas = s.createFornecedor;
export const updateFornecedorCarretas = s.updateFornecedor;
export const deleteFornecedorCarretas = s.deleteFornecedor;
