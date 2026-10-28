import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installButtonGuard } from 'utils/buttonGuard';

function montar(rotulo, extra = {}) {
    const wrap = document.createElement('div');
    if (extra.repeat) wrap.setAttribute('data-repeat', '');
    const btn = document.createElement('button');
    btn.textContent = rotulo;
    const fn = vi.fn();
    btn.addEventListener('click', fn);
    wrap.appendChild(btn); document.body.appendChild(wrap);
    return { btn, fn };
}

describe('buttonGuard', () => {
    beforeAll(() => installButtonGuard());

    it('descarta o segundo clique rápido no mesmo botão', () => {
        const { btn, fn } = montar('Detalhes');
        btn.click(); btn.click();
        expect(fn).toHaveBeenCalledTimes(1);
    });
    it('trava botão de gravação e dá feedback visual', () => {
        const { btn, fn } = montar('Salvar');
        btn.click();
        expect(btn.classList.contains('lf-pressed')).toBe(true);
        expect(btn.classList.contains('lf-locked')).toBe(true);
        btn.click();
        expect(fn).toHaveBeenCalledTimes(1);
    });
    it('botão comum sem type não recebe trava de gravação (não "pisca" em cinza)', () => {
        const { btn } = montar('Detalhar');
        btn.click();
        expect(btn.classList.contains('lf-locked')).toBe(false);
    });
    it('não bloqueia dentro de data-repeat (paginação)', () => {
        const { btn, fn } = montar('Próxima', { repeat: true });
        btn.click(); btn.click(); btn.click();
        expect(fn).toHaveBeenCalledTimes(3);
    });
});
