import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Terminal, Globe, Monitor, Image as ImageIcon, Code2, AlertTriangle, Clock } from "lucide-react";

export interface EvidenceData {
  title: string;
  url?: string;
  browser?: string;
  device?: string;
  durationMs?: number;
  screenshotUrl?: string;
  domSnapshot?: string;
  consoleErrors?: string[];
  networkFailures?: { url: string; status: number; method: string; statusText?: string }[];
  timeline?: { action: string; timestamp: string }[];
  bugId?: string;
  testCaseId?: string;
}

interface EvidenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidence: EvidenceData | null;
}

export function EvidenceModal({ open, onOpenChange, evidence }: EvidenceModalProps) {
  if (!evidence) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Evidence Center: {evidence.title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {evidence.browser && <Badge variant="outline" className="text-[10px]">{evidence.browser}</Badge>}
              {evidence.device && <Badge variant="secondary" className="text-[10px] uppercase">{evidence.device}</Badge>}
            </div>
          </div>
          <DialogDescription className="text-xs">
            Linked to Test Case: {evidence.testCaseId || "N/A"} · Bug: {evidence.bugId || "N/A"} · Target: {evidence.url || "N/A"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pt-3">
          <Tabs defaultValue="console" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="console" className="text-xs gap-1.5">
                <Terminal className="h-3.5 w-3.5" />
                Console Logs
                {evidence.consoleErrors?.length ? <Badge variant="destructive" className="h-4 px-1 text-[9px] ml-1">{evidence.consoleErrors.length}</Badge> : null}
              </TabsTrigger>
              <TabsTrigger value="network" className="text-xs gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Network
                {evidence.networkFailures?.length ? <Badge variant="destructive" className="h-4 px-1 text-[9px] ml-1">{evidence.networkFailures.length}</Badge> : null}
              </TabsTrigger>
              <TabsTrigger value="dom" className="text-xs gap-1.5">
                <Code2 className="h-3.5 w-3.5" />
                DOM Snapshot
              </TabsTrigger>
              <TabsTrigger value="screenshot" className="text-xs gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Visual
              </TabsTrigger>
            </TabsList>

            {/* CONSOLE LOGS */}
            <TabsContent value="console" className="mt-4 space-y-2">
              {!evidence.consoleErrors?.length ? (
                <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg">
                  No console errors recorded during this execution.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {evidence.consoleErrors.map((err, i) => (
                    <div key={i} className="p-2.5 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs font-mono break-all flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* NETWORK FAILURES */}
            <TabsContent value="network" className="mt-4 space-y-2">
              {!evidence.networkFailures?.length ? (
                <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg">
                  All recorded network requests completed with HTTP 2xx/3xx.
                </div>
              ) : (
                <div className="space-y-2">
                  {evidence.networkFailures.map((req, i) => (
                    <div key={i} className="p-2.5 rounded border border-destructive/30 bg-destructive/5 text-xs font-mono flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-destructive">[{req.method}]</span>
                        <span className="truncate">{req.url}</span>
                      </div>
                      <Badge variant="destructive" className="text-[10px]">HTTP {req.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* DOM SNAPSHOT */}
            <TabsContent value="dom" className="mt-4">
              {!evidence.domSnapshot ? (
                <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg">
                  DOM snapshot was not captured or was summarized during step execution.
                </div>
              ) : (
                <pre className="p-3 bg-muted/40 rounded-lg text-xs font-mono max-h-72 overflow-auto select-all">
                  {evidence.domSnapshot}
                </pre>
              )}
            </TabsContent>

            {/* VISUAL / SCREENSHOT */}
            <TabsContent value="screenshot" className="mt-4">
              {!evidence.screenshotUrl ? (
                <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg">
                  Raster screenshot requires an active Playwright/CDP browser runner attached.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden bg-black/40">
                  <img src={evidence.screenshotUrl} alt="Execution screenshot" className="w-full h-auto max-h-96 object-contain" />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
