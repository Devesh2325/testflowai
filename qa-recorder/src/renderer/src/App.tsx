import React, { useState, useEffect, useRef } from "react";
import { UrlBar } from "./components/UrlBar";
import { RecordingPanel } from "./components/RecordingPanel";
import { RecordedStep, BaselineNoise } from "./types";

export default function App() {
  const [currentUrl, setCurrentUrl] = useState("https://example.com");
  const [scenarioName, setScenarioName] = useState("Critical Regression Flow");
  const [isRecording, setIsRecording] = useState(false);
  const [steps, setSteps] = useState<RecordedStep[]>([]);
  const [baselineNoise, setBaselineNoise] = useState<BaselineNoise>({
    consoleErrors: [],
    failedRequests: [],
    pageErrors: [],
  });

  const browserContainerRef = useRef<HTMLDivElement>(null);

  // Measure and send bounds of left panel to Electron Main for WebContentsView positioning
  const updateEmbeddedBounds = () => {
    if (!browserContainerRef.current || !window.qaRecorder) return;
    const rect = browserContainerRef.current.getBoundingClientRect();
    window.qaRecorder.updateBounds({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  };

  useEffect(() => {
    updateEmbeddedBounds();

    const resizeObserver = new ResizeObserver(() => {
      updateEmbeddedBounds();
    });

    if (browserContainerRef.current) {
      resizeObserver.observe(browserContainerRef.current);
    }

    window.addEventListener("resize", updateEmbeddedBounds);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateEmbeddedBounds);
    };
  }, []);

  // Listen to live events from Electron Main
  useEffect(() => {
    if (!window.qaRecorder) return;

    // 1. Live Step Captured
    const unsubStep = window.qaRecorder.onStepCaptured((newStep) => {
      setSteps((prev) => [...prev, newStep]);
    });

    // 2. Navigation
    const unsubNav = window.qaRecorder.onNavigated((data) => {
      setCurrentUrl(data.url);
    });

    // 3. Baseline Noise
    const unsubNoise = window.qaRecorder.onNoiseCaptured((noise) => {
      setBaselineNoise(noise);
    });

    // 4. Status Changed
    const unsubStatus = window.qaRecorder.onStatusChanged((status) => {
      setIsRecording(status.isRecording);
      if (status.scenarioName) setScenarioName(status.scenarioName);
    });

    return () => {
      unsubStep();
      unsubNav();
      unsubNoise();
      unsubStatus();
    };
  }, []);

  // Handlers
  const handleNavigate = async (url: string) => {
    if (window.qaRecorder) {
      const res = await window.qaRecorder.navigate(url);
      if (res.success) setCurrentUrl(res.url);
    }
  };

  const handleStartRecording = async () => {
    if (!window.qaRecorder) return;
    setSteps([]);
    setBaselineNoise({ consoleErrors: [], failedRequests: [], pageErrors: [] });
    await window.qaRecorder.startRecording(scenarioName);
    setIsRecording(true);
  };

  const handleStopRecording = async () => {
    if (!window.qaRecorder) return;
    const res = await window.qaRecorder.stopRecording();
    setIsRecording(false);
    if (res?.steps) setSteps(res.steps);
  };

  const handleMoveUp = async (index: number) => {
    if (index > 0) {
      const newSteps = [...steps];
      const [item] = newSteps.splice(index, 1);
      newSteps.splice(index - 1, 0, item);
      setSteps(newSteps);
      if (window.qaRecorder) await window.qaRecorder.reorderSteps(index, index - 1);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index < steps.length - 1) {
      const newSteps = [...steps];
      const [item] = newSteps.splice(index, 1);
      newSteps.splice(index + 1, 0, item);
      setSteps(newSteps);
      if (window.qaRecorder) await window.qaRecorder.reorderSteps(index, index + 1);
    }
  };

  const handleDeleteStep = async (index: number) => {
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    setSteps(newSteps);
    if (window.qaRecorder) await window.qaRecorder.deleteStep(index);
  };

  const handleUpdateStep = async (index: number, updated: RecordedStep) => {
    const newSteps = [...steps];
    newSteps[index] = updated;
    setSteps(newSteps);
    if (window.qaRecorder) await window.qaRecorder.updateStep(index, updated);
  };

  const handleAddAssertion = async (type: "assert_visible" | "assert_text_equals" | "assert_url_contains") => {
    if (!window.qaRecorder) return;
    const pathSnippet = new URL(currentUrl).pathname;
    const manualStep: RecordedStep = {
      id: `step_${Date.now()}_manual_assert`,
      action: type,
      name: `Assert URL contains "${pathSnippet}"`,
      value: pathSnippet,
      url: currentUrl,
      timestamp: Date.now(),
    };
    setSteps((prev) => [...prev, manualStep]);
    await window.qaRecorder.addManualStep(manualStep);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden font-sans">
      {/* Top URL Bar */}
      <UrlBar
        currentUrl={currentUrl}
        isRecording={isRecording}
        onNavigate={handleNavigate}
        onBack={() => window.qaRecorder?.goBack()}
        onForward={() => window.qaRecorder?.goForward()}
        onReload={() => window.qaRecorder?.reload()}
      />

      {/* Main Split Layout: Left Embedded Browser, Right Recording Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Container over which Electron overlays the WebContentsView */}
        <div
          ref={browserContainerRef}
          id="browser-viewport-container"
          className="flex-1 bg-zinc-950 relative overflow-hidden flex items-center justify-center text-muted-foreground/30 font-mono text-xs select-none"
        >
          {/* Visual watermark behind the embedded browser */}
          <span>[Embedded Browser WebContentsView]</span>
        </div>

        {/* Right: Steps and Scenario Panel (width: 420px) */}
        <div className="w-[420px] shrink-0 h-full">
          <RecordingPanel
            scenarioName={scenarioName}
            isRecording={isRecording}
            steps={steps}
            baselineNoise={baselineNoise}
            onScenarioNameChange={setScenarioName}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onDeleteStep={handleDeleteStep}
            onUpdateStep={handleUpdateStep}
            onAddAssertion={handleAddAssertion}
          />
        </div>
      </div>
    </div>
  );
}
