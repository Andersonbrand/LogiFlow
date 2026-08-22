-- ═══════════════════════════════════════════════════════════════════════════
-- LogiFlow — Criação do bucket "checklist-fotos" (Supabase Storage)
-- Execute no Supabase SQL Editor.
--
-- CONTEXTO: o código de checklists (carretasService.js) faz upload das fotos
-- pro bucket "checklist-fotos" desde a migration de múltiplas fotos
-- (20260319_checklist_multiplas_fotos.sql), mas o bucket em si NUNCA foi
-- criado no Storage — só a coluna `fotos_urls` no banco. Resultado: todo
-- upload falhava com "StorageApiError: Bucket not found" e nenhuma foto
-- (ou só a que por acaso ficou de alguma tentativa antiga) era salva.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Cria o bucket como público (as fotos precisam ser acessíveis via URL
--    pública simples pro admin visualizar, sem precisar de signed URL).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'checklist-fotos',
    'checklist-fotos',
    true,
    10485760, -- 10MB por arquivo (as fotos já chegam comprimidas pelo app, ~200-800KB)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- 2. RLS do bucket (storage.objects) — qualquer usuário autenticado
--    (motorista, carreteiro, admin) pode enviar e ler fotos de checklist;
--    leitura pública porque o bucket é público e o app usa getPublicUrl().
DROP POLICY IF EXISTS "checklist_fotos_select_public" ON storage.objects;
CREATE POLICY "checklist_fotos_select_public" ON storage.objects
    FOR SELECT USING (bucket_id = 'checklist-fotos');

DROP POLICY IF EXISTS "checklist_fotos_insert_autenticado" ON storage.objects;
CREATE POLICY "checklist_fotos_insert_autenticado" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'checklist-fotos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "checklist_fotos_update_autenticado" ON storage.objects;
CREATE POLICY "checklist_fotos_update_autenticado" ON storage.objects
    FOR UPDATE USING (bucket_id = 'checklist-fotos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "checklist_fotos_delete_admin" ON storage.objects;
CREATE POLICY "checklist_fotos_delete_admin" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'checklist-fotos'
        AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','master'))
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- Depois de rodar isto, teste de novo o envio do checklist com várias fotos.
-- Se preferir criar pelo Dashboard em vez de SQL:
--   Storage → New bucket → nome exatamente "checklist-fotos" → Public bucket: ON
-- ═══════════════════════════════════════════════════════════════════════════
