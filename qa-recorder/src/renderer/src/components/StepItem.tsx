import React from "react";
import { RecordedStep } from "../types";
import {
  MousePointer,
  Type,
  Navigation,
  CheckSquare,
  List,
  Eye,
  FileCheck,
  Hash,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit2,
  Lock,
} from "lucide-react";

interface StepItemProps {
  step: RecordedStep;
  index: number;
  totalSteps: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (index: number) => void;
  onEdit: (step: RecordedStep, index: number) => void;
}

export const StepItem: React.FC<StepItemProps> = ({
  step,
  index,
  totalSteps,
  onMoveUp,
  onMoveDown,
  onDelete,
  onEdit,
}) => {
  const getActionIcon = () => {
    switch (step.action) {
      case "click":
      case "dblclick":
        return <MousePointer className="w-3.5 h-3.5 text-blue-400" />;
      case "input":
      case "keypress":
        return <Type className="w-3.5 h-3.5 text-emerald-400" />;
      case "navigate":
        return <Navigation className="w-3.5 h-3.5 text-purple-400" />;
      case "check":
      case "uncheck":
        return <CheckSquare className="w-3.5 h-3.5 text-amber-400" />;
      case "select":
        return <List className="w-3.5 h-3.5 text-indigo-400" />;
      case "assert_visible":
        return <Eye className="w-3.5 h-3.5 text-teal-400" />;
      case "assert_text_equals":
      case "assert_url_contains":
      case "assert_element_count":
        return <FileCheck className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Hash className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getActionBadgeClass = () => {
    if (step.action.startsWith("assert_")) {
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
    switch (step.action) {
      case "click":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "input":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "navigate":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-300 border-zinc-500/20";
    }
  };

  return (
    <div className="group p-3 rounded-lg border border-border/70 bg-card hover:border-border transition-all space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded-full bg-muted/60 text-muted-foreground text-[10px] font-mono flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border shrink-0 ${getActionBadgeClass()}`}>
            {step.action.replace("assert_", "assert: ")}
          </span>
          <span className="font-medium text-xs text-foreground truncate" title={step.name}>
            {step.name}
          </span>
        </div>

        {/* Step Controls: Edit, Reorder, Delete */}
        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
            title="Move Up"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={index === totalSteps - 1}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
            title="Move Down"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(step, index)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Edit Step"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(index)}
            className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
            title="Delete Step"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Selector Details */}
      {step.primarySelector && (
        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground bg-background/50 p-1.5 rounded border border-border/40">
          <div className="truncate flex items-center gap-1.5 min-w-0">
            <span className="text-primary font-medium">[{step.primarySelector.strategy}]</span>
            <span className="truncate">{step.primarySelector.playwrightCode}</span>
          </div>
          {step.fallbackSelectors && step.fallbackSelectors.length > 0 && (
            <span className="px-1.5 py-0.2 rounded bg-muted/70 text-muted-foreground text-[10px] shrink-0 font-sans" title={step.fallbackSelectors.map(s => s.playwrightCode).join("\n")}>
              +{step.fallbackSelectors.length} fallbacks
            </span>
          )}
        </div>
      )}

      {/* Value Details (if input, assertion, or navigate) */}
      {step.value !== undefined && (
        <div className="flex items-center gap-1.5 text-xs text-foreground/80 pl-1">
          {step.isPassword ? (
            <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Password masked: ••••••••</span>
            </span>
          ) : (
            <span className="truncate font-mono text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded">
              Value: "{step.value}"
            </span>
          )}
        </div>
      )}
    </div>
  );
};
