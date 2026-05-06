import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plug, MessageSquare, Github, Slack, Trello, Bot, Zap, GitBranch, Mail, Settings2, Send, BookOpen } from "lucide-react";
import { toast } from "sonner";

type ProviderDef = {
  id: string; name: string; desc: string; icon: any; category: string;
  fields?: { key: string; label: string; placeholder?: string; type?: string }[];
  docs?: { title: string; steps: string[] };
};

const PROVIDERS: ProviderDef[] = [
  { id: "slack", name: "Slack", desc: "Send test failure & release alerts to a channel.", icon: Slack, category: "Notifications",
    fields: [{ key: "webhook_url", label: "Incoming webhook URL", placeholder: "https://hooks.slack.com/services/..." }],
    docs: { title: "Slack setup", steps: [
      "Open https://api.slack.com/apps and create a new app (From scratch).",
      "Enable 'Incoming Webhooks' and click 'Add New Webhook to Workspace'.",
      "Choose the channel that should receive alerts and copy the webhook URL.",
      "Paste the URL here and toggle Slack ON.",
      "Use the 'Send test' button to verify delivery.",
    ]},
  },
  { id: "msteams", name: "Microsoft Teams", desc: "Post run summaries to a Teams channel.", icon: MessageSquare, category: "Notifications",
    fields: [{ key: "webhook_url", label: "Incoming webhook URL", placeholder: "https://outlook.office.com/webhook/..." }],
    docs: { title: "Teams setup", steps: [
      "In Teams, open the target channel → ⋯ → Connectors.",
      "Find 'Incoming Webhook' and click Configure.",
      "Name it 'TestFlow AI', upload an icon, then Create.",
      "Copy the generated webhook URL and paste it here.",
    ]},
  },
  { id: "email", name: "Email reports", desc: "Email run summaries and alerts.", icon: Mail, category: "Notifications",
    fields: [
      { key: "to", label: "Recipient email", placeholder: "you@company.com", type: "email" },
      { key: "from", label: "From (optional)", placeholder: "TestFlow AI <onboarding@resend.dev>" },
    ],
    docs: { title: "Email setup", steps: [
      "Email is delivered through Resend. Add a RESEND_API_KEY secret to your project.",
      "Set the recipient email above.",
      "For production, verify a domain in Resend and use a from-address on that domain.",
    ]},
  },
  { id: "github", name: "GitHub Actions", desc: "Trigger runs from CI and post results back.", icon: Github, category: "CI/CD",
    fields: [{ key: "repo", label: "owner/repo", placeholder: "acme/web" }],
    docs: { title: "GitHub Actions", steps: [
      "Add a workflow that calls your TestFlow API after the test job.",
      "Store any required tokens as GitHub Action secrets.",
    ]},
  },
  { id: "jenkins", name: "Jenkins", desc: "Run tests on Jenkins pipelines.", icon: GitBranch, category: "CI/CD",
    fields: [{ key: "url", label: "Jenkins URL", placeholder: "https://jenkins.acme.com" }],
    docs: { title: "Jenkins", steps: ["Install the HTTP Request plugin.", "Add a post-build step that POSTs run results to TestFlow."] },
  },
  { id: "jira", name: "Jira", desc: "Sync bugs to a Jira project.", icon: Trello, category: "Issue Tracking",
    fields: [
      { key: "url", label: "Jira URL", placeholder: "https://acme.atlassian.net" },
      { key: "project_key", label: "Project key", placeholder: "QA" },
    ],
    docs: { title: "Jira", steps: ["Create an API token at id.atlassian.com.", "Save the Jira URL and project key here."] },
  },
  { id: "selenium", name: "Selenium Grid", desc: "Distribute browser tests across nodes.", icon: Bot, category: "Automation",
    fields: [{ key: "hub_url", label: "Hub URL", placeholder: "http://grid:4444" }],
    docs: { title: "Selenium Grid", steps: ["Run a hub: docker run -d -p 4444:4444 selenium/hub.", "Register your nodes against the hub URL."] },
  },
  { id: "playwright", name: "Playwright", desc: "Run modern E2E tests with Playwright.", icon: Zap, category: "Automation",
    docs: { title: "Playwright", steps: ["npm init playwright@latest", "Use the reporter to POST results to TestFlow."] },
  },
];

type LogRow = { id: string; provider: string; title: string | null; status: string; error: string | null; created_at: string };

