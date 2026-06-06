import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, Zap, Bug, BarChart3, GraduationCap, Bot, ShieldCheck,
  ArrowRight, TestTube2, CheckCircle2, Workflow, Send
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
  const [c, setC] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const sendEnquiry = async () => {
    if (!c.name || !c.email || !c.subject || !c.message) return toast.error("Please fill all fields");
    setSending(true);
    const { error } = await supabase.from("enquiries").insert(c);
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks — we'll get back to you soon");
    setC({ name: "", email: "", subject: "", message: "" });
  };
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav id="nav-main" className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link id="nav-logo" to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-hero grid place-items-center shadow-md">
              <TestTube2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">TestFlow AI</span>
          </Link>
          <div id="nav-links" className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a id="nav-link-features" href="#features" className="hover:text-foreground">Features</a>
            <a id="nav-link-ai" href="#ai" className="hover:text-foreground">AI</a>
            <a id="nav-link-learning" href="#learning" className="hover:text-foreground">Learning</a>
            <a id="nav-link-contact" href="#contact" className="hover:text-foreground">Contact</a>
          </div>
          <div id="nav-actions" className="flex items-center gap-2">
            <Button id="btn-sign-in" variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
            <Button id="btn-get-started" asChild className="bg-gradient-hero hover:opacity-90 border-0"><Link to="/auth">Get started</Link></Button>
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

      {/* Interactive Demo */}
      <section id="demo" className="container py-20">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold">See it <span className="text-gradient">in action</span></h2>
          <p className="text-muted-foreground mt-3">Take an interactive tour of TestFlow AI.</p>
        </div>
        <div className="max-w-5xl mx-auto" style={{ position: "relative", paddingBottom: "calc(54.75% + 25px)", width: "100%", height: 0 }}>
          <iframe
            loading="lazy"
            src="https://pagepilot-demo-viewer-prod.web.app//?tid=6a23e38710adcf3cf33aa974&did=6a23eaa910adcf3cf33ab6cf&type=demo&status=live"
            allow="fullscreen"
            title="TestFlow AI interactive demo"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "1px solid rgba(63,95,172,0.35)",
              boxShadow: "0px 0px 18px rgba(26, 19, 72, 0.15)",
              borderRadius: "10px",
              boxSizing: "border-box",
            }}
          />
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

      {/* Contact / Enquiry */}
      <section id="contact" className="container py-20">
        <div className="max-w-2xl mx-auto text-center mb-8">
          <h2 className="text-4xl font-bold">Get in <span className="text-gradient">touch</span></h2>
          <p className="text-muted-foreground mt-3">Questions, demos or feedback — drop us a note.</p>
        </div>
        <Card className="max-w-2xl mx-auto p-6 md:p-8 shadow-elegant">
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={c.name} onChange={e => setC({ ...c, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={c.email} onChange={e => setC({ ...c, email: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Subject</Label><Input value={c.subject} onChange={e => setC({ ...c, subject: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Message</Label><Textarea rows={4} value={c.message} onChange={e => setC({ ...c, message: e.target.value })} /></div>
          </div>
          <Button onClick={sendEnquiry} disabled={sending} className="mt-4 bg-gradient-hero border-0 gap-2"><Send className="h-4 w-4" />{sending ? "Sending…" : "Send enquiry"}</Button>
        </Card>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 TestFlow AI. Test smarter. Release faster.
      </footer>
    </div>
  );
}
