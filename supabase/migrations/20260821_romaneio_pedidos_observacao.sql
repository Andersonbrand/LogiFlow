-- Adiciona campo de observação aos pedidos do romaneio de CAMINHÕES
-- (tabela romaneio_pedidos, usada pelo módulo de Romaneios fora do Carretas)
ALTER TABLE romaneio_pedidos
    ADD COLUMN IF NOT EXISTS observacao text;
