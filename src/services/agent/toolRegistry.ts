/**
 * Structured Tool Registry for Autonomous AI QA Platform
 * 
 * Implements structured tool calling, argument validation,
 * database interactions with existing QA tables, and human approval gating.
 */

import { supabase } from "@/integrations/supabase/client";
import { browserBridge } from "./browserBridge";
import { ToolResult, HumanApprovalRequest } from "./types";

export interface ToolDefinition {
  name: string;
  category: "browser" | "diagnostic" | "qa" | "reporting";
  description: string;
  isDangerous?: boolean;
  requiresApproval?: (params: Record<string, any>, context: any) => boolean;
  execute: (params: Record<string, any>, context: ExecutionContext) => Promise<ToolResult>;
}

export interface ExecutionContext {
  missionId: string;
  projectId?: string;
  workspaceId?: string;
  userId?: string;
  environment?: string;
  approvedActionIds?: Set<string>;
  onApprovalRequired?: (req: HumanApprovalRequest) => Promise<boolean>;
}

class ToolRegistryService {
  private tools = new Map<string, ToolDefinition>();

  constructor() {
    this.registerBrowserTools();
    this.registerDiagnosticTools();
    this.registerQATools();
  }

  public register(def: ToolDefinition) {
    this.tools.set(def.name, def);
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Main tool invocation pipeline with human approval interceptor
   */
  public async executeTool(name: string, params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        tool: name,
        error: `Unknown tool: "${name}"`,
      };
    }

    // Check for high-risk / dangerous action requiring human approval
    const isRisky = tool.isDangerous || (tool.requiresApproval && tool.requiresApproval(params, context));
    const actionKey = `${context.missionId}_${name}_${JSON.stringify(params)}`;

