import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, User, Lock, LogOut, Shield } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user, signOut } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);
      setFullName(p?.full_name ?? "");
      setEmail(p?.email ?? user.email ?? "");
      setRole(r?.role ?? "tester");
      setLoading(false);
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  };

  const changePassword = async () => {
    if (pwd.length < 6) return toast.error("Password must be at least 6 characters");
    if (pwd !== pwd2) return toast.error("Passwords don't match");
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setPwd(""); setPwd2(""); }
  };

  const initials = (fullName || email || "U").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><SettingsIcon className="h-7 w-7 text-primary" />Settings</h1>
        <p className="text-muted-foreground">Manage your account, security, and workspace.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4"><User className="h-4 w-4 text-primary" /><h2 className="font-semibold">Profile</h2></div>
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="h-16 w-16"><AvatarFallback className="bg-gradient-hero text-primary-foreground text-lg font-bold">{initials}</AvatarFallback></Avatar>
          <div>
            <div className="font-medium">{fullName || "Unnamed user"}</div>
            <div className="text-sm text-muted-foreground">{email}</div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>Full name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} disabled={loading} /></div>
          <div><Label>Email</Label><Input value={email} disabled /></div>
        </div>
        <div className="mt-4"><Button onClick={saveProfile} disabled={saving || loading}>{saving ? "Saving…" : "Save changes"}</Button></div>
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
