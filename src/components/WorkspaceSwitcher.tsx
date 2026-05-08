import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Check, Plus, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

export default function WorkspaceSwitcher() {
  const { workspaces, current, switchTo, createWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const create = async () => {
    if (!name.trim()) return;
    const ws = await createWorkspace(name.trim());
    if (ws) { toast.success("Workspace created"); setName(""); setOpen(false); }
    else toast.error("Could not create workspace");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 max-w-[220px]">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{current?.name ?? "Workspace"}</span>
            <ChevronsUpDown className="h-3 w-3 opacity-60 ml-auto" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 bg-popover">
          <DropdownMenuLabel>Your workspaces</DropdownMenuLabel>
          {workspaces.map(w => (
            <DropdownMenuItem key={w.id} onClick={() => switchTo(w.id)} className="flex items-center gap-2">
              <span className="truncate flex-1">{w.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{w.role}</span>
              {current?.id === w.id && <Check className="h-3 w-3 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create workspace</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Acme QA Team" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
