-- ═══════════════════════════════════════════════════════════════════════════
-- Carretas → Romaneios: ao excluir um romaneio, os números restantes são
-- reordenados automaticamente (ROM-001, ROM-002, ... sem buracos).
-- Chamada pelo front (deleteRomaneio) via supabase.rpc('renumerar_romaneios_carretas').
-- Só mexe em números no formato ROM-<dígitos>; outros valores em `numero` ficam intactos.
-- Atômica (uma transação) e em 2 fases por causa do UNIQUE em `numero`.
-- Execute no Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION renumerar_romaneios_carretas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_alterados integer;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('renumerar_romaneios_carretas'));

    CREATE TEMP TABLE _rom_novo ON COMMIT DROP AS
    SELECT id,
           numero AS numero_atual,
           'ROM-' || lpad(row_number() OVER (ORDER BY nnum, created_at, id)::text, 3, '0') AS numero_novo
    FROM (
        SELECT id, numero, created_at,
               substring(upper(btrim(numero)) from 5)::numeric AS nnum
        FROM carretas_romaneios
        WHERE upper(btrim(numero)) ~ '^ROM-[0-9]+$'
    ) s;

    DELETE FROM _rom_novo WHERE numero_atual = numero_novo;
    SELECT count(*) INTO v_alterados FROM _rom_novo;

    IF v_alterados > 0 THEN
        UPDATE carretas_romaneios c SET numero = 'TMP-' || c.id::text
          FROM _rom_novo n WHERE c.id = n.id;
        UPDATE carretas_romaneios c SET numero = n.numero_novo
          FROM _rom_novo n WHERE c.id = n.id;
    END IF;

    RETURN v_alterados;
END;
$$;

GRANT EXECUTE ON FUNCTION renumerar_romaneios_carretas() TO authenticated;

-- Opcional: compactar a numeração atual agora (corrige buracos já existentes):
-- SELECT renumerar_romaneios_carretas();
