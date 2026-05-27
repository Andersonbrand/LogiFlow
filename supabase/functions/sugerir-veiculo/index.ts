import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { pesoTotal, valorCarga, destino, nPedidos, pedidosResumo, veiculos } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada nas secrets da Edge Function.");

    const veiculosStr = Array.isArray(veiculos) && veiculos.length > 0
      ? veiculos.join("; ")
      : "Nenhum veículo disponível cadastrado";

    const prompt = `Você é especialista em logística de transporte rodoviário brasileiro. Com base nos dados abaixo, sugira o MELHOR veículo DISPONÍVEL para essa viagem, justificando em 2-3 frases concisas em português.

Peso total estimado: ${pesoTotal > 0 ? pesoTotal.toLocaleString("pt-BR") + " kg" : "não informado"}
Valor total da carga: R$ ${Number(valorCarga || 0).toLocaleString("pt-BR")}
Destino: ${destino || "não informado"}
Número de pedidos: ${nPedidos}
Pedidos: ${pedidosResumo || "não especificados"}

Veículos disponíveis: ${veiculosStr}

Considere: capacidade de carga vs peso real, tipo de composição e disponibilidade. Se nenhum for adequado, informe claramente.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    const sugestao = (data.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");

    return new Response(JSON.stringify({ sugestao }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
