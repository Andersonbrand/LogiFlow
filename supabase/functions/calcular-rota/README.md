# Edge Function: calcular-rota

Calcula a distância de uma rota (origem → paradas → destino), o custo de
combustível estimado e o pedágio, sem expor nenhuma chave de API no navegador.

## Como funciona
1. **Geocodificação**: cada cidade é convertida em coordenadas via Nominatim
   (OpenStreetMap), sem precisar de API key. As cidades são geocodificadas
   **em sequência** (não em paralelo) com um pequeno intervalo entre cada
   uma — o Nominatim público exige no máximo 1 requisição por segundo, e
   fazer todas de uma vez causa falhas intermitentes ("cidade não encontrada").
2. **Roteamento**: com as coordenadas, calcula a rota real via OpenRouteService
   (chave em `ORS_API_KEY`). Se a chave não estiver configurada ou o ORS
   falhar, cai para uma estimativa por distância em linha reta (× 1.35).
3. Calcula pedágio estimado (R$/100km informado pelo app) e, se o veículo
   tiver consumo km/l cadastrado, o custo de combustível.

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

### 3. Configurar a chave do OpenRouteService (opcional, mas recomendado)
Sem essa chave a função ainda funciona, só usa a estimativa por linha reta
em vez da rota real das estradas.
```bash
supabase secrets set ORS_API_KEY=SUACHAVEAQUI
```
Chave gratuita em: https://openrouteservice.org/dev/#/signup

### 4. Fazer o deploy da função
```bash
supabase functions deploy calcular-rota
```

### 5. Verificar o deploy
A função estará disponível em:
https://lrsnqkxarkjcemcxzana.supabase.co/functions/v1/calcular-rota

## Testar localmente (opcional)
```bash
supabase functions serve calcular-rota
```

## Erros comuns
- **"Cidade não encontrada"**: o nome da cidade não foi reconhecido pelo
  Nominatim. Inclua o estado (ex: "Barreiras, BA") e confira a grafia
  (acentos não costumam ser o problema, mas nomes muito abreviados sim).
- **HTTP 500 / "Serviço de rota indisponível"**: falha temporária do ORS ou
  do Nominatim — tentar de novo em alguns segundos costuma resolver.
