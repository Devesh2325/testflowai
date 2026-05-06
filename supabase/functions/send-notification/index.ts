import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { title, message } = await req.json();
    if (!title || !message) return json({ error: "title and message required" }, 400);

    const { data: integ } = await supabase
      .from("integrations")
      .select("provider, enabled, config")
      .eq("user_id", user.id)
      .eq("enabled", true);

    const results: Record<string, any> = {};
    const logRows: any[] = [];

    const record = (provider: string, ok: boolean, status: any, error?: string) => {
      results[provider] = { ok, status, error };
      logRows.push({
        user_id: user.id, provider, title, message,
        status: ok ? "sent" : "failed", error: error ?? null,
        payload: { title, message },
      });
    };

    for (const row of integ ?? []) {
      const cfg = (row.config ?? {}) as any;
      try {
        if (row.provider === "slack" && cfg.webhook_url) {
          const r = await fetch(cfg.webhook_url, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: `*${title}*\n${message}` }),
          });
          record("slack", r.ok, r.status, r.ok ? undefined : await r.text());
        } else if (row.provider === "msteams" && cfg.webhook_url) {
          const r = await fetch(cfg.webhook_url, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: `**${title}**\n\n${message}` }),
          });
          record("msteams", r.ok, r.status, r.ok ? undefined : await r.text());
        } else if (row.provider === "email" && cfg.to) {
          const key = Deno.env.get("RESEND_API_KEY");
          if (!key) { record("email", false, 0, "RESEND_API_KEY not configured"); continue; }
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              from: cfg.from || "TestFlow AI <onboarding@resend.dev>",
              to: [cfg.to], subject: title,
              html: `<h2>${title}</h2><p>${message.replace(/\n/g, "<br>")}</p>`,
            }),
          });
          record("email", r.ok, r.status, r.ok ? undefined : await r.text());
        }
      } catch (e: any) {
        record(row.provider, false, 0, e.message);
      }
    }

    if (logRows.length) await supabase.from("notification_log").insert(logRows);

    return json({ ok: true, results });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
