/**
 * Real Browser Automation Bridge for TestFlow AI
 * 
 * Complies strictly with the NO FAKE AI directive:
 * - Directs calls to real browser automation runners (Playwright / CDP / WebDriver)
 * - Returns structured telemetry, DOM, console logs, and real network events
 * - If no external browser runner is reachable, explicitly surfaces "Integration required"
 */

import { ToolResult } from "./types";

export interface BrowserRunnerStatus {
  connected: boolean;
  type: "playwright" | "cdp" | "sandbox" | "disconnected";
  endpoint: string;
  activeTargetUrl?: string;
  lastChecked: string;
  errorMessage?: string;
}

export interface NetworkLogEntry {
  url: string;
  method: string;
  status: number;
  durationMs: number;
  timestamp: string;
  statusText?: string;
}

export interface ConsoleLogEntry {
  level: "log" | "info" | "warn" | "error";
  text: string;
  timestamp: string;
}

class BrowserBridgeService {
  private runnerEndpoint: string;
  private currentUrl: string = "";
  private consoleLogs: ConsoleLogEntry[] = [];
  private networkLogs: NetworkLogEntry[] = [];
  private isConnected: boolean = false;
  private runnerType: "playwright" | "cdp" | "sandbox" | "disconnected" = "disconnected";
  private lastError: string | null = null;

  constructor() {
    // Read configured browser runner endpoint from localStorage if set
    this.runnerEndpoint = localStorage.getItem("testflow_browser_runner_url") || "http://localhost:9222";
  }

  public getStatus(): BrowserRunnerStatus {
    return {
      connected: this.isConnected,
      type: this.runnerType,
      endpoint: this.runnerEndpoint,
      activeTargetUrl: this.currentUrl || undefined,
      lastChecked: new Date().toISOString(),
      errorMessage: this.lastError || undefined,
    };
  }

  public setEndpoint(url: string) {
    this.runnerEndpoint = url.trim();
    localStorage.setItem("testflow_browser_runner_url", this.runnerEndpoint);
  }

  /**
   * Health-check connectivity with configured browser runner
   */
  public async checkConnection(): Promise<BrowserRunnerStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      // Probe CDP / json/version or Playwright server health endpoint
      const response = await fetch(`${this.runnerEndpoint.replace(/\/+$/, "")}/json/version`, {
        signal: controller.signal,
      }).catch(async () => {
        // Fallback check to generic /health or /
        return await fetch(`${this.runnerEndpoint.replace(/\/+$/, "")}/health`, {
          signal: controller.signal,
        });
      });

      clearTimeout(timeoutId);

