-- Recalcula o frete dos carregamentos de ESTOQUE já salvos com R$ 0,00,
-- usando a tabela "Frete Estoque" (carretas_fretes, tipo = 'liz') pelo destino.
-- Compara só o nome da cidade (ignora ", BA", parênteses e caixa).
UPDATE carretas_carregamentos c
SET valor_base_frete = f.frete_por_saco,
    tipo_calculo_frete = 'por_saco',
    valor_frete_calculado = COALESCE(c.quantidade, 0) * f.frete_por_saco
FROM carretas_fretes f
WHERE f.tipo = 'liz'
  AND c.empresa_origem = 'ESTOQUE'
  AND COALESCE(c.valor_frete_calculado, 0) = 0
  AND lower(trim(split_part(regexp_replace(f.cidade, '\([^)]*\)', '', 'g'), ',', 1)))
    = lower(trim(split_part(regexp_replace(c.destino, '\([^)]*\)', '', 'g'), ',', 1)));
