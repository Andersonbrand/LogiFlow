import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Geocodifica cidade usando Nominatim (OpenStreetMap) — gratuito, sem API key.
 * Excelente cobertura no Brasil.
 */
async function geocodeCidade(cidade: string): Promise<[number, number] | null> {
  const query = encodeURIComponent(cidade + ", Brasil");
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&countrycodes=br&limit=1`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "LogiFlow/1.0 (routing service)" },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data?.[0]?.lon || !data?.[0]?.lat) return null;
  return [parseFloat(data[0].lon), parseFloat(data[0].lat)]; // [lon, lat]
}

/**
 * Calcula rota usando OSRM (OpenStreetMap Routing Machine) — gratuito, sem API key.
 * Retorna distância em metros e duração em segundos.
 */
async function calcularRotaOSRM(
  coords: [number, number][]
): Promise<{ distance: number; duration: number } | null> {
  // Monta string de coordenadas: lon,lat;lon,lat;...
  const pontos = coords.map(([lon, lat]) => `${lon},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${pontos}?overview=false`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  if (data.code !== "Ok" || !data.routes?.[0]) return null;
  return {
    distance: data.routes[0].distance, // metros
    duration: data.routes[0].duration, // segundos
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

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

    // Geocodificar todas as cidades (sequencial para respeitar rate limit do Nominatim)
    const coords: ([number, number] | null)[] = [];
    for (const cidade of cidades) {
      const c = await geocodeCidade(cidade);
      coords.push(c);
      // Pequena pausa para respeitar o rate limit do Nominatim (1 req/s)
      await new Promise(r => setTimeout(r, 300));
    }

    // Verificar cidades não encontradas
    const notFound = cidades.filter((_, i) => !coords[i]);
    if (notFound.length > 0) {
      return new Response(
        JSON.stringify({ error: `Cidade não encontrada no mapa: ${notFound.join(", ")}. Verifique o nome (ex: "Barreiras, BA").` }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Calcular rota via OSRM
    const rota = await calcularRotaOSRM(coords as [number, number][]);
    if (!rota) {
      return new Response(
        JSON.stringify({ error: "Não foi possível calcular a rota entre as cidades informadas." }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const distanciaKm = Math.round(rota.distance / 1000);
    const duracaoSegundos = Math.round(rota.duration);
    const horas = Math.floor(duracaoSegundos / 3600);
    const minutos = Math.floor((duracaoSegundos % 3600) / 60);
    const tempoEstimado = `${horas}h${minutos > 0 ? minutos + "min" : ""}`;

    const pedagioEstimado = parseFloat(((distanciaKm / 100) * pedagioPor100km).toFixed(2));

    const info: Record<string, unknown> = {
      distanciaTotal: distanciaKm,
      tempoEstimado,
      rota: cidades,
      precoDieselS10: precoDiesel,
      pedagioEstimado,
      rodoviasPrincipais: "OpenStreetMap / OSRM",
      observacao: "Rota real calculada via OpenStreetMap",
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
