import { supabase } from '../supabaseClient';

/**
 * Fábrica do serviço de despesas.
 * As telas de despesas de Carretas, Caminhões e Administrativas fazem as mesmas operações,
 * só mudam as tabelas (e o vínculo com o veículo). Cada serviço informa a sua configuração
 * e recebe as funções prontas — o dado de cada tela continua indo para a sua própria tabela.
 *
 * config:
 *  - tabela:              tabela das despesas
 *  - tabelaCategorias:    tabela das categorias
 *  - tabelaFornecedores:  tabela de fornecedores (legado, por tela)
 *  - fornecedoresUpdatedAt: true se o update de fornecedor grava updated_at
 *  - selectLista/selectCriar/selectAtualizar: colunas retornadas ('*' + join do veículo etc.)
 *  - filtros:             { nomeDoFiltro: 'coluna' } aceitos em fetchDespesas (igualdade)
 */
export function createDespesasService(config) {
    const {
        tabela, tabelaCategorias, tabelaFornecedores,
        fornecedoresUpdatedAt = false,
        selectLista = '*', selectCriar, selectAtualizar,
        filtros = {},
    } = config;
    const agora = () => new Date().toISOString();

    // ── Categorias ──────────────────────────────────────────────────────────
    async function fetchCategorias() {
        const { data, error } = await supabase.from(tabelaCategorias).select('*').order('nome', { ascending: true });
        if (error) throw error;
        return (data || []).map((c) => c.nome);
    }
    async function createCategoria(nome, criadoPor = null) {
        const { data, error } = await supabase.from(tabelaCategorias).insert({ nome, criado_por: criadoPor }).select().single();
        if (error) throw error;
        return data;
    }
    async function renameCategoria(nomeAntigo, nomeNovo) {
        const { error } = await supabase.from(tabelaCategorias).update({ nome: nomeNovo }).eq('nome', nomeAntigo);
        if (error) throw error;
    }
    async function deleteCategoria(nome) {
        const { error } = await supabase.from(tabelaCategorias).delete().eq('nome', nome);
        if (error) throw error;
    }

    // ── Despesas ────────────────────────────────────────────────────────────
    async function fetchDespesas(f = {}) {
        let q = supabase.from(tabela).select(selectLista).order('data_despesa', { ascending: false });
        for (const [nome, coluna] of Object.entries(filtros)) if (f[nome]) q = q.eq(coluna, f[nome]);
        if (f.dataInicio) q = q.gte('data_despesa', f.dataInicio);
        if (f.dataFim) q = q.lte('data_despesa', f.dataFim);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    }
    async function createDespesa(despesa) {
        const { data, error } = await supabase.from(tabela).insert(despesa).select(selectCriar).single();
        if (error) throw error;
        return data;
    }
    async function updateDespesa(id, updates) {
        const { data, error } = await supabase.from(tabela).update({ ...updates, updated_at: agora() })
            .eq('id', id).select(selectAtualizar).single();
        if (error) throw error;
        return data;
    }
    async function deleteDespesa(id) {
        const { error } = await supabase.from(tabela).delete().eq('id', id);
        if (error) throw error;
    }
    /** Busca uma despesa por id (com o veículo, quando a tela tem). */
    async function fetchDespesaPorId(id) {
        const { data } = await supabase.from(tabela).select(selectLista).eq('id', id).single();
        return data || null;
    }
    /** Salva a lista de boletos da despesa. Retorna { error }. */
    function salvarBoletos(id, boletos) {
        return supabase.from(tabela).update({ boletos, updated_at: agora() }).eq('id', id);
    }

    // ── Baixa / revogação de boletos e parcelas de cartão ───────────────────
    async function alterarItem(despesaId, coluna, idx, alterar) {
        const { data: atual } = await supabase.from(tabela).select(coluna).eq('id', despesaId).single();
        const lista = [...(atual?.[coluna] || [])];
        if (lista[idx]) lista[idx] = alterar(lista[idx]);
        const { data, error } = await supabase.from(tabela).update({ [coluna]: lista, updated_at: agora() })
            .eq('id', despesaId).select().single();
        if (error) throw error;
        return data;
    }
    const pagar = (item) => ({ ...item, pago: true, pago_em: agora() });
    const revogar = (item) => { const { pago_em: _pagoEm, ...resto } = item; return { ...resto, pago: false }; };
    const pagarBoleto = (id, idx) => alterarItem(id, 'boletos', idx, pagar);
    const revogarBoleto = (id, idx) => alterarItem(id, 'boletos', idx, revogar);
    const pagarParcelaCartao = (id, idx) => alterarItem(id, 'parcelas_cartao', idx, pagar);
    const revogarParcelaCartao = (id, idx) => alterarItem(id, 'parcelas_cartao', idx, revogar);

    // ── Fornecedores (tabela por tela; o cadastro global está em fornecedoresService) ──
    async function fetchFornecedores() {
        const { data, error } = await supabase.from(tabelaFornecedores).select('*').order('nome', { ascending: true });
        if (error) throw error;
        return data || [];
    }
    async function createFornecedor(fornecedor) {
        const { data, error } = await supabase.from(tabelaFornecedores).insert(fornecedor).select().single();
        if (error) throw error;
        return data;
    }
    async function updateFornecedor(id, updates) {
        const dados = fornecedoresUpdatedAt ? { ...updates, updated_at: agora() } : updates;
        const { data, error } = await supabase.from(tabelaFornecedores).update(dados).eq('id', id).select().single();
        if (error) throw error;
        return data;
    }
    async function deleteFornecedor(id) {
        const { error } = await supabase.from(tabelaFornecedores).delete().eq('id', id);
        if (error) throw error;
    }

    return {
        fetchCategorias, createCategoria, renameCategoria, deleteCategoria,
        fetchDespesas, createDespesa, updateDespesa, deleteDespesa, fetchDespesaPorId, salvarBoletos,
        pagarBoleto, revogarBoleto, pagarParcelaCartao, revogarParcelaCartao,
        fetchFornecedores, createFornecedor, updateFornecedor, deleteFornecedor,
    };
}
