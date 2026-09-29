import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIMEOUT_MS = 8000; // 8s por chamada externa

function fetchComTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

const VERSAO = "2026-09-29b"; // aparece nas respostas: confirma qual versão está publicada

const UF_NOME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Origem fixa da operação: nunca depende de serviço externo
const COORDS_FIXAS: Record<string, [number, number]> = {
  "guanambi|BA": [-42.7799, -14.2231], // [lon, lat]
};

const cacheGeo = new Map<string, [number, number]>();
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "Arapiranga, Rio de Contas, BA" -> candidatos ["Arapiranga","Rio de Contas"], uf BA
function separarCidadeUF(txt: string): { candidatos: string[]; uf: string } {
  const partes = txt.replace(/\([^)]*\)/g, "").split(",").map((p) => p.trim()).filter(Boolean);
  let uf = "BA";
  const ultima = (partes[partes.length - 1] || "").toUpperCase();
  if (partes.length > 1 && /^[A-Z]{2}$/.test(ultima) && UF_NOME[ultima]) {
    uf = ultima;
    partes.pop();
  }
  return { candidatos: partes.length ? partes : [txt.trim()], uf };
}

type Res = [number, number] | null | "erro";

// Open-Meteo Geocoding: gratuito, sem chave e sem o limite de 1 req/s do Nominatim
async function geocodeOpenMeteo(nome: string, uf: string): Promise<Res> {
  const estado = semAcento(UF_NOME[uf]);
  let respondeu = false;
  for (const termo of [...new Set([nome, semAcento(nome)])]) {
    try {
      const resp = await fetchComTimeout(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(termo)}&count=20&language=pt&format=json&countryCode=BR`,
      );
      if (!resp.ok) continue;
      respondeu = true;
      const data = await resp.json();
      const achou = (data?.results || []).find(
        (r: any) => semAcento(r.admin1 || "") === estado && typeof r.latitude === "number" && typeof r.longitude === "number",
      );
      if (achou) return [achou.longitude, achou.latitude];
    } catch { /* tenta o próximo termo */ }
  }
  return respondeu ? null : "erro";
}

let ultimaChamadaNominatim = 0;
async function nominatim(params: string): Promise<Res> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const espera = 1100 - (Date.now() - ultimaChamadaNominatim);
    if (espera > 0) await dormir(espera); // no máximo 1 requisição por segundo
    ultimaChamadaNominatim = Date.now();
    try {
      const resp = await fetchComTimeout(
        `https://nominatim.openstreetmap.org/search?${params}&format=json&countrycodes=br&limit=1`,
        { headers: { "User-Agent": "LogiFlow/1.0 contact@logiflow.app", "Accept-Language": "pt-BR" } },
      );
      if (resp.status === 429 || resp.status >= 500) { await dormir(1500 * (tentativa + 1)); continue; }
      if (!resp.ok) return "erro";
      const data = await resp.json();
      if (!data?.[0]?.lon || !data?.[0]?.lat) return null;
      return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    } catch {
      await dormir(1500 * (tentativa + 1));
    }
  }
  return "erro";
}

async function geocodeCidade(txt: string): Promise<Res> {
  const { candidatos, uf } = separarCidadeUF(txt);
  const chave = `${semAcento(candidatos[0])}|${uf}`;
  if (COORDS_FIXAS[chave]) return COORDS_FIXAS[chave];
  if (cacheGeo.has(chave)) return cacheGeo.get(chave)!;

  let algumRespondeuNaoEncontrado = false;
  for (const nome of candidatos) {
    const tentativas: (() => Promise<Res>)[] = [
      () => geocodeOpenMeteo(nome, uf),
      () => nominatim(`city=${encodeURIComponent(nome)}&state=${encodeURIComponent(UF_NOME[uf])}&country=Brasil`),
      () => nominatim(`q=${encodeURIComponent(`${nome}, ${UF_NOME[uf]}, Brasil`)}`),
    ];
    for (const tentar of tentativas) {
      const r = await tentar();
      if (r && r !== "erro") { cacheGeo.set(chave, r); return r; }
      if (r === null) algumRespondeuNaoEncontrado = true;
    }
  }
  return algumRespondeuNaoEncontrado ? null : "erro";
}

