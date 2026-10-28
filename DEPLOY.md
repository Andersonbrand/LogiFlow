# Deploy — LogiFlow

## Front-end (Vercel)
1. Importe o repositório na Vercel (framework: Vite — já definido em `vercel.json`).
2. Em **Settings → Environment Variables** cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Build: `vite build` · saída: `dist` · Node 18+ (`.node-version`).
4. Qualquer push na branch principal gera novo deploy.

## Banco e funções (Supabase)
- `supabase/migrations/` — migrations **datadas** (`AAAAMMDD_descricao.sql`), aplicadas em ordem cronológica.
- `supabase/scripts/`    — scripts avulsos de correção (RLS, funções) rodados manualmente no SQL Editor.
- `supabase/schema/`     — esquema legado do e-commerce (referência histórica).
- `supabase/functions/`  — Edge Functions (`calcular-rota`, `delete-user`, `gerar-diaria-excel`, `gerar-romaneio-excel`, `sugerir-veiculo`).
  Deploy: `supabase functions deploy <nome>`; segredos: `supabase secrets set ORS_API_KEY=...`.

## Checklist antes de publicar
- `npm run lint`  → sem erros
- `npm test`      → testes passando
- `npm run build` → build conclui sem erros
