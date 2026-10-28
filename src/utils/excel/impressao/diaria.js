

// ─── Impressão de Diária no navegador ────────────────────────────────────────
// Gera uma janela de impressão HTML seguindo o mesmo modelo do exportDiariaModelo
// (Excel): cabeçalho com motorista/data/placa, seção Diárias, Rota Programada,
// Valor Total e três linhas de assinatura.
export function printDiaria(diaria) {
    const fmt = d => {
        if (!d) return '—';
        const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
        return dt.toLocaleDateString('pt-BR');
    };
    const brl = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const motoristaNome = diaria.motorista?.name || diaria.motorista_nome || '—';
    const dataI    = fmt(diaria.data_inicio);
    const dataF    = fmt(diaria.data_fim);
    const periodo  = dataF && dataF !== '—' && dataF !== dataI ? `${dataI} a ${dataF}` : dataI;
    const placa    = diaria.veiculo?.placa  || diaria.placa  || '—';
    const modelo   = diaria.veiculo?.modelo || diaria.modelo || '';
    const diasQtd  = Number(diaria.quantidade_dias || diaria.qtd_dias || 1);
    const valorDia = Number(diaria.valor_dia || 0);
    const vlTotal  = Number(diaria.valor_total || 0) || (diasQtd * valorDia);
    const descr    = diaria.descricao || '';
    const destino  = diaria.destino || diaria.viagem?.destino || '';
    const assinaturaMotorista = diaria.motorista?.assinatura_digital || diaria.assinatura_motorista || '';
    // Diárias avulsas usam assinatura_logistica/assinatura_transporte; diárias
    // geradas por romaneio usam assinatura_diaria_logistica/assinatura_diaria_transporte.
    const assinaturaTransporte = diaria.assinatura_transporte || diaria.assinatura_diaria_transporte || '';
    const assinaturaLogistica  = diaria.assinatura_logistica  || diaria.assinatura_diaria_logistica  || '';

    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Diária — ${esc(motoristaNome)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111;background:#fff}
  .page{width:180mm;margin:10mm auto}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  td{border:1px solid #222;padding:5px 8px;vertical-align:top;word-break:break-word}
  .lbl{background:#f0f0f0;font-weight:bold;white-space:nowrap;width:38%}
  .sec{background:#e8e8e8;font-weight:bold;text-align:center;font-size:12pt;padding:7px 8px}
  .sp{height:22px}
  .ttl{font-weight:bold;background:#e8e8e8;font-size:13pt}
  .tval{font-weight:bold;font-size:14pt;text-align:right}
  .emp{text-align:center;font-size:14pt;font-weight:bold;border:2px solid #222;padding:8px;letter-spacing:2px}
  @media print{html,body{margin:0}@page{size:A4 portrait;margin:10mm 15mm}.page{margin:0;width:auto}}
</style>
</head>
<body><div class="page">

<table style="margin-bottom:8px"><tr><td class="emp" colspan="4">TRANSPORTE — DIÁRIAS</td></tr></table>

<table>
  <tr>
    <td class="lbl">Motorista:</td>
    <td>${esc(motoristaNome)}</td>
    <td class="lbl" style="width:18%">Data:</td>
    <td style="width:27%">${esc(periodo)}</td>
  </tr>
  <tr>
    <td class="lbl">Veículo / Placa:</td>
    <td colspan="3">${esc(placa)}${modelo ? ' — ' + esc(modelo) : ''}</td>
  </tr>
</table>

<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">DIÁRIAS</td></tr>
  <tr><td class="lbl">Quantidade de dias:</td><td>${diasQtd}</td></tr>
  <tr><td class="lbl">Valor por dia (R$):</td><td>${brl(valorDia)}</td></tr>
</table>

<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Descrição / Motivo</td></tr>
  <tr><td colspan="2" style="height:24px">${esc(descr)}</td></tr>
  <tr><td colspan="2" class="sp"></td></tr>
  <tr><td colspan="2" class="sp"></td></tr>
</table>

<table style="margin-top:8px">
  <tr><td class="ttl" style="width:50%">Valor Total:</td><td class="tval">${brl(vlTotal)}</td></tr>
</table>

<div style="margin-top:34px;display:flex;justify-content:space-between;align-items:flex-start">
  <div style="width:31%;padding:0 12px 0 0">
    <div style="border-bottom:1px solid #222;height:40px;display:flex;align-items:flex-end;justify-content:center">${assinaturaTransporte ? `<span style="font-family:'Brush Script MT',cursive;font-size:16pt;color:#1D4ED8">${esc(assinaturaTransporte)}</span>` : ''}</div>
    ${assinaturaTransporte ? `<div style="text-align:center;font-size:8pt;color:#059669;padding-top:2px">✓ Assinado digitalmente</div>` : ''}
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO SETOR DE TRANSPORTE</div>
  </div>
  <div style="width:31%;padding:0 6px">
    <div style="border-bottom:1px solid #222;height:40px;display:flex;align-items:flex-end;justify-content:center">${assinaturaLogistica ? `<span style="font-family:'Brush Script MT',cursive;font-size:16pt;color:#1D4ED8">${esc(assinaturaLogistica)}</span>` : ''}</div>
    ${assinaturaLogistica ? `<div style="text-align:center;font-size:8pt;color:#059669;padding-top:2px">✓ Assinado digitalmente</div>` : ''}
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO SETOR DE LOGÍSTICA</div>
  </div>
  <div style="width:31%;padding:0 0 0 12px">
    <div style="border-bottom:1px solid #222;height:40px;display:flex;align-items:flex-end;justify-content:center">${assinaturaMotorista ? `<span style="font-family:'Brush Script MT',cursive;font-size:16pt;color:#1D4ED8">${esc(assinaturaMotorista)}</span>` : ''}</div>
    ${assinaturaMotorista ? `<div style="text-align:center;font-size:8pt;color:#059669;padding-top:2px">✓ Assinado digitalmente</div>` : ''}
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA MOTORISTA</div>
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
