-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Data de referência da diária (editável pelo usuário)
-- Execute no Supabase SQL Editor
--
-- A detecção automática de "quando a diária foi lançada" (diaria_criada_em)
-- não cobre todos os caminhos que podem preencher custo_motorista — e a
-- própria tela de rascunho não tem como definir a diária no momento da
-- criação, então o momento real do lançamento nem sempre corresponde ao que
-- o sistema detecta sozinho. Em vez de perseguir cada caminho novo que pode
-- causar isso, esta coluna dá controle direto pro usuário: um campo de data
-- editável no romaneio, que — quando preenchido — manda mais que qualquer
-- detecção automática na hora de decidir em qual mês a diária conta.
ALTER TABLE romaneios
    ADD COLUMN IF NOT EXISTS diaria_mes_referencia date;

COMMENT ON COLUMN romaneios.diaria_mes_referencia IS
    'Data de referência da diária, definida manualmente pelo usuário no romaneio. Quando preenchida, tem prioridade sobre diaria_criada_em/saida/created_at para classificar em qual mês a diária é contabilizada.';
