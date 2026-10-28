// ─── Proteção e feedback de clique para TODOS os botões do LogiFlow ───────────
// Instalado uma vez em src/index.jsx. Funciona em captura, antes de qualquer onClick:
//  1) Feedback visual: o botão "afunda" rapidamente (classe lf-pressed) ao ser clicado.
//  2) Duplo clique: um 2º clique no MESMO botão em menos de 400 ms é descartado.
//  3) Botões de gravação (Salvar, Registrar, Lançar, Confirmar, Excluir...) ficam
//     travados por 1,5 s após o clique (classe lf-locked) — evita lançamento em
//     duplicidade quando a internet está lenta e o usuário clica de novo.
// Exceções: botão com data-repeat (paginação, +/-), desabilitado, ou dentro de [data-repeat].

const JANELA_PADRAO_MS = 400;
const JANELA_GRAVACAO_MS = 1500;
const ROTULO_GRAVACAO = /^\s*(salvar|registrar|lan[çc]ar|confirmar|finalizar|enviar|criar|cadastrar|adicionar|gravar|aprovar|reprovar|pagar|excluir|remover|importar|gerar|emitir|solicitar|reportar|atualizar|concluir|iniciar)/i;

const ultimoClique = new WeakMap();

export function installButtonGuard() {
    if (typeof document === 'undefined' || window.__lfButtonGuard) return;
    window.__lfButtonGuard = true;

    document.addEventListener('click', (ev) => {
        const alvo = ev.target instanceof Element ? ev.target : null;
        const btn = alvo?.closest('button, [role="button"]');
        if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
        if (btn.closest('[data-repeat]')) return;

        const agora = Date.now();
        const rotulo = (btn.innerText || btn.textContent || btn.getAttribute('aria-label') || btn.title || '').trim();
        // btn.type devolve 'submit' para QUALQUER <button> sem atributo type — só vale submit explícito ou botão dentro de <form>
        const tipoAttr = btn.getAttribute('type');
        const submit = tipoAttr === 'submit' || (!tipoAttr && !!btn.form);
        const gravacao = submit || ROTULO_GRAVACAO.test(rotulo);
        const janela = gravacao ? JANELA_GRAVACAO_MS : JANELA_PADRAO_MS;
        const anterior = ultimoClique.get(btn) || 0;

        if (agora - anterior < janela) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            return;
        }
        ultimoClique.set(btn, agora);

        // feedback visual de clique
        btn.classList.remove('lf-pressed');
        void btn.offsetWidth; // reinicia a animação
        btn.classList.add('lf-pressed');
        setTimeout(() => btn.classList.remove('lf-pressed'), 260);

        if (gravacao) {
            btn.classList.add('lf-locked');
            setTimeout(() => btn.classList.remove('lf-locked'), janela);
        }
    }, true);
}
