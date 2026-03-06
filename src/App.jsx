import React from "react";
import Routes from "./Routes";
import ErrorBoundary from "components/ErrorBoundary";

// ✅ FIX: ErrorBoundary agora envolve toda a aplicação
// Erros de renderização inesperados mostram tela amigável em vez de tela branca
function App() {
    return (
        <ErrorBoundary>
            <Routes />
        </ErrorBoundary>
    );
}

export default App;
