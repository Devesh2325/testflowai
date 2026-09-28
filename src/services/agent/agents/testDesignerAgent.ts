/**
 * Test Designer Agent: Generates comprehensive, atomic, prioritized test scenarios
 * covering Functional, UI, Responsive, Form, and Regression scopes.
 *
 * FULLY AUTONOMOUS:
 * Automatically inspects the discovered application footprint (pages, forms, interactive elements,
 * responsive viewports, and active scopes) to generate the complete optimal test suite
 * without requiring manual scenario count inputs.
 */

import { supabase } from "@/integrations/supabase/client";
import { GeneratedScenario, MissionConfig, ApplicationMap } from "../types";

export class TestDesignerAgent {
  public static async designScenarios(
    config: MissionConfig,
    appMap: ApplicationMap
  ): Promise<GeneratedScenario[]> {
    const pages = appMap.pages || [];
    const primaryPage = pages[0];
    const allForms = pages.flatMap((p) => p.forms || []);
    const allElements = pages.flatMap((p) => p.elements || []);

    const elementsSummary = (primaryPage?.elements || [])
      .slice(0, 20)
      .map((e) => `${e.tag}${e.label ? ` "${e.label}"` : ""}${e.selector ? ` (${e.selector})` : ""}`)
      .join(", ");

    const formsSummary = allForms
      .map((f, i) => `Form #${i + 1} (${f.selector}) with ${f.inputs.length} inputs: [${f.inputs.map((inpt) => inpt.name || inpt.type).join(", ")}]`)
      .join("; ");

    const prompt = `You are a Principal Autonomous QA Test Designer.
Analyze this discovered application footprint and automatically generate the comprehensive, complete test suite required to achieve 100% functional, boundary, UI, and regression coverage for the mission objective and scope.

Application Target: ${config.targetUrl}
Mission Objective: ${config.objective}
Environment: ${config.environment}
Target Device: ${config.device}
Selected Scopes: ${config.scope.join(", ")}
Discovered Footprint:
- Pages (${pages.length}): ${pages.map((p) => p.url).join(", ") || config.targetUrl}
- Forms (${allForms.length}): ${formsSummary || "No explicit forms detected"}
- Interactive Elements (${allElements.length}): ${elementsSummary || "Standard web interface"}

Autonomous Generation Rules:
1. Do NOT constrain yourself to a fixed count. Generate all necessary test scenarios to thoroughly validate the application based on its actual discovered footprint.
2. Generate Positive Happy Path flows for the main user objective.
3. If forms exist or "form" is in scope, generate input validations, boundary cases, and submission handling.
4. If "responsive" or "ui" is in scope, include viewport adaptability and layout verification for ${config.device}.
5. If "api" or "performance" is in scope, include network status code and latency resilience checks.
6. Include negative test cases, edge cases, and runtime console error immunity.

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
        body: { requirement: prompt, format: "both" },
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
            selector: (primaryPage?.elements[sIdx]?.selector) || "body",
            expectedResult: tc.expected_result || "Action completes successfully without error",
          })),
          expectedOutcome: tc.expected_result || "Application behaves according to specification",
          gherkin: tc.gherkin,
          status: "pending",
        }));
      }
    } catch (e) {
      console.warn("AI edge function test case generation bypassed or offline, building autonomous footprint scenarios:", e);
    }

    // Dynamic, autonomous scenario generation based on discovered application footprint
    const scenarios: GeneratedScenario[] = [];

    // 1. Primary Happy Path Scenario
    scenarios.push({
      id: `scen_${config.id}_${scenarios.length + 1}`,
      missionId: config.id,
      title: `Critical Happy Path: ${config.objective.slice(0, 50)}`,
      category: "functional",
      priority: "critical",
      preconditions: `Navigate to target ${config.targetUrl}`,
      steps: [
        { stepNumber: 1, action: "Open target application URL", tool: "browser_navigate", selector: "body", expectedResult: "Page returns HTTP 200 and document renders" },
        { stepNumber: 2, action: "Wait for primary interactive controls to be visible and interactive", tool: "browser_wait", selector: "input, button, a", expectedResult: "Interactive fields enabled and responsive" },
        { stepNumber: 3, action: "Perform core action flow matching user objective", tool: "browser_click", selector: primaryPage?.forms[0]?.submitButton?.selector || "button, a", expectedResult: "Expected state update or route navigation occurs" },
      ],
      expectedOutcome: "Primary user objective completes successfully without error",
      status: "pending",
    });

    // 2. Form & Input Validation Scenarios (if forms discovered or form scope enabled)
    if (allForms.length > 0 || config.scope.includes("form") || config.scope.includes("functional")) {
      const firstForm = allForms[0];
      scenarios.push({
        id: `scen_${config.id}_${scenarios.length + 1}`,
        missionId: config.id,
        title: `Form Boundary & Validation: ${firstForm ? `Form (${firstForm.selector})` : "Interactive Input Controls"}`,
        category: "boundary",
        priority: "high",
        preconditions: `Form is visible on ${config.targetUrl}`,
        steps: [
          { stepNumber: 1, action: "Attempt submission with empty or unformatted fields", tool: "browser_click", selector: firstForm?.submitButton?.selector || "button[type='submit'], button", expectedResult: "Validation cues or required field prompts trigger" },
          { stepNumber: 2, action: "Verify invalid input prevents illegal submission", tool: "browser_wait", selector: firstForm?.selector || "form, body", expectedResult: "No unhandled 500 error or page crash" },
        ],
        expectedOutcome: "Form enforces boundary rules and provides clear validation cues",
        status: "pending",
      });
    }

    // 3. Navigation & Route Traversal Scenario (if multiple pages or navigation elements discovered)
    if (pages.length > 1 || allElements.some((e) => e.tag === "a" || e.tag === "nav")) {
      const targetNav = allElements.find((e) => e.tag === "a" && e.label) || { selector: "a", label: "Navigation Link" };
      scenarios.push({
        id: `scen_${config.id}_${scenarios.length + 1}`,
        title: `Navigation Integrity: Route Transitions & Breadcrumb Verification`,
        category: "functional",
        priority: "medium",
        preconditions: `Application ready at ${config.targetUrl}`,
        steps: [
          { stepNumber: 1, action: `Click navigation element (${targetNav.label || targetNav.selector})`, tool: "browser_click", selector: targetNav.selector || "a", expectedResult: "Navigation triggers without broken 404 links" },
          { stepNumber: 2, action: "Verify route history and URL update", tool: "browser_wait", selector: "body", expectedResult: "New route component mounts cleanly" },
        ],
        expectedOutcome: "Navigation links route properly without dead ends or missing views",
        status: "pending",
      });
    }

    // 4. Interactive Control & State Scenarios (for discovered buttons/inputs)
    const buttons = allElements.filter((e) => e.tag === "button" && e.label);
    if (buttons.length > 0) {
      const sampleBtn = buttons[0];
      scenarios.push({
        id: `scen_${config.id}_${scenarios.length + 1}`,
        missionId: config.id,
        title: `Interactive Action Flow: Button State & Event Dispatch ("${sampleBtn.label}")`,
        category: "functional",
        priority: "high",
        preconditions: `Interactive button rendered on ${config.targetUrl}`,
        steps: [
          { stepNumber: 1, action: `Dispatch click event on "${sampleBtn.label}"`, tool: "browser_click", selector: sampleBtn.selector || "button", expectedResult: "Button handles click event and updates UI state" },
          { stepNumber: 2, action: "Verify state change and button remains active", tool: "browser_wait", selector: sampleBtn.selector || "button", expectedResult: "No UI freezing or unresponsive thread" },
        ],
        expectedOutcome: "Interactive buttons respond promptly with expected visual feedback",
        status: "pending",
      });
    }

    // 5. Responsive & Layout Viewport Verification (if UI or responsive scope)
    if (config.scope.includes("responsive") || config.scope.includes("ui")) {
      scenarios.push({
        id: `scen_${config.id}_${scenarios.length + 1}`,
        missionId: config.id,
        title: `Responsive Viewport Adaptability (${config.device.toUpperCase()})`,
        category: "responsive",
        priority: "medium",
        preconditions: `Viewport set to ${config.device} profile`,
        steps: [
          { stepNumber: 1, action: `Inspect layout boundaries on ${config.device}`, tool: "browser_wait", selector: "body", expectedResult: "document.scrollWidth <= window.innerWidth with zero unwanted horizontal overflow" },
          { stepNumber: 2, action: "Capture visual viewport snapshot for layout inspection", tool: "browser_screenshot", expectedResult: "Elements remain properly sized, legible, and unclipped" },
        ],
        expectedOutcome: `UI adapts cleanly to ${config.device} viewport with no layout shifts or clipped elements`,
        status: "pending",
      });
    }

    // 6. Non-Functional & Runtime Exception Immunity (Console & Network error checks)
    scenarios.push({
      id: `scen_${config.id}_${scenarios.length + 1}`,
      missionId: config.id,
      title: "Runtime Stability & Console Exception Immunity",
      category: "edge",
      priority: "high",
      preconditions: `Application initialized at ${config.targetUrl}`,
      steps: [
        { stepNumber: 1, action: "Inspect active browser console for unhandled runtime exceptions", tool: "inspect_console", expectedResult: "Zero uncaught TypeError, ReferenceError, or fatal React exceptions" },
        { stepNumber: 2, action: "Verify no critical asset load failures (4xx / 5xx scripts/stylesheets)", tool: "inspect_network", expectedResult: "Critical resources load with HTTP 200 or 304" },
      ],
      expectedOutcome: "Application operates cleanly without throwing unhandled exceptions in the runtime console",
      status: "pending",
    });

    // 7. API / Performance Resiliency (if API or Performance scope enabled)
    if (config.scope.includes("api") || config.scope.includes("performance")) {
      scenarios.push({
        id: `scen_${config.id}_${scenarios.length + 1}`,
        missionId: config.id,
        title: "API Network Telemetry & Performance Resilience",
        category: "regression",
        priority: "medium",
        preconditions: `Network telemetry active on ${config.targetUrl}`,
        steps: [
          { stepNumber: 1, action: "Measure backend REST/GraphQL response latencies", tool: "inspect_network", expectedResult: "API requests resolve within acceptable SLAs (< 1500ms)" },
          { stepNumber: 2, action: "Validate payload integrity and response statuses", tool: "inspect_network", expectedResult: "Zero unhandled 500 Internal Server Errors" },
        ],
        expectedOutcome: "Backend network requests resolve efficiently with healthy HTTP status codes",
        status: "pending",
      });
    }

    return scenarios;
  }
}
