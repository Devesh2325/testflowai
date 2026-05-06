import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

type Enquiry = { id: string; name: string; email: string; subject: string; message: string; status: string; created_at: string };

export default function Enquiries() {
  const { user } = useAuth();
  const [list, setList] = useState<Enquiry[]>([]);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("enquiries").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as any);
  };
  useEffect(() => { load(); setForm(f => ({ ...f, name: user?.user_metadata?.full_name ?? "", email: user?.email ?? "" })); }, [user]);

  const submit = async () => {
    if (!form.name || !form.email || !form.subject || !form.message) return toast.error("All fields required");
    setSending(true);
    const { error } = await supabase.from("enquiries").insert({ ...form, user_id: user?.id ?? null });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Enquiry submitted");
    setForm({ ...form, subject: "", message: "" }); load();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><MessageSquare className="h-7 w-7 text-primary" />Enquiries</h1>
        <p className="text-muted-foreground">Send a help request or feature enquiry. We track every submission.</p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-3">New enquiry</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Subject</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Message</Label><Textarea rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></div>
        </div>
        <div className="mt-4"><Button onClick={submit} disabled={sending} className="bg-gradient-hero border-0 gap-2"><Send className="h-4 w-4" />{sending ? "Sending…" : "Submit"}</Button></div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-3">Your submissions ({list.length})</h2>
        {list.length === 0 ? <p className="text-sm text-muted-foreground">No enquiries yet.</p> : (
          <div className="divide-y">
            {list.map(e => (
              <div key={e.id} className="py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium">{e.subject}</div>
                  <Badge variant="outline" className="capitalize">{e.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-1">{e.name} · {e.email} · {new Date(e.created_at).toLocaleString()}</div>
                <p className="text-sm whitespace-pre-wrap">{e.message}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
