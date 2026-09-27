/**
 * Test Designer Agent: Generates comprehensive, atomic, prioritized test scenarios
 * covering Functional, UI, Responsive, and Regression scopes.
 */

import { supabase } from "@/integrations/supabase/client";
import { GeneratedScenario, MissionConfig, ApplicationMap } from "../types";

export class TestDesignerAgent {
  public static async designScenarios(
    config: MissionConfig,
    appMap: ApplicationMap
  ): Promise<GeneratedScenario[]> {
    const page = appMap.pages[0];
    const elementsSummary = (page?.elements || [])
      .slice(0, 15)
      .map((e) => `${e.tag}${e.label ? ` "${e.label}"` : ""}${e.selector ? ` (${e.selector})` : ""}`)
      .join(", ");

    const prompt = `You are a Lead QA Test Designer.
Generate a structured test suite for this application:
URL: ${config.targetUrl}
Objective: ${config.objective}
Scope: ${config.scope.join(", ")}
Target Viewport: ${config.device}
Discovered Elements: ${elementsSummary || "Standard web interface"}

Generate between 3 and ${config.maxTestCases || 6} detailed test scenarios.
Each scenario MUST have:
- title (string)
- category ("functional" | "ui" | "responsive" | "regression" | "boundary" | "edge")
- priority ("critical" | "high" | "medium" | "low")
- preconditions (string)
- expectedOutcome (string)
- steps (array of { stepNumber, action, tool, selector, value, expectedResult })
- gherkin (Feature/Scenario BDD text)

Tools can be: "browser_navigate", "browser_click", "browser_type", "browser_wait", "browser_screenshot"`;

    try {
      const { data, error } = await supabase.functions.invoke("generate-test-cases", {
        body: { requirement: prompt, count: config.maxTestCases || 5, format: "both" },
      });

      if (!error && Array.isArray(data?.test_cases) && data.test_cases.length > 0) {
        return data.test_cases.map((tc: any, idx: number) => ({
          id: `scen_${config.id}_${idx + 1}`,
          missionId: config.id,
          title: tc.title || `Scenario ${idx + 1}`,
          category: (tc.type || "functional") as any,
          priority: (tc.priority || "high") as any,
          preconditions: tc.preconditions || `Application loaded at ${config.targetUrl}`,
          steps: (typeof tc.steps === "string" ? tc.steps.split("\n").filter(Boolean) : ["Navigate to application", "Verify interactive elements"]).map((s: string, sIdx: number) => ({
            stepNumber: sIdx + 1,
            action: s,
            tool: s.toLowerCase().includes("click") ? "browser_click" : s.toLowerCase().includes("type") || s.toLowerCase().includes("enter") ? "browser_type" : "browser_navigate",
            selector: (page?.elements[sIdx]?.selector) || "body",
            expectedResult: tc.expected_result || "Action completes successfully without error",
          })),
          expectedOutcome: tc.expected_result || "Application behaves according to specification",
          gherkin: tc.gherkin,
          status: "pending",
        }));
      }
    } catch {}

    // Deterministic fallback scenarios based on user objective
    const scenarios: GeneratedScenario[] = [
      {
        id: `scen_${config.id}_1`,
        missionId: config.id,
        title: `Positive Happy Path: ${config.objective.slice(0, 50)}`,
        category: "functional",
        priority: "critical",
        preconditions: `Navigate to ${config.targetUrl}`,
        steps: [
          { stepNumber: 1, action: "Open application target URL", tool: "browser_navigate", selector: "body", expectedResult: "Page HTTP 200 and document renders" },
          { stepNumber: 2, action: "Verify primary input controls are visible", tool: "browser_wait", selector: "input, button", expectedResult: "Interactive fields enabled" },
          { stepNumber: 3, action: "Perform primary interaction flow", tool: "browser_click", selector: page?.forms[0]?.submitButton?.selector || "button", expectedResult: "State update or navigation occurs" },
        ],
        expectedOutcome: "Primary user objective completes successfully",
        status: "pending",
      },
      {
        id: `scen_${config.id}_2`,
        missionId: config.id,
        title: `Negative & Boundary Validation: Empty or Invalid Inputs`,
        category: "edge",
        priority: "high",
        preconditions: `Application ready at ${config.targetUrl}`,
        steps: [
          { stepNumber: 1, action: "Submit required form with empty inputs", tool: "browser_click", selector: "button[type='submit'], button", expectedResult: "Validation message surfaces" },
          { stepNumber: 2, action: "Verify no unhandled runtime console exceptions", tool: "inspect_console", expectedResult: "0 unhandled exceptions in console" },
        ],
        expectedOutcome: "Helpful error messages are displayed and invalid submission is blocked",
        status: "pending",
      },
      {
        id: `scen_${config.id}_3`,
        missionId: config.id,
        title: `Viewport & Responsive Layout Check (${config.device.toUpperCase()})`,
        category: "responsive",
        priority: "medium",
        preconditions: `Viewport set to ${config.device}`,
        steps: [
          { stepNumber: 1, action: "Verify no horizontal viewport overflow", tool: "browser_wait", selector: "body", expectedResult: "document.scrollWidth <= window.innerWidth" },
          { stepNumber: 2, action: "Verify touch target sizes and text visibility", tool: "browser_screenshot", expectedResult: "Elements properly spaced and legible" },
        ],
        expectedOutcome: "UI adapts cleanly to the target viewport without overlap or clipping",
        status: "pending",
      },
    ];

    return scenarios;
  }
}
