/**
 * romaneioImportService.js
 * 
 * Importa romaneios a partir do modelo Excel da Comercial Araguaia.
 * 
 * Estrutura do modelo:
 * - Aba "ROMANEIO": lista mestre de materiais (col A-E) + blocos por cidade (col F-K)
 *   - Col A: Nome do material
 *   - Col B: Unidade
 *   - Col C: Quantidade (preenchida pelo usuário)
 *   - Col D: Peso unitário
 *   - Col E: Peso total (= C * D)
 *   - Col F: Labels de cabeçalho (MOTORISTA, PLACA, SAÍDA, CIDADE, etc.)
 *   - Col G: Valores do cabeçalho
 *
 * - Aba "Calculando Romaneio": resumo consolidado (col A=Material, C-L=Qtds por destino, M=Total)
 * 
 * Estratégia de leitura:
 * 1. Lê a aba ROMANEIO
 * 2. Detecta cabeçalhos de cada bloco de cidade (linhas com "MOTORISTA" na col F)
 * 3. Para cada bloco extrai: motorista, placa, destino e materiais com quantidade > 0
 * 4. Gera um romaneio por bloco de cidade encontrado
 */

import * as XLSX from 'xlsx';

export function parseRomaneioModelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellFormula: false });
                
                // Try "ROMANEIO" sheet first, fallback to first sheet
                const sheetName = wb.SheetNames.find(n =>
                    n.toUpperCase().includes('ROMANEIO')
                ) || wb.SheetNames[0];
                
                const ws = wb.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(ws, {
                    header: 1,
                    defval: null,
                    blankrows: false,
                });

                // --- Build material catalog from left columns (A-E) ---
                // Row 0 is header: Material | Unidade | Quantidade | Peso | Peso Total
                const materialCatalog = {}; // nome -> { unidade, pesoUnit }
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const nome = str(row[0]);
                    const unidade = str(row[1]);
                    const pesoUnit = num(row[3]);
                    if (nome && pesoUnit > 0) {
                        materialCatalog[nome.toUpperCase()] = { nome, unidade, pesoUnit };
                    }
                }

                // --- Detect city blocks ---
                // A "block" starts at a row where col F (index 5) contains "MOTORISTA"
                // or col F contains "CIDADE"
                // Each block has:
                //   row with MOTORISTA → col G = motorista name, col H = placa, col J = chegada
                //   row with "CIDADE:" → col G = city name
                //   rows with F=Material header (col F="Material") → start of items table for that city
                //   items continue until next block or end
                
                const blocks = [];
                let currentBlock = null;
                let inItemsTable = false;

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const colF = str(row[5]);
                    const colG = str(row[6]);
                    const colH = str(row[7]);
                    const colI = str(row[8]);  // Peso col in item table
                    const colJ = str(row[9]);  // Peso Total col
                    const colK = str(row[10]); // Assinatura

                    // New block starts when col F = "MOTORISTA"
                    if (colF.toUpperCase() === 'MOTORISTA') {
                        if (currentBlock) blocks.push(currentBlock);
                        currentBlock = {
                            motorista: colG || '',
                            placa:     colH || '',
                            destino:   '',
                            saida:     null,
                            itens:     [],
                        };
                        inItemsTable = false;
                        continue;
                    }

                    if (!currentBlock) continue;

                    // "SAÍDA" row — col H has date/time
                    if (colF.toUpperCase() === 'SAÍDA' || colF.toUpperCase() === 'SAIDA') {
                        if (colH) currentBlock.saida = colH;
                        continue;
                    }

                    // "CIDADE:" row — col G has city name
                    if (colF.toUpperCase().startsWith('CIDADE')) {
                        currentBlock.destino = colG || currentBlock.destino;
                        inItemsTable = false;
                        continue;
                    }

                    // Items table header row (col F = "Material")
                    if (colF === 'Material' && colG === 'Unidade') {
                        inItemsTable = true;
                        continue;
                    }

                    // "Peso Geral:" marks end of items section
                    if (colF.toLowerCase().startsWith('peso geral') || colF.toLowerCase().startsWith('peso')) {
                        inItemsTable = false;
                        continue;
                    }

                    // Read item rows
                    if (inItemsTable) {
                        const matNome = str(row[5]);   // col F = material name in city block
                        const matUnid = str(row[6]);   // col G = unidade
                        const matQtd  = num(row[7]);   // col H = quantidade
                        const matPeso = num(row[8]);   // col I = peso unitário
                        const matPTot = num(row[9]);   // col J = peso total

                        if (matNome && matQtd > 0) {
                            // Look up peso from catalog if not in row
                            const catalogEntry = materialCatalog[matNome.toUpperCase()];
                            const pesoUnit = matPeso > 0 ? matPeso : (catalogEntry?.pesoUnit || 0);
                            currentBlock.itens.push({
                                nome:       matNome,
                                unidade:    matUnid || catalogEntry?.unidade || 'UN',
                                quantidade: matQtd,
                                pesoUnit,
                                pesoTotal:  matPTot > 0 ? matPTot : matQtd * pesoUnit,
                            });
                        }
                    }
                }

                // Push last block
                if (currentBlock) blocks.push(currentBlock);

                // --- Fallback: if no blocks found via headers, try reading left columns directly ---
                // This handles simpler single-city files where user just fills col C (Quantidade)
                const hasData = blocks.some(b => b.itens.length > 0);
                
                if (!hasData) {
                    // Read left columns: if Quantidade (col C) > 0, it's an item for a single romaneio
                    const singleBlock = {
                        motorista: '',
                        placa:     '',
                        destino:   '',
                        saida:     null,
                        itens:     [],
                    };

                    // Try to extract header info from anywhere in the sheet
                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        const f5 = str(row[5]);
                        if (f5.toUpperCase() === 'MOTORISTA') {
                            singleBlock.motorista = str(row[6]);
                            singleBlock.placa     = str(row[7]);
                        }
                        if (f5.toUpperCase().startsWith('CIDADE')) {
                            singleBlock.destino = str(row[6]);
                        }
                        // Left-column items
                        const nome    = str(row[0]);
                        const unidade = str(row[1]);
                        const qtd     = num(row[2]);
                        const peso    = num(row[3]);
                        if (nome && qtd > 0 && peso > 0) {
                            singleBlock.itens.push({
                                nome, unidade: unidade || 'UN',
                                quantidade: qtd, pesoUnit: peso,
                                pesoTotal: qtd * peso,
                            });
                        }
                    }
                    if (singleBlock.itens.length > 0) blocks.push(singleBlock);
                }

                const validBlocks = blocks.filter(b => b.itens.length > 0 || b.motorista);
                
                if (validBlocks.length === 0) {
                    reject(new Error(
                        'Nenhum dado encontrado. Verifique se o arquivo está no formato correto e possui quantidades preenchidas.'
                    ));
                    return;
                }

                resolve({ blocks: validBlocks, materialCatalog });
            } catch (err) {
                reject(new Error('Erro ao ler arquivo: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Erro ao abrir o arquivo.'));
        reader.readAsArrayBuffer(file);
    });
}

function str(v) {
    if (v == null) return '';
    return String(v).trim();
}
function num(v) {
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
}
