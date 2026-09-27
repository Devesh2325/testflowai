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

    const { description, test_case_title, context } = await req.json();
    if (!description) return j({ error: "description required" }, 400);

    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY");
    if (!apiKey) return j({ error: "AI API key not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in Supabase secrets." }, 500);

    const isOpenAI = Boolean(Deno.env.get("OPENAI_API_KEY")) && !Deno.env.get("GEMINI_API_KEY");
    const baseUrl = Deno.env.get("AI_BASE_URL") || (
      isOpenAI
        ? "https://api.openai.com/v1/chat/completions"
        : "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    );
    const model = Deno.env.get("AI_MODEL") || (isOpenAI ? "gpt-4o-mini" : "gemini-2.5-flash");

    const prompt = `You are a senior QA engineer. Generate a structured bug report as strict JSON with keys: title (short), severity (low|medium|high|critical), priority (low|medium|high|urgent), description, steps_to_reproduce (numbered), expected_result, actual_result, environment, browser, device, app_version, tags (string array of 1-4 short tags). 
Source description: ${description}
${test_case_title ? `Linked test case: ${test_case_title}` : ""}
${context ? `Context: ${context}` : ""}
Return ONLY the JSON object.`;

    const r = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return j({ error: `AI: ${await r.text()}` }, 500);
    const data = await r.json();
    let parsed: any = {};
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch { /* */ }
    return j({ bug: parsed });
  } catch (e: any) {
    return j({ error: e.message }, 500);
  }
});
function j(b: any, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
