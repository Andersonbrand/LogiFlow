

// ─────────────────────────────────────────────────────────────────────────────
// IMPRESSÃO — Ordem de Serviço (módulo Carretas / Mecânico)
// ─────────────────────────────────────────────────────────────────────────────
export function printOrdemServico(ordem) {
    const fmt = d => {
        if (!d) return '—';
        const dt = new Date(d);
        return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const numeroOS   = ordem.id ? ordem.id.slice(0, 8).toUpperCase() : '—';
    const placa      = ordem.veiculo?.placa  || ordem.veiculo_caminhao_placa  || '—';
    const modelo     = ordem.veiculo?.modelo || ordem.veiculo_caminhao_modelo || '';
    const mecanico   = ordem.mecanico?.name  || 'Não atribuído';
    const prioridade = ordem.prioridade || 'Normal';
    const status     = ordem.status || 'Pendente';
    const descricao  = ordem.descricao || '';
    const observacoes = ordem.observacoes || '';
    const tipoManutencao = ordem.tipo_manutencao || '—';
    const kmAtual     = ordem.km_atual != null ? Number(ordem.km_atual).toLocaleString('pt-BR') + ' km' : '—';
    const pecas       = ordem.pecas_solicitadas || [];
    const abertura    = fmt(ordem.created_at);
    const finalizacao = ordem.finalizada_em ? fmt(ordem.finalizada_em) : null;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Ordem de Servico OS ${esc(numeroOS)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111;background:#fff}
  .page{width:180mm;margin:10mm auto}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  td{border:1px solid #222;padding:5px 8px;vertical-align:top;word-break:break-word}
  .lbl{background:#f0f0f0;font-weight:bold;white-space:nowrap;width:28%}
  .sec{background:#e8e8e8;font-weight:bold;text-align:center;font-size:12pt;padding:7px 8px}
  .sp{height:22px}
  .emp{text-align:center;font-size:14pt;font-weight:bold;border:2px solid #222;padding:8px;letter-spacing:2px}
  .urgente{color:#B91C1C;font-weight:bold}
  @media print{html,body{margin:0}@page{size:A4 portrait;margin:10mm 15mm}.page{margin:0;width:auto}}
</style>
</head>
<body><div class="page">

<table style="margin-bottom:8px"><tr><td class="emp" colspan="4">ORDEM DE SERVICO - OFICINA</td></tr></table>

<table>
  <tr>
    <td class="lbl">No da OS:</td>
    <td>#${esc(numeroOS)}</td>
  </tr>
  <tr>
    <td class="lbl">Data de abertura:</td>
    <td>${esc(abertura)}</td>
  </tr>
  <tr>
    <td class="lbl">Veiculo / Placa:</td>
    <td>${esc(placa)}${modelo ? ' - ' + esc(modelo) : ''}</td>
  </tr>
  <tr>
    <td class="lbl">Mecanico responsavel:</td>
    <td>${esc(mecanico)}</td>
  </tr>
  <tr>
    <td class="lbl">Tipo de manutencao:</td>
    <td>${esc(tipoManutencao)}</td>
  </tr>
  <tr>
    <td class="lbl">KM atual do veiculo:</td>
    <td>${esc(kmAtual)}</td>
  </tr>
  <tr>
    <td class="lbl">Prioridade:</td>
    <td class="${prioridade === 'Urgente' ? 'urgente' : ''}">${esc(prioridade)}${prioridade === 'Urgente' ? ' !' : ''}</td>
  </tr>
  <tr>
    <td class="lbl">Status:</td>
    <td>${esc(status)}</td>
  </tr>
</table>

<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Servico Solicitado</td></tr>
  <tr><td colspan="2" style="min-height:24px">${esc(descricao)}</td></tr>
</table>

${observacoes ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Observacoes do Servico</td></tr>
  <tr><td colspan="2">${esc(observacoes)}</td></tr>
</table>` : ''}

${pecas.length ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="3">Pecas Solicitadas</td></tr>
  <tr>
    <td class="lbl" style="width:50%">Item</td>
    <td class="lbl" style="width:20%">Qtd.</td>
    <td class="lbl" style="width:30%">Status</td>
  </tr>
  ${pecas.map(p => `<tr><td>${esc(p.item)}</td><td>${esc(p.quantidade)}</td><td>${esc(p.status || 'Pendente')}</td></tr>`).join('')}
</table>` : ''}

${ordem.problema_encontrado ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Problema Reportado pelo Mecanico</td></tr>
  <tr><td colspan="2">${esc(ordem.problema_encontrado)}</td></tr>
</table>` : ''}

${ordem.obs_finalizacao ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Observacoes de Finalizacao</td></tr>
  <tr><td colspan="2">${esc(ordem.obs_finalizacao)}</td></tr>
  <tr><td class="lbl">Finalizada em:</td><td>${esc(finalizacao || '—')}</td></tr>
</table>` : ''}

<div style="margin-top:34px;display:flex;justify-content:space-between;align-items:flex-start">
  <div style="width:48%;padding:0 12px 0 0">
    ${ordem.assinatura_mecanico ? `
    <div style="border-bottom:1px solid #222;height:40px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px">
      <span style="font-family:'Brush Script MT',cursive;font-size:16pt;color:#1D4ED8">${esc(ordem.assinatura_mecanico)}</span>
    </div>
    <div style="text-align:center;font-size:8pt;color:#059669;padding-top:2px">✓ Assinado digitalmente</div>` : `
    <div style="border-bottom:1px solid #222;height:40px"></div>`}
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO MECANICO</div>
  </div>
  <div style="width:48%;padding:0 0 0 12px">
    ${ordem.assinatura_admin ? `
    <div style="border-bottom:1px solid #222;height:40px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px">
      <span style="font-family:'Brush Script MT',cursive;font-size:16pt;color:#1D4ED8">${esc(ordem.assinatura_admin)}</span>
    </div>
    <div style="text-align:center;font-size:8pt;color:#059669;padding-top:2px">✓ Assinado digitalmente</div>` : `
    <div style="border-bottom:1px solid #222;height:40px"></div>`}
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO RESPONSAVEL / ADMIN</div>
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
