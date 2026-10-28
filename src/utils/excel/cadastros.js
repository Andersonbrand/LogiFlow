import * as XLSX from 'xlsx';
import { today } from './shared';

// ── Export simples (lista) ────────────────────────────────────────────────────
export function exportMaterialsToExcel(materials) {
    const rows = materials.map(m => ({
        'Nome': m.nome, 'Categoria': m.categoria, 'Unidade': m.unidade,
        'Peso (kg)': m.peso, 'Categoria Frete': m.categoria_frete || '',
        '% Frete': m.percentual_frete != null ? (m.percentual_frete*100).toFixed(2)+'%' : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:40 },{ wch:18 },{ wch:10 },{ wch:12 },{ wch:22 },{ wch:10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Materiais');
    XLSX.writeFile(wb, `materiais_${today()}.xlsx`);
}

export function exportVehiclesToExcel(vehicles) {
    const rows = vehicles.map(v => ({
        'Placa': v.placa, 'Tipo': v.tipo, 'Cap. Peso (kg)': v.capacidadePeso,
        'Cap. Volume (m³)': v.capacidadeVolume, 'Status': v.status,
        'Última Utilização': v.ultimaUtilizacao || '', 'Utilização (%)': v.utilizacao||0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:12 },{ wch:15 },{ wch:15 },{ wch:16 },{ wch:14 },{ wch:18 },{ wch:14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Veículos');
    XLSX.writeFile(wb, `veiculos_${today()}.xlsx`);
}

// ── Import ────────────────────────────────────────────────────────────────────
export function parseMaterialsFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type:'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];

                // Detecta automaticamente a linha do cabeçalho buscando pela coluna "Nome"
                // Funciona mesmo que o cabeçalho não esteja na linha 1
                const allRows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
                let headerRow = 0;
                for (let i = 0; i < Math.min(allRows.length, 10); i++) {
                    const row = allRows[i].map(v => String(v||'').trim().toLowerCase());
                    if (row.includes('nome') || row.includes('name')) { headerRow = i; break; }
                }

                const rows = XLSX.utils.sheet_to_json(ws, { defval:'', range: headerRow });
                const materials = rows
                    .filter(r => r['Nome'] || r['nome'] || r['NOME'])
                    .map(r => ({
                        nome:      String(r['Nome']||r['nome']||r['NOME']||'').trim(),
                        categoria: String(r['Categoria']||r['categoria']||r['CATEGORIA']||'Outros').trim(),
                        unidade:   String(r['Unidade']||r['unidade']||r['UNIDADE']||'un').trim(),
                        peso:      Number(r['Peso (kg)']||r['peso']||r['Peso']||r['PESO (KG)']||r['PESO']||0),
                    })).filter(m => m.nome && m.peso > 0);

                if (materials.length === 0) {
                    reject(new Error('Nenhum material válido encontrado. Verifique se as colunas Nome e Peso (kg) estão preenchidas corretamente.'));
                } else {
                    resolve(materials);
                }
            } catch (err) { reject(new Error('Arquivo inválido: ' + err.message)); }
        };
        reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
        reader.readAsArrayBuffer(file);
    });
}

export function parseVehiclesFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type:'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
                const vehicles = rows
                    .filter(r => r['Placa']||r['placa'])
                    .map(r => ({
                        placa: String(r['Placa']||r['placa']||'').trim().toUpperCase(),
                        tipo: String(r['Tipo']||r['tipo']||'Caminhão').trim(),
                        capacidadePeso: Number(r['Cap. Peso (kg)']||r['capacidadePeso']||0),
                        capacidadeVolume: Number(r['Cap. Volume (m³)']||r['capacidadeVolume']||0),
                        status: String(r['Status']||r['status']||'Disponível').trim(),
                        utilizacao: Number(r['Utilização (%)']||r['utilizacao']||0),
                    })).filter(v => v.placa && v.capacidadePeso > 0);
                resolve(vehicles);
            } catch (err) { reject(new Error('Arquivo inválido. Use o modelo fornecido.')); }
        };
        reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
        reader.readAsArrayBuffer(file);
    });
}

// ── Templates ─────────────────────────────────────────────────────────────────
export function downloadMaterialsTemplate() {
    const rows = [
        { 'Nome':'CIMENTO MONTES CLAROS','Categoria':'Cimento','Unidade':'SC','Peso (kg)':50,'Categoria Frete':'Cimento','% Frete':'5.67%' },
        { 'Nome':'VERGALHAO 1/2 GERDAU', 'Categoria':'Ferragens','Unidade':'BR','Peso (kg)':11.55,'Categoria Frete':'Ferragens','% Frete':'6.00%' },
        { 'Nome':'TELHA RESIDENCIAL 5MM','Categoria':'Telhas','Unidade':'PC','Peso (kg)':27.1,'Categoria Frete':'Telhas de Fibrocimento','% Frete':'6.00%' },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:40 },{ wch:16 },{ wch:10 },{ wch:12 },{ wch:24 },{ wch:10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Materiais');
    XLSX.writeFile(wb, 'modelo_materiais.xlsx');
}

export function downloadVehiclesTemplate() {
    const rows = [
        { 'Placa':'ABC-1234','Tipo':'Caminhão','Cap. Peso (kg)':12000,'Cap. Volume (m³)':45,'Status':'Disponível','Última Utilização':'2026-03-01','Utilização (%)':75 },
        { 'Placa':'DEF-5678','Tipo':'Van','Cap. Peso (kg)':3500,'Cap. Volume (m³)':12,'Status':'Disponível','Última Utilização':'2026-03-02','Utilização (%)':50 },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:12 },{ wch:12 },{ wch:15 },{ wch:15 },{ wch:14 },{ wch:18 },{ wch:14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Veículos');
    XLSX.writeFile(wb, 'modelo_veiculos.xlsx');
}
