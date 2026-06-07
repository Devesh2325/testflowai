import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { requirement, count = 5, format = "standard" } = await req.json();
    if (!requirement || typeof requirement !== "string") {
      return j({ error: "requirement is required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const includeGherkin = format === "gherkin" || format === "both";

    const tcProps: any = {
      title: { type: "string" },
      preconditions: { type: "string" },
      steps: { type: "string", description: "Numbered steps separated by newlines" },
      expected_result: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
      type: { type: "string", enum: ["functional", "regression", "smoke", "integration", "performance", "security", "usability"] },
    };
    const required = ["title", "steps", "expected_result", "priority", "type"];
    if (includeGherkin) {
      tcProps.gherkin = { type: "string", description: "Full Gherkin scenario: Feature/Scenario/Given/When/Then/And lines" };
      required.push("gherkin");
    }

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
              items: { type: "object", properties: tcProps, required, additionalProperties: false },
            },
          },
          required: ["test_cases"],
          additionalProperties: false,
        },
      },
    }];

    const sys = includeGherkin
      ? "You are a senior QA engineer. Generate clear, atomic, prioritized test cases including positive, negative, and edge cases. For each test case ALSO output a full Gherkin BDD scenario (Feature, Scenario, Given/When/Then/And) in the 'gherkin' field."
      : "You are a senior QA engineer. Generate clear, atomic, prioritized test cases including positive, negative, and edge cases.";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Generate ${count} thorough test cases for this requirement:\n\n${requirement}` },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "emit_test_cases" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return j({ error: "Rate limit exceeded. Try again shortly." }, 429);
      if (resp.status === 402) return j({ error: "AI credits exhausted." }, 402);
      console.error("AI error", resp.status, await resp.text());
      return j({ error: "AI gateway error" }, 500);
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : { test_cases: [] };
    return j(args);
  } catch (e) {
    console.error(e);
    return j({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function j(b: any, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
