

// ─────────────────────────────────────────────────────────────────────────────
// IMPRESSÃO — Romaneio (módulo Carretas)
// ─────────────────────────────────────────────────────────────────────────────
export function printRomaneioCarretas(romaneio) {
    const fmtData = d => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—';
    const fmtDataHora = d => {
        if (!d) return '—';
        const dt = new Date(d);
        return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };
    const brl = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const itens = romaneio.itens || [];
    const pesoTotal = itens.reduce((s, it) => s + Number(it.peso_total || 0), 0);
    const valorCarga = Number(romaneio.valor_carga || 0);
    const valorFrete = Number(romaneio.valor_frete || 0);
    const pctFrete = valorCarga > 0 ? (valorFrete / valorCarga) * 100 : 0;
    const statusCfg = STATUS_ROMANEIO_COLORS_LOCAL[romaneio.status] || { text: '#374151' };

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Romaneio ${esc(romaneio.numero)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111;background:#fff}
  .page{width:180mm;margin:10mm auto}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  td,th{border:1px solid #222;padding:5px 8px;vertical-align:top;word-break:break-word}
  .lbl{background:#f0f0f0;font-weight:bold;white-space:nowrap;width:28%}
  .sec{background:#e8e8e8;font-weight:bold;text-align:center;font-size:12pt;padding:7px 8px}
  .emp{text-align:center;font-size:14pt;font-weight:bold;border:2px solid #222;padding:8px;letter-spacing:2px}
  .ttl{font-weight:bold;background:#e8e8e8;font-size:12pt}
  .tval{font-weight:bold;font-size:13pt;text-align:right}
  th{background:#f0f0f0;font-size:9.5pt;text-align:left}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  @media print{html,body{margin:0}@page{size:A4 portrait;margin:10mm 15mm}.page{margin:0;width:auto}}
</style>
</head>
<body><div class="page">

<table style="margin-bottom:8px"><tr><td class="emp" colspan="4">ROMANEIO DE CARGA — CARRETAS</td></tr></table>

<table>
  <tr>
    <td class="lbl">Nº Romaneio:</td>
    <td>${esc(romaneio.numero)}</td>
    <td class="lbl" style="width:22%">Status:</td>
    <td style="width:22%;font-weight:bold;color:${statusCfg.text}">${esc(romaneio.status || '—')}</td>
  </tr>
  <tr>
    <td class="lbl">Motorista:</td>
    <td>${esc(romaneio.motorista?.name || '—')}</td>
    <td class="lbl">Placa:</td>
    <td>${esc(romaneio.veiculo?.placa || '—')}${romaneio.veiculo?.modelo ? ' — ' + esc(romaneio.veiculo.modelo) : ''}</td>
  </tr>
  <tr>
    <td class="lbl">Empresa:</td>
    <td>${esc(romaneio.empresa || '—')}</td>
    <td class="lbl">Destino:</td>
    <td>${esc(romaneio.destino || '—')}</td>
  </tr>
  <tr>
    <td class="lbl">Nº NF:</td>
    <td>${esc(romaneio.numero_nf || '—')}</td>
    <td class="lbl">Nº Pedido:</td>
    <td>${esc(romaneio.numero_pedido || '—')}</td>
  </tr>
  <tr>
    <td class="lbl">Data Saída:</td>
    <td>${esc(fmtData(romaneio.data_saida))}</td>
    <td class="lbl">Data Chegada:</td>
    <td>${esc(fmtData(romaneio.data_chegada))}</td>
  </tr>
</table>

${itens.length > 0 ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="4">Materiais Transportados</td></tr>
</table>
<table style="margin-top:0">
  <tr>
    <th style="width:46%">Material</th>
    <th style="width:18%">Qtd.</th>
    <th style="width:12%">Unid.</th>
    <th style="width:24%">Peso (kg)</th>
  </tr>
  ${itens.map(it => `<tr>
    <td>${esc(it.material?.nome || it.descricao || '—')}</td>
    <td class="num">${esc(Number(it.quantidade || 0).toLocaleString('pt-BR'))}</td>
    <td>${esc(it.unidade || '—')}</td>
    <td class="num">${it.peso_total ? esc(Number(it.peso_total).toLocaleString('pt-BR')) : '—'}</td>
  </tr>`).join('')}
  <tr>
    <td class="lbl" colspan="3">Peso Total</td>
    <td class="num" style="font-weight:bold">${pesoTotal > 0 ? esc(pesoTotal.toLocaleString('pt-BR')) + ' kg' : '—'}</td>
  </tr>
</table>` : ''}

<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Valores</td></tr>
  <tr><td class="ttl" style="width:60%">Valor da Carga:</td><td class="tval">${brl(valorCarga)}</td></tr>
  <tr><td class="ttl">Frete:</td><td class="tval">${brl(valorFrete)}</td></tr>
  <tr><td class="lbl">Frete sobre a carga:</td><td>${pctFrete.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</td></tr>
</table>

${romaneio.observacoes ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Observações</td></tr>
  <tr><td colspan="2">${esc(romaneio.observacoes)}</td></tr>
</table>` : ''}

<div style="margin-top:34px;display:flex;justify-content:space-between;align-items:flex-start">
  <div style="width:48%;padding:0 12px 0 0">
    <div style="border-bottom:1px solid #222;height:40px"></div>
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO MOTORISTA</div>
  </div>
  <div style="width:48%;padding:0 0 0 12px">
    <div style="border-bottom:1px solid #222;height:40px"></div>
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO RESPONSÁVEL / CONFERENTE</div>
  </div>
</div>

<p style="margin-top:14px;font-size:8pt;color:#666;text-align:center">Emitido em ${esc(fmtDataHora(new Date().toISOString()))} — LogiFlow</p>

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

const STATUS_ROMANEIO_COLORS_LOCAL = {
    'Aguardando':          { text: '#B45309' },
    'Carregando':          { text: '#1D4ED8' },
    'Em Trânsito':         { text: '#7C3AED' },
    'Entrega finalizada':  { text: '#065F46' },
    'Cancelado':           { text: '#6B7280' },
};
