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

    const { run_id } = await req.json();
    if (!run_id) return j({ error: "run_id required" }, 400);

    const { data: run } = await supa.from("test_runs").select("*").eq("id", run_id).maybeSingle();
    if (!run) return j({ error: "run not found" }, 404);

    const { data: execs } = await supa.from("test_executions").select("status,notes,browser,device,test_case_id").eq("run_id", run_id);
    const { data: tcs } = await supa.from("test_cases").select("id,title,priority,type");
    const { data: bugs } = await supa.from("bugs").select("title,severity,status,linked_test_case").eq("run_id", run_id);

    const tcMap = new Map((tcs ?? []).map((t: any) => [t.id, t]));
    const counts: Record<string, number> = {};
    for (const e of execs ?? []) counts[e.status] = (counts[e.status] ?? 0) + 1;
    const total = execs?.length ?? 0;

    const failed = (execs ?? []).filter((e: any) => e.status === "fail" || e.status === "blocked")
      .map((e: any) => ({ title: tcMap.get(e.test_case_id)?.title ?? "Unknown", status: e.status, notes: e.notes ?? "" }));

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return j({ error: "AI not configured" }, 500);

    const prompt = `You are a senior QA lead. Produce a concise executive summary (Markdown) of this test run.

Run: ${run.name}
Total executions: ${total}
Status counts: ${JSON.stringify(counts)}
Bugs filed: ${bugs?.length ?? 0} (${(bugs ?? []).map((b: any) => `${b.severity}:${b.title}`).slice(0, 10).join("; ")})

Failures/blocked (top 20):
${failed.slice(0, 20).map((f, i) => `${i + 1}. [${f.status}] ${f.title} — ${f.notes}`).join("\n")}

Output sections:
## Overview
## Pass / Fail Highlights
## Risk Areas
## Recommended Next Actions
Keep it under 400 words.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      if (r.status === 429) return j({ error: "Rate limit. Try again shortly." }, 429);
      if (r.status === 402) return j({ error: "AI credits exhausted." }, 402);
      return j({ error: `AI: ${await r.text()}` }, 500);
    }
    const data = await r.json();
    const summary = data.choices?.[0]?.message?.content ?? "";
    return j({ summary, stats: { total, counts, bugs: bugs?.length ?? 0 } });
  } catch (e: any) {
    return j({ error: e.message }, 500);
  }
});
function j(b: any, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
