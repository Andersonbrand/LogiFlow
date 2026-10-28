import { supabase } from '../supabaseClient';
import { normalizarCidadeBA } from '../../utils/cidadeUtils';

// ── Autocomplete ──────────────────────────────────────────────────────────────
export async function fetchMotoristas() {
    // Retorna lista de nomes únicos dos romaneios existentes (autocomplete)
    const { data } = await supabase.from('romaneios').select('motorista').not('motorista','is',null);
    return [...new Set((data||[]).map(r=>r.motorista).filter(Boolean))].sort();
}

// Retorna motoristas com UUID — usado para vincular motorista_id ao criar romaneio
export async function fetchMotoristasComId() {
    const { data } = await supabase
        .from('user_profiles')
        .select('id, name, tipo_veiculo')
        .eq('role', 'motorista')          // apenas motoristas de caminhão
        .neq('tipo_veiculo', 'carreta')   // exclui motoristas de carreta
        .order('name');
    return data || [];
}

// Cidades cadastradas oficialmente no LogiFlow (cadastro de Fretes por Cidade
// do módulo de Carretas — `carretas_fretes`), não mais um histórico de textos
// já digitados em romaneios anteriores. Mantém isso uniforme com o resto do
// sistema. Como o cadastro guarda só o nome da cidade (sem UF), adiciona
// ", BA" — todas essas cidades são da região de atuação (Bahia) — pra manter
// o mesmo formato "Cidade, UF" que o cálculo de rota por IA já usava e
// precisa pra geocodificar com precisão.
export async function fetchDestinos() {
    const { data, error } = await supabase
        .from('carretas_fretes')
        .select('cidade')
        .not('cidade', 'is', null);
    if (error) throw error;
    const nomes = [...new Set((data || []).map(r => (r.cidade || '').trim()).filter(Boolean))];
    // Padroniza todas: sem parênteses e sempre terminando em ", BA" — nunca some
    // exceção, senão o cálculo de rota da IA integrada fica impreciso.
    return [...new Set(nomes.map(c => normalizarCidadeBA(c)))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
