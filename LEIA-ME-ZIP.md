# LogiFlow — versão reorganizada (teste)

1. **Extraia numa pasta nova e vazia** (não por cima do projeto antigo — arquivos velhos misturam).
2. Copie o seu `.env` (com as chaves do Supabase) para a raiz da pasta nova — ele não vai no ZIP.
3. `npm install` e depois `npm run dev`.
4. Leia `docs/REORGANIZACAO.md` (o que mudou) e `docs/MUDANCAS_DE_ARQUIVOS.md` (onde cada arquivo foi parar).

Pontos para testar com atenção (dados reais): telas de Despesas de Carretas, Caminhões e Administrativas (agora usam o mesmo
componente), Volume, Relatórios, painel do Carreteiro/Motorista/Mecânico, criação de Romaneio, Backup no painel Admin.
Se algo quebrar, me mande o erro do console (F12) e o nome da tela.
