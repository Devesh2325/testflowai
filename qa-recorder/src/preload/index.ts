/**
 * Preload script for QA Recorder React Shell UI
 * Exposes type-safe APIs for embedded browser control, recording, and step management.
 */

import { contextBridge, ipcRenderer } from "electron";
import { RecordedStep, BaselineNoise, RunnerBounds } from "../types";

export interface QARecorderAPI {
  navigate: (url: string) => Promise<{ success: boolean; url: string }>;
  startRecording: (scenarioName: string) => Promise<{ success: boolean }>;
  stopRecording: () => Promise<{ steps: RecordedStep[]; baselineNoise: BaselineNoise }>;
  updateBounds: (bounds: RunnerBounds) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  reload: () => Promise<void>;
  addManualStep: (step: RecordedStep) => Promise<void>;
  updateStep: (index: number, step: RecordedStep) => Promise<void>;
  deleteStep: (index: number) => Promise<void>;
  reorderSteps: (fromIndex: number, toIndex: number) => Promise<void>;
  onStepCaptured: (callback: (step: RecordedStep) => void) => () => void;
  onNavigated: (callback: (data: { url: string; title: string }) => void) => () => void;
  onNoiseCaptured: (callback: (noise: BaselineNoise) => void) => () => void;
  onStatusChanged: (callback: (status: { isRecording: boolean; scenarioName: string }) => void) => () => void;
}

const api: QARecorderAPI = {
  navigate: (url: string) => ipcRenderer.invoke("recorder:navigate", url),
  startRecording: (scenarioName: string) => ipcRenderer.invoke("recorder:start", { scenarioName }),
  stopRecording: () => ipcRenderer.invoke("recorder:stop"),
  updateBounds: (bounds: RunnerBounds) => ipcRenderer.invoke("recorder:update-bounds", bounds),
  goBack: () => ipcRenderer.invoke("recorder:go-back"),
  goForward: () => ipcRenderer.invoke("recorder:go-forward"),
  reload: () => ipcRenderer.invoke("recorder:reload"),
  addManualStep: (step: RecordedStep) => ipcRenderer.invoke("recorder:add-step", step),
  updateStep: (index: number, step: RecordedStep) => ipcRenderer.invoke("recorder:update-step", { index, step }),
  deleteStep: (index: number) => ipcRenderer.invoke("recorder:delete-step", index),
  reorderSteps: (fromIndex: number, toIndex: number) => ipcRenderer.invoke("recorder:reorder-steps", { fromIndex, toIndex }),

  onStepCaptured: (callback) => {
    const subscription = (_event: any, step: RecordedStep) => callback(step);
    ipcRenderer.on("recorder:step-captured", subscription);
    return () => ipcRenderer.removeListener("recorder:step-captured", subscription);
  },

  onNavigated: (callback) => {
    const subscription = (_event: any, data: { url: string; title: string }) => callback(data);
    ipcRenderer.on("recorder:navigated", subscription);
    return () => ipcRenderer.removeListener("recorder:navigated", subscription);
  },

  onNoiseCaptured: (callback) => {
    const subscription = (_event: any, noise: BaselineNoise) => callback(noise);
    ipcRenderer.on("recorder:noise-captured", subscription);
    return () => ipcRenderer.removeListener("recorder:noise-captured", subscription);
  },

  onStatusChanged: (callback) => {
    const subscription = (_event: any, status: { isRecording: boolean; scenarioName: string }) => callback(status);
    ipcRenderer.on("recorder:status-changed", subscription);
    return () => ipcRenderer.removeListener("recorder:status-changed", subscription);
  },
};

contextBridge.exposeInMainWorld("qaRecorder", api);
