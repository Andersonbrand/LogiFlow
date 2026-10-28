import { createDespesasService } from './createDespesasService';

// Despesas ADMINISTRATIVAS (transporte) — usa a fábrica compartilhada com as tabelas próprias desta tela.
// Categorias vivem no banco (não em localStorage), iguais para todos os dispositivos.
const s = createDespesasService({
    tabela: 'transporte_despesas_adm',
    tabelaCategorias: 'despesas_adm_categorias',
    tabelaFornecedores: 'despesas_adm_fornecedores',
    fornecedoresUpdatedAt: true,
    filtros: { categoria: 'categoria', formaPgto: 'forma_pagamento' },
});

export const CATEGORIAS_DESPESA_ADM = [
    'Pneus em Estoque',
    'Materiais de Escritório',
    'Equipamentos e Ferramentas',
    'Uniformes / EPIs',
    'Limpeza e Higiene',
    'Informática / Tecnologia',
    'Comunicação / Telefonia',
    'Manutenção Predial',
    'Energia Elétrica',
    'Água e Saneamento',
    'Aluguel / Locação',
    'Seguros Administrativos',
    'Taxas e Impostos',
    'Serviços Terceirizados',
    'Alimentação / Refeições',
    'Treinamento / Capacitação',
    'Marketing / Publicidade',
    'Viagens Administrativas',
    'Outros',
];

export const fetchCategoriasDespesaAdm = s.fetchCategorias;
export const createCategoriaDespesaAdm = s.createCategoria;
export const renameCategoriaDespesaAdm = s.renameCategoria;
export const deleteCategoriaDespesaAdm = s.deleteCategoria;

export const fetchDespesasAdmTransporte = s.fetchDespesas;
export const createDespesaAdmTransporte = s.createDespesa;
export const updateDespesaAdmTransporte = s.updateDespesa;
export const deleteDespesaAdmTransporte = s.deleteDespesa;
export const fetchDespesaAdmPorId = s.fetchDespesaPorId;
export const salvarBoletosDespesaAdm = s.salvarBoletos;

export const pagarBoletoAdmTransporte = s.pagarBoleto;
export const revogarBoletoAdmTransporte = s.revogarBoleto;
export const pagarParcelaCartaoAdmTransporte = s.pagarParcelaCartao;
export const revogarParcelaCartaoAdmTransporte = s.revogarParcelaCartao;

export const fetchFornecedoresAdmTransporte = s.fetchFornecedores;
export const createFornecedorAdmTransporte = s.createFornecedor;
export const updateFornecedorAdmTransporte = s.updateFornecedor;
export const deleteFornecedorAdmTransporte = s.deleteFornecedor;
