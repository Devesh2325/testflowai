import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sparkles, Zap, Bug, BarChart3, GraduationCap, Bot, ShieldCheck,
  ArrowRight, TestTube2, CheckCircle2, Workflow
} from "lucide-react";

const features = [
  { icon: Bot, title: "AI Test Generation", desc: "Convert requirements into test cases, edge cases, and full coverage in seconds." },
  { icon: Bug, title: "Smart Bug Tracking", desc: "Kanban + AI duplicate detection, auto-severity, root-cause hints." },
  { icon: Workflow, title: "Manual + Automation", desc: "Selenium, Playwright & CI/CD results in one unified dashboard." },
  { icon: BarChart3, title: "Release Readiness", desc: "AI-driven risk scores, coverage % and high-risk modules at a glance." },
  { icon: GraduationCap, title: "Learning Hub", desc: "QA roadmaps, interview prep, and real bug case studies. Unique to TestFlow." },
  { icon: ShieldCheck, title: "Enterprise Ready", desc: "RBAC, audit logs, multi-tenant isolation. Built for scale." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-hero grid place-items-center shadow-md">
              <TestTube2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">TestFlow AI</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#ai" className="hover:text-foreground">AI</a>
            <a href="#learning" className="hover:text-foreground">Learning</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
            <Button asChild className="bg-gradient-hero hover:opacity-90 border-0"><Link to="/auth">Get started</Link></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-subtle" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-hero opacity-20 blur-3xl" />
        <div className="container relative pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm mb-6">
            <Sparkles className="h-3 w-3 text-primary" />
            AI-first test management for modern QA teams
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.05]">
            Test smarter. <span className="text-gradient">Release faster.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            The intuitive test management platform that combines manual testing, automation, and AI — so your team ships with confidence.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button size="lg" asChild className="bg-gradient-hero hover:opacity-90 border-0 shadow-glow gap-2 h-12 px-6">
              <Link to="/auth">Start free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-6">View live demo</Button>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            {["50% less testing time", "AI bug detection", "Manual + Automation"].map(t => (
              <div key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />{t}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-24">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold">Everything QA needs. <span className="text-gradient">In one place.</span></h2>
          <p className="text-muted-foreground mt-3">Inspired by Notion + Linear. Built for testers.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(f => (
            <Card key={f.title} className="p-6 hover:shadow-elegant transition-shadow border-border/60 bg-gradient-card">
              <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* AI block */}
      <section id="ai" className="container py-20">
        <Card className="relative overflow-hidden p-12 md:p-16 border-0 bg-gradient-hero text-primary-foreground">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%)]" />
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs mb-5">
              <Zap className="h-3 w-3" /> AI Assistant
            </div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">From requirement to test plan in under 60 seconds.</h2>
            <p className="mt-4 text-lg opacity-90">Paste your requirement. Get prioritized test cases, edge cases, and risk-based suggestions — instantly.</p>
            <Button size="lg" variant="secondary" asChild className="mt-8"><Link to="/auth">Try the AI Assistant</Link></Button>
          </div>
        </Card>
      </section>

      {/* CTA */}
      <section id="learning" className="container py-24 text-center">
        <h2 className="text-4xl font-bold mb-4">Ready to <span className="text-gradient">level up your QA?</span></h2>
        <p className="text-muted-foreground mb-8">Join teams shipping faster with TestFlow AI.</p>
        <Button size="lg" asChild className="bg-gradient-hero border-0 shadow-glow"><Link to="/auth">Get started — it's free</Link></Button>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 TestFlow AI. Test smarter. Release faster.
      </footer>
    </div>
  );
}
