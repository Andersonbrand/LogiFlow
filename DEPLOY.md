# LogiFlow — Deploy no Vercel

## ✅ Pré-requisitos

1. Conta no [Vercel](https://vercel.com)
2. Repositório no GitHub com este código
3. Projeto no Supabase configurado com as variáveis abaixo

## 🗄️ SQL obrigatório no Supabase

Execute no **SQL Editor** do Supabase antes de fazer o deploy:

```sql
-- Adicionar colunas de aprovação (se ainda não existirem)
ALTER TABLE public.romaneios
  ADD COLUMN IF NOT EXISTS status_aprovacao text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS motivo_reprovacao text DEFAULT '';
```

## 🚀 Deploy no Vercel

### Opção 1 — Via interface Vercel
1. Acesse vercel.com → "New Project"
2. Importe o repositório GitHub
3. Em **Build Settings**:
   - Framework: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `build`
4. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = `https://lrsnqkxarkjcemcxzana.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
5. Clique em **Deploy**

### Opção 2 — Via Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

## 📝 Variáveis de ambiente necessárias

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon do Supabase |

## 🔧 Build local para teste

```bash
npm install
npm run build
npm run serve
```

## 📱 Usuários e roles

| Role | Acesso |
|---|---|
| `admin` | Tudo — aprovações, usuários, financeiro, bonificações |
| `operador` | Romaneios, materiais, veículos, relatórios |
| `motorista` | Apenas /motorista — suas viagens |