async function calcularRotaOSRM(coords: [number, number][]): Promise<{ distance: number; duration: number } | null> {
  try {
    const pontos = coords.map(([lon, lat]) => `${lon},${lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${pontos}?overview=false`;
    const resp = await fetchComTimeout(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    return { distance: data.routes[0].distance, duration: data.routes[0].duration };
  } catch {
    return null;
  }
}

/** Estimativa de distância por estrada usando distância haversine × fator 1.35 */
function distanciaEstimada(coords: [number, number][]): number {
  let totalKm = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    totalKm += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return Math.round(totalKm * 1.35); // fator de tortuosidade de estrada
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const cidades: string[] = body.cidades;
    const consumoKm: number | null = body.consumoKm;
    const precoDiesel: number = body.precoDiesel || 6.50;
    const pedagioPor100km: number = body.pedagioPor100km || 8.00;

    if (!cidades || cidades.length < 2) {
      return new Response(
        JSON.stringify({ error: "Informe pelo menos origem e destino" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Geocodifica uma por vez (o Nominatim, quando usado, exige no máximo 1 req/s)
    const coordsResults: Res[] = [];
    for (const c of cidades) coordsResults.push(await geocodeCidade(c));

    const comErro = cidades.filter((_, i) => coordsResults[i] === "erro");
    if (comErro.length > 0) {
      return new Response(
        JSON.stringify({ error: `Serviço de localização indisponível para: ${comErro.join(" | ")}. Tente novamente ou preencha a distância manualmente.`, versao: VERSAO }),
        { status: 503, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    const notFound = cidades.filter((_, i) => !coordsResults[i]);
    if (notFound.length > 0) {
      return new Response(
        JSON.stringify({ error: `Não localizei: ${notFound.join(" | ")}. Confira a grafia no cadastro de fretes.`, versao: VERSAO }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const coords = coordsResults as [number, number][];

    // Tenta OSRM; se falhar, usa estimativa por haversine
    let distanciaKm: number;
    let tempoEstimado: string;
    let fonte: string;

    const rota = await calcularRotaOSRM(coords);
    if (rota) {
      distanciaKm = Math.round(rota.distance / 1000);
      const h = Math.floor(rota.duration / 3600);
      const m = Math.floor((rota.duration % 3600) / 60);
      tempoEstimado = `${h}h${m > 0 ? m + "min" : ""}`;
      fonte = "OpenStreetMap / OSRM";
    } else {
      // Fallback: distância estimada por coordenadas
      distanciaKm = distanciaEstimada(coords);
      const minutos = Math.round((distanciaKm / 80) * 60); // velocidade média 80 km/h
      const h = Math.floor(minutos / 60);
      const m = minutos % 60;
      tempoEstimado = `${h}h${m > 0 ? m + "min" : ""} (estimado)`;
      fonte = "Estimativa por coordenadas";
    }

    const pedagioEstimado = parseFloat(((distanciaKm / 100) * pedagioPor100km).toFixed(2));

    const info: Record<string, unknown> = {
      distanciaTotal: distanciaKm,
      tempoEstimado,
      versao: VERSAO,
      rota: cidades,
      precoDieselS10: precoDiesel,
      pedagioEstimado,
      rodoviasPrincipais: fonte,
      observacao: rota ? "Rota real calculada via OpenStreetMap" : "Distância estimada — verifique e ajuste se necessário",
    };

    if (consumoKm && distanciaKm) {
      const litros = distanciaKm / consumoKm;
      info.litrosEstimados = Math.round(litros);
      info.custoCombustivel = parseFloat((litros * precoDiesel).toFixed(2));
    }

    return new Response(JSON.stringify(info), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Erro na Edge Function calcular-rota:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Erro interno" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
