-- ═══════════════════════════════════════════════════════════════════════════════
-- EXECUTE NO SUPABASE DASHBOARD → SQL EDITOR
-- Adiciona suporte a "Carregamento no Estoque" com seleção do tipo de cimento
-- (Montes Claros / Liz / Ambas).
--
-- Usado em dois fluxos:
--  1) Motorista carreteiro registrando uma viagem (carretas_registros_viagem) —
--     reaproveita a coluna 'local_carregamento' que já existia na tabela mas
--     nunca tinha sido usada pela interface (valor 'Estoque' marca o tipo).
--  2) Admin registrando um carregamento da frota própria (carretas_carregamentos) —
--     novo tipo 'ESTOQUE' dentro do campo empresa_origem (mesmo padrão já usado
--     para FOB/CIF).
--
-- Sem esta coluna, salvar um carregamento/viagem com tipo de cimento falha
-- silenciosamente (o app tem um retry que descarta colunas inexistentes, então
-- o registro salva mas SEM o tipo de cimento até esta migration ser executada).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE carretas_carregamentos
    ADD COLUMN IF NOT EXISTS tipo_cimento text;

ALTER TABLE carretas_registros_viagem
    ADD COLUMN IF NOT EXISTS tipo_cimento text;

COMMENT ON COLUMN carretas_carregamentos.tipo_cimento IS
    'Marca de cimento do carregamento retirado do estoque: Montes Claros | Liz | Ambas. Só preenchido quando empresa_origem = ''ESTOQUE''.';

COMMENT ON COLUMN carretas_registros_viagem.tipo_cimento IS
    'Marca de cimento da viagem registrada pelo motorista: Montes Claros | Liz | Ambas. Só preenchido quando local_carregamento = ''Estoque''.';

COMMENT ON COLUMN carretas_registros_viagem.local_carregamento IS
    'Origem do carregamento informada pelo motorista. Valor ''Estoque'' indica que a carga foi retirada do estoque próprio (não direto do fornecedor).';

-- VERIFICAÇÃO FINAL:
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('carretas_carregamentos', 'carretas_registros_viagem')
  AND column_name IN ('tipo_cimento', 'local_carregamento')
ORDER BY table_name, column_name;
