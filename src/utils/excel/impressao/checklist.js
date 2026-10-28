

// ─────────────────────────────────────────────────────────────────────────────
// IMPRESSÃO — Checklist de veículo (módulo Carretas — caminhões e carretas)
// ─────────────────────────────────────────────────────────────────────────────
export function printChecklist(checklist, todosItensAtivos = []) {
    const fmtData = d => {
        if (!d) return '—';
        const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
        return dt.toLocaleDateString('pt-BR');
    };
    const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // Helpers locais (mesma lógica de utils/carretasService.js), para não criar
    // dependência circular: itens ficam gravados como { ok, obs, label } (novo
    // formato) ou apenas true/false (registros antigos).
    const itemIsOk  = v => (v && typeof v === 'object') ? !!v.ok : !!v;
    const itemObsOf = v => (v && typeof v === 'object') ? (v.obs || '') : '';
    const itemLabelOf = (v, id) => {
        if (v && typeof v === 'object' && v.label) return v.label;
        const found = todosItensAtivos.find(i => i.id === id);
        return found ? found.label : id;
    };

    const motoristaNome = checklist.motorista?.name || checklist.motorista_nome || '—';
    const placa   = checklist.veiculo?.placa || checklist.veiculo_caminhao_placa || '—';
    const modelo  = checklist.veiculo?.modelo || checklist.veiculo_caminhao_modelo || '';
    const semana  = fmtData(checklist.semana_ref);
    const odometro = checklist.odometro != null && checklist.odometro !== '' ? `${Number(checklist.odometro).toLocaleString('pt-BR')} km` : '—';
    const itens   = checklist.itens || {};
    const entradas = Object.entries(itens);
    const ok      = entradas.filter(([, v]) => itemIsOk(v)).length;
    const total   = entradas.length;
    const fotos   = (checklist.fotos_urls && checklist.fotos_urls.length) ? checklist.fotos_urls : (checklist.foto_url ? [checklist.foto_url] : []);

    // Duas colunas de itens (como no modelo de referência) — divide a lista ao meio.
    const metade = Math.ceil(entradas.length / 2);
    const colEsquerda = entradas.slice(0, metade);
    const colDireita  = entradas.slice(metade);
    const tabelaItens = (lista) => `<table><tbody>${lista.map(([id, v]) => {
        const itemOk = itemIsOk(v); const label = itemLabelOf(v, id); const obs = itemObsOf(v);
        return `<tr>
            <td style="width:70%">${esc(label)}${obs ? `<br/><span style="font-size:8pt;font-style:italic;color:#991B1B">"${esc(obs)}"</span>` : ''}</td>
            <td style="text-align:center;font-weight:bold;color:${itemOk ? '#059669' : '#DC2626'};width:30%">${itemOk ? '✓ OK' : '✗ NÃO OK'}</td>
        </tr>`;
    }).join('')}</tbody></table>`;

    const fotosHtml = fotos.length ? `
        <table style="margin-top:8px">
            <tr><td class="sec" colspan="4">FOTOS (${fotos.length})</td></tr>
        </table>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px">
            ${fotos.map(f => `<img src="${f}" style="width:100%;height:220px;object-fit:cover;border:1px solid #222;border-radius:4px" />`).join('')}
        </div>` : '';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Checklist — ${esc(placa)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#111;background:#fff}
  .page{width:190mm;margin:8mm auto}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  td{border:1px solid #222;padding:5px 8px;vertical-align:top;word-break:break-word;font-size:9.5pt}
  .lbl{background:#f0f0f0;font-weight:bold;white-space:nowrap;width:28%}
  .sec{background:#e8e8e8;font-weight:bold;text-align:center;font-size:11pt;padding:6px 8px}
  .emp{text-align:center;font-size:14pt;font-weight:bold;border:2px solid #222;padding:8px;letter-spacing:2px}
  .cols{display:flex;gap:8px;margin-top:8px}
  .cols>div{flex:1}
  @media print{html,body{margin:0}@page{size:A4 portrait;margin:8mm 12mm}.page{margin:0;width:auto}}
</style>
</head>
<body><div class="page">

<table style="margin-bottom:8px"><tr><td class="emp" colspan="4">CHECKLIST DE VEÍCULO</td></tr></table>

<table>
  <tr>
    <td class="lbl">Motorista:</td>
    <td>${esc(motoristaNome)}</td>
    <td class="lbl" style="width:20%">Semana:</td>
    <td style="width:25%">${esc(semana)}</td>
  </tr>
  <tr>
    <td class="lbl">Veículo / Placa:</td>
    <td>${esc(placa)}${modelo ? ' — ' + esc(modelo) : ''}</td>
    <td class="lbl">Odômetro:</td>
    <td>${esc(odometro)}</td>
  </tr>
  <tr>
    <td class="lbl">Status:</td>
    <td colspan="3">${checklist.aprovado ? '✓ Aprovado' : '⏳ Pendente'}${checklist.manutencao_registrada ? ' · Manutenção registrada' : ''} — ${ok}/${total} itens OK</td>
  </tr>
</table>

<table style="margin-top:8px"><tr><td class="sec" colspan="2">ITENS VERIFICADOS</td></tr></table>
<div class="cols">
  <div>${tabelaItens(colEsquerda)}</div>
  <div>${tabelaItens(colDireita)}</div>
</div>

${(checklist.problemas || checklist.necessidades || checklist.observacoes_livres) ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">OBSERVAÇÕES GERAIS</td></tr>
  ${checklist.problemas ? `<tr><td class="lbl">Problemas:</td><td>${esc(checklist.problemas)}</td></tr>` : ''}
  ${checklist.necessidades ? `<tr><td class="lbl">Necessidades:</td><td>${esc(checklist.necessidades)}</td></tr>` : ''}
  ${checklist.observacoes_livres ? `<tr><td class="lbl">Obs. livres:</td><td>${esc(checklist.observacoes_livres)}</td></tr>` : ''}
</table>` : ''}

${checklist.obs_manutencao ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">MANUTENÇÃO REGISTRADA</td></tr>
  <tr><td colspan="2">${esc(checklist.obs_manutencao)}</td></tr>
</table>` : ''}

${fotosHtml}

<div style="margin-top:34px;display:flex;justify-content:center">
  <div style="width:60%">
    <div style="border-bottom:1px solid #222;height:40px"></div>
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO MOTORISTA</div>
  </div>
</div>

</div>
<script>
  window.onload=function(){window.print();window.onfocus=function(){setTimeout(function(){window.close();},500);}};
</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Permita popups para este site e tente novamente.'); return; }
    win.document.write(html);
    win.document.close();
}
