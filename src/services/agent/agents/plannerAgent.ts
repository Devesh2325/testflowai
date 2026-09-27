/**
 * Planner Agent: Understands objective, establishes scope, prioritizes critical paths,
 * and generates structured execution strategy.
 */

import { supabase } from "@/integrations/supabase/client";
import { MissionConfig } from "../types";
import { agentMemory } from "../memory";

export interface ExecutionPlan {
  strategySummary: string;
  scopeSummary: string[];
  prioritizedWorkflows: { name: string; priority: "high" | "medium" | "low"; rationale: string }[];
  targetBreakpoints: ("desktop" | "tablet" | "mobile")[];
  estimatedSteps: number;
}

export class PlannerAgent {
  public static async createPlan(config: MissionConfig): Promise<ExecutionPlan> {
    const memoryContext = agentMemory.getRelevantContext(config.projectId, config.targetUrl, config.objective);

    const prompt = `You are a Principal QA Strategy Engineer.
Target Application URL: ${config.targetUrl}
Objective: ${config.objective}
Environment: ${config.environment}
Browser: ${config.browser}
Device: ${config.device}
Scope: ${config.scope.join(", ")}
${memoryContext ? `Project History & Memory:\n${memoryContext}` : ""}

Produce a structured testing plan as JSON with keys:
- strategySummary (string: 2-3 sentences explaining testing strategy)
- scopeSummary (array of strings: key testing areas to focus on)
- prioritizedWorkflows (array of objects: { name, priority, rationale })
- targetBreakpoints (array of "desktop" | "tablet" | "mobile")
- estimatedSteps (number: realistic count between 5 and 20)

Return ONLY valid JSON.`;

    try {
      // Invoke generate-test-cases or direct Edge Function with JSON response
      const { data, error } = await supabase.functions.invoke("generate-test-cases", {
        body: { requirement: prompt, count: 1, format: "standard" },
      });

      if (!error && data?.strategySummary) {
        return data as ExecutionPlan;
      }
    } catch {}

    // Fallback deterministic strategy builder based on mission scope and objective
    const isAuthFocused = /login|signup|auth|register|password/i.test(config.objective);
    const isFormFocused = config.scope.includes("form") || /form|submit|checkout/i.test(config.objective);

    const workflows = [];
    if (isAuthFocused) {
      workflows.push(
        { name: "Authentication Form Validation", priority: "high" as const, rationale: "Critical security gate preventing unauthorized access" },
        { name: "Positive Credentials Submission", priority: "high" as const, rationale: "Core user journey to access authenticated dashboard" },
        { name: "Negative Credential Error Feedback", priority: "medium" as const, rationale: "Ensure graceful error messaging on bad inputs" }
      );
    } else if (isFormFocused) {
      workflows.push(
        { name: "Form Field Constraint Validation", priority: "high" as const, rationale: "Verify required fields and input format masks" },
        { name: "Valid Form Submission", priority: "high" as const, rationale: "Happy path end-to-end data submission" }
      );
    } else {
      workflows.push(
        { name: "Core Page Navigation & Layout", priority: "high" as const, rationale: "Validate main viewport rendering and navigation links" },
        { name: "Interactive Element Responsiveness", priority: "medium" as const, rationale: "Confirm buttons, inputs, and modals respond properly" }
      );
    }

    return {
      strategySummary: `Autonomous QA evaluation of ${config.targetUrl} targeting "${config.objective}" across ${config.device} viewport in ${config.environment}.`,
      scopeSummary: config.scope.map(s => `${s.toUpperCase()} Testing`),
      prioritizedWorkflows: workflows,
      targetBreakpoints: [config.device],
      estimatedSteps: Math.max(6, workflows.length * 3),
    };
  }
}
