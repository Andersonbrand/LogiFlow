import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CHECKLISTS
// ─────────────────────────────────────────────────────────────────────────────
// Lista padrão (fallback) — usada apenas se a tabela `carretas_checklist_itens`
// ainda não existir/estiver vazia (ex: antes de rodar a migration). A fonte
// da verdade passou a ser o banco, editável pelo admin — ver fetchChecklistItens.
export const CHECKLIST_ITENS = [
    { id: 'pneus',       label: 'Pneus em bom estado' },
    { id: 'iluminacao',  label: 'Iluminação funcionando' },
    { id: 'cintas',      label: 'Cintas de amarração' },
    { id: 'freios',      label: 'Freios em ordem' },
    { id: 'documentos',  label: 'Documentos do veículo' },
    { id: 'extintor',    label: 'Extintor de incêndio' },
    { id: 'triangulo',   label: 'Triângulo de segurança' },
    { id: 'macaco',      label: 'Macaco e chave de roda' },
    { id: 'espelhos',    label: 'Espelhos retrovisores' },
    { id: 'vazamentos',  label: 'Sem vazamentos (óleo/combustível)' },
];

// ── Itens configuráveis do checklist (admin) ───────────────────────────────
export async function fetchChecklistItens(somenteAtivos = true) {
    let q = supabase.from('carretas_checklist_itens').select('*').order('ordem', { ascending: true });
    if (somenteAtivos) q = q.eq('ativo', true);
    const { data, error } = await q;
    if (error) {
        // Tabela ainda não existe (migration não rodou) — usa a lista fixa como fallback.
        console.warn('carretas_checklist_itens indisponível, usando lista padrão:', error.message);
        return CHECKLIST_ITENS.map((i, idx) => ({ id: i.id, label: i.label, ordem: idx, ativo: true }));
    }
    return data && data.length ? data : CHECKLIST_ITENS.map((i, idx) => ({ id: i.id, label: i.label, ordem: idx, ativo: true }));
}

export async function createChecklistItem(label) {
    const { data: existentes } = await supabase.from('carretas_checklist_itens').select('ordem').order('ordem', { ascending: false }).limit(1);
    const proximaOrdem = existentes && existentes.length ? Number(existentes[0].ordem) + 1 : 1;
    const { data, error } = await supabase
        .from('carretas_checklist_itens')
        .insert({ label: label.trim(), ordem: proximaOrdem, ativo: true })
        .select().single();
    if (error) throw error;
    return data;
}

export async function updateChecklistItem(id, fields) {
    const { data, error } = await supabase
        .from('carretas_checklist_itens')
        .update(fields)
        .eq('id', id)
        .select().single();
    if (error) throw error;
    return data;
}

export async function deleteChecklistItem(id) {
    const { error } = await supabase.from('carretas_checklist_itens').delete().eq('id', id);
    if (error) throw error;
}

export async function reordenarChecklistItem(id, direcao, itensAtuais) {
    // direcao: 'up' | 'down' — troca a `ordem` com o item vizinho na lista já ordenada.
    const idx = itensAtuais.findIndex(i => i.id === id);
    const alvoIdx = direcao === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || alvoIdx < 0 || alvoIdx >= itensAtuais.length) return;
    const atual = itensAtuais[idx];
    const alvo  = itensAtuais[alvoIdx];
    await Promise.all([
        updateChecklistItem(atual.id, { ordem: alvo.ordem }),
        updateChecklistItem(alvo.id, { ordem: atual.ordem }),
    ]);
}

// ── Helpers de leitura de `itens` (jsonb) — compatíveis com dois formatos:
//    ANTIGO: { [itemId]: true|false }
//    NOVO:   { [itemId]: { ok: bool, obs: string, label: string } }
//    O formato novo grava o `label` junto, para o histórico continuar correto
//    mesmo que o admin depois renomeie ou exclua o item.
export function itemIsOk(valor) {
    if (valor && typeof valor === 'object') return !!valor.ok;
    return !!valor;
}

export function itemObsOf(valor) {
    return (valor && typeof valor === 'object') ? (valor.obs || '') : '';
}

export function itemLabelOf(valor, id) {
    if (valor && typeof valor === 'object' && valor.label) return valor.label;
    const found = CHECKLIST_ITENS.find(i => i.id === id);
    return found ? found.label : id;
}

// Conta quantos itens estão OK dentro de um objeto `itens` (qualquer formato).
export function contarItensOk(itens) {
    return Object.values(itens || {}).filter(itemIsOk).length;
}

