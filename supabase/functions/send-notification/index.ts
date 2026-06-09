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

    const { title, message, providers: only, link } = await req.json();
    if (!title || !message) return json({ error: "title and message required" }, 400);

    let q = supabase.from("integrations").select("provider, enabled, config").eq("user_id", user.id).eq("enabled", true);
    const { data: integ } = await q;

    const results: Record<string, any> = {};
    const logRows: any[] = [];

    const record = (provider: string, ok: boolean, status: any, error?: string, extra?: any) => {
      results[provider] = { ok, status, error, ...extra };
      logRows.push({
        user_id: user.id, provider, title, message,
        status: ok ? "sent" : "failed", error: error ?? null,
        payload: { title, message, link, ...extra },
      });
    };

    const rows = (integ ?? []).filter(r => !only || (Array.isArray(only) && only.includes(r.provider)));

    for (const row of rows) {
      const cfg = (row.config ?? {}) as any;
      try {
        // ---- Slack ----
        if (row.provider === "slack" && cfg.webhook_url) {
          const r = await fetch(cfg.webhook_url, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: `*${title}*\n${message}${link ? `\n<${link}|Open in TestFlow>` : ""}` }),
          });
          record("slack", r.ok, r.status, r.ok ? undefined : await r.text());

        // ---- MS Teams ----
        } else if (row.provider === "msteams" && cfg.webhook_url) {
          const r = await fetch(cfg.webhook_url, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: `**${title}**\n\n${message}${link ? `\n\n[Open in TestFlow](${link})` : ""}` }),
          });
          record("msteams", r.ok, r.status, r.ok ? undefined : await r.text());

        // ---- Email (Resend) ----
        } else if (row.provider === "email" && cfg.to) {
          const key = Deno.env.get("RESEND_API_KEY");
          if (!key) { record("email", false, 0, "RESEND_API_KEY not configured"); continue; }
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              from: cfg.from || "TestFlow AI <onboarding@resend.dev>",
              to: [cfg.to], subject: title,
              html: `<h2>${title}</h2><p>${String(message).replace(/\n/g, "<br>")}</p>${link ? `<p><a href="${link}">Open in TestFlow</a></p>` : ""}`,
            }),
          });
          record("email", r.ok, r.status, r.ok ? undefined : await r.text());

        // ---- Jira: create issue ----
        } else if (row.provider === "jira" && cfg.url && cfg.project_key && cfg.email && cfg.api_token) {
          const auth = btoa(`${cfg.email}:${cfg.api_token}`);
          const base = String(cfg.url).replace(/\/+$/, "");
          const r = await fetch(`${base}/rest/api/3/issue`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}`, Accept: "application/json" },
            body: JSON.stringify({
              fields: {
                project: { key: cfg.project_key },
                summary: title,
                issuetype: { name: cfg.issue_type || "Bug" },
                description: {
                  type: "doc", version: 1,
                  content: [{ type: "paragraph", content: [{ type: "text", text: String(message) + (link ? `\n\n${link}` : "") }] }],
                },
              },
            }),
          });
          const body = await r.text();
          let issueKey: string | undefined;
          try { issueKey = JSON.parse(body)?.key; } catch {}
          record("jira", r.ok, r.status, r.ok ? undefined : body, { issue_key: issueKey, issue_url: issueKey ? `${base}/browse/${issueKey}` : undefined });

        // ---- GitHub: create issue ----
        } else if (row.provider === "github" && cfg.repo && cfg.token) {
          const r = await fetch(`https://api.github.com/repos/${cfg.repo}/issues`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cfg.token}`,
              "Accept": "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({ title, body: `${message}${link ? `\n\n${link}` : ""}`, labels: ["testflow"] }),
          });
          const body = await r.text();
          let html_url: string | undefined;
          try { html_url = JSON.parse(body)?.html_url; } catch {}
          record("github", r.ok, r.status, r.ok ? undefined : body, { issue_url: html_url });

        // ---- Jenkins: trigger build (with optional token) ----
        } else if (row.provider === "jenkins" && cfg.url && cfg.job) {
          const base = String(cfg.url).replace(/\/+$/, "");
          const path = cfg.token ? `/job/${encodeURIComponent(cfg.job)}/build?token=${encodeURIComponent(cfg.token)}` : `/job/${encodeURIComponent(cfg.job)}/build`;
          const headers: Record<string, string> = {};
          if (cfg.user && cfg.api_token) headers["Authorization"] = `Basic ${btoa(`${cfg.user}:${cfg.api_token}`)}`;
          const r = await fetch(`${base}${path}`, { method: "POST", headers });
          record("jenkins", r.ok || r.status === 201, r.status, (r.ok || r.status === 201) ? undefined : await r.text());

        } else {
          // configured-but-incomplete — surface to UI
          record(row.provider, false, 0, "Missing required configuration");
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