    if (isRisky && !context.approvedActionIds?.has(actionKey)) {
      const approvalReq: HumanApprovalRequest = {
        id: `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        missionId: context.missionId,
        stepId: actionKey,
        action: `Execute tool: ${name}`,
        reason: params._reason || `Tool performs a critical or irreversible action in ${context.environment || "current"} environment.`,
        potentialImpact: params._potentialImpact || "May create external messages, modify production records, or alter persistent state.",
        tool: name,
        params,
        createdAt: new Date().toISOString(),
      };

      if (context.onApprovalRequired) {
        const approved = await context.onApprovalRequired(approvalReq);
        if (!approved) {
          return {
            success: false,
            tool: name,
            error: "Action rejected by human operator.",
            observedState: "Human approval rejected",
          };
        }
        context.approvedActionIds?.add(actionKey);
      } else {
        return {
          success: false,
          tool: name,
          error: "HUMAN_APPROVAL_REQUIRED: Action paused waiting for human authorization.",
          observedState: "Paused: Waiting for human approval",
        };
      }
    }

    try {
      return await tool.execute(params, context);
    } catch (err: any) {
      return {
        success: false,
        tool: name,
        error: err.message || "Tool execution failed",
      };
    }
  }

  /* ------------------- BROWSER TOOLS ------------------- */
  private registerBrowserTools() {
    this.register({
      name: "browser_open",
      category: "browser",
      description: "Opens a target URL in the real browser runner",
      execute: async ({ url }) => browserBridge.navigate(url),
    });

    this.register({
      name: "browser_navigate",
      category: "browser",
      description: "Navigates to a new page or route in the application",
      execute: async ({ url }) => browserBridge.navigate(url),
    });

    this.register({
      name: "browser_click",
      category: "browser",
      description: "Clicks on an interactive DOM element using a CSS or XPath selector",
      execute: async ({ selector }) => browserBridge.click(selector),
    });

    this.register({
      name: "browser_type",
      category: "browser",
      description: "Types characters into an input field or textarea",
      execute: async ({ selector, text }) => browserBridge.type(selector, text),
    });

    this.register({
      name: "browser_screenshot",
      category: "browser",
      description: "Captures a high-resolution screenshot of the current page viewport",
      execute: async () => browserBridge.screenshot(),
    });

    this.register({
      name: "browser_get_dom",
      category: "browser",
      description: "Extracts current DOM elements and visible hierarchy",
      execute: async () => browserBridge.getDom(),
    });

    this.register({
      name: "browser_wait",
      category: "browser",
      description: "Waits for a specified number of milliseconds or network idle",
      execute: async ({ ms = 1000 }) => {
        await new Promise((r) => setTimeout(r, ms));
        return {
          success: true,
          tool: "browser_wait",
          observedState: `Waited ${ms}ms`,
          data: { waitedMs: ms },
        };
      },
    });
  }

  /* ------------------- DIAGNOSTIC TOOLS ------------------- */
  private registerDiagnosticTools() {
    this.register({
      name: "inspect_console",
      category: "diagnostic",
      description: "Retrieves console logs, warnings, and unhandled JS exceptions",
      execute: async () => browserBridge.inspectConsole(),
    });

    this.register({
      name: "inspect_network",
      category: "diagnostic",
      description: "Retrieves network requests, response status codes, and latency",
      execute: async () => browserBridge.inspectNetwork(),
    });

    this.register({
      name: "inspect_api_response",
      category: "diagnostic",
      description: "Directly tests an API endpoint with custom method, headers, and payload",
      execute: async ({ url, method = "GET", headers = {}, body }) => {
        const start = performance.now();
        try {
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", ...headers },
            body: body ? JSON.stringify(body) : undefined,
          });
          const text = await res.text();
          let json: any = null;
          try { json = JSON.parse(text); } catch {}
          return {
            success: res.ok,
            tool: "inspect_api_response",
            target: url,
            durationMs: Math.round(performance.now() - start),
            data: { status: res.status, statusText: res.statusText, data: json || text },
            observedState: `API returned HTTP ${res.status}`,
          };
        } catch (err: any) {
          return {
            success: false,
            tool: "inspect_api_response",
            target: url,
            error: err.message,
            durationMs: Math.round(performance.now() - start),
          };
        }
      },
    });
  }

  /* ------------------- QA DATABASE TOOLS ------------------- */
  private registerQATools() {
    this.register({
      name: "create_test_case",
      category: "qa",
      description: "Persists a generated test case into the existing Test Cases database",
      execute: async ({ title, steps, expected_result, priority, type, preconditions }, ctx) => {
        if (!ctx.projectId) throw new Error("projectId is required in context");
        const { data, error } = await supabase.from("test_cases").insert({
          title,
          steps,
          expected_result,
          priority: priority || "medium",
          type: type || "functional",
          preconditions,
          project_id: ctx.projectId,
          owner_id: ctx.userId || "00000000-0000-0000-0000-000000000000",
        }).select().single();

        if (error) throw error;
        return {
          success: true,
          tool: "create_test_case",
          data,
          observedState: `Created Test Case: "${title}" (ID: ${data.id})`,
        };
      },
    });

    this.register({
      name: "create_bug",
      category: "qa",
      description: "Creates a confirmed bug report directly in the existing Bugs database",
      execute: async ({ title, description, severity, priority, steps_to_reproduce, expected_result, actual_result, linked_test_case, run_id, tags }, ctx) => {
        if (!ctx.projectId) throw new Error("projectId is required in context");
        const { data, error } = await supabase.from("bugs").insert({
          title,
          description,
          severity: severity || "medium",
          priority: priority || "medium",
          steps_to_reproduce,
          expected_result,
          actual_result,
          linked_test_case,
          run_id,
          project_id: ctx.projectId,
          owner_id: ctx.userId || "00000000-0000-0000-0000-000000000000",
          status: "open",
          tags: tags || ["ai-discovered", "mission"],
        }).select().single();

        if (error) throw error;
        return {
          success: true,
          tool: "create_bug",
          data,
          observedState: `Created Bug: "${title}" [${severity?.toUpperCase() || "MEDIUM"}]`,
        };
      },
    });

    this.register({
      name: "get_previous_bugs",
      category: "qa",
      description: "Retrieves past bugs for the active project to check for known regressions",
      execute: async ({ limit = 20 }, ctx) => {
        if (!ctx.projectId) return { success: true, tool: "get_previous_bugs", data: [] };
        const { data, error } = await supabase
          .from("bugs")
          .select("id, title, severity, status, linked_test_case")
          .eq("project_id", ctx.projectId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        return {
          success: true,
          tool: "get_previous_bugs",
          data: data || [],
          observedState: `Loaded ${data?.length || 0} existing project bugs`,
        };
      },
    });

    this.register({
      name: "get_previous_test_runs",
      category: "qa",
      description: "Retrieves past test runs and failure patterns for regression planning",
      execute: async ({ limit = 5 }, ctx) => {
        if (!ctx.projectId) return { success: true, tool: "get_previous_test_runs", data: [] };
        const { data, error } = await supabase
          .from("test_runs")
          .select("id, name, status, created_at")
          .eq("project_id", ctx.projectId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        return {
          success: true,
          tool: "get_previous_test_runs",
          data: data || [],
          observedState: `Loaded ${data?.length || 0} historical test runs`,
        };
      },
    });

    this.register({
      name: "send_notification_alert",
      category: "qa",
      description: "Dispatches external alert through configured Slack, Teams, Jira, or Email channels",
      isDangerous: true,
      requiresApproval: (params, ctx) => ctx.environment === "production",
      execute: async ({ title, message, link, providers }, ctx) => {
        const { data, error } = await supabase.functions.invoke("send-notification", {
          body: { title, message, link, providers },
        });
        if (error) throw error;
        return {
          success: true,
          tool: "send_notification_alert",
          data,
          observedState: `Sent notification alert: "${title}"`,
        };
      },
    });
  }
}

export const toolRegistry = new ToolRegistryService();
