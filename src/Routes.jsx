import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop    from "components/ScrollToTop";
import ErrorBoundary  from "components/ErrorBoundary";
import ProtectedRoute from "components/ProtectedRoute";
import { AuthProvider } from "utils/AuthContext";

import NotFound        from "pages/NotFound";
import Login           from "pages/login";
import MainDashboard   from "pages/main-dashboard";
import MaterialCatalog from "pages/material-catalog";
import VehicleFleet    from "pages/vehicle-fleet-management";
import Romaneios       from "pages/romaneios";
import Relatorios      from "pages/relatorios";
import AdminPanel      from "pages/admin";
import Financeiro      from "pages/financeiro";
import Consolidacao    from "pages/consolidacao";

const Routes = () => (
    <BrowserRouter>
        <AuthProvider>
            <ErrorBoundary>
                <ScrollToTop />
                <RouterRoutes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/"                         element={<ProtectedRoute><MainDashboard /></ProtectedRoute>} />
                    <Route path="/main-dashboard"           element={<ProtectedRoute><MainDashboard /></ProtectedRoute>} />
                    <Route path="/material-catalog"         element={<ProtectedRoute><MaterialCatalog /></ProtectedRoute>} />
                    <Route path="/vehicle-fleet-management" element={<ProtectedRoute><VehicleFleet /></ProtectedRoute>} />
                    <Route path="/romaneios"                element={<ProtectedRoute><Romaneios /></ProtectedRoute>} />
                    <Route path="/relatorios"               element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
                    <Route path="/financeiro"               element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
                    <Route path="/consolidacao"             element={<ProtectedRoute><Consolidacao /></ProtectedRoute>} />
                    <Route path="/admin"                    element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                </RouterRoutes>
            </ErrorBoundary>
        </AuthProvider>
    </BrowserRouter>
);

export default Routes;
