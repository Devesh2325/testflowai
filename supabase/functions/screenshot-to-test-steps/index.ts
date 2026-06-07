import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "unauthorized" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return j({ error: "unauthorized" }, 401);

    const { image_base64, image_url, context } = await req.json();
    if (!image_base64 && !image_url) return j({ error: "image_base64 or image_url required" }, 400);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return j({ error: "AI not configured" }, 500);

    const imageContent = image_url
      ? { type: "image_url", image_url: { url: image_url } }
      : { type: "image_url", image_url: { url: image_base64.startsWith("data:") ? image_base64 : `data:image/png;base64,${image_base64}` } };

    const tools = [{
      type: "function",
      function: {
        name: "emit_test_case",
        description: "Generate a test case from a UI screenshot",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            ui_summary: { type: "string", description: "What screen / UI is visible" },
            preconditions: { type: "string" },
            steps: { type: "string", description: "Numbered actionable steps for QA tester" },
            expected_result: { type: "string" },
            priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
            type: { type: "string", enum: ["functional", "regression", "smoke", "integration", "usability"] },
          },
          required: ["title", "ui_summary", "steps", "expected_result", "priority", "type"],
          additionalProperties: false,
        },
      },
    }];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `You are a senior QA engineer. Look at this UI screenshot and create one detailed test case covering its main user flow. ${context ? `Context: ${context}` : ""}` },
            imageContent,
          ],
        }],
        tools,
        tool_choice: { type: "function", function: { name: "emit_test_case" } },
      }),
    });
    if (!r.ok) {
      if (r.status === 429) return j({ error: "Rate limit. Try again shortly." }, 429);
      if (r.status === 402) return j({ error: "AI credits exhausted." }, 402);
      return j({ error: `AI: ${await r.text()}` }, 500);
    }
    const data = await r.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const test_case = call ? JSON.parse(call.function.arguments) : {};
    return j({ test_case });
  } catch (e: any) {
    return j({ error: e.message }, 500);
  }
});
function j(b: any, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
