import React, { useState } from "react";
import { RecordedStep, BaselineNoise } from "../types";
import { StepItem } from "./StepItem";
import { StepEditModal } from "./StepEditModal";
import { BaselineNoiseBadge } from "./BaselineNoiseBadge";
import { Play, Square, Sparkles, Layers, CheckCircle2, PlusCircle } from "lucide-react";

interface RecordingPanelProps {
  scenarioName: string;
  isRecording: boolean;
  steps: RecordedStep[];
  baselineNoise: BaselineNoise;
  onScenarioNameChange: (name: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDeleteStep: (index: number) => void;
  onUpdateStep: (index: number, updated: RecordedStep) => void;
  onAddAssertion: (type: "assert_visible" | "assert_text_equals" | "assert_url_contains") => void;
}

export const RecordingPanel: React.FC<RecordingPanelProps> = ({
  scenarioName,
  isRecording,
  steps,
  baselineNoise,
  onScenarioNameChange,
  onStartRecording,
  onStopRecording,
  onMoveUp,
  onMoveDown,
  onDeleteStep,
  onUpdateStep,
  onAddAssertion,
}) => {
  const [editingStep, setEditingStep] = useState<{ step: RecordedStep; index: number } | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const handleStop = async () => {
    onStopRecording();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 4000);
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border select-none">
      {/* Panel Header */}
      <div className="p-4 border-b border-border space-y-3 shrink-0 bg-card/60 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Scenario Recorder</h2>
              <p className="text-[11px] text-muted-foreground">Playwright Test Generator</p>
            </div>
          </div>
          <BaselineNoiseBadge noise={baselineNoise} />
        </div>

        {/* Scenario Name Input */}
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">
            Scenario Name
          </label>
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => onScenarioNameChange(e.target.value)}
            disabled={isRecording}
            placeholder="e.g. User Authentication & Profile Update"
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-60 transition-all font-medium"
          />
        </div>

        {/* Action Controls: Start / Stop */}
        <div className="pt-1">
          {!isRecording ? (
            <button
              onClick={onStartRecording}
              className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-red-900/30 cursor-pointer"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              <span>Start Recording</span>
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-2 border border-border transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current text-red-500" />
              <span>Stop & Save Scenario</span>
            </button>
          )}
        </div>
      </div>

      {/* Steps List Header */}
      <div className="px-4 py-2 bg-muted/20 border-b border-border flex items-center justify-between shrink-0 text-xs">
        <span className="font-semibold text-muted-foreground">
          Captured Steps ({steps.length})
        </span>
        {isRecording && (
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Listening to interactions...</span>
          </span>
        )}
      </div>

      {/* Saved Banner */}
      {justSaved && (
        <div className="m-3 p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Scenario successfully saved to SQLite database and ready for replay!</span>
        </div>
      )}

      {/* Steps Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {steps.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-muted/30 border border-border flex items-center justify-center text-muted-foreground/60">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">No Steps Recorded Yet</h4>
              <p className="text-[11px] max-w-xs leading-relaxed">
                Click <b>"Start Recording"</b> above and interact with the page on the left.
              </p>
            </div>
            <div className="text-[11px] p-3 rounded border border-border/50 bg-background/50 text-left space-y-1 font-mono text-[10px]">
              <div className="text-muted-foreground font-sans font-semibold mb-1">In-page tips:</div>
              <div>• Left-click buttons, links, or inputs</div>
              <div>• Type into fields (passwords auto-masked)</div>
              <div>• Right-click any element to add assertions</div>
            </div>
          </div>
        ) : (
          steps.map((step, idx) => (
            <StepItem
              key={step.id || idx}
              step={step}
              index={idx}
              totalSteps={steps.length}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onDelete={onDeleteStep}
              onEdit={(st, i) => setEditingStep({ step: st, index: i })}
            />
          ))
        )}
      </div>

      {/* Bottom Manual Assertion Shortcut Bar */}
      {isRecording && (
        <div className="p-3 border-t border-border bg-card/40 flex items-center justify-between gap-1 text-[11px]">
          <span className="text-muted-foreground font-medium flex items-center gap-1">
            <PlusCircle className="w-3.5 h-3.5 text-primary" />
            <span>Quick Assertion:</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAddAssertion("assert_url_contains")}
              className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-secondary-foreground text-[10px] font-medium border border-border"
            >
              URL Contains
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingStep && (
        <StepEditModal
          step={editingStep.step}
          index={editingStep.index}
          isOpen={true}
          onClose={() => setEditingStep(null)}
          onSave={(i, updated) => {
            onUpdateStep(i, updated);
            setEditingStep(null);
          }}
        />
      )}
    </div>
  );
};
