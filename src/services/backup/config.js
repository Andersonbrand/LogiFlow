

// ═══════════════════════════════════════════════════════════════════════════
// LogiFlow — Backup e Restauração
//
// Exporta/importa os dados do Supabase (tabelas) e os arquivos anexados no
// Supabase Storage (CNH de motoristas) como um único arquivo .zip, organizado
// por pastas (módulos). Cada tabela vira dois arquivos — um .json (para a
// reimportação funcionar) e um .xlsx (para leitura/edição fácil em Excel).
// O admin escolhe, na tela, quais módulos/tabelas/anexos deseja exportar ou
// importar (total ou parcial).
//
// Estrutura do .zip gerado:
//   manifest.json                          → metadados do backup (data, versão, contagens)
//   01-usuarios/user_profiles.json
//   01-usuarios/user_profiles.xlsx
//   02-carretas/carretas_veiculos.json
//   02-carretas/carretas_veiculos.xlsx
//   ...
//   storage/cnh-documents/cnh_123.jpg       → arquivos baixados do Storage
// ═══════════════════════════════════════════════════════════════════════════

export const BACKUP_VERSION = 1;

// ── Catálogo de módulos e tabelas ─────────────────────────────────────────
// `pk`   → coluna usada como chave de conflito no upsert (padrão: 'id')
// `nice` → nome amigável exibido na tela
// ── Buckets do Supabase Storage (arquivos/anexos) ──────────────────────────
// Cada bucket é vinculado ao módulo ao qual pertence, pra aparecer junto na tela.
export const BACKUP_BUCKETS = [
    { id: 'cnh-documents', nice: 'CNH dos motoristas (documentos/fotos)', moduleId: 'usuarios' },
];

export const BUCKET_INDEX = BACKUP_BUCKETS.reduce((acc, b) => { acc[b.id] = b; return acc; }, {});

export const BACKUP_MODULES = [
    {
        id: 'usuarios',
        label: 'Usuários & Perfis',
        icon: 'Users',
        folder: '01-usuarios',
        buckets: ['cnh-documents'],
        tables: [
            { name: 'user_profiles', nice: 'Perfis de usuário', pk: 'id', aviso: 'Vinculado ao login (auth). Restaurar só recria o perfil se o usuário já existir no Supabase Auth.' },
        ],
    },
    {
        id: 'caminhoes',
        label: 'Caminhões (frota)',
        icon: 'Truck',
        folder: '02-caminhoes',
        tables: [
            { name: 'vehicles', nice: 'Veículos' },
            { name: 'vehicle_history', nice: 'Histórico de veículos' },
            { name: 'maintenance_alerts', nice: 'Alertas de manutenção' },
            { name: 'caminhoes_despesas', nice: 'Despesas de caminhões' },
            { name: 'caminhoes_fornecedores', nice: 'Fornecedores (caminhões)' },
        ],
    },
    {
        id: 'carretas',
        label: 'Carretas (frota)',
        icon: 'ShieldCheck',
        folder: '03-carretas',
        tables: [
            { name: 'carretas_veiculos', nice: 'Veículos (cavalo/implemento)' },
            { name: 'carretas_empresas', nice: 'Empresas/transportadoras' },
            { name: 'carretas_postos', nice: 'Postos de combustível' },
            { name: 'carretas_pontos_parada', nice: 'Pontos de parada' },
            { name: 'carretas_config', nice: 'Configurações da frota' },
            { name: 'carretas_checklists', nice: 'Checklists' },
            { name: 'carretas_ordens_servico', nice: 'Ordens de serviço' },
            { name: 'carretas_registros_viagem', nice: 'Registros de viagem' },
            { name: 'carretas_viagens', nice: 'Viagens' },
            { name: 'carretas_carregamentos', nice: 'Carregamentos' },
            { name: 'carretas_diarias', nice: 'Diárias' },
            { name: 'carretas_abastecimentos', nice: 'Abastecimentos' },
            { name: 'carretas_despesas_extras', nice: 'Despesas extras' },
            { name: 'carretas_bonificacoes_extras', nice: 'Bonificações extras' },
            { name: 'carretas_fretes', nice: 'Fretes' },
            { name: 'carretas_fornecedores', nice: 'Fornecedores (carretas)' },
            { name: 'carretas_notificacoes', nice: 'Notificações' },
        ],
    },
    {
        id: 'romaneios_carretas',
        label: 'Romaneios (carretas)',
        icon: 'FileText',
        folder: '04-romaneios-carretas',
        tables: [
            { name: 'carretas_romaneios', nice: 'Romaneios de carretas' },
            { name: 'carretas_romaneio_itens', nice: 'Itens dos romaneios' },
        ],
    },
    {
        id: 'romaneios',
        label: 'Romaneios (caminhões)',
        icon: 'ClipboardList',
        folder: '05-romaneios',
        tables: [
            { name: 'romaneios', nice: 'Romaneios' },
            { name: 'romaneio_itens', nice: 'Itens dos romaneios' },
            { name: 'romaneio_pedidos', nice: 'Pedidos vinculados' },
            { name: 'bonificacoes', nice: 'Bonificações' },
            { name: 'rota_corredores', nice: 'Corredores de rota' },
        ],
    },
    {
        id: 'custos_rodagem',
        label: 'Custos de Rodagem',
        icon: 'Calculator',
        folder: '06-custos-rodagem',
        tables: [
            { name: 'custos_itens', nice: 'Itens de custo (KM/dia)' },
            { name: 'custos_config', nice: 'Margem padrão', pk: 'tipo_veiculo' },
            { name: 'custos_destinos', nice: 'Estimativa por destino' },
        ],
    },
    {
        id: 'materiais',
        label: 'Materiais',
        icon: 'Package',
        folder: '07-materiais',
        tables: [
            { name: 'materials', nice: 'Materiais' },
        ],
    },
    {
        id: 'despesas_adm',
        label: 'Despesas Administrativas',
        icon: 'Receipt',
        folder: '08-despesas-adm',
        tables: [
            { name: 'transporte_despesas_adm', nice: 'Despesas adm. (transporte)' },
            { name: 'despesas_adm_fornecedores', nice: 'Fornecedores (desp. adm.)' },
            { name: 'duplicatas_verificadas', nice: 'Duplicatas verificadas' },
        ],
    },
    {
        id: 'sistema',
        label: 'Sistema & Configurações',
        icon: 'Settings',
        folder: '09-sistema',
        tables: [
            { name: 'fornecedores', nice: 'Fornecedores (cadastro global)' },
            { name: 'notifications', nice: 'Notificações' },
            { name: 'ai_suggestions_dismissed', nice: 'Sugestões de IA dispensadas' },
        ],
    },
];

// Mapa rápido nome-da-tabela → definição (com módulo pai)
export const TABLE_INDEX = BACKUP_MODULES.flatMap(m =>
    m.tables.map(t => ({ ...t, moduleId: m.id, moduleLabel: m.label, folder: m.folder }))
).reduce((acc, t) => { acc[t.name] = t; return acc; }, {});
