/**
 * Agent Memory System: Two-level memory (Project Memory & Mission Memory)
 * 
 * Efficiently indexes context so the agent retrieves relevant data only.
 */

import { ApplicationMap, SelfHealingRecord, BugInvestigationResult, GeneratedScenario } from "./types";

export interface ProjectMemoryData {
  projectId: string;
  applicationMap?: ApplicationMap;
  knownWorkflows: string[];
  unstableModules: string[];
  healedLocators: Record<string, string>; // original -> healed
  authFlows: { loginUrl?: string; lastSuccessfulForm?: string };
  lastUpdated: string;
}

export interface MissionMemoryData {
  missionId: string;
  goal: string;
  planSummary?: string;
  completedActions: { action: string; tool?: string; timestamp: string }[];
  observedFailures: { scenarioId: string; error: string; count: number }[];
  investigations: BugInvestigationResult[];
  decisions: string[];
}

class AgentMemoryService {
  private projectCache = new Map<string, ProjectMemoryData>();
  private missionCache = new Map<string, MissionMemoryData>();

  /**
   * Load or initialize Project Memory
   */
  public getProjectMemory(projectId: string): ProjectMemoryData {
    if (!this.projectCache.has(projectId)) {
      const stored = localStorage.getItem(`testflow_mem_proj_${projectId}`);
      if (stored) {
        try {
          this.projectCache.set(projectId, JSON.parse(stored));
        } catch {}
      }

      if (!this.projectCache.has(projectId)) {
        this.projectCache.set(projectId, {
          projectId,
          knownWorkflows: [],
          unstableModules: [],
          healedLocators: {},
          authFlows: {},
          lastUpdated: new Date().toISOString(),
        });
      }
    }
    return this.projectCache.get(projectId)!;
  }

  /**
   * Save updated Project Memory
   */
  public saveProjectMemory(data: ProjectMemoryData) {
    data.lastUpdated = new Date().toISOString();
    this.projectCache.set(data.projectId, data);
    try {
      localStorage.setItem(`testflow_mem_proj_${data.projectId}`, JSON.stringify(data));
    } catch {}
  }

  /**
   * Initialize or retrieve Mission Memory
   */
  public getMissionMemory(missionId: string, goal: string = ""): MissionMemoryData {
    if (!this.missionCache.has(missionId)) {
      this.missionCache.set(missionId, {
        missionId,
        goal,
        completedActions: [],
        observedFailures: [],
        investigations: [],
        decisions: [],
      });
    }
    return this.missionCache.get(missionId)!;
  }

  /**
   * Record action in Mission Memory
   */
  public recordMissionAction(missionId: string, action: string, tool?: string) {
    const mem = this.getMissionMemory(missionId);
    mem.completedActions.push({
      action,
      tool,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record failure or observation
   */
  public recordFailure(missionId: string, scenarioId: string, error: string) {
    const mem = this.getMissionMemory(missionId);
    const existing = mem.observedFailures.find((f) => f.scenarioId === scenarioId);
    if (existing) {
      existing.count += 1;
      existing.error = error;
    } else {
      mem.observedFailures.push({ scenarioId, error, count: 1 });
    }
  }

  /**
   * Record healed locator into Project Memory
   */
  public recordHealedLocator(projectId: string, original: string, healed: string) {
    const projMem = this.getProjectMemory(projectId);
    projMem.healedLocators[original] = healed;
    this.saveProjectMemory(projMem);
  }

  /**
   * Smart context retrieval: Extracts only relevant context for LLM prompt
   */
  public getRelevantContext(projectId: string | undefined, targetUrl: string, objective: string): string {
    if (!projectId) return "";
    const mem = this.getProjectMemory(projectId);
    const relevantWorkflows = mem.knownWorkflows.filter((w) =>
      objective.toLowerCase().includes(w.toLowerCase())
    );

    const parts: string[] = [];
    if (relevantWorkflows.length) {
      parts.push(`Known Workflows for this area: ${relevantWorkflows.join(", ")}`);
    }
    if (mem.unstableModules.length) {
      parts.push(`Historically Unstable Areas to verify: ${mem.unstableModules.join(", ")}`);
    }
    if (Object.keys(mem.healedLocators).length) {
      parts.push(`Known Resilient Element Locators available: ${Object.keys(mem.healedLocators).length} cached selectors.`);
    }

    return parts.join("\n");
  }
}

export const agentMemory = new AgentMemoryService();
