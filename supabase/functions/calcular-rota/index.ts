import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function geocodeCidade(cidade: string, apiKey: string): Promise<[number, number] | null> {
  const url = "https://api.openrouteservice.org/geocode/search?api_key=" + apiKey +
    "&text=" + encodeURIComponent(cidade + ", Brasil") +
    "&boundary.country=BR&size=1";
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords) return null;
  return [coords[0], coords[1]]; // [lon, lat]
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

    const apiKey = Deno.env.get("ORS_API_KEY") ?? "";

    // Geocodificar todas as cidades em paralelo
    const coordsResults = await Promise.all(cidades.map(c => geocodeCidade(c, apiKey)));

    // Verificar se todas foram encontradas
    const notFound = cidades.filter((_, i) => !coordsResults[i]);
    if (notFound.length > 0) {
      throw new Error("Cidades nao encontradas: " + notFound.join(", "));
    }

    const coordinates = coordsResults as [number, number][];

    // Chamar a API de direções para caminhão (driving-hgv)
    const rotaResp = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-hgv",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": apiKey,
        },
        body: JSON.stringify({
          coordinates: coordinates,
          units: "km",
          language: "pt",
        }),
      }
    );

    if (!rotaResp.ok) {
      const errText = await rotaResp.text();
      throw new Error("ORS API error: " + errText);
    }

    const rotaData = await rotaResp.json();
    const summary = rotaData.routes?.[0]?.summary;

    if (!summary) {
      throw new Error("Rota nao encontrada entre as cidades informadas");
    }

    const distanciaTotal = Math.round(summary.distance);
    const duracaoSegundos = Math.round(summary.duration);
    const horas = Math.floor(duracaoSegundos / 3600);
    const minutos = Math.floor((duracaoSegundos % 3600) / 60);
    const tempoEstimado = horas + "h" + (minutos > 0 ? minutos + "min" : "");

    // Estimar pedágio baseado na distância
    const pedagioEstimado = parseFloat(((distanciaTotal / 100) * pedagioPor100km).toFixed(2));

    const info: Record<string, unknown> = {
      distanciaTotal,
      tempoEstimado,
      rota: cidades,
      precoDieselS10: precoDiesel,
      pedagioEstimado,
      rodoviasPrincipais: "Calculado via OpenRouteService",
      observacao: "Rota real para caminhao via OpenStreetMap",
    };

    // Calcular custo do combustível se consumo foi informado
    if (consumoKm && distanciaTotal) {
      const litros = distanciaTotal / consumoKm;
      info.litrosEstimados = Math.round(litros);
      info.custoCombustivel = parseFloat((litros * precoDiesel).toFixed(2));
    }

    return new Response(JSON.stringify(info), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Erro na Edge Function:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Erro interno" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
