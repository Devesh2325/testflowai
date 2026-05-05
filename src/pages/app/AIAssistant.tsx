import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Plus, Wand2 } from "lucide-react";
import { toast } from "sonner";

type Generated = { title: string; preconditions?: string; steps: string; expected_result: string; priority: string; type: string };
type Project = { id: string; name: string };

export default function AIAssistant() {
  const { user } = useAuth();
  const [requirement, setRequirement] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Generated[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    supabase.from("projects").select("id,name").then(({ data }) => {
      setProjects(data ?? []);
      if (data?.[0]) setProjectId(data[0].id);
    });
  }, []);

  const generate = async () => {
    if (!requirement.trim()) return toast.error("Enter a requirement");
    setLoading(true); setResults([]);
    const { data, error } = await supabase.functions.invoke("generate-test-cases", { body: { requirement, count: 5 } });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data?.error) return toast.error(data.error);
    setResults(data?.test_cases ?? []);
    if (user) supabase.from("ai_history").insert({ user_id: user.id, prompt: requirement, response: JSON.stringify(data) });
  };

  const saveAll = async () => {
    if (!projectId || !user) return toast.error("Select a project");
    const rows = results.map(r => ({
      title: r.title, preconditions: r.preconditions, steps: r.steps, expected_result: r.expected_result,
      priority: r.priority as any, type: r.type as any,
      project_id: projectId, owner_id: user.id,
    }));
    const { error } = await supabase.from("test_cases").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} test cases saved`);
    setResults([]); setRequirement("");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          AI Assistant
        </h1>
        <p className="text-muted-foreground">Turn requirements into structured test cases instantly.</p>
      </div>

      <Card className="p-6 bg-gradient-card">
        <Label className="mb-2 block font-medium">Requirement or user story</Label>
        <Textarea
          rows={6}
          value={requirement}
          onChange={e => setRequirement(e.target.value)}
          placeholder="e.g. As a user, I want to reset my password via email link so I can regain access if I forget it..."
          className="bg-background"
        />
        <div className="flex items-center gap-3 mt-3">
          <Button onClick={generate} disabled={loading} className="bg-gradient-hero border-0 hover:opacity-90 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {loading ? "Generating..." : "Generate test cases"}
          </Button>
          <span className="text-xs text-muted-foreground">Powered by Lovable AI · Gemini</span>
        </div>
      </Card>

      {results.length > 0 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{results.length} generated test cases</h2>
            <div className="flex items-center gap-2">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={saveAll} className="gap-2 bg-gradient-hero border-0"><Plus className="h-4 w-4" />Save all</Button>
            </div>
          </div>
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="p-4 rounded-lg border bg-background">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{r.type}</Badge>
                  <Badge variant="outline" className="capitalize">{r.priority}</Badge>
                </div>
                <h3 className="font-semibold">{r.title}</h3>
                {r.preconditions && <p className="text-sm text-muted-foreground mt-2"><strong>Pre:</strong> {r.preconditions}</p>}
                <pre className="text-sm mt-2 whitespace-pre-wrap font-sans"><strong>Steps:</strong>{"\n"}{r.steps}</pre>
                <p className="text-sm mt-2"><strong>Expected:</strong> {r.expected_result}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
