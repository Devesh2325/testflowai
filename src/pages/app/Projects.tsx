import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FolderKanban, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Project = { id: string; name: string; description: string | null; created_at: string };

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim() || !user) return;
    const { error } = await supabase.from("projects").insert({ name, description, owner_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Project created");
    setName(""); setDescription(""); setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete project and all its data?")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Organize your testing work by product.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-hero border-0 hover:opacity-90 gap-2"><Plus className="h-4 w-4" />New project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
              <Button onClick={create} className="w-full bg-gradient-hero border-0">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card">
          <FolderKanban className="h-10 w-10 mx-auto text-primary mb-3" />
          <h3 className="font-semibold mb-1">No projects yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first project to start organizing test cases.</p>
          <Button onClick={() => setOpen(true)} className="bg-gradient-hero border-0">Create project</Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <Card key={p.id} className="p-5 hover:shadow-elegant transition-all bg-gradient-card group">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center">
                  <FolderKanban className="h-5 w-5 text-primary" />
                </div>
                <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <h3 className="font-semibold">{p.name}</h3>
              {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
