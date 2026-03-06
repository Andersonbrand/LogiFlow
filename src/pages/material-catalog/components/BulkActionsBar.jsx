import React, { useRef } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import { downloadMaterialsTemplate } from 'utils/excelUtils';

export default function BulkActionsBar({ onExportExcel, onImportExcel, totalCount }) {
    const fileRef = useRef();

    const handleImport = (e) => {
        const file = e?.target?.files?.[0];
        if (file) onImportExcel(file);
        e.target.value = '';
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" iconName="FileDown" iconPosition="left" iconSize={14}
                onClick={onExportExcel} title="Exportar catálogo como Excel">
                <span className="hidden sm:inline">Exportar Excel</span>
                <span className="sm:hidden">Exportar</span>
            </Button>
            <Button variant="outline" size="sm" iconName="FileUp" iconPosition="left" iconSize={14}
                onClick={() => fileRef?.current?.click()} title="Importar materiais de Excel">
                <span className="hidden sm:inline">Importar Excel</span>
                <span className="sm:hidden">Importar</span>
            </Button>
            <Button variant="ghost" size="sm" iconName="FileSpreadsheet" iconPosition="left" iconSize={14}
                onClick={downloadMaterialsTemplate} title="Baixar modelo Excel para preenchimento">
                <span className="hidden sm:inline">Modelo</span>
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
            <span className="text-xs text-[var(--color-text-secondary)] hidden md:inline">
                <Icon name="Package" size={13} color="currentColor" className="inline mr-1" />
                {totalCount} materiais cadastrados
            </span>
        </div>
    );
}
