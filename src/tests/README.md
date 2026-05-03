# Testes Automatizados — LogiFlow

## Como executar

Instale as dependências de desenvolvimento:

```bash
npm install --save-dev vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

Execute os testes:

```bash
# Rodar uma vez
npx vitest run

# Modo watch (fica observando mudanças)
npx vitest

# Com relatório de cobertura
npx vitest run --coverage
```

## Estrutura

```
src/tests/
├── setup.js                  # Configuração global (mock do Supabase)
├── freteConfig.test.js       # Lógica de categorias e cálculo de frete
└── romaneioLogica.test.js    # Lógica de status e margem de lucro
```

## O que está coberto

| Módulo | Cobertura | O que é testado |
|--------|-----------|-----------------|
| `freteConfig.js` | Alta | Detecção de categoria, cálculo de %, formatação |
| `romaneioService.js` | Parcial | Sincronização de status, cálculo de margem |

## Próximos testes (roadmap)

- [ ] `vehicleService.js` — CRUD de veículos com mock
- [ ] `excelUtils.js` — Geração de planilhas
- [ ] `aiSuggestionsService.js` — Persistência de sugestões
- [ ] Componentes UI — `RomaneioFormModal`, `VehicleFormModal` (com Testing Library)

## Observação

O banco de dados (Supabase) é completamente mockado — os testes rodam sem
conexão com internet ou credenciais. Isso garante que:
- Os testes são rápidos (< 2s para toda a suite)
- Funcionam em qualquer máquina ou CI/CD
- Não modificam dados reais de produção
