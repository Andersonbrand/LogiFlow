/**
 * corredoresService.js
 * CRUD de corredores de rota no Supabase.
 * Tabela: rota_corredores { id, nome, label, icone, cidades: text[] }
 */
import { supabase } from './supabaseClient';

// Corredores padrão — usados como fallback se o banco estiver vazio
export const CORREDORES_PADRAO = [
    {
        nome: 'norte',
        label: '↑ Norte (BR-030 → Lapa / Ibotirama)',
        icone: 'ArrowUp',
        cidades: [
            'bom jesus da lapa', 'ibotirama', 'barra', 'xique-xique', 'xique xique',
            'brotas de macaubas', 'brotas de macaúbas', 'ipupiara', 'canarana',
            'lapão', 'lapao', 'gentio do ouro', 'america dourada', 'barro alto',
            'iraquara', 'seabra', 'boninal', 'palmeiras',
        ],
    },
    {
        nome: 'nordeste',
        label: '↗ Nordeste (Caetité / Brumado)',
        icone: 'ArrowUpRight',
        cidades: [
            'caetité', 'caetite', 'brumado', 'livramento de nossa senhora', 'livramento',
            'tanhaçu', 'tanhacu', 'itiruçu', 'itirucu', 'jequié', 'jequie',
            'vitória da conquista', 'vitoria da conquista', 'poções', 'pocoes',
            'itapetinga', 'maiquinique',
        ],
    },
    {
        nome: 'leste_norte',
        label: '→ Leste-Norte (Palmas / Lagoa Real)',
        icone: 'ArrowRight',
        cidades: [
            'palmas de monte alto', 'sebastião laranjeiras', 'sebastiao laranjeiras',
            'lagoa real', 'ituaçu', 'ituacu', 'contendas do sincorá', 'anagé', 'anage', 'planalto',
        ],
    },
    {
        nome: 'leste_sul',
        label: '→ Leste-Sul (Candiba / Caculé)',
        icone: 'ArrowRight',
        cidades: [
            'candiba', 'pindaí', 'pindai', 'ibiassucê', 'ibiassuce',
            'caculé', 'cacule', 'jacaraci', 'licínio de almeida', 'licinio de almeida',
            'mortugaba', 'cordeiros',
        ],
    },
    {
        nome: 'sul',
        label: '↓ Sul (Carinhanha / Correntina)',
        icone: 'ArrowDown',
        cidades: [
            'carinhanha', 'feira da mata', 'coribe', 'santana', 'correntina',
            'jaborandi', 'formosa do rio preto', 'barreiras', 'luís eduardo magalhães',
            'luis eduardo magalhaes', 'santa rita de cássia', 'santa rita de cassia',
        ],
    },
    {
        nome: 'oeste',
        label: '← Oeste (Malhada / Urandi)',
        icone: 'ArrowLeft',
        cidades: ['malhada', 'iuiu', 'iuiú', 'urandi', 'riacho de santana', 'igaporã', 'igapora'],
    },
    {
        nome: 'sul_proximo',
        label: '↓ Sul Próximo (Paratinga / Macaúbas)',
        icone: 'ArrowDown',
        cidades: ['paratinga', 'macaúbas', 'macaubas', 'ibitiara'],
    },
];

// Cache em memória para evitar buscas repetidas durante a sessão
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function fetchCorredores() {
    // Retorna cache se ainda válido
    if (_cache && Date.now() - _cacheTs < CACHE_TTL) return _cache;

    try {
        const { data, error } = await supabase
            .from('rota_corredores')
            .select('*')
            .order('nome', { ascending: true });

        if (error || !data || data.length === 0) {
            // Banco vazio ou erro: usa padrão e tenta popular o banco
            if (!error) await popularCorredoresPadrao();
            _cache = CORREDORES_PADRAO;
        } else {
            _cache = data.map(d => ({
                ...d,
                // cidades pode vir como array (postgres text[]) ou string JSON
                cidades: Array.isArray(d.cidades)
                    ? d.cidades
                    : (typeof d.cidades === 'string' ? JSON.parse(d.cidades) : []),
            }));
        }
        _cacheTs = Date.now();
        return _cache;
    } catch {
        return CORREDORES_PADRAO;
    }
}

async function popularCorredoresPadrao() {
    try {
        for (const c of CORREDORES_PADRAO) {
            await supabase.from('rota_corredores').upsert(
                { nome: c.nome, label: c.label, icone: c.icone, cidades: c.cidades },
                { onConflict: 'nome' }
            );
        }
    } catch { /* silencioso */ }
}

export async function upsertCorredor(corredor) {
    const { data, error } = await supabase
        .from('rota_corredores')
        .upsert(
            { nome: corredor.nome, label: corredor.label, icone: corredor.icone, cidades: corredor.cidades },
            { onConflict: 'nome' }
        )
        .select()
        .single();
    if (error) throw error;
    _cache = null; // invalida cache
    return data;
}

export async function deleteCorredor(nome) {
    const { error } = await supabase
        .from('rota_corredores')
        .delete()
        .eq('nome', nome);
    if (error) throw error;
    _cache = null;
}

export function invalidarCache() {
    _cache = null;
    _cacheTs = 0;
}
