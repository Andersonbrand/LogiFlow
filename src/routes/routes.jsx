import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ProtectedRoute, { AdminRoute, StaffRoute, MotoristaRoute, CarreteiroRoute, MecanicoRoute } from "routes/private-routes";
import { AuthProvider } from "context/AuthContext";
import { PageTabsProvider } from "context/PageTabsContext";

import {
    Login, MainDashboard, MaterialCatalog, VehicleFleet, Romaneios, Relatorios, AdminPanel,
    Consolidacao, MotoristaDashboard, ResetPassword, CarretasPage, CarreteiroDashboard,
    MecanicoPage, PerfilUsuario, EmailConfirmado, DespesasCaminhoes, DespesasAdmTransporte,
    EntregasAcessorios, NotFound,
} from "pages";
import paths from "constants/paths";
import { ScrollToTop, ErrorBoundary } from 'components';

const Routes = () => (
    <BrowserRouter>
        <AuthProvider>
            <PageTabsProvider>
            <ErrorBoundary>
                <ScrollToTop />
                <RouterRoutes>
                    <Route path={paths.Login}          element={<Login />} />
                    <Route path={paths.ResetPassword} element={<ResetPassword />} />

                    {/* Página de confirmação de e-mail — pública (link vem do e-mail) */}
                    <Route path={paths.EmailConfirmado}          element={<EmailConfirmado />} />

                    {/* Perfil do usuário — acessível por todos os papéis autenticados */}
                    <Route path={paths.Perfil}                   element={<ProtectedRoute><PerfilUsuario /></ProtectedRoute>} />

                    {/* Rotas para admin e operador */}
                    <Route path={paths.Home}                         element={<StaffRoute><MainDashboard /></StaffRoute>} />
                    <Route path={paths.MainDashboard}           element={<StaffRoute><MainDashboard /></StaffRoute>} />
                    <Route path={paths.MaterialCatalog}         element={<StaffRoute><MaterialCatalog /></StaffRoute>} />
                    <Route path={paths.VehicleFleet} element={<StaffRoute><VehicleFleet /></StaffRoute>} />
                    <Route path={paths.Romaneios}                element={<StaffRoute><Romaneios /></StaffRoute>} />
                    <Route path={paths.Relatorios}               element={<StaffRoute><Relatorios /></StaffRoute>} />
                    <Route path={paths.Consolidacao}             element={<StaffRoute><Consolidacao /></StaffRoute>} />

                    {/* Rotas exclusivas do admin */}
                    <Route path={paths.Admin}                    element={<AdminRoute><AdminPanel /></AdminRoute>} />

                    {/* Rota do motorista (caminhão) */}
                    <Route path={paths.Motorista}                element={<MotoristaRoute><MotoristaDashboard /></MotoristaRoute>} />

                    {/* Módulo Transporte - Carretas (admin apenas) */}
                    <Route path={paths.Carretas}                 element={<AdminRoute><CarretasPage /></AdminRoute>} />

                    {/* Módulo Despesas — Caminhões (admin apenas) */}
                    <Route path={paths.DespesasCaminhoes}       element={<AdminRoute><DespesasCaminhoes /></AdminRoute>} />

                    {/* Módulo Despesas Administrativas — Transporte (admin apenas) */}
                    <Route path={paths.DespesasAdmTransporte}  element={<AdminRoute><DespesasAdmTransporte /></AdminRoute>} />

                    {/* Entregas de Acessórios aos motoristas (admin apenas) */}
                    <Route path={paths.EntregasAcessorios}      element={<AdminRoute><EntregasAcessorios /></AdminRoute>} />


                    {/* Rota do carreteiro */}
                    <Route path={paths.Carreteiro}               element={<CarreteiroRoute><CarreteiroDashboard /></CarreteiroRoute>} />

                    {/* Rota do mecânico */}
                    <Route path={paths.Mecanico}                 element={<MecanicoRoute><MecanicoPage /></MecanicoRoute>} />

                    <Route path={paths.NotFound} element={<NotFound />} />
                </RouterRoutes>
            </ErrorBoundary>
            </PageTabsProvider>
        </AuthProvider>
    </BrowserRouter>
);

export default Routes;
