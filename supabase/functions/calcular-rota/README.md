# Edge Function: calcular-rota

Proxy seguro entre o LogiFlow e a API Anthropic.
Resolve o bloqueio de CORS e mantém a chave da API segura no servidor.

## Como fazer o deploy

### 1. Instalar a CLI do Supabase
```bash
npm install -g supabase
```

### 2. Fazer login e linkar o projeto
```bash
supabase login
supabase link --project-ref lrsnqkxarkjcemcxzana
```

### 3. Adicionar a chave da Anthropic como secret
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-SUACHARAAQUI
```

### 4. Fazer o deploy da função
```bash
supabase functions deploy calcular-rota
```

### 5. Verificar o deploy
A função estará disponível em:
https://lrsnqkxarkjcemcxzana.supabase.co/functions/v1/calcular-rota

## Testar localmente (opcional)
```bash
supabase functions serve calcular-rota --env-file .env.local
```

Crie um `.env.local` com:
```
ANTHROPIC_API_KEY=sk-ant-SUACHARAAQUI
```

## O que a função faz
- Recebe: lista de cidades + consumo km/l do veículo
- Consulta a Anthropic com a chave segura no servidor
- Retorna: distância, tempo, preço do Diesel S10 (Guanambi-BA), pedágios estimados, custo do combustível já calculado
- Headers CORS configurados para aceitar requisições do browser
