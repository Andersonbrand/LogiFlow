import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop    from "components/ScrollToTop";
import ErrorBoundary  from "components/ErrorBoundary";
import ProtectedRoute, { AdminRoute, StaffRoute, MotoristaRoute, CarreteiroRoute, MecanicoRoute } from "components/ProtectedRoute";
import { AuthProvider } from "utils/AuthContext";

import NotFound              from "pages/NotFound";
import Login                 from "pages/login";
import MainDashboard         from "pages/main-dashboard";
import MaterialCatalog       from "pages/material-catalog";
import VehicleFleet          from "pages/vehicle-fleet-management";
import Romaneios             from "pages/romaneios";
import Relatorios            from "pages/relatorios";
import AdminPanel            from "pages/admin";
import Financeiro            from "pages/financeiro";
import Consolidacao          from "pages/consolidacao";
import MotoristaDashboard    from "pages/motorista";
import ResetPassword         from "pages/reset-password";
import CarretasPage          from "pages/carretas";
import CarreteiroDashboard   from "pages/carreteiro";
import MecanicoPage          from "pages/mecanico";
import PerfilUsuario         from "pages/perfil-usuario";

const Routes = () => (
    <BrowserRouter>
        <AuthProvider>
            <ErrorBoundary>
                <ScrollToTop />
                <RouterRoutes>
                    <Route path="/login"          element={<Login />} />
                    <Route path="/reset-password" element={<ResetPassword />} />

                    {/* Perfil do usuário — acessível por todos os papéis autenticados */}
                    <Route path="/perfil"                   element={<ProtectedRoute><PerfilUsuario /></ProtectedRoute>} />

                    {/* Rotas para admin e operador */}
                    <Route path="/"                         element={<StaffRoute><MainDashboard /></StaffRoute>} />
                    <Route path="/main-dashboard"           element={<StaffRoute><MainDashboard /></StaffRoute>} />
                    <Route path="/material-catalog"         element={<StaffRoute><MaterialCatalog /></StaffRoute>} />
                    <Route path="/vehicle-fleet-management" element={<StaffRoute><VehicleFleet /></StaffRoute>} />
                    <Route path="/romaneios"                element={<StaffRoute><Romaneios /></StaffRoute>} />
                    <Route path="/relatorios"               element={<StaffRoute><Relatorios /></StaffRoute>} />
                    <Route path="/consolidacao"             element={<StaffRoute><Consolidacao /></StaffRoute>} />

                    {/* Rotas exclusivas do admin */}
                    <Route path="/financeiro"               element={<AdminRoute><Financeiro /></AdminRoute>} />
                    <Route path="/admin"                    element={<AdminRoute><AdminPanel /></AdminRoute>} />

                    {/* Rota do motorista (caminhão) */}
                    <Route path="/motorista"                element={<MotoristaRoute><MotoristaDashboard /></MotoristaRoute>} />

                    {/* Módulo Transporte - Carretas (admin/operador) */}
                    <Route path="/carretas"                 element={<StaffRoute><CarretasPage /></StaffRoute>} />

                    {/* Rota do carreteiro */}
                    <Route path="/carreteiro"               element={<CarreteiroRoute><CarreteiroDashboard /></CarreteiroRoute>} />

                    {/* Rota do mecânico */}
                    <Route path="/mecanico"                 element={<MecanicoRoute><MecanicoPage /></MecanicoRoute>} />

                    <Route path="*" element={<NotFound />} />
                </RouterRoutes>
            </ErrorBoundary>
        </AuthProvider>
    </BrowserRouter>
);

export default Routes;
