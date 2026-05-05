import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Share2, Trash2, Save, Users } from "lucide-react";
import { toast } from "sonner";

type Doc = { id: string; title: string; type: string; content: string | null; project_id: string; owner_id: string };
type Project = { id: string; name: string };
type Share = { id: string; document_id: string; shared_with_email: string; permission: string };

const DOC_TYPES = [
  { id: "plan", label: "Test Plan" },
  { id: "strategy", label: "Test Strategy" },
  { id: "rtm", label: "Requirement Traceability" },
  { id: "report", label: "Status Report" },
];

export default function Docs() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePerm, setSharePerm] = useState<"view" | "edit">("view");
  const [tab, setTab] = useState("plan");
  const [form, setForm] = useState({ title: "", type: "plan", content: "", project_id: "" });

  const load = async () => {
    const [d, p, s] = await Promise.all([
      supabase.from("documents").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
      supabase.from("document_shares").select("id,document_id,shared_with_email,permission"),
    ]);
    setDocs(d.data ?? []); setProjects(p.data ?? []); setShares(s.data ?? []);
    if (p.data?.[0] && !form.project_id) setForm(f => ({ ...f, project_id: p.data![0].id }));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.project_id || !user) return toast.error("Title and project required");
    const { error } = await supabase.from("documents").insert({
      ...form, owner_id: user.id, type: form.type,
    });
    if (error) return toast.error(error.message);
    toast.success("Document created"); setOpen(false);
    setForm(f => ({ ...f, title: "", content: "" })); load();
  };

  const updateDoc = async () => {
    if (!activeDoc) return;
    const { error } = await supabase.from("documents")
      .update({ title: activeDoc.title, content: activeDoc.content })
      .eq("id", activeDoc.id);
    if (error) return toast.error(error.message);
    toast.success("Saved"); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeDoc?.id === id) setActiveDoc(null);
    load();
  };

  const addShare = async () => {
    if (!activeDoc || !user || !shareEmail) return toast.error("Email required");
    const { error } = await supabase.from("document_shares").insert({
      document_id: activeDoc.id, shared_with_email: shareEmail.trim().toLowerCase(),
      permission: sharePerm, owner_id: user.id,
    });
    if (error) return toast.error(error.message);
    toast.success(`Shared with ${shareEmail}`); setShareEmail(""); load();
  };

  const removeShare = async (id: string) => {
    await supabase.from("document_shares").delete().eq("id", id);
    load();
  };

  const docsByType = (t: string) => docs.filter(d => d.type === t);
  const docShares = activeDoc ? shares.filter(s => s.document_id === activeDoc.id) : [];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><BookOpen className="h-7 w-7 text-primary" />Documents</h1>
          <p className="text-muted-foreground">Test plans, strategies, traceability — share with your team.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-hero border-0 hover:opacity-90 gap-2" disabled={!projects.length}><Plus className="h-4 w-4" />New document</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New document</DialogTitle><DialogDescription>Pick a type — each tab uses the right template.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div><Label>Project</Label>
                <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Content</Label><Textarea rows={6} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Markdown supported…" /></div>
              <Button onClick={create} className="w-full bg-gradient-hero border-0">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {DOC_TYPES.map(t => (
            <TabsTrigger key={t.id} value={t.id}>{t.label} <Badge variant="secondary" className="ml-2">{docsByType(t.id).length}</Badge></TabsTrigger>
          ))}
        </TabsList>
        {DOC_TYPES.map(t => (
          <TabsContent key={t.id} value={t.id} className="grid md:grid-cols-[280px_1fr] gap-4 pt-4">
            <Card className="p-3 space-y-1">
              {docsByType(t.id).length === 0 && <p className="text-sm text-muted-foreground p-3">No {t.label.toLowerCase()} yet.</p>}
              {docsByType(t.id).map(d => (
                <button key={d.id} onClick={() => setActiveDoc(d)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition ${activeDoc?.id === d.id ? "bg-muted" : ""}`}>
                  <div className="font-medium truncate">{d.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.owner_id === user?.id ? "Owned by you" : "Shared with you"}
                  </div>
                </button>
              ))}
            </Card>
            <Card className="p-4 min-h-[400px]">
              {!activeDoc || activeDoc.type !== t.id ? (
                <p className="text-sm text-muted-foreground">Select a document to edit.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input value={activeDoc.title} onChange={e => setActiveDoc({ ...activeDoc, title: e.target.value })} className="text-lg font-semibold" />
                    <Button onClick={updateDoc} variant="outline" className="gap-1"><Save className="h-4 w-4" />Save</Button>
                    {activeDoc.owner_id === user?.id && <>
                      <Button onClick={() => setShareOpen(true)} variant="outline" className="gap-1"><Share2 className="h-4 w-4" />Share</Button>
                      <Button onClick={() => remove(activeDoc.id)} variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>}
                  </div>
                  {docShares.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />Shared with:
                      {docShares.map(s => <Badge key={s.id} variant="outline" className="gap-1">{s.shared_with_email} · {s.permission}</Badge>)}
                    </div>
                  )}
                  <Textarea rows={18} value={activeDoc.content ?? ""} onChange={e => setActiveDoc({ ...activeDoc, content: e.target.value })} placeholder="Markdown supported…" />
                </div>
              )}
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Share document</DialogTitle><DialogDescription>Invite teammates by email.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="teammate@email.com" value={shareEmail} onChange={e => setShareEmail(e.target.value)} />
              <Select value={sharePerm} onValueChange={v => setSharePerm(v as any)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addShare}>Add</Button>
            </div>
            <div className="space-y-2">
              {docShares.map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                  <div><span className="font-medium">{s.shared_with_email}</span> <Badge variant="outline" className="ml-2">{s.permission}</Badge></div>
                  <Button size="icon" variant="ghost" onClick={() => removeShare(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {docShares.length === 0 && <p className="text-xs text-muted-foreground">Not shared yet.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
