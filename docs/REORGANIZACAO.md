# Reorganização do código — andamento

Meta: estrutura no padrão do Code Burger (pages com seu código próprio, rotas centralizadas,
barrels de import/export, services/config/utils separados), **sem mudar comportamento nem visual**.

## Concluído
- Legado Next.js removido (src/app, middleware, context .tsx, lib/supabase*, Header/Footer .tsx, next.config…).
- Duplicatas mortas removidas (cópias antigas de carretasService/romaneioService/RomaneiosTable/AISuggestionsP/AppImage).
- Nova estrutura: routes/ · constants/paths.js · services/ · context/ · hooks/ · config/ · components/<Nome>/ + barrels.
- Páginas divididas: um componente por pasta (`pages/<tela>/components/<Nome>/index.jsx`), helpers/constantes em `utils/`.
- `carretasService` → `services/carretas/*` · `romaneioService` → `services/romaneio/*` · `excelUtils` → `utils/excel/*`.
- Rotas e navegação usam `constants/paths.js`.
- ESLint/Prettier/Vitest configurados; `.env.example`, README, DEPLOY.md; SQL avulso em `supabase/scripts`.

- Abas e modais que estavam dentro de componentes gigantes foram extraídos para `components/<Nome>/` (carreteiro, relatórios,
  motorista, mecânico, consolidação, admin, romaneios, PainelMotorista e abas de Carretas). Maior arquivo: 9.259 → ~1.270 linhas.
- Consultas diretas ao Supabase saíram das telas (`services/authService`, `storageService`, `duplicatasService`, `carretas/fretes`…).
- Telas/componentes sem uso removidos.

- **Despesas unificadas** (Carretas, Caminhões e Administrativas): `services/despesas/createDespesasService.js` (fábrica; cada tela
  informa suas tabelas) + módulo `components/Despesas/` (página, modais de despesa/baixa/visualização/fornecedores, hooks). Cada tela
  continua ativa e grava na sua tabela via `config.js` própria (`pages/despesas-*/config.js`, `pages/carretas/despesasConfig.js`).
  Padrão visual: azul LogiFlow (`ModalHeader`, `ModalOverlay`, `Field` agora vêm de `components/`).
- **Hooks extraídos** (estado + dados + handlers fora do JSX): TabVolume (5), relatórios (8), carreteiro (8), TabRelatorioFinanceiro (2),
  PainelMotorista (6), motorista (4), mecânico (2), RomaneioFormModal (2). Pasta `hooks/` ao lado de cada tela/componente.

## Pendente (próximas rodadas)
1. Componentes extraídos ainda recebem muitas props (copiam o estado do pai) — agrupar em objetos/contexto onde fizer sentido.
2. Componentes duplicados com diferenças visuais (SearchInput, StatusBadge, DestinoSelect, PainelCustos…): decidir o padrão.
3. Dividir `utils/excel/romaneios.js` (~750) e `impressao.js` (~630) por documento; `backupService` (~470).
4. Teste final no navegador com dados reais (ver abaixo).

## Verificações já feitas
`vite build` · `npm run lint` (0 erros) · `npm test` (28 testes) · teste de fumaça em navegador (Chromium) com Supabase simulado:
15 rotas × 4 papéis, cliques nas abas — mesmo resultado e 0 erros de console na versão original e na reorganizada.
