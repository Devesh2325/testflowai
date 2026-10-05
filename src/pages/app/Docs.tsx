import { useEffect, useState, useMemo } from "react";
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
import {
  BookOpen, Plus, Share2, Trash2, Save, Users, FileText, Sparkles, Copy,
  Check, Eye, Edit3, Download, Search, CheckCircle2, Bookmark, ShieldCheck,
  Code2, ExternalLink, Printer
} from "lucide-react";
import { toast } from "sonner";
import { QA_TEMPLATES, QATemplate } from "@/data/qaTemplates";
import { QA_STANDARDS, QAStandardSection } from "@/data/qaStandards";

type Doc = { id: string; title: string; type: string; content: string | null; project_id: string; owner_id: string; created_at?: string; updated_at?: string };
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
  const [mainTab, setMainTab] = useState<"my-docs" | "qa-standards" | "templates">("my-docs");
  const [subDocType, setSubDocType] = useState("plan");
  const [previewMode, setPreviewMode] = useState<"edit" | "preview" | "split">("split");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [standardsSearch, setStandardsSearch] = useState("");
  const [selectedStandard, setSelectedStandard] = useState<QAStandardSection>(QA_STANDARDS[0]);

  // Document creation form
  const [form, setForm] = useState({ title: "", type: "plan", content: "", project_id: "" });

  const load = async () => {
    const [d, p, s] = await Promise.all([
      supabase.from("documents").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
      supabase.from("document_shares").select("id,document_id,shared_with_email,permission"),
    ]);
    setDocs((d.data ?? []) as any);
    setProjects(p.data ?? []);
    setShares(s.data ?? []);
    if (p.data?.[0] && !form.project_id) setForm(f => ({ ...f, project_id: p.data![0].id }));
    if (d.data?.[0] && !activeDoc) setActiveDoc(d.data[0] as any);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.project_id || !user) return toast.error("Title and project required");
    const { data, error } = await supabase.from("documents").insert({
      ...form, owner_id: user.id, type: form.type,
    }).select().single();
    if (error) return toast.error(error.message);
    toast.success("Document created successfully");
    setOpen(false);
    setForm(f => ({ ...f, title: "", content: "" }));
    load();
    if (data) setActiveDoc(data as any);
  };

  const updateDoc = async () => {
    if (!activeDoc) return;
    const { error } = await supabase.from("documents")
      .update({ title: activeDoc.title, content: activeDoc.content })
      .eq("id", activeDoc.id);
    if (error) return toast.error(error.message);
    toast.success("Document saved");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Document deleted");
    if (activeDoc?.id === id) setActiveDoc(null);
    load();
  };

  const addShare = async () => {
    if (!activeDoc || !user || !shareEmail) return toast.error("Email required");
    const { error } = await supabase.from("document_shares").insert({
      document_id: activeDoc.id,
      shared_with_email: shareEmail.trim().toLowerCase(),
      permission: sharePerm,
      owner_id: user.id,
      workspace_id: (activeDoc as any).workspace_id,
    });
    if (error) return toast.error(error.message);
    toast.success(`Shared with ${shareEmail}`);
    setShareEmail("");
    load();
  };

  const removeShare = async (id: string) => {
    await supabase.from("document_shares").delete().eq("id", id);
    toast.success("Share removed");
    load();
  };

  const loadTemplateIntoForm = (template: QATemplate) => {
    setForm({
      title: template.title,
      type: template.type,
      content: template.content,
      project_id: projects[0]?.id || "",
    });
    setOpen(true);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const exportMarkdown = () => {
    if (!activeDoc) return;
    const blob = new Blob([activeDoc.content || ""], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeDoc.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Markdown file downloaded");
  };

  const docsByType = (t: string) => docs.filter(d => d.type === t);
  const docShares = activeDoc ? shares.filter(s => s.document_id === activeDoc.id) : [];

  const filteredStandards = useMemo(() => {
    if (!standardsSearch.trim()) return QA_STANDARDS;
    const q = standardsSearch.toLowerCase();
    return QA_STANDARDS.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q)
    );
  }, [standardsSearch]);

  return (
    <div className="space-y-6 max-w-7xl pb-16">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-hero text-primary-foreground shadow">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">QA Documentation & Standards Hub</h1>
              <p className="text-muted-foreground text-sm">
                IEEE 829 test plans, ISTQB test strategy guides, manual testing standards & traceability matrix.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-hero border-0 hover:opacity-90 gap-2 shadow" disabled={!projects.length}>
                <Plus className="h-4 w-4" />
                New Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create QA Document</DialogTitle>
                <DialogDescription>
                  Start from scratch or pick a market-standard template.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Project</Label>
                    <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Document Type</Label>
                    <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOC_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Document Title</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g. Sprint 24 Regression Test Plan"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Content (Markdown Supported)</Label>
                    <span className="text-[11px] text-muted-foreground">Headers, tables, checklists supported</span>
                  </div>
                  <Textarea
                    rows={10}
                    className="font-mono text-xs"
                    value={form.content}
                    onChange={e => setForm({ ...form, content: e.target.value })}
                    placeholder="# Test Plan Overview&#10;&#10;## 1. Scope&#10;- Feature A&#10;- Feature B"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex gap-1.5 overflow-x-auto py-1">
                    {QA_TEMPLATES.slice(0, 3).map(tpl => (
                      <Button
                        key={tpl.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7 gap-1"
                        onClick={() => setForm(f => ({ ...f, content: tpl.content, title: f.title || tpl.title, type: tpl.type }))}
                      >
                        <Sparkles className="h-3 w-3 text-primary" />
                        Insert {tpl.title.split(" ")[0]}
                      </Button>
                    ))}
                  </div>
                  <Button onClick={create} className="bg-gradient-hero border-0">Create Document</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Mode Tabs */}
      <Tabs value={mainTab} onValueChange={(v: any) => setMainTab(v)} className="space-y-4">
        <TabsList className="bg-muted/50 p-1 border">
          <TabsTrigger value="my-docs" className="gap-2">
            <FileText className="h-4 w-4" />
            <span>My Project Documents</span>
            <Badge variant="secondary" className="ml-1 text-xs">{docs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="qa-standards" className="gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>QA Standards & Knowledge Base</span>
            <Badge className="ml-1 bg-primary/20 text-primary border-0 text-[10px]">ISTQB Guide</Badge>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Sparkles className="h-4 w-4 text-warning" />
            <span>Industry QA Templates</span>
            <Badge variant="secondary" className="ml-1 text-xs">{QA_TEMPLATES.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------------- */}
        {/* TAB 1: MY PROJECT DOCUMENTS */}
        {/* ------------------------------------------------------------------------- */}
        <TabsContent value="my-docs" className="space-y-4">
          <Tabs value={subDocType} onValueChange={setSubDocType}>
            <div className="flex items-center justify-between border-b pb-2">
              <TabsList className="bg-transparent p-0 gap-2">
                {DOC_TYPES.map(t => (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className="data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-md px-3 py-1.5 text-xs font-medium"
                  >
                    {t.label}
                    <Badge variant="secondary" className="ml-2 text-[10px]">{docsByType(t.id).length}</Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {DOC_TYPES.map(t => (
              <TabsContent key={t.id} value={t.id} className="grid md:grid-cols-[300px_1fr] gap-4 pt-2">
                {/* Document List Sidebar */}
                <Card className="p-3 space-y-2 h-[calc(100vh-320px)] flex flex-col bg-card/60">
                  <div className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider">
                    {t.label}s ({docsByType(t.id).length})
                  </div>
                  <div className="overflow-y-auto flex-1 space-y-1 pr-1">
                    {docsByType(t.id).length === 0 && (
                      <div className="p-4 text-center text-xs text-muted-foreground space-y-2">
                        <p>No {t.label.toLowerCase()} created yet.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => {
                            const matchingTpl = QA_TEMPLATES.find(tpl => tpl.type === t.id) || QA_TEMPLATES[0];
                            loadTemplateIntoForm(matchingTpl);
                          }}
                        >
                          <Sparkles className="h-3 w-3 text-primary" />
                          Use {t.label} Template
                        </Button>
                      </div>
                    )}
                    {docsByType(t.id).map(d => (
                      <button
                        key={d.id}
                        onClick={() => setActiveDoc(d)}
                        className={`w-full text-left p-2.5 rounded-lg text-sm transition-all border ${
                          activeDoc?.id === d.id
                            ? "bg-primary/10 border-primary/30 text-foreground shadow-xs"
                            : "border-transparent hover:bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        <div className="font-medium truncate text-xs">{d.title}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center justify-between mt-1">
                          <span>{d.owner_id === user?.id ? "Owned by you" : "Shared"}</span>
                          {d.created_at && <span>{new Date(d.created_at).toLocaleDateString()}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Document Editor & Preview Pane */}
                <Card className="p-4 h-[calc(100vh-320px)] flex flex-col bg-card">
                  {!activeDoc || activeDoc.type !== t.id ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-3">
                      <FileText className="h-10 w-10 text-muted-foreground/40" />
                      <div>
                        <h3 className="font-semibold text-sm text-foreground">Select a document</h3>
                        <p className="text-xs">Choose a document from the left list or create a new one.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col space-y-3 min-h-0">
                      {/* Document Toolbar */}
                      <div className="flex items-center justify-between gap-3 border-b pb-3 flex-wrap">
                        <Input
                          value={activeDoc.title}
                          onChange={e => setActiveDoc({ ...activeDoc, title: e.target.value })}
                          className="text-base font-bold flex-1 h-9 max-w-md"
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* View Mode Toggle */}
                          <div className="flex items-center rounded-md border p-0.5 bg-muted/40">
                            <button
                              onClick={() => setPreviewMode("edit")}
                              className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${previewMode === "edit" ? "bg-background text-foreground shadow-xs font-medium" : "text-muted-foreground"}`}
                              title="Edit Markdown"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => setPreviewMode("split")}
                              className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${previewMode === "split" ? "bg-background text-foreground shadow-xs font-medium" : "text-muted-foreground"}`}
                              title="Split View"
                            >
                              <span>Split</span>
                            </button>
                            <button
                              onClick={() => setPreviewMode("preview")}
                              className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${previewMode === "preview" ? "bg-background text-foreground shadow-xs font-medium" : "text-muted-foreground"}`}
                              title="Rendered Preview"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Preview</span>
                            </button>
                          </div>

                          <Button onClick={updateDoc} size="sm" className="gap-1.5 bg-gradient-hero border-0 h-8">
                            <Save className="h-3.5 w-3.5" />
                            <span>Save</span>
                          </Button>
                          <Button onClick={exportMarkdown} variant="outline" size="sm" className="h-8 gap-1">
                            <Download className="h-3.5 w-3.5" />
                            <span>Export</span>
                          </Button>
                          {activeDoc.owner_id === user?.id && (
                            <>
                              <Button onClick={() => setShareOpen(true)} variant="outline" size="sm" className="h-8 gap-1">
                                <Share2 className="h-3.5 w-3.5" />
                                <span>Share</span>
                              </Button>
                              <Button onClick={() => remove(activeDoc.id)} variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Shares list badge */}
                      {docShares.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground py-0.5">
                          <Users className="h-3 w-3" />
                          <span>Collaborators:</span>
                          {docShares.map(s => (
                            <Badge key={s.id} variant="outline" className="gap-1 text-[11px]">
                              {s.shared_with_email} · {s.permission}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Editor / Preview Area */}
                      <div className="flex-1 min-h-0 grid gap-3" style={{
                        gridTemplateColumns: previewMode === "split" ? "1fr 1fr" : "1fr"
                      }}>
                        {/* Editor Box */}
                        {(previewMode === "edit" || previewMode === "split") && (
                          <div className="h-full flex flex-col">
                            <Textarea
                              className="flex-1 font-mono text-xs resize-none p-3 leading-relaxed bg-background/50 border border-border"
                              value={activeDoc.content ?? ""}
                              onChange={e => setActiveDoc({ ...activeDoc, content: e.target.value })}
                              placeholder="# Write your test plan or documentation in Markdown..."
                            />
                          </div>
                        )}

                        {/* Rendered Preview Box */}
                        {(previewMode === "preview" || previewMode === "split") && (
                          <div className="h-full overflow-y-auto p-4 rounded-md border border-border/80 bg-background/60 prose prose-invert prose-xs max-w-none">
                            <div className="space-y-3 text-xs leading-relaxed">
                              {(activeDoc.content || "").split("\n\n").map((block, bIdx) => {
                                if (block.startsWith("# ")) {
                                  return <h1 key={bIdx} className="text-xl font-bold text-foreground border-b pb-1.5">{block.replace("# ", "")}</h1>;
                                }
                                if (block.startsWith("## ")) {
                                  return <h2 key={bIdx} className="text-base font-semibold text-foreground mt-4 mb-1">{block.replace("## ", "")}</h2>;
                                }
                                if (block.startsWith("### ")) {
                                  return <h3 key={bIdx} className="text-sm font-semibold text-primary mt-2">{block.replace("### ", "")}</h3>;
                                }
                                if (block.startsWith("- ") || block.startsWith("* ")) {
                                  return (
                                    <ul key={bIdx} className="list-disc pl-5 space-y-1">
                                      {block.split("\n").map((li, lIdx) => (
                                        <li key={lIdx}>{li.replace(/^[-*]\s+/, "")}</li>
                                      ))}
                                    </ul>
                                  );
                                }
                                if (block.startsWith("|")) {
                                  // Simple Markdown table renderer
                                  const rows = block.split("\n").filter(r => !r.includes("---"));
                                  return (
                                    <div key={bIdx} className="overflow-x-auto my-2">
                                      <table className="w-full text-[11px] border-collapse border border-border">
                                        <tbody>
                                          {rows.map((row, rIdx) => {
                                            const cells = row.split("|").filter((_, i, a) => i > 0 && i < a.length - 1);
                                            return (
                                              <tr key={rIdx} className={rIdx === 0 ? "bg-muted font-bold" : "border-b border-border"}>
                                                {cells.map((c, cIdx) => (
                                                  <td key={cIdx} className="p-1.5 border border-border">{c.trim()}</td>
                                                ))}
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  );
                                }
                                return <p key={bIdx} className="text-muted-foreground">{block}</p>;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* ------------------------------------------------------------------------- */}
        {/* TAB 2: QA STANDARDS & KNOWLEDGE BASE */}
        {/* ------------------------------------------------------------------------- */}
        <TabsContent value="qa-standards" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap bg-muted/20 p-3 rounded-lg border">
            <div className="flex items-center gap-2 max-w-md flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search QA standards, ISTQB techniques, BVA, WCAG checklists..."
                value={standardsSearch}
                onChange={e => setStandardsSearch(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Conforms to ISTQB CTFL Syllabus & ISO/IEC/IEEE 29119</span>
            </div>
          </div>

          <div className="grid md:grid-cols-[300px_1fr] gap-4">
            {/* Standards Navigation Sidebar */}
            <Card className="p-3 space-y-1 bg-card/60">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                Knowledge Modules ({filteredStandards.length})
              </div>
              <div className="space-y-1">
                {filteredStandards.map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => setSelectedStandard(sec)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-all border ${
                      selectedStandard.id === sec.id
                        ? "bg-primary/10 border-primary/30 text-foreground font-semibold"
                        : "border-transparent hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{sec.title}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{sec.badge}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-1">{sec.summary}</p>
                  </button>
                ))}
              </div>
            </Card>

            {/* Standard Detail Viewer */}
            <Card className="p-6 bg-card space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 border-b pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-primary/20 text-primary border-0 text-xs">{selectedStandard.badge}</Badge>
                    <span className="text-xs text-muted-foreground">Official QA Reference</span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight">{selectedStandard.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{selectedStandard.summary}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(selectedStandard.content, selectedStandard.id)}
                  className="gap-1 text-xs shrink-0"
                >
                  {copiedId === selectedStandard.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedId === selectedStandard.id ? "Copied" : "Copy Guide"}</span>
                </Button>
              </div>

              {/* Cheat Sheet Quick Cards if available */}
              {selectedStandard.cheatSheet && (
                <div className="grid sm:grid-cols-2 gap-2.5 bg-muted/20 p-3 rounded-lg border">
                  {selectedStandard.cheatSheet.map((item, idx) => (
                    <div key={idx} className="bg-background/80 p-2.5 rounded border border-border/60 space-y-0.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-primary">{item.label}</div>
                      <div className="font-mono text-xs font-semibold text-foreground">{item.value}</div>
                      <div className="text-[10px] text-muted-foreground">{item.note}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Guide Content */}
              <div className="prose prose-invert prose-xs max-w-none text-xs leading-relaxed space-y-3">
                {selectedStandard.content.split("\n\n").map((block, bIdx) => {
                  if (block.startsWith("### ")) {
                    return <h3 key={bIdx} className="text-sm font-bold text-foreground mt-4 mb-1 border-b pb-1">{block.replace("### ", "")}</h3>;
                  }
                  if (block.startsWith("#### ")) {
                    return <h4 key={bIdx} className="text-xs font-semibold text-primary mt-2">{block.replace("#### ", "")}</h4>;
                  }
                  if (block.startsWith("- ") || block.startsWith("* ")) {
                    return (
                      <ul key={bIdx} className="list-disc pl-5 space-y-1">
                        {block.split("\n").map((li, lIdx) => (
                          <li key={lIdx}>{li.replace(/^[-*]\s+/, "")}</li>
                        ))}
                      </ul>
                    );
                  }
                  if (block.startsWith("|")) {
                    const rows = block.split("\n").filter(r => !r.includes("---"));
                    return (
                      <div key={bIdx} className="overflow-x-auto my-2">
                        <table className="w-full text-[11px] border-collapse border border-border">
                          <tbody>
                            {rows.map((row, rIdx) => {
                              const cells = row.split("|").filter((_, i, a) => i > 0 && i < a.length - 1);
                              return (
                                <tr key={rIdx} className={rIdx === 0 ? "bg-muted font-bold" : "border-b border-border"}>
                                  {cells.map((c, cIdx) => (
                                    <td key={cIdx} className="p-1.5 border border-border">{c.trim()}</td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  }
                  return <p key={bIdx} className="text-muted-foreground">{block}</p>;
                })}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------------------- */}
        {/* TAB 3: INDUSTRY STANDARD QA TEMPLATES LIBRARY */}
        {/* ------------------------------------------------------------------------- */}
        <TabsContent value="templates" className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-card border border-border/80 flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-warning" />
                Industry-Standard QA Templates Library
              </h2>
              <p className="text-xs text-muted-foreground">
                Battle-tested templates conforming to IEEE 829, ISTQB, and agile release management. Click to copy or create directly.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {QA_TEMPLATES.map(tpl => (
              <Card key={tpl.id} className="p-5 flex flex-col justify-between space-y-4 bg-card hover:border-primary/40 transition-all shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary">
                      {tpl.category}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Type: {tpl.type.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-foreground">{tpl.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>

                <div className="pt-2 border-t flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1 h-8 px-2"
                    onClick={() => copyToClipboard(tpl.content, tpl.id)}
                  >
                    {copiedId === tpl.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedId === tpl.id ? "Copied" : "Copy"}</span>
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs gap-1 h-8 bg-gradient-hero border-0"
                    onClick={() => loadTemplateIntoForm(tpl)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Use Template</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Share Document Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share QA Document</DialogTitle>
            <DialogDescription>Invite team members to view or edit this document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <Input
                placeholder="teammate@company.com"
                value={shareEmail}
                onChange={e => setShareEmail(e.target.value)}
                className="text-xs"
              />
              <Select value={sharePerm} onValueChange={v => setSharePerm(v as any)}>
                <SelectTrigger className="w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addShare} size="sm" className="bg-gradient-hero border-0">Add</Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {docShares.map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs border rounded-md px-3 py-2 bg-background/50">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.shared_with_email}</span>
                    <Badge variant="outline" className="text-[10px]">{s.permission}</Badge>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeShare(s.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
              {docShares.length === 0 && <p className="text-xs text-muted-foreground p-2 text-center">No teammates invited yet.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
