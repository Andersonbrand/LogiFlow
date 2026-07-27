/**
 * pneusService.js
 * Serviços para o módulo de Gestão de Pneus
 * Tabelas: pneus_catalogo, pneus_compras, pneus
 */
import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO (Marca / Modelo / Medida) — listas extensíveis
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchCatalogoPneus() {
    const { data, error } = await supabase
        .from('pneus_catalogo')
        .select('*')
        .order('valor', { ascending: true });
    if (error) throw error;
    const out = { marca: [], modelo: [], medida: [], eixo: [] };
    (data || []).forEach(item => { if (out[item.tipo]) out[item.tipo].push(item.valor); });
    return out;
}

// Versão "crua", com id — usada na tela de gerenciar catálogo (editar/excluir)
export async function fetchCatalogoPneusRaw(tipo) {
    let q = supabase.from('pneus_catalogo').select('*').order('valor', { ascending: true });
    if (tipo) q = q.eq('tipo', tipo);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function addItemCatalogoPneus(tipo, valor) {
    const { data, error } = await supabase
        .from('pneus_catalogo')
        .insert({ tipo, valor: valor.trim() })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateItemCatalogoPneus(id, valor) {
    const { data, error } = await supabase
        .from('pneus_catalogo')
        .update({ valor: valor.trim() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteItemCatalogoPneus(id) {
    const { error } = await supabase
        .from('pneus_catalogo')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPRAS — vínculo com NF de Despesas Administrativas (categoria Pneus em Estoque)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchComprasPneus() {
    const { data, error } = await supabase
        .from('pneus_compras')
        .select(`
            *,
            despesa:despesa_adm_id (id, nota_fiscal, notas_fiscais, fornecedor, data_despesa, valor, categoria)
        `)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function createCompraPneus(compra) {
    const { data, error } = await supabase
        .from('pneus_compras')
        .insert(compra)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateCompraPneus(id, updates) {
    const { data, error } = await supabase
        .from('pneus_compras')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteCompraPneus(id) {
    const { error } = await supabase.from('pneus_compras').delete().eq('id', id);
    if (error) throw error;
}

// Notas fiscais lançadas em Despesas Administrativas com categoria "Pneus em
// Estoque" — usadas para o admin escolher de qual compra está saindo o saldo.
// Usamos ilike (contém "pneu", sem diferenciar maiúsc./minúsc.) para não
// perder notas caso a categoria tenha sido digitada com variação de caixa.
export async function fetchDespesasAdmPneus() {
    const { data, error } = await supabase
        .from('transporte_despesas_adm')
        .select('id, nota_fiscal, notas_fiscais, fornecedor, data_despesa, valor, categoria')
        .ilike('categoria', '%pneu%')
        .order('data_despesa', { ascending: false });
    if (error) throw error;
    return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// PNEUS — cada unidade instalada/em uso/substituída
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPneus(filters = {}) {
    let q = supabase
        .from('pneus')
        .select(`
            *,
            veiculo:veiculo_id (id, placa, modelo),
            motorista:motorista_id (id, name),
            compra:compra_id (id, quantidade, despesa_adm_id,
                despesa:despesa_adm_id (nota_fiscal, fornecedor, data_despesa))
        `)
        .order('data_instalacao', { ascending: false });

    if (filters.veiculoId) q = q.eq('veiculo_id', filters.veiculoId);
    if (filters.status)    q = q.eq('status', filters.status);
    if (filters.marca)     q = q.eq('marca', filters.marca);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createPneu(pneu) {
    const { data, error } = await supabase
        .from('pneus')
        .insert(pneu)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updatePneu(id, updates) {
    const { data, error } = await supabase
        .from('pneus')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deletePneu(id) {
    const { error } = await supabase.from('pneus').delete().eq('id', id);
    if (error) throw error;
}

// Registra a substituição do pneu (retirada de uso): grava km_final, data e
// muda o status para "substituido". Se substituirPor=true, já cria o novo
// pneu que assume o lugar (mesmo veículo/eixo).
export async function substituirPneu(id, { km_final, data_substituicao, observacoes }) {
    return updatePneu(id, {
        km_final: km_final !== '' && km_final != null ? Number(km_final) : null,
        data_substituicao: data_substituicao || new Date().toISOString().slice(0, 10),
        status: 'substituido',
        ...(observacoes !== undefined ? { observacoes } : {}),
    });
}

// Saldo de uma compra: quantidade comprada - quantidade já usada (pneus vinculados)
export function saldoCompra(compra, pneusDaCompra = []) {
    const usados = pneusDaCompra.filter(p => p.compra_id === compra.id).length;
    return Math.max(0, Number(compra.quantidade || 0) - usados);
}

// KM rodado de um pneu (só definido quando já foi substituído / tem km_final)
export function kmRodado(pneu) {
    if (pneu.km_final == null || pneu.km_atual == null) return null;
    const km = Number(pneu.km_final) - Number(pneu.km_atual);
    return km >= 0 ? km : null;
}
