import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { TestTube2, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase recovery link sets a session via the hash; AuthProvider also picks it up.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated — signing you in");
    nav("/app");
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-subtle p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-hero grid place-items-center shadow-md">
            <TestTube2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-xl">TestFlow AI</span>
        </Link>
        <Card className="p-6 shadow-elegant">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Set a new password</h1>
          </div>
          {!ready ? (
            <p className="text-sm text-muted-foreground">
              This link is invalid or expired. <Link to="/auth" className="text-primary underline">Request a new reset link</Link>.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div><Label>New password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus /></div>
              <div><Label>Confirm password</Label><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
              <Button disabled={loading} className="w-full bg-gradient-hero border-0 hover:opacity-90">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Update password
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
