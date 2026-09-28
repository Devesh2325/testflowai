import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Globe, ArrowRightCircle, ShieldAlert } from "lucide-react";

interface UrlBarProps {
  currentUrl: string;
  isRecording: boolean;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
}

export const UrlBar: React.FC<UrlBarProps> = ({
  currentUrl,
  isRecording,
  onNavigate,
  onBack,
  onForward,
  onReload,
}) => {
  const [inputUrl, setInputUrl] = useState(currentUrl);

  useEffect(() => {
    setInputUrl(currentUrl);
  }, [currentUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      onNavigate(inputUrl.trim());
    }
  };

  return (
    <div className="h-14 border-b border-border bg-card/80 backdrop-blur px-4 flex items-center justify-between gap-3 shrink-0">
      {/* Navigation Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onForward}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onReload}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Reload"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* URL Input Form */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-2xl flex items-center gap-2">
        <div className="relative flex-1 flex items-center">
          <Globe className="w-4 h-4 absolute left-3 text-muted-foreground" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter web application URL to record (e.g. https://example.com)..."
            className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border border-border"
        >
          <span>Go</span>
          <ArrowRightCircle className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Recording Status Badge */}
      <div className="flex items-center gap-2">
        {isRecording ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>RECORDING IN PROGRESS</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/40 border border-border text-muted-foreground text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            <span>RECORDER IDLE</span>
          </div>
        )}
      </div>
    </div>
  );
};
