import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  Monitor,
  Terminal,
  Play,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Layers,
  ShieldAlert,
  ArrowRight,
  Code2,
  Clock,
  Database,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export default function QARecorderView() {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(label);
    toast.success(`Copied: ${text}`);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-hero text-primary-foreground shadow">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">QA Recorder</h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                  Desktop App (Milestone 1 Ready)
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Embedded browser scenario recorder ➔ Playwright test generator ➔ 6-hour automated regression scheduler.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Launch Button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => copyToClipboard("npm run qa:dev", "launch")}
            className="bg-gradient-hero border-0 gap-2 shadow"
          >
            <Terminal className="h-4 w-4" />
            {copiedCmd === "launch" ? "Copied Launch Command!" : "Copy Launch Command"}
          </Button>
        </div>
      </div>

      {/* Main Hero Card: How to Open & Run */}
      <Card className="p-6 bg-gradient-card border-border/80 shadow-elegant">
        <div className="grid md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Monitor className="h-4 w-4" />
              <span>Native Desktop Application Shell (Electron + Vite + Playwright)</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Why QA Recorder runs as a dedicated Desktop App
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Standard web browsers restrict embedding arbitrary external websites due to strict <b>X-Frame-Options</b> and <b>CORS security policies</b>. QA Recorder is built with <b>Electron's native <code className="text-primary font-mono text-xs">WebContentsView</code></b> so you can freely record any live website, capture cross-origin events, mask passwords, and store persistent SQLite test runs without browser sandbox limitations.
            </p>

            {/* Launch Instructions */}
            <div className="p-4 rounded-lg bg-background/80 border border-border space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Run this command in your terminal to open QA Recorder:</span>
                <span className="text-[11px] text-muted-foreground">Terminal / Command Prompt</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-950 p-2.5 rounded font-mono text-xs text-primary font-semibold border border-zinc-800 select-all">
                  npm run qa:dev
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard("npm run qa:dev", "terminal")}
                  className="gap-1.5 shrink-0"
                >
                  {copiedCmd === "terminal" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCmd === "terminal" ? "Copied" : "Copy"}</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Alternatively: <code>cd qa-recorder && npm run dev</code>
              </p>
            </div>
          </div>

          {/* Quick Stats / Highlights */}
          <div className="md:col-span-4 bg-muted/20 border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Milestone 1 Capabilities
            </h3>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>Embedded Browser:</b> Live navigation with real URL bar</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>In-Page Recorder:</b> Clicks, typing, selects, checkboxes, Enter/Tab/Esc</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>Prioritized Selectors:</b> testId ➔ role ➔ label ➔ placeholder ➔ text ➔ CSS</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>2-3 Fallbacks:</b> Selector drift protection</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>Right-Click Menu:</b> Assert visible, text, URL, count</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>Known Baseline Noise:</b> Tracks pre-existing 4xx/5xx & console errors</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>Local SQLite:</b> Auto-saved to <code>qa_recorder.sqlite</code></span>
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* 4 Milestones Roadmap */}
      <div>
        <h3 className="text-base font-semibold mb-3">QA Recorder Delivery Roadmap</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-4 bg-emerald-950/20 border-emerald-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">Milestone 1</span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px]">Complete</Badge>
            </div>
            <h4 className="font-semibold text-sm">Embedded Browser & Recorder</h4>
            <p className="text-xs text-muted-foreground">
              WebContentsView shell, in-page event interception, prioritized selector generation, right-click assertions, and step editing.
            </p>
          </Card>

          <Card className="p-4 bg-card border-border space-y-2 opacity-90">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary">Milestone 2</span>
              <Badge variant="outline" className="text-[10px]">Next</Badge>
            </div>
            <h4 className="font-semibold text-sm">Playwright Spec Generation & Replay</h4>
            <p className="text-xs text-muted-foreground">
              Generates clean <code>.spec.ts</code> files, storageState auth reuse, and manual replay via separate Node child process runner.
            </p>
          </Card>

          <Card className="p-4 bg-card border-border space-y-2 opacity-70">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Milestone 3</span>
              <Badge variant="outline" className="text-[10px]">Pending</Badge>
            </div>
            <h4 className="font-semibold text-sm">Run Artifacts & Dashboard</h4>
            <p className="text-xs text-muted-foreground">
              Step-by-step timeline, screenshots, DOM snapshots, trace viewer link, and historical pass rate analytics.
            </p>
          </Card>

          <Card className="p-4 bg-card border-border space-y-2 opacity-70">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Milestone 4</span>
              <Badge variant="outline" className="text-[10px]">Pending</Badge>
            </div>
            <h4 className="font-semibold text-sm">Scheduler & CI Export</h4>
            <p className="text-xs text-muted-foreground">
              6-hour background node-cron execution, system tray daemon, desktop failure alerts, and GitHub Actions CI workflow export.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
