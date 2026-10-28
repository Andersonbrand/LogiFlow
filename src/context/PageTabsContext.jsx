import React, { createContext, useContext, useState, useCallback } from 'react';

// Permite que uma página (ex: motorista de caminhão, carreteiro) registre suas
// próprias "abas" internas (Minhas Viagens, Checklist, Abastecimentos...) para
// que apareçam dentro do MESMO menu hamburguer principal (o que tem Meu
// Perfil/Sair), em vez de cada página ter seu próprio botão "☰" separado —
// dois ícones de hambúrguer parecidos (um pra trocar de aba, outro pra
// perfil/sair) confundiam os usuários e quebravam o layout em telas pequenas.
const PageTabsContext = createContext(null);

export function PageTabsProvider({ children }) {
    const [pageTabs, setPageTabsState] = useState(null); // { tabs: [{id,label,icon}], activeId, onSelect } | null

    const setPageTabs = useCallback((tabs, activeId, onSelect) => {
        setPageTabsState(tabs ? { tabs, activeId, onSelect } : null);
    }, []);

    return (
        <PageTabsContext.Provider value={{ pageTabs, setPageTabs }}>
            {children}
        </PageTabsContext.Provider>
    );
}

export function usePageTabs() {
    return useContext(PageTabsContext) || { pageTabs: null, setPageTabs: () => {} };
}
