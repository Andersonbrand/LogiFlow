# LogiFlow — Gestão Logística

Aplicação web (React 18 + Vite + Tailwind) com Supabase (Postgres, Auth, Realtime, Storage, Edge Functions).

```bash
npm install --legacy-peer-deps
cp .env.example .env      # preencha as variáveis do Supabase
npm start                 # http://localhost:4028
npm run build · npm test · npm run lint
```

## Estrutura (`src/`)

```
src/
├── index.jsx            ponto de entrada (monta <App />)
├── App.jsx              verifica variáveis de ambiente e renderiza as rotas
├── routes/              routes.jsx (todas as rotas) · private-routes.jsx (guardas por papel)
├── constants/           paths.js — URLs de todas as telas (fonte única)
├── pages/               uma pasta por tela (ver abaixo) + index.js (barrel)
├── components/          componentes compartilhados: components/<Nome>/index.jsx + index.js (barrel)
├── context/             provedores globais: AuthContext, PageTabsContext
├── hooks/               hooks reutilizáveis: useToast, useRecarregarAoVoltar, useDeviceProfile
├── services/            acesso a dados e regras de negócio (Supabase): supabaseClient.js + *Service.js
├── config/              configurações de domínio: freteConfig, pneuDiagramaConfig, mobileDevices
├── utils/               funções puras (formatação, planilhas, cidades, rota, erros amigáveis)
├── styles/              CSS global (tailwind, index, mobile)
├── assets/              ícones e imagens
└── tests/               testes (vitest)
```

### Anatomia de uma tela (`pages/<tela>/`)
```
pages/carretas/
├── index.jsx            componente da página (layout, abas, estado da página)
├── components/          componentes DESTA tela, cada um em sua pasta
│   └── TabViagens/
│       ├── index.jsx    o componente
│       ├── components/  sub-componentes só dele (quando existirem)
│       └── utils/       helpers.js / constants.js só dele
└── utils/               helpers.js / constants.js compartilhados entre os componentes da tela
```

### Regras de importação
- Entre pastas de topo, use o **alias**: `import { Button } from 'components'`, `import paths from 'constants/paths'`,
  `import { fetchRomaneios } from 'services/romaneioService'`.
- Dentro da mesma tela, use **caminho relativo**: `import TabViagens from './components/TabViagens'`.
- Componentes compartilhados entram pelo barrel `components` (`index.js`). Ao criar um, exporte-o lá.
- Telas só são importadas por `routes/routes.jsx` (via barrel `pages`).
- Dependência vai sempre "para baixo": pages → components/hooks/context → services → utils/config.

### Onde colocar código novo
| Quero…                               | Vai em…                                   |
|--------------------------------------|--------------------------------------------|
| nova tela                            | `pages/<nome>/` + rota em `routes/routes.jsx` + `constants/paths.js` |
| botão/modal usado em várias telas    | `components/<Nome>/index.jsx` + barrel     |
| componente usado só numa tela        | `pages/<tela>/components/<Nome>/`          |
| consulta/gravação no banco           | `services/<dominio>Service.js`             |
| função pura (formatar, calcular)     | `utils/`                                   |
| tabela de valores/regras de negócio  | `config/`                                  |
| estado global                        | `context/`                                 |
| nova tabela/política SQL             | `supabase/migrations/AAAAMMDD_*.sql`       |

Mais detalhes de publicação em [DEPLOY.md](DEPLOY.md).
