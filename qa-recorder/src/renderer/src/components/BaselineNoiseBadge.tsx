import React, { useState } from "react";
import { BaselineNoise } from "../types";
import { AlertTriangle, Bug, WifiOff, X } from "lucide-react";

interface BaselineNoiseBadgeProps {
  noise: BaselineNoise;
}

export const BaselineNoiseBadge: React.FC<BaselineNoiseBadgeProps> = ({ noise }) => {
  const [isOpen, setIsOpen] = useState(false);

  const totalNoise =
    noise.consoleErrors.length + noise.failedRequests.length + noise.pageErrors.length;

  if (totalNoise === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors cursor-pointer"
        title="View captured baseline noise (console errors & failed requests)"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Baseline Noise: {totalNoise}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-foreground">
                  Known Baseline Noise ({totalNoise})
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <p className="text-muted-foreground">
                Captured during recording to differentiate pre-existing errors from new regression defects during replay.
              </p>

              {/* Console Errors */}
              {noise.consoleErrors.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-medium text-red-400 flex items-center gap-1.5">
                    <Bug className="w-3.5 h-3.5" />
                    <span>Console Errors ({noise.consoleErrors.length})</span>
                  </div>
                  <div className="space-y-1">
                    {noise.consoleErrors.map((err, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-red-950/20 border border-red-900/30 text-red-300 font-mono text-[11px] break-all"
                      >
                        {err.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed Network Requests */}
              {noise.failedRequests.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-medium text-amber-400 flex items-center gap-1.5">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Failed Requests 4xx/5xx ({noise.failedRequests.length})</span>
                  </div>
                  <div className="space-y-1">
                    {noise.failedRequests.map((req, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-amber-950/20 border border-amber-900/30 text-amber-300 font-mono text-[11px] flex justify-between gap-2"
                      >
                        <span className="truncate">{req.method} {req.url}</span>
                        <span className="font-bold shrink-0">{req.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
