// Caminhos (URLs) de todas as rotas do LogiFlow — única fonte da verdade.
// Use `paths.Romaneios` em <Route path=...>, <Link to=...> e navigate(...)
// em vez de escrever a string solta em cada arquivo.
const paths = {
    // públicas
    Login:                  '/login',
    ResetPassword:          '/reset-password',
    EmailConfirmado:        '/email-confirmado',

    // qualquer usuário autenticado
    Perfil:                 '/perfil',

    // admin + operador
    Home:                   '/',
    MainDashboard:          '/main-dashboard',
    MaterialCatalog:        '/material-catalog',
    VehicleFleet:           '/vehicle-fleet-management',
    Romaneios:              '/romaneios',
    Relatorios:             '/relatorios',
    Consolidacao:           '/consolidacao',

    // somente admin
    Admin:                  '/admin',
    Carretas:               '/carretas',
    DespesasCaminhoes:      '/despesas-caminhoes',
    DespesasAdmTransporte:  '/despesas-adm-transporte',
    EntregasAcessorios:     '/entregas-acessorios',

    // por papel
    Motorista:              '/motorista',
    Carreteiro:             '/carreteiro',
    Mecanico:               '/mecanico',

    NotFound:               '*',
};

export default paths;
