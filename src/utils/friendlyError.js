// Traduz erros técnicos (Supabase, rede, navegador) para mensagens que o
// usuário final entende e sabe o que fazer.
//
// Uso direto:   showToast(mensagemAmigavel(err, 'carregar os dados'), 'error')
// Uso central:  useToast() já aplica `suavizarMensagem` em toda mensagem de
//               erro/aviso, então telas antigas ("Erro ao carregar: " + e.message)
//               passam a mostrar texto amigável sem alteração.
//
// O erro técnico original SEMPRE vai para o console (F12) para diagnóstico.

// Ordem importa: o primeiro padrão que casar vence.
const REGRAS = [
    {
        // Conflito de sessão entre abas/janelas ou aba que ficou "dormindo"
        teste: /lock broken|steal.{0,10}option|lock.{0,40}not released|NavigatorLock|AbortError/i,
        msg: 'A conexão foi interrompida por alguns instantes (provavelmente há outra aba do sistema aberta ou a aba estava inativa). Tente novamente — se persistir, feche as outras abas do LogiFlow e atualize a página (F5).',
    },
    {
        teste: /timeout|timed out|tempo.{0,10}esgot/i,
        msg: 'O servidor demorou demais para responder. Verifique sua internet e tente novamente.',
    },
    {
        teste: /failed to fetch|networkerror|network request failed|load failed|err_internet|err_network|fetch failed/i,
        msg: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
    },
    {
        teste: /jwt expired|invalid jwt|refresh token|session.{0,20}(expired|missing|not found)|not authenticated|auth session missing/i,
        msg: 'Sua sessão expirou. Saia do sistema e entre novamente.',
    },
    {
        teste: /row-level security|violates row-level|permission denied|not authorized|\b42501\b|\b401\b|\b403\b/i,
        msg: 'Você não tem permissão para realizar esta ação. Fale com um administrador.',
    },
    {
        teste: /duplicate key|already exists|unique constraint|\b23505\b/i,
        msg: 'Este registro já existe no sistema.',
    },
    {
        teste: /foreign key|violates.*constraint|\b23503\b/i,
        msg: 'Não foi possível concluir: este registro está vinculado a outros dados.',
    },
    {
        teste: /\b5\d\d\b.*(error|server)|bad gateway|service unavailable|gateway time/i,
        msg: 'O servidor está temporariamente indisponível. Aguarde um momento e tente novamente.',
    },
];

function textoDe(err) {
    if (!err) return '';
    if (typeof err === 'string') return err;
    return [err.name, err.message, err.code, err.details, err.hint].filter(Boolean).join(' ');
}

/** true se o texto parece um erro técnico que sabemos traduzir. */
export function ehErroTecnico(texto) {
    const t = textoDe(texto);
    return REGRAS.some(r => r.teste.test(t));
}

/**
 * Converte um erro (objeto ou texto) em mensagem amigável.
 * `acao` é opcional, ex.: 'carregar os dados', 'salvar o romaneio'.
 */
export function mensagemAmigavel(err, acao) {
    const t = textoDe(err);
    const regra = REGRAS.find(r => r.teste.test(t));
    if (regra) {
        console.warn('[LogiFlow] erro original:', err);
        return regra.msg;
    }
    const prefixo = acao ? `Não foi possível ${acao}.` : 'Ocorreu um erro inesperado.';
    return t ? `${prefixo} Detalhe: ${t}` : prefixo;
}

/**
 * Usado pelo useToast: recebe a mensagem já montada pela tela
 * ("Erro ao carregar: AbortError: Lock broken...") e, se reconhecer o erro
 * técnico, troca por texto amigável mantendo o contexto ("Erro ao carregar").
 * Mensagens que não são técnicas passam intactas.
 */
export function suavizarMensagem(msg, tipo) {
    if (tipo !== 'error' && tipo !== 'warning') return msg;
    if (typeof msg !== 'string') return msg;
    const regra = REGRAS.find(r => r.teste.test(msg));
    if (!regra) return msg;
    console.warn('[LogiFlow] erro original:', msg);
    // Mantém o início "Erro ao carregar" (antes dos dois-pontos) como contexto
    const contexto = msg.split(':')[0].trim();
    const temContexto = /^(erro|falha|não foi possível)/i.test(contexto) && contexto.length < 60;
    return temContexto ? `${contexto}. ${regra.msg}` : regra.msg;
}
