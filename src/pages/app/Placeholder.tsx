import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

export const Placeholder = ({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) => (
  <div className="space-y-6 max-w-5xl">
    <div>
      <h1 className="text-3xl font-bold flex items-center gap-2"><Icon className="h-7 w-7 text-primary" />{title}</h1>
      <p className="text-muted-foreground">{desc}</p>
    </div>
    <Card className="p-12 text-center bg-gradient-card">
      <Icon className="h-10 w-10 mx-auto text-primary mb-3" />
      <h3 className="font-semibold mb-1">Coming soon</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">This module is on the roadmap. Stay tuned — or share what you'd like to see first.</p>
    </Card>
  </div>
);
