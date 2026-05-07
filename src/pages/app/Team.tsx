import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Send, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

type Invite = { id: string; email: string; role: string; token: string; accepted_at: string | null; created_at: string };
type Member = { user_id: string; role: string; email: string | null; full_name: string | null };

const ROLES = ["admin", "manager", "tester", "viewer"];

export default function Team() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("tester");
  const [copied, setCopied] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string>("");

  const load = async () => {
    if (!user) return;
    const [{ data: inv }, { data: roles }, { data: mine }] = await Promise.all([
      supabase.from("invitations").select("*").eq("invited_by", user.id).order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ]);
    setInvites((inv ?? []) as any);
    setMyRole(mine?.role ?? "tester");
    if (roles && roles.length) {
      const ids = roles.map((r: any) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,email,full_name").in("id", ids);
      const map = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      setMembers(roles.map((r: any) => ({ user_id: r.user_id, role: r.role, email: map[r.user_id]?.email ?? null, full_name: map[r.user_id]?.full_name ?? null })));
    } else setMembers([]);
  };
  useEffect(() => { load(); }, [user]);

  const invite = async () => {
    if (!user || !email) return;
    const { data, error } = await supabase.from("invitations").insert({ invited_by: user.id, email: email.trim().toLowerCase(), role: role as any }).select().maybeSingle();
    if (error) return toast.error(error.message);
    setEmail("");
    const link = `${window.location.origin}/auth?invite=${data!.token}&email=${encodeURIComponent(email)}`;
    await supabase.functions.invoke("send-notification", {
      body: { title: "You've been invited to TestFlow AI", message: `Open this link to accept: ${link}` },
    }).catch(() => {});
    toast.success("Invitation created — link copied");
    navigator.clipboard.writeText(link).catch(() => {});
    load();
  };

  const copyLink = (token: string, em: string) => {
    const link = `${window.location.origin}/auth?invite=${token}&email=${encodeURIComponent(em)}`;
    navigator.clipboard.writeText(link);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  const revoke = async (id: string) => { await supabase.from("invitations").delete().eq("id", id); load(); };

  const setMemberRole = async (uid: string, newRole: string) => {
    if (myRole !== "admin") return toast.error("Only admins can change roles");
    await supabase.from("user_roles").delete().eq("user_id", uid);
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: newRole as any });
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="h-7 w-7 text-primary" />Team & Invites</h1>
        <p className="text-muted-foreground">Invite teammates, manage roles, and copy invitation links.</p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Invite a teammate</h2>
        <div className="flex gap-2 items-end">
          <div className="flex-1"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@company.com" /></div>
          <div className="w-40"><Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={invite} className="gap-2 bg-gradient-hero border-0"><Send className="h-4 w-4" />Send invite</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">A secure invite link is generated and copied to your clipboard. The role is applied automatically when they sign up.</p>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Pending invitations</h2>
        {invites.length === 0 ? <p className="text-sm text-muted-foreground">No invitations yet.</p> : (
          <div className="space-y-2">
            {invites.map(i => (
              <div key={i.id} className="flex items-center gap-3 border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{i.email}</div>
                  <div className="text-xs text-muted-foreground">Invited {new Date(i.created_at).toLocaleString()}</div>
                </div>
                <Badge variant="outline" className="capitalize">{i.role}</Badge>
                {i.accepted_at ? <Badge className="bg-success/15 text-success border-success/30">Accepted</Badge> : <Badge variant="secondary">Pending</Badge>}
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => copyLink(i.token, i.email)}>
                  {copied === i.token ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}Copy link
                </Button>
                <Button size="icon" variant="ghost" onClick={() => revoke(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Members</h2>
        {members.length === 0 ? <p className="text-sm text-muted-foreground">No members yet.</p> : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.user_id} className="flex items-center gap-3 border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{m.full_name || m.email || m.user_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                {myRole === "admin" ? (
                  <Select value={m.role} onValueChange={v => setMemberRole(m.user_id, v)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <Badge variant="outline" className="capitalize">{m.role}</Badge>}
              </div>
            ))}
          </div>
        )}
        {myRole !== "admin" && <p className="text-xs text-muted-foreground mt-3">Only admins can change member roles.</p>}
      </Card>
    </div>
  );
}
