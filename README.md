# Araguaia E-Commerce
> Next.js 15 · TypeScript · Tailwind CSS · Supabase

E-commerce B2B de materiais de construção civil com painel administrativo completo.

---

## Stack
- **Frontend:** Next.js 15, React 19, TypeScript
- **Estilo:** Tailwind CSS + design glass-morphism premium
- **Backend/DB:** Supabase (PostgreSQL + Auth + Storage)
- **Deploy:** Vercel + Supabase

---

## Setup Local

### 1. Clone e instale
```bash
git clone <seu-repositorio>
cd araguaia-ecommerce
npm install
```

### 2. Crie o projeto no Supabase
1. Acesse [app.supabase.com](https://app.supabase.com) e clique em **New Project**
2. Anote a **URL** e **anon key** em **Settings → API**

### 3. Configure o banco de dados
1. No Supabase, vá em **SQL Editor**
2. Cole e execute o conteúdo do arquivo `src/lib/database.sql`
3. Isso cria as tabelas, RLS policies, bucket de storage e dados iniciais

### 4. Variáveis de ambiente
```bash
cp .env.example .env.local
```
Edite `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
NEXT_PUBLIC_SITE_URL=http://localhost:4028
```

### 5. Rode o projeto
```bash
npm run dev
# Acesse: http://localhost:4028
```

---

## Criar usuário Admin

1. Acesse `/register` e crie uma conta com seu e-mail
2. No Supabase → **SQL Editor**, execute:
```sql
SELECT promote_to_admin('seu@email.com');
```
3. Faça logout e login novamente
4. Acesse `/admin-dashboard`

---

## Estrutura de Rotas

| Rota | Descrição |
|---|---|
| `/homepage` | Home (hero, produtos, stats, sobre, orçamento) |
| `/products` | Catálogo com filtros e busca |
| `/cart` | Carrinho + finalização de pedido |
| `/login` | Login via Supabase Auth |
| `/register` | Cadastro de usuário |
| `/admin-dashboard` | Painel admin (requer role admin) |

---

## Deploy na Vercel

1. Faça push do projeto para o GitHub
2. Importe no [vercel.com](https://vercel.com)
3. Configure as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` → URL da sua Vercel (ex: `https://araguaia.vercel.app`)
4. Deploy!

### Configurar URL no Supabase para produção
No Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://seu-dominio.vercel.app`
- **Redirect URLs:** `https://seu-dominio.vercel.app/**`

---

## Banco de Dados

### Tabelas
- **products** — catálogo de produtos
- **orders** — pedidos dos clientes
- **quotes** — solicitações de orçamento

### Storage
- **product-images** — bucket público para imagens dos produtos

---

## Scripts
```bash
npm run dev        # Dev em localhost:4028
npm run build      # Build de produção
npm run start      # Servidor de produção
npm run type-check # Verificação TypeScript
npm run lint       # Linting
npm run format     # Prettier
```
# e-commerce-Araguaia
