/**
 * Browser Execution Agent: Executes test scenarios through structured browser tools,
 * observes state changes, detects failures, and applies self-healing locators.
 */

import { GeneratedScenario, MissionConfig, SelfHealingRecord } from "../types";
import { toolRegistry, ExecutionContext } from "../toolRegistry";
import { browserBridge } from "../browserBridge";
import { agentMemory } from "../memory";

export interface ExecutionResult {
  scenarioId: string;
  status: "passed" | "failed" | "blocked" | "skipped" | "flaky";
  durationMs: number;
  actualResult: string;
  failedStepIndex?: number;
  error?: string;
  screenshotUrl?: string;
  selfHealingEvents: SelfHealingRecord[];
}

export class ExecutionAgent {
  public static async executeScenario(
    scenario: GeneratedScenario,
    config: MissionConfig,
    context: ExecutionContext,
    onStepUpdate?: (stepNumber: number, action: string, status: "running" | "success" | "failed") => void
  ): Promise<ExecutionResult> {
    const startTime = performance.now();
    const healingEvents: SelfHealingRecord[] = [];
    let isHealed = false;

    // Check project memory for known healed locators for this project
    const projMem = config.projectId ? agentMemory.getProjectMemory(config.projectId) : undefined;

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      onStepUpdate?.(step.stepNumber, step.action, "running");

      // Check if selector was previously healed in project memory
      let activeSelector = step.selector;
      if (activeSelector && projMem?.healedLocators[activeSelector]) {
        activeSelector = projMem.healedLocators[activeSelector];
      }

      // Execute tool
      let res = await toolRegistry.executeTool(
        step.tool || "browser_wait",
        {
          url: config.targetUrl,
          selector: activeSelector,
          text: step.value || "test@example.com",
          ms: 1000,
        },
        context
      );

      // Section 15: Self-Healing Logic if selector failed
      if (!res.success && activeSelector && config.autoHealEnabled !== false) {
        // Attempt locator resolution heuristic (e.g. text/aria alternative)
        const healedSelector = this.findAlternativeLocator(activeSelector, step.action);
        if (healedSelector && healedSelector !== activeSelector) {
          const retryRes = await toolRegistry.executeTool(
            step.tool,
            { selector: healedSelector, text: step.value },
            context
          );

          if (retryRes.success) {
            res = retryRes;
            isHealed = true;
            const record: SelfHealingRecord = {
              id: `heal_${Date.now()}_${i}`,
              missionId: config.id,
              scenarioId: scenario.id,
              originalLocator: activeSelector,
              healedLocator: healedSelector,
              strategy: "fuzzy_label",
              confidence: 88,
              applied: true,
              timestamp: new Date().toISOString(),
            };
            healingEvents.push(record);
            if (config.projectId) {
              agentMemory.recordHealedLocator(config.projectId, activeSelector, healedSelector);
            }
          }
        }
      }

      if (!res.success) {
        onStepUpdate?.(step.stepNumber, step.action, "failed");
        return {
          scenarioId: scenario.id,
          status: res.requiresIntegration ? "blocked" : "failed",
          durationMs: Math.round(performance.now() - startTime),
          actualResult: res.error || "Action failed during execution",
          failedStepIndex: i,
          error: res.error || undefined,
          screenshotUrl: res.screenshot,
          selfHealingEvents: healingEvents,
        };
      }

      onStepUpdate?.(step.stepNumber, step.action, "success");
    }

    const totalDuration = Math.round(performance.now() - startTime);
    return {
      scenarioId: scenario.id,
      status: "passed",
      durationMs: totalDuration,
      actualResult: isHealed
        ? `Scenario completed successfully with ${healingEvents.length} self-healed selector(s)`
        : "All steps completed and expected conditions verified",
      selfHealingEvents: healingEvents,
    };
  }

  /**
   * Resilient locator heuristic for self-healing tests
   */
  private static findAlternativeLocator(original: string, actionText: string): string | null {
    // If ID selector failed, fallback to button text or name
    if (original.startsWith("#")) {
      const idName = original.slice(1);
      return `[data-testid="${idName}"], button:has-text("${idName}"), [name="${idName}"]`;
    }
    // If strict button text failed, check case-insensitive button or link
    if (original.includes("button")) {
      const match = actionText.match(/"([^"]+)"/);
      if (match) {
        return `button:has-text("${match[1]}"), a:has-text("${match[1]}")`;
      }
    }
    return null;
  }
}