export async function fetchChecklists(filters = {}) {
    let q = supabase
        .from('carretas_checklists')
        .select(`
            *,
            motorista:motorista_id(id, name),
            veiculo:veiculo_id(id, placa)
        `)
        .order('created_at', { ascending: false });

    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.pendente)    q = q.eq('aprovado', false);
    if (filters.dataInicio)  q = q.gte('created_at', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('created_at', filters.dataFim + 'T23:59:59');

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createChecklist(checklist, onProgressoFotos) {
    const fotos = await uploadFotosChecklistSeNecessario(checklist.fotos_urls, onProgressoFotos);
    const { data, error } = await supabase
        .from('carretas_checklists')
        .insert({ ...checklist, fotos_urls: fotos, foto_url: fotos[0] || checklist.foto_url || '', aprovado: false })
        .select()
        .single();
    if (error) throw error;
    // _fotosFalhas: quantas fotos selecionadas não conseguiram ser enviadas
    // (checklist é salvo mesmo assim com as que deram certo). As telas que
    // chamam createChecklist usam isso pra avisar o motorista.
    return { ...data, _fotosFalhas: fotos.falhas || 0 };
}

export async function updateChecklist(id, fields, onProgressoFotos) {
    const patch = { ...fields };
    let fotosFalhas = 0;
    if (patch.fotos_urls) {
        patch.fotos_urls = await uploadFotosChecklistSeNecessario(patch.fotos_urls, onProgressoFotos);
        fotosFalhas = patch.fotos_urls.falhas || 0;
        if (patch.foto_url !== undefined) patch.foto_url = patch.fotos_urls[0] || patch.foto_url || '';
    }
    const { data, error } = await supabase
        .from('carretas_checklists')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return { ...data, _fotosFalhas: fotosFalhas };
}

// ─── Upload de fotos do checklist ────────────────────────────────────────────
// As fotos chegam do MultiFotoField como data-URLs base64 (ex: "data:image/...").
// Enviar isso direto pro banco (coluna jsonb) fazia o payload do checklist
// passar de dezenas de MB quando havia várias fotos, e o insert/update no
// Supabase ficava "carregando" pra sempre sem nunca terminar (corpo grande
// demais). Agora, antes de gravar, cada foto em base64 é enviada pro Storage
// (bucket "checklist-fotos") e trocada pela URL pública — bem mais leve.
// Fotos que já são URL (ex: ao editar um checklist existente) são mantidas.
//
// IMPORTANTE (ago/2026): isto rodava com Promise.all — as N fotos subiam
// todas AO MESMO TEMPO. Em wifi de escritório isso é ótimo, mas motorista
// envia checklist do pátio/estrada com sinal de celular fraco: 8 uploads
// simultâneos brigando pela mesma conexão instável faziam a imensa maioria
// cair (timeout/conexão perdida no meio do upload), sobrando só 1 ou 2 —
// exatamente o "de 8 fotos só 1 chegou" relatado. Trocado para SEQUENCIAL
// (uma foto de cada vez) com retry automático, que é muito mais confiável
// em rede móvel mesmo sendo um pouco mais lento.
async function uploadUmaFotoComRetry(foto, idx, tentativas = 3) {
    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
        try {
            const resp = await fetch(foto);
            const blob = await resp.blob();
            const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0];
            const nome = `checklist_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('checklist-fotos').upload(nome, blob, { contentType: blob.type, upsert: true });
            if (uploadErr) throw uploadErr;
            const { data: urlData } = supabase.storage.from('checklist-fotos').getPublicUrl(uploadData.path);
            return urlData?.publicUrl || null;
        } catch (e) {
            console.error(`Falha ao enviar foto do checklist (tentativa ${tentativa}/${tentativas}):`, e);
            if (tentativa < tentativas) {
                // pequena pausa antes de tentar de novo — dá tempo da conexão
                // móvel se recuperar em vez de martelar a rede instável
                await new Promise(r => setTimeout(r, 600 * tentativa));
            }
        }
    }
    return null;
}

async function uploadFotosChecklistSeNecessario(fotos, onProgresso) {
    if (!Array.isArray(fotos) || fotos.length === 0) return fotos || [];
    let falhas = 0;
    const urls = [];
    for (let idx = 0; idx < fotos.length; idx++) {
        const foto = fotos[idx];
        if (typeof foto !== 'string' || !foto.startsWith('data:')) {
            urls.push(foto); // já é uma URL (edição de checklist existente)
            onProgresso?.(idx + 1, fotos.length);
            continue;
        }
        const url = await uploadUmaFotoComRetry(foto, idx);
        if (url) urls.push(url); else falhas += 1;
        onProgresso?.(idx + 1, fotos.length);
    }
    urls.falhas = falhas;
    urls.falhas = falhas;
    return urls;
}

export async function aprovarChecklist(id, adminId) {
    const { data, error } = await supabase
        .from('carretas_checklists')
        .update({ aprovado: true, aprovado_por: adminId, aprovado_em: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function registrarManutencaoChecklist(id, observacao) {
    const { data, error } = await supabase
        .from('carretas_checklists')
        .update({ manutencao_registrada: true, obs_manutencao: observacao })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}
