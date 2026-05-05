import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, BookOpen, Trophy, Map, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Topic = { name: string; links: { label: string; url: string }[] };

const roadmap: { stage: string; topics: Topic[] }[] = [
  {
    stage: "Manual QA Foundations",
    topics: [
      { name: "SDLC & STLC", links: [
        { label: "Guru99 — STLC", url: "https://www.guru99.com/software-testing-life-cycle.html" },
        { label: "ISTQB Glossary", url: "https://glossary.istqb.org/" },
      ]},
      { name: "Test design techniques", links: [
        { label: "Equivalence & BVA", url: "https://www.guru99.com/equivalence-partitioning-boundary-value-analysis.html" },
        { label: "ISTQB Foundation (free PDF)", url: "https://www.istqb.org/certifications/certified-tester-foundation-level" },
      ]},
      { name: "Bug lifecycle", links: [
        { label: "Defect lifecycle", url: "https://www.guru99.com/defect-life-cycle.html" },
      ]},
      { name: "Test case writing", links: [
        { label: "How to write test cases", url: "https://www.softwaretestinghelp.com/test-case-template/" },
      ]},
    ],
  },
  {
    stage: "API Testing",
    topics: [
      { name: "REST basics", links: [
        { label: "MDN — HTTP", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP" },
        { label: "REST API Tutorial", url: "https://restfulapi.net/" },
      ]},
      { name: "Postman / Bruno", links: [
        { label: "Postman Learning Center", url: "https://learning.postman.com/" },
        { label: "Bruno docs", url: "https://docs.usebruno.com/" },
      ]},
      { name: "Auth & headers", links: [
        { label: "OAuth 2 simplified", url: "https://aaronparecki.com/oauth-2-simplified/" },
      ]},
      { name: "Status codes", links: [
        { label: "MDN HTTP status", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status" },
      ]},
    ],
  },
  {
    stage: "Automation Essentials",
    topics: [
      { name: "Selenium", links: [
        { label: "Selenium docs", url: "https://www.selenium.dev/documentation/" },
      ]},
      { name: "Playwright", links: [
        { label: "Playwright docs", url: "https://playwright.dev/docs/intro" },
        { label: "Playwright YouTube", url: "https://www.youtube.com/@Playwrightdev" },
      ]},
      { name: "Page Object Model", links: [
        { label: "POM guide", url: "https://martinfowler.com/bliki/PageObject.html" },
      ]},
      { name: "CI integration", links: [
        { label: "GitHub Actions", url: "https://docs.github.com/actions" },
      ]},
    ],
  },
  {
    stage: "Advanced QA",
    topics: [
      { name: "Performance (k6, JMeter)", links: [
        { label: "k6 docs", url: "https://k6.io/docs/" },
        { label: "JMeter user manual", url: "https://jmeter.apache.org/usermanual/index.html" },
      ]},
      { name: "Security basics", links: [
        { label: "OWASP Top 10", url: "https://owasp.org/www-project-top-ten/" },
      ]},
      { name: "Contract tests", links: [
        { label: "Pact intro", url: "https://docs.pact.io/" },
      ]},
      { name: "Observability", links: [
        { label: "OpenTelemetry", url: "https://opentelemetry.io/docs/" },
      ]},
    ],
  },
];

const interview = [
  { q: "Difference between verification and validation?", url: "https://www.guru99.com/verification-v-s-validation-in-a-software-testing.html" },
  { q: "Explain boundary value analysis.", url: "https://www.guru99.com/equivalence-partitioning-boundary-value-analysis.html" },
  { q: "What is risk-based testing?", url: "https://www.istqb.org/" },
  { q: "Smoke vs sanity testing?", url: "https://www.guru99.com/smoke-sanity-testing.html" },
  { q: "How do you prioritize bugs?", url: "https://www.atlassian.com/agile/project-management/prioritization" },
];

export default function Learning() {
  const { user } = useAuth();
  const [done, setDone] = useState<Set<string>>(new Set());
  const allTopics = roadmap.flatMap(r => r.topics.map(t => t.name));
  const pct = Math.round((done.size / allTopics.length) * 100);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("learning_progress").select("topic, completed").eq("user_id", user.id);
      setDone(new Set((data ?? []).filter((d: any) => d.completed).map((d: any) => d.topic)));
    })();
  }, [user]);

  const toggle = async (topic: string) => {
    if (!user) return;
    const next = new Set(done);
    const completing = !next.has(topic);
    if (completing) next.add(topic); else next.delete(topic);
    setDone(next);
    if (completing) {
      const { error } = await supabase.from("learning_progress")
        .upsert({ user_id: user.id, topic, completed: true }, { onConflict: "user_id,topic" });
      if (error) toast.error("Failed to save"); else toast.success(`Marked: ${topic}`);
    } else {
      await supabase.from("learning_progress").delete().eq("user_id", user.id).eq("topic", topic);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><GraduationCap className="h-7 w-7 text-primary" />Learning Hub</h1>
        <p className="text-muted-foreground">Grow your QA career — curated study links for every topic.</p>
      </div>

      <Card className="p-6 bg-gradient-hero text-primary-foreground border-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm opacity-90">Your progress</div>
            <div className="text-3xl font-bold">{pct}%</div>
          </div>
          <Trophy className="h-10 w-10 opacity-90" />
        </div>
        <Progress value={pct} className="bg-white/20" />
        <p className="text-xs opacity-90 mt-2">{done.size} of {allTopics.length} topics completed</p>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4"><Map className="h-5 w-5 text-primary" /><h2 className="font-semibold">QA Roadmap</h2></div>
        <div className="grid md:grid-cols-2 gap-3">
          {roadmap.map((r, i) => (
            <Card key={r.stage} className="p-4 bg-gradient-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-full bg-gradient-hero text-primary-foreground grid place-items-center text-xs font-bold">{i + 1}</div>
                <h3 className="font-semibold">{r.stage}</h3>
              </div>
              <div className="space-y-3">
                {r.topics.map(t => (
                  <div key={t.name} className="space-y-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={done.has(t.name)} onCheckedChange={() => toggle(t.name)} />
                      <span className={done.has(t.name) ? "line-through text-muted-foreground" : "font-medium"}>{t.name}</span>
                    </label>
                    <div className="flex flex-wrap gap-2 ml-6">
                      {t.links.map(l => (
                        <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                           className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />{l.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3"><BookOpen className="h-5 w-5 text-primary" /><h2 className="font-semibold">Interview prep</h2></div>
          <ul className="space-y-2 text-sm">
            {interview.map(i => (
              <li key={i.q}>
                <a href={i.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary inline-flex items-start gap-1">
                  • {i.q} <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3"><Trophy className="h-5 w-5 text-primary" /><h2 className="font-semibold">Achievements</h2></div>
          <div className="flex flex-wrap gap-2">
            {done.size >= 1 && <Badge className="bg-success/10 text-success border-success/20">First step ✓</Badge>}
            {done.size >= 5 && <Badge className="bg-primary/10 text-primary border-primary/20">Getting serious</Badge>}
            {done.size >= 10 && <Badge className="bg-accent/10 text-accent border-accent/20">QA Pro</Badge>}
            {done.size === allTopics.length && <Badge className="bg-gradient-hero text-primary-foreground border-0">Roadmap Complete 🏆</Badge>}
            {done.size === 0 && <p className="text-sm text-muted-foreground">Complete topics to earn badges.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
