// Identifica o tipo de um anexo a partir do data URL (PDF, imagem, Word ou outro)
export function getAnexoTipo(dataUrl) {
    if (!dataUrl) return null;
    const m = /^data:([^;]+);/.exec(dataUrl);
    const mime = m ? m[1] : '';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('image/')) return 'imagem';
    if (mime === 'application/msword' || mime.includes('wordprocessingml')) return 'word';
    return 'outro';
}

export function downloadAnexo(url, nomeArquivo) {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo || 'anexo';
    document.body.appendChild(a);
    a.click();
    a.remove();
}
