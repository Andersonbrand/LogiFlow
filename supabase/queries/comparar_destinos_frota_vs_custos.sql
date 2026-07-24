-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Comparação: destinos usados nos fretes × destinos cadastrados
--            na tabela de custos de margem (custos_destinos)
--
-- Rode no Supabase SQL Editor. Não altera nada — é só leitura (SELECT).
--
-- Usa a mesma normalização que o app já usa em JS (normalizarDestino):
-- remove acentos, deixa minúsculo, remove parênteses tipo "(Por Matina)",
-- colapsa espaços. Isso é o que o DRE usa para tentar casar o destino do
-- frete com um destino cadastrado em custos_destinos.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists unaccent;

-- Função auxiliar de normalização (mesma regra usada no app)
create or replace function _norm_destino(txt text) returns text as $$
  select trim(regexp_replace(regexp_replace(lower(unaccent(coalesce(txt, ''))), '\([^)]*\)', ' ', 'g'), '\s+', ' ', 'g'));
$$ language sql immutable;

-- ─── 1) TODOS os destinos usados em fretes da frota própria, com o que
--        casou (ou não) na tabela de custos ────────────────────────────────
with destinos_frota as (
    select destino, count(*) as qtd_fretes
    from (
        select destino from carretas_carregamentos where coalesce(is_terceiro, false) = false and destino is not null and destino <> ''
        union all
        select destino from carretas_romaneios where destino is not null and destino <> ''
    ) t
    group by destino
),
destinos_custos as (
    select id, destino, _norm_destino(destino) as norm
    from custos_destinos
    where destino is not null
)
select
    df.destino                         as destino_usado_no_frete,
    df.qtd_fretes                      as qtd_fretes,
    dc.destino                         as destino_cadastrado_em_custos,
    case
        when dc.destino is null then '❌ SEM CADASTRO — nenhum destino de custos bate com este'
        when dc.destino = df.destino then '✅ Igual'
        else '⚠️ Cadastrado com grafia diferente'
    end as situacao
from destinos_frota df
left join lateral (
    select destino from destinos_custos
    where norm = _norm_destino(df.destino)
    limit 1
) exato on true
left join lateral (
    -- se não achou exato, tenta por trecho/substring (mesma lógica do app)
    select destino from destinos_custos
    where exato.destino is null
      and (norm like '%' || _norm_destino(df.destino) || '%' or _norm_destino(df.destino) like '%' || norm || '%')
    limit 1
) aprox on true
left join lateral (select coalesce(exato.destino, aprox.destino) as destino) dc on true
order by (dc.destino is null) desc, df.qtd_fretes desc;

-- ─── 2) Só os destinos cadastrados em custos_destinos que NUNCA aparecem
--        em nenhum frete (podem estar com erro de digitação, ou apenas
--        sem uso ainda) ───────────────────────────────────────────────────
-- select cd.destino as destino_cadastrado_sem_uso
-- from custos_destinos cd
-- where not exists (
--     select 1 from (
--         select destino from carretas_carregamentos where destino is not null
--         union all
--         select destino from carretas_romaneios where destino is not null
--     ) f
--     where _norm_destino(f.destino) = _norm_destino(cd.destino)
--        or _norm_destino(f.destino) like '%' || _norm_destino(cd.destino) || '%'
--        or _norm_destino(cd.destino) like '%' || _norm_destino(f.destino) || '%'
-- );
