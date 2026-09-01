-- Padroniza os nomes de cidade já cadastrados em carretas_fretes para o
-- formato uniforme "Nome da Cidade, BA": sem parênteses com informação
-- extra (ex: "(Por Matina)") e sempre terminando em ", BA", sem exceção.
-- Sem isso o cálculo de rota do sistema de IA integrado fica impreciso.

-- 1) Remove qualquer "(...)" e colapsa espaços duplicados deixados por isso
UPDATE carretas_fretes
SET cidade = trim(regexp_replace(
        regexp_replace(cidade, '\([^)]*\)', ' ', 'g'),
        '\s+', ' ', 'g'
    ))
WHERE cidade ~ '\(';

-- 2) Remove vírgula/espaço sobrando no final (pode ter sobrado da remoção acima)
UPDATE carretas_fretes
SET cidade = regexp_replace(cidade, ',\s*$', '')
WHERE cidade ~ ',\s*$';

-- 3) Garante que toda cidade termine em ", BA" (ou outra UF de 2 letras) —
-- nomes com vírgula por serem compostos (ex: "Arapiranga, Rio de Contas")
-- também recebem o sufixo, já que não terminam em ", XX".
UPDATE carretas_fretes
SET cidade = cidade || ', BA'
WHERE cidade !~ ',\s*[A-Za-z]{2}$';
