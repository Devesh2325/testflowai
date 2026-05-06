import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, User, Lock, LogOut, Shield, Camera, Database, FolderKanban, FileText, Bug as BugIcon, PlayCircle } from "lucide-react";
import { toast } from "sonner";

type Profile = {
  full_name: string | null; email: string | null; avatar_url: string | null;
  phone: string | null; bio: string | null; job_title: string | null; timezone: string | null;
};

export default function Settings() {
  const { user, signOut } = useAuth();
  const [p, setP] = useState<Profile>({ full_name: "", email: "", avatar_url: "", phone: "", bio: "", job_title: "", timezone: "" });
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState(""); const [pwd2, setPwd2] = useState("");
  const [counts, setCounts] = useState({ projects: 0, tests: 0, runs: 0, bugs: 0, modules: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: r }, projects, tests, runs, bugs, modules] = await Promise.all([
        supabase.from("profiles").select("full_name,email,avatar_url,phone,bio,job_title,timezone").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("test_cases").select("id", { count: "exact", head: true }),
        supabase.from("test_runs").select("id", { count: "exact", head: true }),
        supabase.from("bugs").select("id", { count: "exact", head: true }),
        supabase.from("modules").select("id", { count: "exact", head: true }),
      ]);
      setP({
        full_name: prof?.full_name ?? "", email: prof?.email ?? user.email ?? "",
        avatar_url: prof?.avatar_url ?? "", phone: prof?.phone ?? "",
        bio: prof?.bio ?? "", job_title: prof?.job_title ?? "",
        timezone: prof?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setRole(r?.role ?? "tester");
      setCounts({
        projects: projects.count ?? 0, tests: tests.count ?? 0, runs: runs.count ?? 0,
        bugs: bugs.count ?? 0, modules: modules.count ?? 0,
      });
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: p.full_name, phone: p.phone, bio: p.bio, job_title: p.job_title, timezone: p.timezone,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  };

  const uploadAvatar = async (f: File) => {
    if (!user) return;
    const path = `${user.id}/avatar-${Date.now()}.${f.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
    if (error) return toast.error(error.message);
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
    setP(s => ({ ...s, avatar_url: pub.publicUrl }));
    toast.success("Avatar updated");
  };

  const changePassword = async () => {
    if (pwd.length < 6) return toast.error("Password must be at least 6 characters");
    if (pwd !== pwd2) return toast.error("Passwords don't match");
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setPwd(""); setPwd2(""); }
  };

  const initials = (p.full_name || p.email || "U").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><SettingsIcon className="h-7 w-7 text-primary" />Settings</h1>
        <p className="text-muted-foreground">Manage your profile, security, and workspace.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4"><User className="h-4 w-4 text-primary" /><h2 className="font-semibold">Profile</h2></div>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <Avatar className="h-20 w-20">
              {p.avatar_url ? <AvatarImage src={p.avatar_url} /> : null}
              <AvatarFallback className="bg-gradient-hero text-primary-foreground text-lg font-bold">{initials}</AvatarFallback>
            </Avatar>
            <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1.5 shadow">
              <Camera className="h-3 w-3" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
          </div>
          <div>
            <div className="font-medium text-lg">{p.full_name || "Unnamed user"}</div>
            <div className="text-sm text-muted-foreground">{p.job_title || "—"} · {p.email}</div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>Full name</Label><Input value={p.full_name ?? ""} onChange={e => setP({ ...p, full_name: e.target.value })} disabled={loading} /></div>
          <div><Label>Email</Label><Input value={p.email ?? ""} disabled /></div>
          <div><Label>Job title</Label><Input value={p.job_title ?? ""} onChange={e => setP({ ...p, job_title: e.target.value })} placeholder="QA Engineer" /></div>
          <div><Label>Phone</Label><Input value={p.phone ?? ""} onChange={e => setP({ ...p, phone: e.target.value })} placeholder="+1 555 …" /></div>
          <div><Label>Timezone</Label><Input value={p.timezone ?? ""} onChange={e => setP({ ...p, timezone: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Bio</Label><Textarea rows={3} value={p.bio ?? ""} onChange={e => setP({ ...p, bio: e.target.value })} placeholder="A short intro about you…" /></div>
        </div>
        <div className="mt-4"><Button onClick={save} disabled={saving || loading}>{saving ? "Saving…" : "Save profile"}</Button></div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4"><Database className="h-4 w-4 text-primary" /><h2 className="font-semibold">Workspace data</h2></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={FolderKanban} label="Projects" value={counts.projects} />
          <Stat icon={Database} label="Modules" value={counts.modules} />
          <Stat icon={FileText} label="Test cases" value={counts.tests} />
          <Stat icon={PlayCircle} label="Test runs" value={counts.runs} />
          <Stat icon={BugIcon} label="Bugs" value={counts.bugs} />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4"><Shield className="h-4 w-4 text-primary" /><h2 className="font-semibold">Role & access</h2></div>
        <p className="text-sm text-muted-foreground mb-2">Your current role determines what you can do in workspaces.</p>
        <div className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm bg-muted/50">
          <span className="capitalize font-medium">{role}</span>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4"><Lock className="h-4 w-4 text-primary" /><h2 className="font-semibold">Change password</h2></div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>New password</Label><Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} /></div>
          <div><Label>Confirm password</Label><Input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} /></div>
        </div>
        <div className="mt-4"><Button onClick={changePassword} variant="secondary">Update password</Button></div>
      </Card>

      <Card className="p-6 border-destructive/30">
        <h2 className="font-semibold mb-2 text-destructive">Sign out</h2>
        <p className="text-sm text-muted-foreground mb-4">End your session on this device.</p>
        <Separator className="mb-4" />
        <Button variant="destructive" onClick={signOut} className="gap-2"><LogOut className="h-4 w-4" />Sign out</Button>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-lg border bg-gradient-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
