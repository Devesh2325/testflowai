import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FolderKanban, FileText, Bug, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

type Result = {
  id: string;
  kind: "project" | "test_case" | "bug";
  title: string;
  subtitle?: string;
  url: string;
};

const iconFor = (k: Result["kind"]) =>
  k === "project" ? FolderKanban : k === "test_case" ? FileText : Bug;

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { current } = useWorkspace();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const term = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    if (!term || !current?.id) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const ws = current.id;
      try {
        const [proj, tc, bg] = await Promise.all([
          supabase.from("projects").select("id,name,description").eq("workspace_id", ws).ilike("name", like).limit(5),
          supabase.from("test_cases").select("id,title,project_id").eq("workspace_id", ws).ilike("title", like).limit(8),
          supabase.from("bugs").select("id,title,status").eq("workspace_id", ws).ilike("title", like).limit(8),
        ]);
        if (cancelled) return;
        const out: Result[] = [
          ...(proj.data ?? []).map((p: any) => ({
            id: p.id, kind: "project" as const, title: p.name,
            subtitle: p.description ?? "Project", url: `/app/projects`,
          })),
          ...(tc.data ?? []).map((t: any) => ({
            id: t.id, kind: "test_case" as const, title: t.title,
            subtitle: "Test case", url: `/app/test-cases`,
          })),
          ...(bg.data ?? []).map((b: any) => ({
            id: b.id, kind: "bug" as const, title: b.title,
            subtitle: b.status ?? "Bug", url: `/app/bugs`,
          })),
        ];
        setResults(out);
        setActive(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [term, current?.id]);

  const go = (r: Result) => {
    setOpen(false);
    setQ("");
    navigate(r.url);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active]); }
  };

  return (
    <div ref={wrapRef} className="relative flex-1 max-w-xl">
      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search projects, test cases, bugs… (⌘K)"
        className="pl-9 pr-12 h-9 bg-secondary/60 border-transparent focus-visible:bg-background"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] text-muted-foreground">
        ⌘K
      </kbd>

      {open && (term.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-md border bg-popover shadow-lg z-50 overflow-hidden">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground">No results for "{term}"</div>
          )}
          {!loading && results.length > 0 && (
            <ul className="max-h-80 overflow-auto py-1">
              {results.map((r, i) => {
                const Icon = iconFor(r.kind);
                return (
                  <li key={`${r.kind}-${r.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left text-sm",
                        i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{r.title}</div>
                        {r.subtitle && <div className="text-xs text-muted-foreground truncate">{r.subtitle}</div>}
                      </div>
                      <span className="text-[10px] uppercase text-muted-foreground">{r.kind.replace("_", " ")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
