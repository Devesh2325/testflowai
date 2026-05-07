import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function NotificationsBell() {
  const { items, unread, markRead, markAll } = useNotifications();
  const nav = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] rounded-full h-4 min-w-4 px-1 grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAll}>
              <Check className="h-3 w-3" />Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</div>
          ) : items.map(n => (
            <button key={n.id}
              onClick={() => { markRead(n.id); if (n.link) nav(n.link); }}
              className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}>
              <div className="flex items-center gap-2 mb-1">
                {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                <div className="font-medium text-sm flex-1 truncate">{n.title}</div>
                <Badge variant="outline" className="text-[9px] capitalize">{n.kind}</Badge>
              </div>
              {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
