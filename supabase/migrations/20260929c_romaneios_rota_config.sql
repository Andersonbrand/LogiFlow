-- Guarda, por romaneio, o que o usuário escolheu/calculou na aba Viagem:
-- posto e preço do diesel, pedágio (ligado/desligado e R$/100km), litros estimados
-- e o resultado do cálculo de rota (ida, tempo, cidades, mensagens).
-- Sem isso, ao reabrir a edição tudo voltava ao padrão.
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS rota_config jsonb;
