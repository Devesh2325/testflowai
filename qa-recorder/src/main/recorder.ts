/**
 * Recording Session Manager for QA Recorder
 * Coordinates live step capture, noise tracking, and step editing
 */

import { WebContents, BrowserWindow } from "electron";
import { RecordedStep, BaselineNoise, Scenario } from "./types";
import { getDatabase } from "./db";

export class RecordingSession {
  private isRecording: boolean = false;
  private scenarioName: string = "New Scenario";
  private startUrl: string = "";
  private currentUrl: string = "";
  private steps: RecordedStep[] = [];
  private baselineNoise: BaselineNoise = {
    consoleErrors: [],
    failedRequests: [],
    pageErrors: [],
  };

  private embeddedWebContents: WebContents | null = null;
  private rendererWindow: BrowserWindow | null = null;

  constructor() {}

  public setEmbeddedWebContents(wc: WebContents) {
    this.embeddedWebContents = wc;
    this.attachTelemetryListeners(wc);
  }

  public setRendererWindow(win: BrowserWindow) {
    this.rendererWindow = win;
  }

  private attachTelemetryListeners(wc: WebContents) {
    // 1. Capture console errors
    wc.on("console-message", (_event, level, message, _line, sourceId) => {
      // level: 0 = log, 1 = info, 2 = warning, 3 = error
      if (level >= 3) {
        const errorEntry = { text: message, timestamp: Date.now(), url: sourceId };
        this.baselineNoise.consoleErrors.push(errorEntry);
        this.emitNoiseUpdate();
      }
    });

    // 2. Capture page errors
    wc.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      if (errorCode !== -3) { // Ignore aborted requests
        const errEntry = { error: `${errorDescription} (${errorCode}) at ${validatedURL}`, timestamp: Date.now() };
        this.baselineNoise.pageErrors.push(errEntry);
        this.emitNoiseUpdate();
      }
    });

    // 3. Navigation handling
    wc.on("did-navigate", (_event, url) => {
      this.currentUrl = url;
      if (this.rendererWindow && !this.rendererWindow.isDestroyed()) {
        this.rendererWindow.webContents.send("recorder:navigated", {
          url,
          title: wc.getTitle(),
        });
      }

      if (this.isRecording) {
        // Record navigation step
        this.addStep({
          id: `step_${Date.now()}_nav`,
          action: "navigate",
          name: `Navigate to ${url}`,
          url,
          timestamp: Date.now(),
        });

        // Spec Requirement: "Also auto-add a URL assertion after each navigation."
        this.addStep({
          id: `step_${Date.now()}_assert_url`,
          action: "assert_url_contains",
          name: `Assert URL contains "${new URL(url).pathname}"`,
          value: new URL(url).pathname,
          url,
          timestamp: Date.now() + 1,
        });
      }
    });

    // 4. Capture failed network requests (4xx / 5xx)
    wc.session.webRequest.onCompleted((details) => {
      if (details.statusCode >= 400 && details.url.startsWith("http")) {
        const reqEntry = {
          url: details.url,
          method: details.method,
          status: details.statusCode,
          timestamp: Date.now(),
        };
        this.baselineNoise.failedRequests.push(reqEntry);
        this.emitNoiseUpdate();
      }
    });
  }

  public start(name: string) {
    this.isRecording = true;
    this.scenarioName = name.trim() || `Scenario ${new Date().toLocaleTimeString()}`;
    this.startUrl = this.currentUrl;
    this.steps = [];
    this.baselineNoise = {
      consoleErrors: [],
      failedRequests: [],
      pageErrors: [],
    };

    // If starting on an already loaded page, record the initial navigate step
    if (this.startUrl && this.startUrl !== "about:blank") {
      this.addStep({
        id: `step_${Date.now()}_start_nav`,
        action: "navigate",
        name: `Navigate to ${this.startUrl}`,
        url: this.startUrl,
        timestamp: Date.now(),
      });
    }

    // Inform embedded content script
    if (this.embeddedWebContents && !this.embeddedWebContents.isDestroyed()) {
      this.embeddedWebContents.send("recorder:set-recording", true);
    }

    this.emitStatusUpdate();
    return { success: true };
  }

  public stop(): { steps: RecordedStep[]; baselineNoise: BaselineNoise; scenario: Scenario } {
    this.isRecording = false;

    if (this.embeddedWebContents && !this.embeddedWebContents.isDestroyed()) {
      this.embeddedWebContents.send("recorder:set-recording", false);
    }

    const scenario: Scenario = {
      id: `scen_${Date.now()}`,
      name: this.scenarioName,
      startUrl: this.startUrl || this.currentUrl || "https://example.com",
      steps: [...this.steps],
      baselineNoise: { ...this.baselineNoise },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save scenario to SQLite database
    try {
      const db = getDatabase();
      const insert = db.prepare(`
        INSERT INTO scenarios (id, name, start_url, steps_json, baseline_noise_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        scenario.id,
        scenario.name,
        scenario.startUrl,
        JSON.stringify(scenario.steps),
        JSON.stringify(scenario.baselineNoise),
        scenario.createdAt,
        scenario.updatedAt
      );
      console.log(`💾 Scenario "${scenario.name}" saved to SQLite database (${scenario.steps.length} steps)`);
    } catch (e: any) {
      console.warn("Could not save scenario to SQLite:", e.message);
    }

    this.emitStatusUpdate();
    return { steps: this.steps, baselineNoise: this.baselineNoise, scenario };
  }

  public addStep(step: RecordedStep) {
    this.steps.push(step);
    if (this.rendererWindow && !this.rendererWindow.isDestroyed()) {
      this.rendererWindow.webContents.send("recorder:step-captured", step);
    }
  }

  public updateStep(index: number, updated: RecordedStep) {
    if (index >= 0 && index < this.steps.length) {
      this.steps[index] = updated;
    }
  }

  public deleteStep(index: number) {
    if (index >= 0 && index < this.steps.length) {
      this.steps.splice(index, 1);
    }
  }

  public reorderSteps(fromIndex: number, toIndex: number) {
    if (
      fromIndex >= 0 &&
      fromIndex < this.steps.length &&
      toIndex >= 0 &&
      toIndex < this.steps.length
    ) {
      const [item] = this.steps.splice(fromIndex, 1);
      this.steps.splice(toIndex, 0, item);
    }
  }

  public getSteps() {
    return [...this.steps];
  }

  public getStatus() {
    return {
      isRecording: this.isRecording,
      scenarioName: this.scenarioName,
      currentUrl: this.currentUrl,
    };
  }

  private emitNoiseUpdate() {
    if (this.rendererWindow && !this.rendererWindow.isDestroyed()) {
      this.rendererWindow.webContents.send("recorder:noise-captured", this.baselineNoise);
    }
  }

  private emitStatusUpdate() {
    if (this.rendererWindow && !this.rendererWindow.isDestroyed()) {
      this.rendererWindow.webContents.send("recorder:status-changed", {
        isRecording: this.isRecording,
        scenarioName: this.scenarioName,
      });
    }
  }
}

export const recordingSession = new RecordingSession();
