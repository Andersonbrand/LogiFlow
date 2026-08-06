-- Registra a data/hora em que a diária foi de fato lançada dentro do romaneio,
-- independente da data de criação do romaneio em si.
--
-- Problema: um romaneio pode ser criado num mês (ex.: 24/07) e ficar
-- "Aguardando" liberação por dias; quando a diária é preenchida dentro dele
-- só depois (ex.: 01/08), o custo era contabilizado no período do romaneio
-- (created_at), não no período em que a diária foi realmente lançada.
--
-- diaria_criada_em é preenchida automaticamente no app assim que
-- custo_motorista passa a ter valor > 0 pela primeira vez, e não é mais
-- alterada depois disso (mesmo que a diária seja editada) — mesma lógica já
-- usada para não alterar retroativamente uma diária já assinada.

ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS diaria_criada_em timestamptz;

COMMENT ON COLUMN romaneios.diaria_criada_em IS
    'Data/hora em que a diária do motorista (custo_motorista) foi lançada pela primeira vez dentro deste romaneio. Usada para contabilizar a diária no período correto, mesmo que o romaneio tenha sido criado em outro mês.';

-- Backfill: para romaneios já existentes com diária lançada, assume a data
-- de criação do romaneio como aproximação (não há como recuperar a data real
-- do lançamento retroativamente).
UPDATE romaneios
SET diaria_criada_em = created_at
WHERE custo_motorista > 0
  AND diaria_criada_em IS NULL;
