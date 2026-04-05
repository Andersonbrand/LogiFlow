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

async function geocodeCidade(cidade: string): Promise<[number, number] | null> {
  try {
    const query = encodeURIComponent(cidade + ", Brasil");
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&countrycodes=br&limit=1`;
    const resp = await fetchComTimeout(url, {
      headers: { "User-Agent": "LogiFlow/1.0 contact@logiflow.app" },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.[0]?.lon || !data?.[0]?.lat) return null;
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
  } catch {
    return null;
  }
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

    // Geocodificar em paralelo (sem delay — server-side, sem rate limit de browser)
    const coordsResults = await Promise.all(cidades.map(geocodeCidade));

    const notFound = cidades.filter((_, i) => !coordsResults[i]);
    if (notFound.length > 0) {
      return new Response(
        JSON.stringify({ error: `Cidade não encontrada: ${notFound.join(", ")}. Tente incluir o estado (ex: "Barreiras, BA").` }),
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
