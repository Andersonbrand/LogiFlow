export const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const FMT_DATE = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export async function downloadImagem(url, nomeArquivo) {
    if (!url) return;
    try {
        if (url.startsWith('data:')) {
            const a = document.createElement('a');
            a.href = url;
            a.download = nomeArquivo || 'foto.jpg';
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
        }
        const resp = await fetch(url);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = nomeArquivo || 'foto.jpg';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
    } catch {
        // Fallback: abre em nova aba se o download direto falhar (ex.: CORS)
        window.open(url, '_blank');
    }
}
