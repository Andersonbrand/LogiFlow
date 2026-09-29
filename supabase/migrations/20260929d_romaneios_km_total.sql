-- ATENÇÃO: rode SOMENTE depois de publicar o front novo e depois da migration 20260929c.
--
-- Mudança de regra: romaneios.distancia_km passa a guardar o KM TOTAL (ida+volta),
-- o mesmo valor usado no cálculo de combustível. Antes guardava só a ida.
-- Romaneios antigos (rota_config ainda nulo) são convertidos uma única vez: km x 2.
-- A marca em rota_config impede converter duas vezes se o script rodar de novo.
--
-- 1) Confira antes (opcional):
--    SELECT numero, distancia_km AS ida, distancia_km * 2 AS total
--    FROM romaneios WHERE rota_config IS NULL AND COALESCE(distancia_km, 0) > 0;
--
-- 2) Converter:
UPDATE romaneios
SET distancia_km = distancia_km * 2,
    rota_config  = jsonb_build_object('km_total', true, 'migrado_de_ida', true)
WHERE rota_config IS NULL
  AND COALESCE(distancia_km, 0) > 0;
--
-- Para desfazer (só as linhas convertidas por este script):
--    UPDATE romaneios SET distancia_km = distancia_km / 2, rota_config = NULL
--    WHERE rota_config ->> 'migrado_de_ida' = 'true';
