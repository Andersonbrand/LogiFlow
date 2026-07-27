-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Gestão de Pneus
--
-- Cria a estrutura para o novo módulo de controle de pneus:
--   1) pneus_catalogo   -> listas extensíveis de Marca / Modelo / Medida
--                          ("deixar opção de incluir mais")
--   2) pneus_compras    -> vincula uma compra (NF lançada em Despesas
--                          Administrativas, categoria "Pneus em Estoque") a
--                          uma quantidade de pneus, para controlar o saldo
--                          disponível daquela nota
--   3) pneus            -> cada pneu instalado num veículo, referenciando
--                          opcionalmente de qual compra (saldo) ele saiu
--
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1) CATÁLOGO (Marca / Modelo / Medida) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS pneus_catalogo (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo        text        NOT NULL CHECK (tipo IN ('marca', 'modelo', 'medida')),
    valor       text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pneus_catalogo_unico
    ON pneus_catalogo (tipo, lower(valor));

INSERT INTO pneus_catalogo (tipo, valor)
VALUES
    ('marca', 'Goodyear'), ('marca', 'Firestone'), ('marca', 'Michelin'),
    ('marca', 'Amulet'), ('marca', 'Spedemax'),
    ('medida', '215'), ('medida', '275'), ('medida', '295')
ON CONFLICT DO NOTHING;

ALTER TABLE pneus_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_staff_pneus_catalogo" ON pneus_catalogo
    FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'operador')));

-- ─── 2) COMPRAS (lote de pneus vinculado a uma NF de Despesas Adm.) ──────────
CREATE TABLE IF NOT EXISTS pneus_compras (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    despesa_adm_id  uuid        REFERENCES transporte_despesas_adm(id) ON DELETE SET NULL,
    marca           text,
    modelo          text,
    medida          text,
    quantidade      integer     NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    valor_total     numeric(12,2),
    observacoes     text,
    criado_por      uuid        REFERENCES user_profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pneus_compras_despesa ON pneus_compras (despesa_adm_id);

ALTER TABLE pneus_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_staff_pneus_compras" ON pneus_compras
    FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'operador')));

-- ─── 3) PNEUS (cada unidade instalada / em uso / substituída) ────────────────
CREATE TABLE IF NOT EXISTS pneus (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    compra_id           uuid        REFERENCES pneus_compras(id) ON DELETE SET NULL,
    marca               text        NOT NULL,
    modelo              text,
    medida              text,
    categoria_bandagem  text        CHECK (categoria_bandagem IN ('mista', 'borrachudo', 'liso')),
    veiculo_id          uuid        REFERENCES carretas_veiculos(id) ON DELETE SET NULL,
    motorista_id        uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
    eixo_trocado        text,
    km_atual            numeric,
    km_final            numeric,
    data_instalacao     date        NOT NULL DEFAULT CURRENT_DATE,
    data_substituicao   date,
    status              text        NOT NULL DEFAULT 'em_uso' CHECK (status IN ('em_uso', 'substituido')),
    observacoes         text,
    criado_por          uuid        REFERENCES user_profiles(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pneus_veiculo   ON pneus (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_pneus_compra    ON pneus (compra_id);
CREATE INDEX IF NOT EXISTS idx_pneus_status    ON pneus (status);

ALTER TABLE pneus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_staff_pneus" ON pneus
    FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'operador')));

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- SELECT * FROM pneus_catalogo ORDER BY tipo, valor;
-- SELECT c.*, d.nota_fiscal, d.fornecedor, d.valor AS valor_nf,
--        c.quantidade - (SELECT count(*) FROM pneus p WHERE p.compra_id = c.id) AS saldo
-- FROM pneus_compras c LEFT JOIN transporte_despesas_adm d ON d.id = c.despesa_adm_id
-- ORDER BY c.created_at DESC;
-- SELECT * FROM pneus ORDER BY created_at DESC LIMIT 20;
