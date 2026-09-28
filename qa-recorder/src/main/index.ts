/**
 * Electron Main Process for QA Recorder
 * Manages the shell window, embedded browser WebContentsView, and IPC dispatch.
 */

import { app, BrowserWindow, WebContentsView, ipcMain, BaseWindow } from "electron";
import path from "node:path";
import { recordingSession } from "./recorder";
import { getDatabase } from "./db";
import { RunnerBounds } from "./types";

let mainWindow: BrowserWindow | null = null;
let embeddedView: any = null; // WebContentsView or BrowserView fallback

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: "QA Recorder",
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  recordingSession.setRendererWindow(mainWindow);

  // Determine preload path for the embedded browser view
  const injectedPreloadPath = path.join(__dirname, "../preload/recorder-injected.js");

  // Create Embedded Browser View
  const viewWebPreferences = {
    preload: injectedPreloadPath,
    contextIsolation: false, // Allows easy DOM listening and context menu injection
    nodeIntegration: false,
    sandbox: false,
  };

  try {
    // Modern Electron: WebContentsView
    embeddedView = new WebContentsView({ webPreferences: viewWebPreferences });
    (mainWindow.contentView as any).addChildView(embeddedView);
    console.log("🖥️  Embedded WebContentsView initialized");
  } catch (err: any) {
    console.warn("Falling back to BrowserView:", err.message);
    const { BrowserView } = require("electron");
    embeddedView = new BrowserView({ webPreferences: viewWebPreferences });
    mainWindow.setBrowserView(embeddedView);
  }

  // Connect webContents to recording session
  recordingSession.setEmbeddedWebContents(embeddedView.webContents);

  // Initial load
  embeddedView.webContents.loadURL("https://example.com");

  // Set default bounds
  const [winWidth, winHeight] = mainWindow.getSize();
  const defaultBounds: RunnerBounds = {
    x: 0,
    y: 56, // height of top URL bar
    width: Math.floor(winWidth * 0.62), // 62% for browser, 38% for recording panel
    height: winHeight - 56,
  };
  embeddedView.setBounds(defaultBounds);

  // Handle window resizing
  mainWindow.on("resize", () => {
    if (!mainWindow || !embeddedView) return;
    const [w, h] = mainWindow.getSize();
    const currentBounds = embeddedView.getBounds();
    embeddedView.setBounds({
      x: 0,
      y: currentBounds.y || 56,
      width: Math.floor(w * 0.62),
      height: h - (currentBounds.y || 56),
    });
  });

  // Load React UI
  const devServerUrl = process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    embeddedView = null;
  });
}

// -------------------------------------------------------------
// IPC HANDLERS
// -------------------------------------------------------------

// Navigate embedded browser
ipcMain.handle("recorder:navigate", async (_event, targetUrl: string) => {
  if (!embeddedView) return { success: false, url: targetUrl };
  let url = targetUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    await embeddedView.webContents.loadURL(url);
    return { success: true, url };
  } catch (e: any) {
    return { success: false, error: e.message, url };
  }
});

// Browser controls
ipcMain.handle("recorder:go-back", () => {
  if (embeddedView?.webContents?.canGoBack()) {
    embeddedView.webContents.goBack();
  }
});

ipcMain.handle("recorder:go-forward", () => {
  if (embeddedView?.webContents?.canGoForward()) {
    embeddedView.webContents.goForward();
  }
});

ipcMain.handle("recorder:reload", () => {
  embeddedView?.webContents?.reload();
});

// Update bounds from React UI (e.g. when panel is resized)
ipcMain.handle("recorder:update-bounds", (_event, bounds: RunnerBounds) => {
  if (embeddedView) {
    embeddedView.setBounds(bounds);
  }
});

// Recording controls
ipcMain.handle("recorder:start", (_event, { scenarioName }) => {
  return recordingSession.start(scenarioName);
});

ipcMain.handle("recorder:stop", () => {
  return recordingSession.stop();
});

// Step management
ipcMain.handle("recorder:add-step", (_event, step) => {
  recordingSession.addStep(step);
});

ipcMain.handle("recorder:update-step", (_event, { index, step }) => {
  recordingSession.updateStep(index, step);
});

ipcMain.handle("recorder:delete-step", (_event, index) => {
  recordingSession.deleteStep(index);
});

ipcMain.handle("recorder:reorder-steps", (_event, { fromIndex, toIndex }) => {
  recordingSession.reorderSteps(fromIndex, toIndex);
});

// Bridge step from injected content script to recording session
ipcMain.on("recorder:step-captured", (_event, stepPayload) => {
  const fullStep = {
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...stepPayload,
  };
  recordingSession.addStep(fullStep);
});

// App Lifecycle
app.whenReady().then(() => {
  getDatabase(); // initialize SQLite
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
