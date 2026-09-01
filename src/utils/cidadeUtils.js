// ─── Normalização de nomes de cidade (tabela de fretes / destinos de romaneio) ─
// Padrão exigido: "Nome da Cidade, BA" — sem parênteses com informação extra,
// e SEMPRE terminando em ", BA", sem exceção. Isso é usado pelo sistema de
// cálculo de rota (IA integrada), que fica impreciso se o nome vier em formatos
// diferentes (com "(Por Matina)", sem UF, etc.).
export function normalizarCidadeBA(cidadeBruta, uf = 'BA') {
    if (!cidadeBruta) return '';
    let cidade = String(cidadeBruta)
        .replace(/\([^)]*\)/g, ' ')   // remove qualquer "(...)" — ex: "(Por Matina)"
        .replace(/\s+/g, ' ')         // colapsa espaços duplicados deixados pela remoção
        .trim()
        .replace(/,\s*$/, '');        // remove vírgula sobrando no final

    // Já termina com ", BA" (ou outra UF de 2 letras)? Não duplica.
    if (/,\s*[A-Za-z]{2}$/.test(cidade)) {
        // normaliza a UF para maiúsculas (ex: ", ba" -> ", BA")
        return cidade.replace(/,\s*([A-Za-z]{2})$/, (_, u) => `, ${u.toUpperCase()}`);
    }
    return `${cidade}, ${uf}`;
}
