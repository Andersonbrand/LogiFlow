import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function fetchComTimeout(url: string, opts: RequestInit = {}, ms = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/** Geocodificação: Nominatim (OpenStreetMap) — sem API key, ótima cobertura no Brasil */
async function geocodeCidade(cidade: string): Promise<[number, number] | null> {
  try {
    const q = encodeURIComponent(cidade + ", Brasil");
    const resp = await fetchComTimeout(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&countrycodes=br&limit=1`,
      { headers: { "User-Agent": "LogiFlow/1.0 contact@logiflow.app" } },
      8000
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.[0]?.lon || !data?.[0]?.lat) return null;
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
  } catch {
    return null;
  }
}

/** Roteamento: OpenRouteService — usa a ORS_API_KEY configurada no Supabase */
async function rotaORS(
  coords: [number, number][],
  apiKey: string
): Promise<{ distanceKm: number; durationSec: number } | null> {
  try {
    const resp = await fetchComTimeout(
      "https://api.openrouteservice.org/v2/directions/driving-hgv",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": apiKey },
        body: JSON.stringify({ coordinates: coords, units: "km" }),
      },
      12000
    );
    if (!resp.ok) {
      const txt = await resp.text();
      console.error("ORS routing error:", resp.status, txt);
      return null;
    }
    const data = await resp.json();
    const summary = data.routes?.[0]?.summary;
    if (!summary) return null;
    return { distanceKm: Math.round(summary.distance), durationSec: Math.round(summary.duration) };
  } catch (e) {
    console.error("ORS routing exception:", e);
    return null;
  }
}

/** Fallback: distância haversine × 1.35 (fator de tortuosidade de estrada) */
function distanciaHaversine(coords: [number, number][]): number {
  let totalKm = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    totalKm += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return Math.round(totalKm * 1.35);
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

    // ── Geocodificar em paralelo via Nominatim ────────────────────────────────
    const coordsResults = await Promise.all(cidades.map(geocodeCidade));
    const notFound = cidades.filter((_, i) => !coordsResults[i]);
    if (notFound.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Cidade não encontrada: ${notFound.join(", ")}. Inclua o estado (ex: "Barreiras, BA").`,
        }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    const coords = coordsResults as [number, number][];

    // ── Calcular rota via ORS (com chave configurada) ─────────────────────────
    const orsKey = Deno.env.get("ORS_API_KEY") ?? "";
    let distanciaKm: number;
    let tempoEstimado: string;
    let fonte: string;
    let rotaReal = false;

    if (orsKey) {
      const rota = await rotaORS(coords, orsKey);
      if (rota) {
        distanciaKm = rota.distanceKm;
        const h = Math.floor(rota.durationSec / 3600);
        const m = Math.floor((rota.durationSec % 3600) / 60);
        tempoEstimado = `${h}h${m > 0 ? m + "min" : ""}`;
        fonte = "OpenRouteService (rota real)";
        rotaReal = true;
      } else {
        // ORS falhou — usa fallback
        distanciaKm = distanciaHaversine(coords);
        const min = Math.round((distanciaKm / 80) * 60);
        tempoEstimado = `${Math.floor(min / 60)}h${min % 60 > 0 ? (min % 60) + "min" : ""} (estimado)`;
        fonte = "Estimativa por coordenadas";
      }
    } else {
      distanciaKm = distanciaHaversine(coords);
      const min = Math.round((distanciaKm / 80) * 60);
      tempoEstimado = `${Math.floor(min / 60)}h${min % 60 > 0 ? (min % 60) + "min" : ""} (estimado)`;
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
      observacao: rotaReal
        ? "Rota real calculada via OpenRouteService"
        : "Distância estimada — verifique e ajuste se necessário",
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
    console.error("Erro calcular-rota:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Erro interno" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
