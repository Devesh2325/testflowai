import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Notification = {
  id: string; title: string; body: string | null; link: string | null;
  kind: string; read: boolean; created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(30);
    setItems((data ?? []) as any);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase.channel(`notifs-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => setItems(s => [p.new as Notification, ...s]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems(s => s.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems(s => s.map(n => ({ ...n, read: true })));
  };
  const unread = items.filter(n => !n.read).length;
  return { items, unread, markRead, markAll, refresh: load };
}
