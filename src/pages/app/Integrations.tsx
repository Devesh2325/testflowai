import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plug, MessageSquare, Github, Slack, Trello, Bot, Zap, GitBranch, Mail } from "lucide-react";
import { toast } from "sonner";

const PROVIDERS = [
  { id: "slack", name: "Slack", desc: "Send test failure & release alerts to channels.", icon: Slack, category: "Notifications" },
  { id: "msteams", name: "Microsoft Teams", desc: "Post run summaries to Teams channels.", icon: MessageSquare, category: "Notifications" },
  { id: "github", name: "GitHub Actions", desc: "Trigger runs from CI and post results back.", icon: Github, category: "CI/CD" },
  { id: "jenkins", name: "Jenkins", desc: "Run tests on Jenkins pipelines.", icon: GitBranch, category: "CI/CD" },
  { id: "jira", name: "Jira", desc: "Sync bugs to Jira projects.", icon: Trello, category: "Issue Tracking" },
  { id: "selenium", name: "Selenium Grid", desc: "Distribute browser tests across nodes.", icon: Bot, category: "Automation" },
  { id: "playwright", name: "Playwright", desc: "Run modern E2E tests with Playwright.", icon: Zap, category: "Automation" },
  { id: "email", name: "Email reports", desc: "Schedule daily/weekly summary emails.", icon: Mail, category: "Notifications" },
];

export default function Integrations() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("integrations").select("provider, enabled").eq("user_id", user.id);
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r: any) => { map[r.provider] = r.enabled; });
      setEnabled(map);
      setLoading(false);
    })();
  }, [user]);

  const toggle = async (provider: string, val: boolean) => {
    if (!user) return;
    setEnabled(s => ({ ...s, [provider]: val }));
    const { error } = await supabase.from("integrations")
      .upsert({ user_id: user.id, provider, enabled: val }, { onConflict: "user_id,provider" });
    if (error) {
      toast.error("Failed to update");
      setEnabled(s => ({ ...s, [provider]: !val }));
    } else {
      toast.success(`${provider} ${val ? "connected" : "disconnected"}`);
    }
  };

  const grouped = PROVIDERS.reduce<Record<string, typeof PROVIDERS>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Plug className="h-7 w-7 text-primary" />Integrations</h1>
        <p className="text-muted-foreground">Connect TestFlow AI to your tools — toggle to enable.</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{cat}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {items.map(p => (
              <Card key={p.id} className="p-5 flex items-start gap-4 hover:shadow-elegant transition-all">
                <div className="h-10 w-10 rounded-lg bg-gradient-card grid place-items-center shrink-0">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{p.name}</h3>
                    {enabled[p.id] && <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-success/20">Connected</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
                <Switch checked={!!enabled[p.id]} onCheckedChange={(v) => toggle(p.id, v)} />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
