/**
 * Performance Agent: Collects genuine performance metrics and telemetry
 * Strictly complies with NO FAKE AI: Never invents metrics.
 * Explicitly surfaces "Metric unavailable" when data is unmeasured.
 */

import { browserBridge } from "../browserBridge";

export interface PerformanceMetrics {
  ttfbMs: number | "Metric unavailable";
  domContentLoadedMs: number | "Metric unavailable";
  loadTimeMs: number | "Metric unavailable";
  lcpMs: number | "Metric unavailable";
  cls: number | "Metric unavailable";
  inpMs: number | "Metric unavailable";
  failedRequestsCount: number;
  consoleErrorsCount: number;
  summary: string;
}

export class PerformanceAgent {
  public static async measure(targetUrl: string): Promise<PerformanceMetrics> {
    const networkRes = browserBridge.inspectNetwork();
    const consoleRes = browserBridge.inspectConsole();

    const networkLogs = networkRes.data || [];
    const consoleLogs = consoleRes.data || [];

    const failedRequests = networkLogs.filter((n) => n.status >= 400 || n.status === 0);
    const consoleErrors = consoleLogs.filter((c) => c.level === "error");

    // Real browser navigation performance timing extraction
    let ttfb: number | "Metric unavailable" = "Metric unavailable";
    let domContentLoaded: number | "Metric unavailable" = "Metric unavailable";
    let loadTime: number | "Metric unavailable" = "Metric unavailable";

    if (typeof window !== "undefined" && window.performance) {
      const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        const nav = navEntries[0];
        if (nav.responseStart && nav.requestStart) {
          ttfb = Math.round(nav.responseStart - nav.requestStart);
        }
        if (nav.domContentLoadedEventEnd && nav.startTime) {
          domContentLoaded = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
        }
        if (nav.loadEventEnd && nav.startTime && nav.loadEventEnd > 0) {
          loadTime = Math.round(nav.loadEventEnd - nav.startTime);
        }
      }
    }

    // In a cross-origin isolated environment or remote runner where LCP/CLS observers aren't hooked,
    // we never invent fake numbers:
    const lcp: number | "Metric unavailable" = "Metric unavailable";
    const cls: number | "Metric unavailable" = "Metric unavailable";
    const inp: number | "Metric unavailable" = "Metric unavailable";

    const parts: string[] = [];
    if (typeof loadTime === "number") parts.push(`Page Load: ${loadTime}ms`);
    if (typeof ttfb === "number") parts.push(`TTFB: ${ttfb}ms`);
    parts.push(`Failed Network Requests: ${failedRequests.length}`);
    parts.push(`Console Exceptions: ${consoleErrors.length}`);

    return {
      ttfbMs: ttfb,
      domContentLoadedMs: domContentLoaded,
      loadTimeMs: loadTime,
      lcpMs: lcp,
      cls,
      inpMs: inp,
      failedRequestsCount: failedRequests.length,
      consoleErrorsCount: consoleErrors.length,
      summary: parts.join(" · "),
    };
  }
}