export default function Integrations() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, { enabled: boolean; config: any }>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProviderDef | null>(null);
  const [docs, setDocs] = useState<ProviderDef | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<LogRow[]>([]);

  const refreshLogs = async () => {
    if (!user) return;
    const { data } = await supabase.from("notification_log").select("id,provider,title,status,error,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setLogs((data ?? []) as any);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("integrations").select("provider, enabled, config").eq("user_id", user.id);
      const map: Record<string, { enabled: boolean; config: any }> = {};
      (data ?? []).forEach((r: any) => { map[r.provider] = { enabled: r.enabled, config: r.config ?? {} }; });
      setRows(map);
      await refreshLogs();
      setLoading(false);
    })();
  }, [user]);

  const upsert = async (provider: string, patch: { enabled?: boolean; config?: any }) => {
    if (!user) return;
    const current = rows[provider] ?? { enabled: false, config: {} };
    const next = { enabled: patch.enabled ?? current.enabled, config: patch.config ?? current.config };
    setRows(s => ({ ...s, [provider]: next }));
    const { error } = await supabase.from("integrations")
      .upsert({ user_id: user.id, provider, enabled: next.enabled, config: next.config }, { onConflict: "user_id,provider" });
    if (error) { toast.error("Failed to update"); return false; }
    return true;
  };

  const toggle = async (p: ProviderDef, val: boolean) => {
    if (val && p.fields?.length) {
      const cfg = rows[p.id]?.config ?? {};
      const missing = p.fields.find(f => !cfg[f.key]);
      if (missing) {
        setEditing(p); setDraft(cfg);
        toast.message(`Configure ${p.name} to enable it`);
        return;
      }
    }
    const ok = await upsert(p.id, { enabled: val });
    if (ok) toast.success(`${p.name} ${val ? "connected" : "disconnected"}`);
  };

  const saveConfig = async () => {
    if (!editing) return;
    const ok = await upsert(editing.id, { config: draft, enabled: true });
    if (ok) { toast.success(`${editing.name} configured`); setEditing(null); }
  };

  const sendTest = async (p: ProviderDef) => {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: { title: `Test from TestFlow AI`, message: `If you can read this, ${p.name} is wired up correctly.` },
    });
    if (error) return toast.error(error.message);
    const result = (data?.results ?? {})[p.id];
    if (!result) return toast.error("Provider didn't run — check config & enabled toggle");
    if (result.ok) toast.success(`${p.name}: delivered`); else toast.error(`${p.name}: ${result.error || result.status}`);
    refreshLogs();
  };

  const grouped = PROVIDERS.reduce<Record<string, ProviderDef[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p); return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Plug className="h-7 w-7 text-primary" />Integrations</h1>
        <p className="text-muted-foreground">Connect TestFlow AI to your tools. Configure → enable → test → see activity below.</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{cat}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {items.map(p => {
              const r = rows[p.id];
              return (
                <Card key={p.id} className="p-5 flex items-start gap-4 hover:shadow-elegant transition-all">
                  <div className="h-10 w-10 rounded-lg bg-gradient-card grid place-items-center shrink-0">
                    <p.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{p.name}</h3>
                      {r?.enabled && <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-success/20">Connected</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{p.desc}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {p.fields && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => { setEditing(p); setDraft(r?.config ?? {}); }}>
                          <Settings2 className="h-3 w-3" />Configure
                        </Button>
                      )}
                      {p.docs && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setDocs(p)}>
                          <BookOpen className="h-3 w-3" />Docs
                        </Button>
                      )}
                      {r?.enabled && (p.id === "slack" || p.id === "msteams" || p.id === "email") && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => sendTest(p)}>
                          <Send className="h-3 w-3" />Send test
                        </Button>
                      )}
                    </div>
                  </div>
                  <Switch checked={!!r?.enabled} onCheckedChange={(v) => toggle(p, v)} />
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent activity</h2>
          <Button size="sm" variant="ghost" onClick={refreshLogs}>Refresh</Button>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications sent yet. Configure & test an integration above.</p>
        ) : (
          <div className="divide-y">
            {logs.map(l => (
              <div key={l.id} className="py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="outline" className="capitalize">{l.provider}</Badge>
                  <span className="truncate">{l.title || "(no title)"}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className={l.status === "sent" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>{l.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Configure {editing?.name}</DialogTitle><DialogDescription>Settings are stored securely per user.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {editing?.fields?.map(f => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Input type={f.type ?? "text"} placeholder={f.placeholder} value={draft[f.key] ?? ""} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))} />
              </div>
            ))}
            <Button onClick={saveConfig} className="w-full bg-gradient-hero border-0">Save & enable</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!docs} onOpenChange={(o) => !o && setDocs(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{docs?.docs?.title}</DialogTitle><DialogDescription>Step-by-step setup.</DialogDescription></DialogHeader>
          <ol className="space-y-2 text-sm list-decimal pl-5">
            {docs?.docs?.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
