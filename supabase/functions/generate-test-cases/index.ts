import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { requirement, count = 5 } = await req.json();
    if (!requirement || typeof requirement !== "string") {
      return new Response(JSON.stringify({ error: "requirement is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const tools = [{
      type: "function",
      function: {
        name: "emit_test_cases",
        description: "Return generated test cases",
        parameters: {
          type: "object",
          properties: {
            test_cases: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  preconditions: { type: "string" },
                  steps: { type: "string", description: "Numbered steps separated by newlines" },
                  expected_result: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  type: { type: "string", enum: ["functional", "regression", "smoke", "integration", "performance", "security", "usability"] },
                },
                required: ["title", "steps", "expected_result", "priority", "type"],
                additionalProperties: false,
              },
            },
          },
          required: ["test_cases"],
          additionalProperties: false,
        },
      },
    }];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a senior QA engineer. Generate clear, atomic, prioritized test cases including positive, negative, and edge cases." },
          { role: "user", content: `Generate ${count} thorough test cases for this requirement:\n\n${requirement}` },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "emit_test_cases" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : { test_cases: [] };

    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
