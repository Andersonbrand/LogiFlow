// Baixa uma imagem (data URL base64 ou URL remota) forçando o download no navegador
// Identifica o tipo de um anexo a partir do data URL (usado no anexo da OS)
export function getAnexoTipo(dataUrl) {
    if (!dataUrl) return null;
    const m = /^data:([^;]+);/.exec(dataUrl);
    const mime = m ? m[1] : '';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('image/')) return 'imagem';
    if (mime === 'application/msword' || mime.includes('wordprocessingml')) return 'word';
    return 'outro';
}
