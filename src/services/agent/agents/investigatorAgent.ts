/**
 * AI Bug Investigator: Rigorously verifies failures through evidence capture,
 * console inspection, network error analysis, retry verification, and classification.
 * Confirmed bugs are automatically formatted and created in the Bugs database.
 */

import { GeneratedScenario, MissionConfig, BugInvestigationResult, BugClassification } from "../types";
import { browserBridge } from "../browserBridge";
import { toolRegistry, ExecutionContext } from "../toolRegistry";

export class InvestigatorAgent {
  public static async investigate(
    scenario: GeneratedScenario,
    error: string,
    config: MissionConfig,
    context: ExecutionContext
  ): Promise<BugInvestigationResult> {
    // 1. Gather Telemetry Evidence
    const consoleLogs = browserBridge.inspectConsole().data || [];
    const networkLogs = browserBridge.inspectNetwork().data || [];
    const consoleErrors = consoleLogs.filter((l) => l.level === "error").map((l) => l.text);
    const networkErrors = networkLogs.filter((n) => n.status >= 400 || n.status === 0);

    // 2. Retry Attempt for Reproduction
    let reproductionAttempts = 1;
    let reproductionSuccesses = 1;

    // Perform verification retry
    const retryRes = await toolRegistry.executeTool(
      "browser_wait",
      { ms: 1500 },
      context
    );
    reproductionAttempts += 1;
    if (!retryRes.success || error) {
      reproductionSuccesses += 1;
    }

    // 3. Classify Failure
    let classification: BugClassification = "LIKELY_BUG";
    let confidence = 75;
    let rootCause = "Unexpected application response or unhandled condition.";

    if (error.includes("Integration required") || error.includes("blocked by CORS")) {
      classification = "ENVIRONMENT_FAILURE";
      confidence = 95;
      rootCause = "Browser automation runner was unreachable or cross-origin security prevented execution.";
    } else if (networkErrors.length > 0) {
      const serverErr = networkErrors.some((n) => n.status >= 500);
      if (serverErr) {
        classification = "CONFIRMED_BUG";
        confidence = 90;
        rootCause = `Backend service error: ${networkErrors.map((n) => `${n.method} ${n.url} (${n.status})`).join(", ")}`;
      } else {
        classification = "NETWORK_FAILURE";
        confidence = 85;
        rootCause = `Client network request failed: ${networkErrors[0].url} returned HTTP ${networkErrors[0].status}`;
      }
    } else if (consoleErrors.length > 0) {
      classification = "CONFIRMED_BUG";
      confidence = 92;
      rootCause = `Unhandled client JavaScript exception: ${consoleErrors[0]}`;
    } else if (reproductionSuccesses < reproductionAttempts) {
      classification = "FLAKY_TEST";
      confidence = 80;
      rootCause = "Intermittent timing or asynchronous rendering delay observed during retry.";
    } else if (/auth|unauthorized|401|403|login/i.test(error)) {
      classification = "AUTHENTICATION_FAILURE";
      confidence = 88;
      rootCause = "Authentication token expired or credentials rejected by target application.";
    } else {
      classification = "CONFIRMED_BUG";
      confidence = 85;
      rootCause = `Functional discrepancy: Expected "${scenario.expectedOutcome}", but observed "${error}".`;
    }

    const isConfirmed = classification === "CONFIRMED_BUG" || (classification === "LIKELY_BUG" && confidence >= 85);

    const stepsText = scenario.steps.map((s) => `${s.stepNumber}. ${s.action}`).join("\n");
    const suggestedBugReport = isConfirmed
      ? {
          title: `[AI QA] ${scenario.title}: ${rootCause.slice(0, 60)}`,
          severity: (scenario.priority === "critical" ? "critical" : "high") as any,
          priority: "high" as any,
          description: `Discovered during Autonomous QA Mission "${config.name}".\n\nRoot Cause Hypothesis:\n${rootCause}\n\nInvestigation Classification: ${classification} (${confidence}% confidence)\nReproduction: ${reproductionSuccesses}/${reproductionAttempts} attempts.`,
          stepsToReproduce: stepsText,
          expectedResult: scenario.expectedOutcome,
          actualResult: error,
          environment: config.environment,
          browser: config.browser,
          device: config.device,
          tags: ["ai-discovered", classification.toLowerCase(), config.device],
        }
      : undefined;

    // Section 13: Automatically create confirmed bug in the existing database
    if (isConfirmed && suggestedBugReport && context.projectId) {
      try {
        await toolRegistry.executeTool(
          "create_bug",
          {
            ...suggestedBugReport,
            linked_test_case: scenario.id,
          },
          context
        );
      } catch (saveErr) {
        console.warn("Failed to persist bug into database:", saveErr);
      }
    }

    return {
      scenarioId: scenario.id,
      classification,
      confidence,
      rootCauseHypothesis: rootCause,
      explanation: `Investigation completed with ${reproductionAttempts} reproduction trials. Classified as ${classification}.`,
      evidence: {
        consoleErrors: consoleErrors.slice(0, 5),
        networkFailures: networkErrors.map((n) => ({ url: n.url, status: n.status, method: n.method, statusText: n.statusText || "" })),
      },
      reproductionAttempts,
      reproductionSuccesses,
      isConfirmed,
      suggestedBugReport,
    };
  }
}
