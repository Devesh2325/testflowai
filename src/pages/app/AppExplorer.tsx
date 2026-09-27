import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Globe, FolderTree, ChevronRight, Layers, FileCode, CheckCircle2, ArrowRight } from "lucide-react";
import { agentMemory, ApplicationMap } from "@/services/agent";
import { Link } from "react-router-dom";

type Project = { id: string; name: string };

export default function AppExplorer() {
  const { current: ws } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [appMap, setAppMap] = useState<ApplicationMap | null>(null);

  useEffect(() => {
    supabase.from("projects").select("id,name").then(({ data }) => {
      setProjects(data ?? []);
      if (data?.[0]) {
        setSelectedProjectId(data[0].id);
        const mem = agentMemory.getProjectMemory(data[0].id);
        if (mem.applicationMap) setAppMap(mem.applicationMap);
      }
    });
  }, []);

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    const mem = agentMemory.getProjectMemory(projId);
    setAppMap(mem.applicationMap || null);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Network className="h-7 w-7 text-primary" />
            Application Explorer
          </h1>
          <p className="text-muted-foreground">
            Structural view of pages, forms, interactive elements, and critical user flows discovered by AI agents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedProjectId} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button asChild className="gap-2 bg-gradient-hero border-0">
            <Link to="/app/missions">Launch Explorer Mission</Link>
          </Button>
        </div>
      </div>

      {!appMap ? (
        <Card className="p-12 text-center space-y-3 bg-gradient-card">
          <FolderTree className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold">No Application Map Discovered Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Run an AI QA Mission or an Auto Test on your web application to map its routes, forms, and interactive controls automatically.
          </p>
          <Button asChild variant="outline">
            <Link to="/app/missions">Start Discovery in AI QA Mission</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-card">
              <span className="text-xs text-muted-foreground">Target Domain</span>
              <div className="text-sm font-mono font-semibold truncate mt-1">{appMap.baseUrl}</div>
            </Card>
            <Card className="p-4 bg-gradient-card">
              <span className="text-xs text-muted-foreground">Discovered Pages</span>
              <div className="text-2xl font-bold mt-1">{appMap.pages.length}</div>
            </Card>
            <Card className="p-4 bg-gradient-card">
              <span className="text-xs text-muted-foreground">Mapped Controls</span>
              <div className="text-2xl font-bold mt-1">
                {appMap.pages.reduce((acc, p) => acc + p.elements.length, 0)}
              </div>
            </Card>
            <Card className="p-4 bg-gradient-card">
              <span className="text-xs text-muted-foreground">Core Workflows</span>
              <div className="text-2xl font-bold mt-1">{appMap.workflows.length}</div>
            </Card>
          </div>

          {/* Tree hierarchy */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="p-6 lg:col-span-2 space-y-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Discovered Pages & Components
              </h3>
              <div className="space-y-4">
                {appMap.pages.map((p, idx) => (
                  <div key={idx} className="border rounded-lg p-4 space-y-3 bg-background/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">{p.title}</span>
                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.path}</code>
                      </div>
                      <Badge variant="outline" className="text-xs">{p.elements.length} Elements</Badge>
                    </div>

                    {/* Forms */}
                    {p.forms.length > 0 && (
                      <div className="space-y-1.5 pl-4 border-l-2 border-primary/40">
                        <span className="text-xs font-semibold text-muted-foreground">Forms:</span>
                        {p.forms.map((f) => (
                          <div key={f.id} className="text-xs flex items-center gap-2 text-foreground font-mono">
                            <span className="text-primary font-bold">[{f.method}]</span>
                            <span>{f.inputs.length} inputs</span>
                            {f.submitButton && <Badge variant="secondary" className="text-[10px]">{f.submitButton.label}</Badge>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Elements Chips */}
                    {p.elements.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {p.elements.slice(0, 12).map((el) => (
                          <span key={el.id} className="px-2 py-0.5 rounded text-[11px] font-mono border bg-muted/30">
                            {el.tag}{el.label ? `: "${el.label}"` : ""}
                          </span>
                        ))}
                        {p.elements.length > 12 && (
                          <span className="px-2 py-0.5 text-[11px] text-muted-foreground">
                            +{p.elements.length - 12} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Workflows */}
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <FileCode className="h-4 w-4 text-primary" />
                Identified User Flows
              </h3>
              <div className="space-y-3">
                {appMap.workflows.map((wf) => (
                  <div key={wf.id} className="p-3 rounded-lg border bg-background/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs">{wf.name}</span>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">{wf.criticality}</Badge>
                    </div>
                    <div className="space-y-1">
                      {wf.steps.map((st, i) => (
                        <div key={i} className="text-xs flex items-center gap-2 text-muted-foreground">
                          <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                          <span>{st}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
