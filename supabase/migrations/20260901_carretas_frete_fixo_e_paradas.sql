-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Módulo de Carretas: frete fixo no romaneio + múltiplas cidades
-- Execute no Supabase SQL Editor
--
-- Escopo: SOMENTE o módulo de carretas (carretas_romaneios,
-- carretas_carregamentos, carretas_registros_viagem). Não toca em `romaneios`
-- nem em nenhuma tabela do módulo de caminhões.
--
-- ── PARTE 1 — Frete fixo no romaneio de carretas ────────────────────────────
-- O romaneio de carretas já calculava o frete somando o percentual de cada
-- pedido (carretas_romaneio_pedidos.percentual_frete). Passa a existir uma
-- alternativa, escolhida para o romaneio inteiro (substitui o cálculo por
-- pedido, não se combina com ele):
--   • 'percentual_pedido' — comportamento atual (padrão)
--   • 'percentual_fixo'   — um percentual único sobre o valor total da carga
--   • 'valor_fixo'        — um valor em R$ combinado direto com o setor de
--                           transporte (registra responsável e data)
--
-- A coluna `tipo_calculo_frete` já existia em carretas_romaneios, mas nunca
-- foi de fato usada pra alternar o cálculo (era gravada como 'fixo' sempre,
-- sem nenhum código lendo esse valor) — reaproveitada aqui com o novo
-- significado. Nenhum outro lugar do sistema depende dos valores antigos
-- ('fixo' | 'por_tonelada' | 'por_km'), então a normalização abaixo é segura.
ALTER TABLE carretas_romaneios
    ADD COLUMN IF NOT EXISTS percentual_frete_fixo   numeric(6,4),
    ADD COLUMN IF NOT EXISTS frete_fixo_responsavel   text,
    ADD COLUMN IF NOT EXISTS frete_fixo_combinado_em  date;

UPDATE carretas_romaneios
SET tipo_calculo_frete = 'percentual_pedido'
WHERE tipo_calculo_frete IS NULL
   OR tipo_calculo_frete IN ('fixo', 'por_tonelada', 'por_km');

ALTER TABLE carretas_romaneios ALTER COLUMN tipo_calculo_frete SET DEFAULT 'percentual_pedido';

COMMENT ON COLUMN carretas_romaneios.tipo_calculo_frete IS
    'Modo de cálculo do frete do romaneio de carretas: percentual_pedido (padrão, soma por pedido) | percentual_fixo (percentual único sobre valor_carga) | valor_fixo (R$ combinado com o setor de transporte).';
COMMENT ON COLUMN carretas_romaneios.percentual_frete_fixo IS
    'Percentual usado quando tipo_calculo_frete = percentual_fixo (ex.: 0.05 = 5%), aplicado sobre valor_carga.';
COMMENT ON COLUMN carretas_romaneios.frete_fixo_responsavel IS
    'Nome de quem combinou/aprovou o valor de frete fixo em R$ junto ao setor de transporte (só usado quando tipo_calculo_frete = valor_fixo).';
COMMENT ON COLUMN carretas_romaneios.frete_fixo_combinado_em IS
    'Data em que o valor de frete fixo em R$ foi combinado com o setor de transporte (só usado quando tipo_calculo_frete = valor_fixo).';

-- ── PARTE 2 — Múltiplas cidades no mesmo registro ───────────────────────────
-- Mesmo padrão que os romaneios de caminhão já usam (campo `paradas`, lista
-- de cidades intermediárias antes do destino final): adiciona a mesma coluna
-- nas 3 telas do módulo de carretas onde hoje só existe uma cidade por
-- registro. Opcional — vazia (`[]`) não muda nada do comportamento atual.
ALTER TABLE carretas_romaneios
    ADD COLUMN IF NOT EXISTS paradas jsonb DEFAULT '[]'::jsonb;

ALTER TABLE carretas_carregamentos
    ADD COLUMN IF NOT EXISTS paradas jsonb DEFAULT '[]'::jsonb;

ALTER TABLE carretas_registros_viagem
    ADD COLUMN IF NOT EXISTS paradas jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN carretas_romaneios.paradas IS
    'Cidades adicionais além do destino principal, mesmo formato usado em romaneios de caminhão. Lista JSON de strings, opcional.';
COMMENT ON COLUMN carretas_carregamentos.paradas IS
    'Cidades adicionais além do destino principal (Volume de carregamento — frota própria/terceiros/retira). Lista JSON de strings, opcional.';
COMMENT ON COLUMN carretas_registros_viagem.paradas IS
    'Cidades adicionais além do destino principal (registro de viagem do motorista de carreta). Lista JSON de strings, opcional.';

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'carretas_romaneios' AND column_name LIKE '%frete%';
-- SELECT column_name FROM information_schema.columns WHERE table_name IN ('carretas_romaneios','carretas_carregamentos','carretas_registros_viagem') AND column_name = 'paradas';