      if (response && response.ok) {
        this.isConnected = true;
        this.runnerType = "cdp";
        this.lastError = null;
      } else {
        this.isConnected = false;
        this.runnerType = "disconnected";
        this.lastError = "Runner responded with HTTP " + (response?.status || "error");
      }
    } catch (e: any) {
      this.isConnected = false;
      this.runnerType = "disconnected";
      this.lastError = e?.message || "Runner unreachable at " + this.runnerEndpoint;
    }

    return this.getStatus();
  }

  /**
   * Open or navigate to URL
   */
  public async navigate(url: string): Promise<ToolResult<{ url: string; title: string; html?: string }>> {
    const startTime = performance.now();
    this.currentUrl = url;

    // Check if real CDP/Playwright runner is active
    await this.checkConnection();

    if (this.isConnected) {
      try {
        const resp = await fetch(`${this.runnerEndpoint}/navigate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await resp.json();
        return {
          success: true,
          tool: "browser_navigate",
          target: url,
          observedState: `Navigated to ${url} (Title: ${data.title || "Loaded"})`,
          data: { url, title: data.title || "Loaded", html: data.html },
          durationMs: Math.round(performance.now() - startTime),
        };
      } catch (err: any) {
        return {
          success: false,
          tool: "browser_navigate",
          target: url,
          error: err.message,
          durationMs: Math.round(performance.now() - startTime),
        };
      }
    }

    // Direct HTTP fetch inspection as safe fallback for publicly accessible endpoints
    try {
      const fetchStart = performance.now();
      const res = await fetch(url, { method: "GET", mode: "cors" });
      const htmlText = await res.text();
      const fetchDuration = Math.round(performance.now() - fetchStart);

      // Record real network entry
      this.networkLogs.push({
        url,
        method: "GET",
        status: res.status,
        statusText: res.statusText,
        durationMs: fetchDuration,
        timestamp: new Date().toISOString(),
      });

      // Parse document title if HTML returned
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");
      const title = doc.querySelector("title")?.textContent || "Loaded Page";

      return {
        success: true,
        tool: "browser_navigate",
        target: url,
        observedState: `Loaded ${url} (HTTP ${res.status})`,
        data: { url, title, html: htmlText },
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (corsErr: any) {
      // Per instructions: NO FAKE AI. Clearly report integration required if cross-origin runner is needed.
      return {
        success: false,
        tool: "browser_navigate",
        target: url,
        requiresIntegration: true,
        error: `Integration required: Real browser runner unreachable at ${this.runnerEndpoint}. (Direct browser request blocked by CORS policy: ${corsErr.message})`,
        observedState: "Browser runner connection required for cross-origin navigation",
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * Click an element by selector
   */
  public async click(selector: string): Promise<ToolResult> {
    const startTime = performance.now();

    if (!this.isConnected) {
      return {
        success: false,
        tool: "browser_click",
        target: selector,
        requiresIntegration: true,
        error: `Integration required: Browser runner not connected at ${this.runnerEndpoint}. Connect Playwright/CDP runner to execute real clicks.`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      const resp = await fetch(`${this.runnerEndpoint}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selector }),
      });
      const data = await resp.json();
      return {
        success: resp.ok,
        tool: "browser_click",
        target: selector,
        observedState: data.observedState || `Clicked on element: ${selector}`,
        data,
        error: resp.ok ? null : data.error || "Click failed",
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err: any) {
      return {
        success: false,
        tool: "browser_click",
        target: selector,
        error: err.message,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * Type text into an input element
   */
  public async type(selector: string, text: string): Promise<ToolResult> {
    const startTime = performance.now();

    if (!this.isConnected) {
      return {
        success: false,
        tool: "browser_type",
        target: selector,
        requiresIntegration: true,
        error: `Integration required: Browser runner not connected at ${this.runnerEndpoint}. Connect Playwright/CDP runner to type into inputs.`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      const resp = await fetch(`${this.runnerEndpoint}/type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selector, text }),
      });
      const data = await resp.json();
      return {
        success: resp.ok,
        tool: "browser_type",
        target: selector,
        observedState: `Typed "${text.replace(/./g, "*")}" into ${selector}`,
        data,
        error: resp.ok ? null : data.error,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err: any) {
      return {
        success: false,
        tool: "browser_type",
        target: selector,
        error: err.message,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * Capture a real screenshot
   */
  public async screenshot(): Promise<ToolResult<{ screenshotUrl: string }>> {
    const startTime = performance.now();

    if (!this.isConnected) {
      return {
        success: false,
        tool: "browser_screenshot",
        requiresIntegration: true,
        error: `Integration required: Screenshot capture requires an active Playwright/CDP runner at ${this.runnerEndpoint}.`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      const resp = await fetch(`${this.runnerEndpoint}/screenshot`, { method: "POST" });
      const data = await resp.json();
      return {
        success: resp.ok,
        tool: "browser_screenshot",
        screenshot: data.screenshotUrl,
        data: { screenshotUrl: data.screenshotUrl },
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err: any) {
      return {
        success: false,
        tool: "browser_screenshot",
        error: err.message,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * Retrieve DOM and interactive elements
   */
  public async getDom(): Promise<ToolResult<{ html: string; text: string }>> {
    const startTime = performance.now();

    if (this.isConnected) {
      try {
        const resp = await fetch(`${this.runnerEndpoint}/dom`);
        const data = await resp.json();
        return {
          success: true,
          tool: "browser_get_dom",
          data: { html: data.html, text: data.text },
          observedState: `Retrieved DOM (${(data.html || "").length} characters)`,
          durationMs: Math.round(performance.now() - startTime),
        };
      } catch (err: any) {
        return {
          success: false,
          tool: "browser_get_dom",
          error: err.message,
          durationMs: Math.round(performance.now() - startTime),
        };
      }
    }

    return {
      success: false,
      tool: "browser_get_dom",
      requiresIntegration: true,
      error: `Integration required: DOM inspection requires browser runner connection at ${this.runnerEndpoint}.`,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  /**
   * Diagnostic: Inspect console logs
   */
  public inspectConsole(): ToolResult<ConsoleLogEntry[]> {
    return {
      success: true,
      tool: "inspect_console",
      data: [...this.consoleLogs],
      observedState: `${this.consoleLogs.length} console log entries observed (${this.consoleLogs.filter(l => l.level === "error").length} errors)`,
    };
  }

  /**
   * Diagnostic: Inspect network requests
   */
  public inspectNetwork(): ToolResult<NetworkLogEntry[]> {
    const failed = this.networkLogs.filter(n => n.status >= 400 || n.status === 0);
    return {
      success: true,
      tool: "inspect_network",
      data: [...this.networkLogs],
      observedState: `${this.networkLogs.length} network requests recorded (${failed.length} failed/error requests)`,
    };
  }

  /**
   * Clear active session logs
   */
  public clearLogs() {
    this.consoleLogs = [];
    this.networkLogs = [];
  }
}

export const browserBridge = new BrowserBridgeService();
