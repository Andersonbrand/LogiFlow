import { MUNICIPIOS_BA, PROJ } from './bahiaGeo';

// Localidades atendidas que não são municípios no IBGE (distritos/povoados) — coordenadas informadas pelo usuário.
// Mesma projeção do mapa: x = (lng − lng0) × cos × k ; y = (lat − lat1) × −k
const proj = (nome, lat, lng) => [nome, +((lng - PROJ.lng0) * PROJ.cos * PROJ.k).toFixed(1), +((PROJ.lat1 - lat) * PROJ.k).toFixed(1), lat, lng];

export const LOCALIDADES = {
    // Ibitira — distrito de Rio do Antônio (não confundir com o município de Ibitiara)
    'ibitira': proj('Ibitira', -14.20571, -42.11361),
};

export const MUNICIPIOS_MAPA = { ...MUNICIPIOS_BA, ...LOCALIDADES };
