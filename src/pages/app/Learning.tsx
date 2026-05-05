import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, BookOpen, Trophy, Map } from "lucide-react";
import { toast } from "sonner";

const roadmap = [
  { stage: "Manual QA Foundations", topics: ["SDLC & STLC", "Test design techniques", "Bug lifecycle", "Test case writing"] },
  { stage: "API Testing", topics: ["REST basics", "Postman / Bruno", "Auth & headers", "Status codes"] },
  { stage: "Automation Essentials", topics: ["Selenium", "Playwright", "Page Object Model", "CI integration"] },
  { stage: "Advanced QA", topics: ["Performance (k6, JMeter)", "Security basics", "Contract tests", "Observability"] },
];
const interview = [
  "Difference between verification and validation?",
  "Explain boundary value analysis.",
  "What is risk-based testing?",
  "Smoke vs sanity testing?",
  "How do you prioritize bugs?",
];

export default function Learning() {
  const { user } = useAuth();
  const [done, setDone] = useState<Set<string>>(new Set());
  const allTopics = roadmap.flatMap(r => r.topics);
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
        <p className="text-muted-foreground">Grow your QA career — from manual to automation and beyond.</p>
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
              <div className="space-y-2">
                {r.topics.map(t => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground transition-colors">
                    <Checkbox checked={done.has(t)} onCheckedChange={() => toggle(t)} />
                    <span className={done.has(t) ? "line-through text-muted-foreground" : ""}>{t}</span>
                  </label>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3"><BookOpen className="h-5 w-5 text-primary" /><h2 className="font-semibold">Interview prep</h2></div>
          <ul className="space-y-2 text-sm">{interview.map(q => <li key={q} className="text-muted-foreground">• {q}</li>)}</ul>
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
