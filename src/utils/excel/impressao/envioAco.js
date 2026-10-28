

// ─────────────────────────────────────────────────────────────────────────────
// IMPRESSÃO — Comprovante de envio de aço (Carretas → Distribuição de Viagens)
// Mesmo mecanismo da impressão de Diária: abre uma janela com o documento e já
// chama a impressão; a janela fica aberta para conferência.
// ─────────────────────────────────────────────────────────────────────────────
export function printEnvioAco(envio) {
    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmt = d => d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    const pedidos = Array.isArray(envio?.pedidos) ? envio.pedidos : [];
    const motoristaNome = envio.motorista?.name || '—';
    const cod = String(envio.id || '').slice(0, 8).toUpperCase();
    const linhas = pedidos.length
        ? pedidos.map(p => `<tr><td>${esc(p.numero_pedido)}</td><td>${esc(p.cliente)}</td><td>${esc(p.cidade)}</td><td>${fmt(p.data_entrega)}</td></tr>`).join('')
        : `<tr><td colspan="4">${esc(envio.destino || '—')} <em>(registro antigo, sem detalhamento)</em></td></tr>`;
    const quando = envio.assinatura_admin_at ? new Date(envio.assinatura_admin_at).toLocaleString('pt-BR') : '';
    const assinAdmin = envio.assinatura_admin || '';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Envio de aço — ${esc(motoristaNome)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111;background:#fff}
  .page{width:180mm;margin:10mm auto}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  td,th{border:1px solid #222;padding:5px 8px;vertical-align:top;word-break:break-word;text-align:left}
  .lbl{background:#f0f0f0;font-weight:bold;white-space:nowrap;width:22%}
  .sec{background:#e8e8e8;font-weight:bold;text-align:center;font-size:12pt;padding:7px 8px}
  th{background:#f0f0f0;font-size:10pt}
  .emp{text-align:center;font-size:14pt;font-weight:bold;border:2px solid #222;padding:8px;letter-spacing:2px}
  .sp{height:22px}
  @media print{html,body{margin:0}@page{size:A4 portrait;margin:10mm 15mm}.page{margin:0;width:auto}}
</style>
</head>
<body>
<div class="page">
<table style="margin-bottom:8px"><tr><td class="emp" colspan="4">TRANSPORTE — ENVIO DE AÇO</td></tr></table>
<table>
  <tr><td class="lbl">Motorista:</td><td>${esc(motoristaNome)}</td><td class="lbl">Registro:</td><td>${esc(cod)}</td></tr>
  <tr><td class="lbl">Placa:</td><td>${esc(envio.placa || '—')}</td><td class="lbl">Data do envio:</td><td>${fmt(envio.data_envio)}</td></tr>
</table>
<div class="sp"></div>
<table>
  <tr><td class="sec" colspan="4">PEDIDOS</td></tr>
  <tr><th style="width:18%">Nº do pedido</th><th>Cliente</th><th style="width:26%">Cidade</th><th style="width:20%">Data de entrega</th></tr>
  ${linhas}
</table>
${envio.observacoes ? `<div class="sp"></div><table><tr><td class="sec">OBSERVAÇÕES</td></tr><tr><td>${esc(envio.observacoes)}</td></tr></table>` : ''}
<div class="sp"></div>
<p style="font-size:10pt">Declaro ter recebido a carga de aço referente aos pedidos acima, para entrega nas cidades e datas indicadas.</p>
<div style="display:flex;justify-content:space-between;margin-top:56px">
  <div style="width:47%;padding:0 6px 0 0">
    <div style="border-bottom:1px solid #222;height:40px;display:flex;align-items:flex-end;justify-content:center">${assinAdmin ? `<span style="font-family:'Brush Script MT',cursive;font-size:16pt;color:#1D4ED8">${esc(assinAdmin)}</span>` : ''}</div>
    ${assinAdmin ? `<div style="text-align:center;font-size:8pt;color:#059669;padding-top:2px">✓ Assinado digitalmente${quando ? ' em ' + esc(quando) : ''}</div>` : ''}
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO RESPONSÁVEL</div>
  </div>
  <div style="width:47%;padding:0 0 0 6px">
    <div style="border-bottom:1px solid #222;height:40px"></div>
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA MOTORISTA — ${esc(motoristaNome)}</div>
    <div style="text-align:center;font-size:8pt;padding-top:2px">Data: ____/____/________</div>
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
