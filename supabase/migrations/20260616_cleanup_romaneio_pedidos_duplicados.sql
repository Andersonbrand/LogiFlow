-- ─────────────────────────────────────────────────────────────────────────
-- Limpeza de pedidos duplicados em romaneio_pedidos (módulo Romaneios, fora
-- de Carretas). Um bug anterior no fluxo de edição inseria os mesmos pedidos
-- duas vezes ao salvar; o cliente foi corrigido, mas os registros duplicados
-- que já existem no banco continuam sendo carregados e re-salvos em loop.
--
-- Esta migration identifica grupos de pedidos com o mesmo romaneio_id +
-- numero_pedido + valor_pedido + cidade_destino, mantém o registro mais
-- antigo (created_at) e remove os demais — reatribuindo antes os itens
-- vinculados (romaneio_itens.pedido_id) ao registro que será mantido.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Identifica duplicatas e define qual registro "sobrevive" (o mais antigo)
WITH duplicados AS (
    SELECT
        id,
        romaneio_id,
        FIRST_VALUE(id) OVER (
            PARTITION BY romaneio_id, numero_pedido, valor_pedido, COALESCE(cidade_destino, '')
            ORDER BY created_at ASC, id ASC
        ) AS id_manter
    FROM romaneio_pedidos
),
a_remover AS (
    SELECT id, id_manter FROM duplicados WHERE id <> id_manter
)

-- 2. Reatribui os itens das linhas duplicadas para a linha que vai sobreviver
UPDATE romaneio_itens ri
SET pedido_id = ar.id_manter
FROM a_remover ar
WHERE ri.pedido_id = ar.id;

-- 3. Remove os pedidos duplicados (agora sem itens vinculados)
DELETE FROM romaneio_pedidos rp
WHERE rp.id IN (
    SELECT id FROM (
        SELECT
            id,
            FIRST_VALUE(id) OVER (
                PARTITION BY romaneio_id, numero_pedido, valor_pedido, COALESCE(cidade_destino, '')
                ORDER BY created_at ASC, id ASC
            ) AS id_manter
        FROM romaneio_pedidos
    ) x
    WHERE x.id <> x.id_manter
);

COMMIT;

-- Para conferir quantos registros foram removidos, rode antes e depois:
-- SELECT count(*) FROM romaneio_pedidos;
