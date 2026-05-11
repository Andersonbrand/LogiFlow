-- ═══════════════════════════════════════════════════════════════════════════════
-- LogiFlow — Numeração Compartilhada de Romaneios
-- Garante que romaneios do admin (romaneios) e do motorista (carretas_romaneios)
-- com mesmo motorista + destino + data_saida compartilhem o mesmo número.
-- Execute no Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Garante coluna motorista_id em romaneios (admin) ──────────────────────
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS motorista_id uuid REFERENCES auth.users(id);

-- ── 2. Índices para lookup rápido de romaneio existente ─────────────────────
CREATE INDEX IF NOT EXISTS idx_romaneios_motorista_destino_saida
    ON romaneios (motorista_id, destino, saida);

CREATE INDEX IF NOT EXISTS idx_carretas_romaneios_motorista_destino_data
    ON carretas_romaneios (motorista_id, destino, data_saida);

-- ── 3. Habilita Realtime nas duas tabelas (seguro — só adiciona se ausente) ──
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'romaneios'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE romaneios;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'carretas_romaneios'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE carretas_romaneios;
    END IF;
END;
$$;

-- ── 4. Função SQL para lookup de número compartilhado ───────────────────────
-- Pode ser chamada via RPC para garantir consistência server-side.
CREATE OR REPLACE FUNCTION buscar_numero_romaneio_existente(
    p_motorista_id uuid,
    p_destino      text,
    p_data_saida   date
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_numero text;
    v_destino_norm text := lower(trim(p_destino));
BEGIN
    -- Busca na tabela romaneios (admin)
    SELECT numero INTO v_numero
    FROM romaneios
    WHERE motorista_id = p_motorista_id
      AND lower(trim(destino)) = v_destino_norm
      AND saida::date = p_data_saida
      AND numero IS NOT NULL
    LIMIT 1;

    IF v_numero IS NOT NULL THEN
        RETURN v_numero;
    END IF;

    -- Busca na tabela carretas_romaneios (motorista)
    SELECT numero INTO v_numero
    FROM carretas_romaneios
    WHERE motorista_id = p_motorista_id
      AND lower(trim(destino)) = v_destino_norm
      AND data_saida = p_data_saida
      AND numero IS NOT NULL
    LIMIT 1;

    RETURN v_numero; -- null se não encontrado
END;
$$;

-- ── 5. Função SQL para próximo número global ─────────────────────────────────
CREATE OR REPLACE FUNCTION proximo_numero_romaneio()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_carretas int := 0;
    v_max_admin    int := 0;
    v_max          int;
BEGIN
    SELECT COALESCE(
        MAX(CAST(regexp_replace(numero, '[^0-9]', '', 'g') AS int)), 0
    ) INTO v_max_carretas
    FROM carretas_romaneios
    WHERE numero IS NOT NULL;

    SELECT COALESCE(
        MAX(CAST(regexp_replace(numero, '[^0-9]', '', 'g') AS int)), 0
    ) INTO v_max_admin
    FROM romaneios
    WHERE numero IS NOT NULL;

    v_max := GREATEST(v_max_carretas, v_max_admin);
    RETURN 'ROM-' || LPAD(CAST(v_max + 1 AS text), 5, '0');
END;
$$;

-- ── 6. Garante que todos os romaneios antigos tenham formato ROM-NNNNN ────────
-- (migração opcional — normaliza números legados como ROM-2026-0001 → ROM-00001)
-- Comente este bloco se não quiser alterar os números históricos.
/*
DO $$
DECLARE
    v_next int;
BEGIN
    SELECT COALESCE(MAX(CAST(regexp_replace(numero, '[^0-9]', '', 'g') AS int)), 0) + 1
    INTO v_next
    FROM (
        SELECT numero FROM romaneios WHERE numero IS NOT NULL
        UNION ALL
        SELECT numero FROM carretas_romaneios WHERE numero IS NOT NULL
    ) t;

    UPDATE romaneios
    SET numero = 'ROM-' || LPAD(CAST(v_next + row_number() OVER (ORDER BY created_at) - 1 AS text), 5, '0')
    WHERE numero NOT LIKE 'ROM-_____' OR numero IS NULL;

    UPDATE carretas_romaneios
    SET numero = 'ROM-' || LPAD(CAST(v_next + (SELECT COUNT(*) FROM romaneios) + row_number() OVER (ORDER BY created_at) - 1 AS text), 5, '0')
    WHERE numero NOT LIKE 'ROM-_____' OR numero IS NULL;
END;
$$;
*/

-- ── 7. Permissões para a função RPC ─────────────────────────────────────────
GRANT EXECUTE ON FUNCTION buscar_numero_romaneio_existente TO authenticated;
GRANT EXECUTE ON FUNCTION proximo_numero_romaneio TO authenticated;