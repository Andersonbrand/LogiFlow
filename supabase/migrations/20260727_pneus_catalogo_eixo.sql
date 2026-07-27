-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Gestão de Pneus: Eixo Trocado vira lista extensível
--
-- "Eixo Trocado" era uma lista fixa no código. Agora vive no mesmo catálogo
-- de Marca/Modelo/Medida (pneus_catalogo), para o admin poder cadastrar,
-- editar e excluir opções direto na tela de Pneus.
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE pneus_catalogo DROP CONSTRAINT IF EXISTS pneus_catalogo_tipo_check;
ALTER TABLE pneus_catalogo ADD CONSTRAINT pneus_catalogo_tipo_check
    CHECK (tipo IN ('marca', 'modelo', 'medida', 'eixo'));

INSERT INTO pneus_catalogo (tipo, valor)
VALUES
    ('eixo', 'Dianteiro Esquerdo'), ('eixo', 'Dianteiro Direito'),
    ('eixo', 'Traseiro 1 Esquerdo Externo'), ('eixo', 'Traseiro 1 Esquerdo Interno'),
    ('eixo', 'Traseiro 1 Direito Externo'), ('eixo', 'Traseiro 1 Direito Interno'),
    ('eixo', 'Traseiro 2 Esquerdo Externo'), ('eixo', 'Traseiro 2 Esquerdo Interno'),
    ('eixo', 'Traseiro 2 Direito Externo'), ('eixo', 'Traseiro 2 Direito Interno'),
    ('eixo', 'Estepe')
ON CONFLICT DO NOTHING;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT * FROM pneus_catalogo WHERE tipo = 'eixo' ORDER BY valor;
