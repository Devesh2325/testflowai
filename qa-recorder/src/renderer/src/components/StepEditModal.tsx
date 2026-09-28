import React, { useState } from "react";
import { RecordedStep, ActionType } from "../types";
import { X, Check } from "lucide-react";

interface StepEditModalProps {
  step: RecordedStep;
  index: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: (index: number, updated: RecordedStep) => void;
}

export const StepEditModal: React.FC<StepEditModalProps> = ({
  step,
  index,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(step.name);
  const [action, setAction] = useState<ActionType>(step.action);
  const [value, setValue] = useState(step.value || "");
  const [selectorCode, setSelectorCode] = useState(
    step.primarySelector?.playwrightCode || ""
  );

  if (!isOpen) return null;

  const handleSave = () => {
    const updated: RecordedStep = {
      ...step,
      name,
      action,
      value: value.trim() ? value : undefined,
      primarySelector: step.primarySelector
        ? {
            ...step.primarySelector,
            playwrightCode: selectorCode,
          }
        : undefined,
    };
    onSave(index, updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg max-w-md w-full shadow-2xl flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">
            Edit Step #{index + 1}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div>
            <label className="block text-muted-foreground mb-1 font-medium">Step Description</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary font-sans"
            />
          </div>

          <div>
            <label className="block text-muted-foreground mb-1 font-medium">Action Type</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as ActionType)}
              className="w-full bg-background border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary font-sans"
            >
              <option value="click">click</option>
              <option value="dblclick">dblclick</option>
              <option value="input">input / type</option>
              <option value="select">select</option>
              <option value="check">check</option>
              <option value="uncheck">uncheck</option>
              <option value="keypress">keypress</option>
              <option value="navigate">navigate</option>
              <option value="assert_visible">assert_visible</option>
              <option value="assert_text_equals">assert_text_equals</option>
              <option value="assert_url_contains">assert_url_contains</option>
              <option value="assert_element_count">assert_element_count</option>
            </select>
          </div>

          {step.primarySelector && (
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">
                Playwright Locator ({step.primarySelector.strategy})
              </label>
              <input
                type="text"
                value={selectorCode}
                onChange={(e) => setSelectorCode(e.target.value)}
                className="w-full bg-background border border-border rounded p-2 font-mono text-[11px] text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          )}

          <div>
            <label className="block text-muted-foreground mb-1 font-medium">
              Value / Argument
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. text to type or expected assertion text"
              className="w-full bg-background border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary font-mono text-xs"
            />
          </div>
        </div>

        <div className="p-3 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded hover:bg-muted text-muted-foreground text-xs font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded text-xs font-medium flex items-center gap-1.5 shadow"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Step</span>
          </button>
        </div>
      </div>
    </div>
  );
};
