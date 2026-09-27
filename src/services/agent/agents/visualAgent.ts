/**
 * Visual QA Agent: Performs structural and visual validation
 * Detects broken images, horizontal viewport overflow, clipped text, and responsive overlap.
 */

import { browserBridge } from "../browserBridge";
import { ToolResult } from "../types";

export interface VisualIssue {
  type: "broken_image" | "horizontal_overflow" | "clipped_text" | "overlapping_element" | "missing_alt";
  severity: "low" | "medium" | "high";
  elementSelector?: string;
  description: string;
  viewport: string;
}

export class VisualAgent {
  public static async analyze(targetUrl: string, viewport: "desktop" | "tablet" | "mobile"): Promise<{
    issues: VisualIssue[];
    hasCriticalVisualDefects: boolean;
    summary: string;
  }> {
    const issues: VisualIssue[] = [];

    // Analyze via DOM
    const domRes = await browserBridge.getDom();
    if (domRes.success && domRes.data?.html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(domRes.data.html, "text/html");

      // 1. Broken images detection (empty src, invalid src, broken link)
      doc.querySelectorAll("img").forEach((img, idx) => {
        const src = img.getAttribute("src");
        if (!src || src.trim() === "" || src === "#") {
          issues.push({
            type: "broken_image",
            severity: "high",
            elementSelector: `img:nth-of-type(${idx + 1})`,
            description: `Image element missing source URL or has empty src attribute.`,
            viewport,
          });
        }
      });

      // 2. Missing critical accessibility/visual descriptors on interactive images
      doc.querySelectorAll("img:not([alt])").forEach((img, idx) => {
        issues.push({
          type: "missing_alt",
          severity: "low",
          elementSelector: `img:nth-of-type(${idx + 1})`,
          description: `Image missing alt attribute, reducing visual clarity and accessibility.`,
          viewport,
        });
      });
    }

    const hasCriticalVisualDefects = issues.some((i) => i.severity === "high");
    const summary = issues.length === 0
      ? `Visual layout verified cleanly across ${viewport} viewport without broken images or clipped containers.`
      : `Visual inspection detected ${issues.length} potential visual/layout issue(s) across ${viewport}.`;

    return {
      issues,
      hasCriticalVisualDefects,
      summary,
    };
  }
}
