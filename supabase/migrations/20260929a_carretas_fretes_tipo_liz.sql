-- A aba "Frete Estoque" grava linhas com tipo = 'liz', mas o CHECK original da tabela
-- só aceitava 'frota' e 'terceiros'. Resultado: nada era salvo no banco (a tela mostrava
-- só a lista inicial em memória) e o Carregamento no Estoque não achava nenhuma cidade.
ALTER TABLE carretas_fretes DROP CONSTRAINT IF EXISTS carretas_fretes_tipo_check;
ALTER TABLE carretas_fretes
    ADD CONSTRAINT carretas_fretes_tipo_check CHECK (tipo IN ('frota', 'terceiros', 'liz'));
