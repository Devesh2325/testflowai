import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TestTube2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
  fullName: z.string().trim().min(1).max(100).optional(),
});

export default function Auth() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get("invite");
  const inviteEmail = params.get("email");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(inviteEmail ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const claimInvite = async () => {
    if (!inviteToken) return;
    const { data, error } = await supabase.rpc("accept_invitation", { _token: inviteToken });
    if (error) { toast.error(error.message); return; }
    toast.success("Joined workspace!");
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        if (inviteToken) await claimInvite();
        nav("/app");
      }
    });
  }, [nav]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/app`, data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome to TestFlow AI!");
    nav("/app");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.pick({ email: true, password: true }).safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && inviteToken) await claimInvite();
    setLoading(false);
    if (error) return toast.error(error.message);
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
          {inviteToken && (
            <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
              You've been invited! Create an account with <strong>{inviteEmail}</strong> to accept.
            </div>
          )}
          <Tabs defaultValue={inviteToken ? "signup" : "login"}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3">
                <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
                <Button disabled={loading} className="w-full bg-gradient-hero border-0 hover:opacity-90">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Sign in
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3">
                <div><Label>Full name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} required /></div>
                <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
                <Button disabled={loading} className="w-full bg-gradient-hero border-0 hover:opacity-90">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
