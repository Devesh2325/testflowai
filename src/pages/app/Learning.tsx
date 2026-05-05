import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, Trophy, Map } from "lucide-react";

const roadmap = [
  { stage: "Manual QA Foundations", topics: ["SDLC & STLC", "Test design techniques", "Bug lifecycle", "Test case writing"] },
  { stage: "API Testing", topics: ["REST basics", "Postman / Bruno", "Auth & headers", "Status codes"] },
  { stage: "Automation Essentials", topics: ["Selenium", "Playwright", "Page Object Model", "CI integration"] },
  { stage: "Advanced QA", topics: ["Performance (k6, JMeter)", "Security basics", "Contract tests", "Observability"] },
];
const interview = ["Difference between verification and validation?", "Explain boundary value analysis.", "What is risk-based testing?", "Smoke vs sanity testing?", "How do you prioritize bugs?"];

export default function Learning() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><GraduationCap className="h-7 w-7 text-primary" />Learning Hub</h1>
        <p className="text-muted-foreground">Grow your QA career — from manual to automation and beyond.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4"><Map className="h-5 w-5 text-primary" /><h2 className="font-semibold">QA Roadmap</h2></div>
        <div className="grid md:grid-cols-2 gap-3">
          {roadmap.map((r, i) => (
            <Card key={r.stage} className="p-4 bg-gradient-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-gradient-hero text-primary-foreground grid place-items-center text-xs font-bold">{i + 1}</div>
                <h3 className="font-semibold">{r.stage}</h3>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {r.topics.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
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
        <Card className="p-6 bg-gradient-hero text-primary-foreground border-0">
          <Trophy className="h-6 w-6 mb-2" />
          <h2 className="font-semibold mb-1">Certification tracking</h2>
          <p className="text-sm opacity-90">Track ISTQB, CSTE, and other certifications. Coming soon.</p>
        </Card>
      </div>
    </div>
  );
}
