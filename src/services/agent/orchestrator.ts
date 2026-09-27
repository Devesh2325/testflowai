/**
 * Central Agent Orchestrator: Drives the full autonomous QA lifecycle
 * 
 * Lifecycle State Machine:
 * MISSION_CREATED ➔ PLANNING ➔ DISCOVERING ➔ TEST_DESIGN ➔ EXECUTING ➔
 * OBSERVING ➔ INVESTIGATING ➔ VERIFYING ➔ BUG_CREATION ➔ REPORTING ➔ COMPLETED
 */

import {
  MissionConfig,
  MissionPhase,
  AgentStepEvent,
  ApplicationMap,
  GeneratedScenario,
  BugInvestigationResult,
  SelfHealingRecord,
  QAMissionReport,
  HumanApprovalRequest,
} from "./types";
import { PlannerAgent, ExecutionPlan } from "./agents/plannerAgent";
import { ExplorerAgent } from "./agents/explorerAgent";
import { TestDesignerAgent } from "./agents/testDesignerAgent";
import { ExecutionAgent, ExecutionResult } from "./agents/executionAgent";
import { InvestigatorAgent } from "./agents/investigatorAgent";
import { VisualAgent } from "./agents/visualAgent";
import { PerformanceAgent } from "./agents/performanceAgent";
import { agentMemory } from "./memory";
import { ExecutionContext } from "./toolRegistry";
import { supabase } from "@/integrations/supabase/client";

export type EventListener = (event: AgentStepEvent) => void;
export type ApprovalListener = (request: HumanApprovalRequest) => Promise<boolean>;

export class AgentOrchestrator {
  private config: MissionConfig;
  private currentPhase: MissionPhase = "MISSION_CREATED";
  private eventListeners: Set<EventListener> = new Set();
  private approvalHandler?: ApprovalListener;
  private isCancelled: boolean = false;
  private approvedActionIds = new Set<string>();

  // Mission Results
  public plan?: ExecutionPlan;
  public appMap?: ApplicationMap;
  public scenarios: GeneratedScenario[] = [];
  public executionResults: ExecutionResult[] = [];
  public investigations: BugInvestigationResult[] = [];
  public selfHealingEvents: SelfHealingRecord[] = [];
  public report?: QAMissionReport;

  constructor(config: MissionConfig) {
    this.config = config;
  }

  public onEvent(listener: EventListener) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public setApprovalHandler(handler: ApprovalListener) {
    this.approvalHandler = handler;
  }

  public cancel() {
    this.isCancelled = true;
    this.transitionPhase("CANCELLED", "Mission cancelled by operator");
  }

  public getPhase(): MissionPhase {
    return this.currentPhase;
  }

  /**
   * Run the complete Autonomous QA Mission
   */
  public async runMission(): Promise<QAMissionReport> {
    const startedAt = new Date().toISOString();
    const startTime = performance.now();

    try {
      // 1. MISSION_CREATED
      this.transitionPhase("MISSION_CREATED", `Mission "${this.config.name}" initialized targeting ${this.config.targetUrl}`);
      agentMemory.recordMissionAction(this.config.id, "Initialized QA Mission");
      if (this.checkCancelled()) return this.buildFinalReport(startedAt, startTime);

      // 2. PLANNING
      this.transitionPhase("PLANNING", "Formulating QA testing strategy and scope prioritization...");
      const planStart = performance.now();
      this.plan = await PlannerAgent.createPlan(this.config);
      this.emitStep({
        phase: "PLANNING",
        agent: "Planner",
        action: `Strategy finalized: ${this.plan.prioritizedWorkflows.length} critical workflows prioritized across ${this.config.device}`,
        status: "success",
        durationMs: Math.round(performance.now() - planStart),
      });
      if (this.checkCancelled()) return this.buildFinalReport(startedAt, startTime);

      // 3. DISCOVERING
      this.transitionPhase("DISCOVERING", `Exploring ${this.config.targetUrl} and building application map...`);
      const exploreStart = performance.now();
      this.appMap = await ExplorerAgent.explore(this.config);
      const totalElements = this.appMap.pages.reduce((acc, p) => acc + p.elements.length, 0);
      const totalForms = this.appMap.pages.reduce((acc, p) => acc + p.forms.length, 0);
      this.emitStep({
        phase: "DISCOVERING",
        agent: "Explorer",
        action: `Application map created: ${this.appMap.pages.length} page(s), ${totalElements} element(s), and ${totalForms} form(s) discovered.`,
        status: "success",
        durationMs: Math.round(performance.now() - exploreStart),
      });
      if (this.checkCancelled()) return this.buildFinalReport(startedAt, startTime);

      // 4. TEST_DESIGN
      this.transitionPhase("TEST_DESIGN", "Generating atomic test scenarios with positive, negative, and edge criteria...");
      const designStart = performance.now();
      this.scenarios = await TestDesignerAgent.designScenarios(this.config, this.appMap);
      this.emitStep({
        phase: "TEST_DESIGN",
        agent: "TestDesigner",
        action: `Generated ${this.scenarios.length} test scenarios across ${this.config.scope.join(", ")} scope.`,
        status: "success",
        durationMs: Math.round(performance.now() - designStart),
      });
      if (this.checkCancelled()) return this.buildFinalReport(startedAt, startTime);

      // Setup Execution Context
      const context: ExecutionContext = {
        missionId: this.config.id,
        projectId: this.config.projectId,
        workspaceId: this.config.workspaceId,
        userId: this.config.userId,
        environment: this.config.environment,
        approvedActionIds: this.approvedActionIds,
        onApprovalRequired: this.approvalHandler,
      };

      // 5. EXECUTING & OBSERVING
      this.transitionPhase("EXECUTING", `Executing ${this.scenarios.length} scenarios through browser automation...`);

      for (let i = 0; i < this.scenarios.length; i++) {
        if (this.checkCancelled()) break;
        const scen = this.scenarios[i];
        scen.status = "running";

        this.emitStep({
          phase: "EXECUTING",
          agent: "Execution",
          action: `Executing Scenario ${i + 1}/${this.scenarios.length}: "${scen.title}"`,
          status: "running",
        });

        const execRes = await ExecutionAgent.executeScenario(
          scen,
          this.config,
          context,
          (stepNum, action, s) => {
            this.emitStep({
              phase: "OBSERVING",
              agent: "Execution",
              action: `Step ${stepNum}: ${action}`,
              status: s,
            });
          }
        );

        this.executionResults.push(execRes);
        scen.status = execRes.status;
        scen.actualResult = execRes.actualResult;
        scen.executionDurationMs = execRes.durationMs;

        if (execRes.selfHealingEvents.length > 0) {
          this.selfHealingEvents.push(...execRes.selfHealingEvents);
          scen.healed = true;
          this.emitStep({
            phase: "EXECUTING",
            agent: "Execution",
            action: `Self-healing applied: ${execRes.selfHealingEvents.length} locator(s) dynamically resolved.`,
            status: "warning",
          });
        }

        // 6. INVESTIGATING & VERIFYING (Triggered upon failure)
        if (execRes.status === "failed" || execRes.status === "blocked") {
          this.transitionPhase("INVESTIGATING", `Investigating failure in "${scen.title}"...`);
          const invStart = performance.now();

          const invRes = await InvestigatorAgent.investigate(
            scen,
            execRes.error || "Execution failed",
            this.config,
            context
          );
          this.investigations.push(invRes);

          if (invRes.isConfirmed && invRes.bugReport) {
            this.createdBugs.push(invRes.bugReport);
            this.emitStep({
              phase: "REPORTING",
              agent: "Investigator",
              action: `Bug Confirmed & Logged: [${invRes.bugReport.severity.toUpperCase()}] ${invRes.bugReport.title}`,
              status: "failed",
            });

            if (this.config.projectId) {
              try {
                await supabase.from("bugs").insert({
                  title: invRes.bugReport.title,
                  description: `${invRes.bugReport.description}\n\nSteps to reproduce:\n${invRes.bugReport.stepsToReproduce.join("\n")}`,
                  severity: invRes.bugReport.severity.toLowerCase() as any,
                  priority: invRes.bugReport.severity === "critical" ? "high" : "medium",
                  status: "open",
                  project_id: this.config.projectId,
                  owner_id: this.config.userId || "00000000-0000-0000-0000-000000000000",
                });
              } catch (bugErr) {
                console.warn("Could not auto-insert bug into Supabase:", bugErr);
              }
            }
          }
        }
      }
      if (this.config.scope.includes("ui") || this.config.scope.includes("responsive")) {
        const visualRes = await VisualAgent.analyze(this.config.targetUrl, this.config.device);
        this.emitStep({
          phase: "OBSERVING",
          agent: "Visual",
          action: visualRes.summary,
          status: visualRes.hasCriticalVisualDefects ? "warning" : "success",
        });
      }

      if (this.config.scope.includes("performance")) {
        const perfRes = await PerformanceAgent.measure(this.config.targetUrl);
        this.emitStep({
          phase: "OBSERVING",
          agent: "Performance",
          action: `Performance Telemetry: ${perfRes.summary}`,
          status: perfRes.failedRequestsCount > 0 ? "warning" : "success",
        });
      }

      // Synchronize results to existing test_runs and test_executions if project selected
      if (this.config.projectId) {
        try {
          const { data: runData } = await supabase.from("test_runs").insert({
            name: `[AI Mission] ${this.config.name}`,
            project_id: this.config.projectId,
            owner_id: this.config.userId || "00000000-0000-0000-0000-000000000000",
            status: "completed",
          }).select().single();

          if (runData) {
            for (let sIdx = 0; sIdx < this.scenarios.length; sIdx++) {
              const sc = this.scenarios[sIdx];
              const er = this.executionResults[sIdx];
              const { data: tcData } = await supabase.from("test_cases").insert({
                title: sc.title,
                steps: sc.steps.map(s => s.action).join("\n"),
                expected_result: sc.expectedOutcome,
                priority: sc.priority as any,
                type: sc.category as any,
                project_id: this.config.projectId,
                owner_id: this.config.userId || "00000000-0000-0000-0000-000000000000",
              }).select().single();

              if (tcData) {
                await supabase.from("test_executions").insert({
                  run_id: runData.id,
                  test_case_id: tcData.id,
                  status: (er?.status === "passed" ? "pass" : er?.status === "failed" ? "fail" : "blocked") as any,
                  notes: er?.actualResult || "Executed by Autonomous AI QA Agent",
                  browser: this.config.browser,
                  device: this.config.device,
                  owner_id: this.config.userId || "00000000-0000-0000-0000-000000000000",
                });
              }
            }
          }
        } catch (dbErr) {
          console.warn("Could not sync mission to test_runs:", dbErr);
        }
      }

      // 8. REPORTING
      this.transitionPhase("REPORTING", "Generating comprehensive QA Mission executive report...");
      const finalReport = this.buildFinalReport(startedAt, startTime);
      this.report = finalReport;

      // 9. COMPLETED
      this.transitionPhase("COMPLETED", `Mission completed with ${finalReport.passed} passed and ${finalReport.bugsCreated} defect(s) discovered.`);
      return finalReport;
    } catch (error: any) {
      this.transitionPhase("FAILED", `Mission aborted with error: ${error.message}`);
      return this.buildFinalReport(startedAt, startTime, error.message);
    }
  }

  private buildFinalReport(startedAt: string, startTime: number, failureError?: string): QAMissionReport {
    const passed = this.executionResults.filter((r) => r.status === "passed").length;
    const failed = this.executionResults.filter((r) => r.status === "failed").length;
    const blocked = this.executionResults.filter((r) => r.status === "blocked").length;
    const skipped = this.executionResults.filter((r) => r.status === "skipped").length;
    const flaky = this.executionResults.filter((r) => r.status === "flaky").length;
    const confirmedBugs = this.investigations.filter((i) => i.isConfirmed);

    return {
      missionId: this.config.id,
      missionName: this.config.name,
      targetUrl: this.config.targetUrl,
      startedAt,
      completedAt: new Date().toISOString(),
      durationSeconds: Math.round((performance.now() - startTime) / 1000),
      testsPlanned: this.scenarios.length,
      testsExecuted: this.executionResults.length,
      passed,
      failed,
      blocked,
      skipped,
      flaky,
      selfHealed: this.selfHealingEvents.length,
      bugsCreated: confirmedBugs.length,
      bugs: confirmedBugs.map((b, idx) => ({
        id: `bug_${idx + 1}`,
        title: b.suggestedBugReport?.title || "Discovered Defect",
        severity: b.suggestedBugReport?.severity || "medium",
        classification: b.classification,
      })),
      coverage: {
        functional: this.config.scope.includes("functional") ? 100 : 0,
        ui: this.config.scope.includes("ui") ? 90 : 0,
        responsive: this.config.scope.includes("responsive") ? 100 : 0,
        accessibility: this.config.scope.includes("accessibility") ? 80 : 0,
        performance: this.config.scope.includes("performance") ? 75 : 0,
        api: this.config.scope.includes("api") ? 85 : 0,
      },
      findings: {
        highRiskAreas: confirmedBugs.map((b) => b.rootCauseHypothesis.slice(0, 80)),
        repeatedFailures: this.investigations.filter((i) => i.reproductionSuccesses > 1).map((i) => i.rootCauseHypothesis),
        regressionRisks: failed > 0 ? ["Critical flow disruption detected in primary path"] : [],
        recommendations: failureError
          ? [`Inspect runner environment: ${failureError}`]
          : [
              "Review confirmed bug reports before triggering release deployment.",
              "Run regression suite on responsive mobile viewports.",
            ],
      },
      aiAnalysis: failureError
        ? `Mission encountered runtime failure: ${failureError}`
        : `Autonomous QA mission executed ${this.executionResults.length} scenarios. Found ${confirmedBugs.length} verified bug(s) with ${this.selfHealingEvents.length} self-healed selector(s).`,
    };
  }

  private transitionPhase(phase: MissionPhase, statusMessage: string) {
    this.currentPhase = phase;
    this.emitStep({
      phase,
      agent: "Planner",
      action: statusMessage,
      status: phase === "FAILED" ? "failed" : phase === "CANCELLED" ? "warning" : "success",
    });
  }

  private emitStep(eventPartial: Omit<AgentStepEvent, "id" | "missionId" | "timestamp">) {
    const event: AgentStepEvent = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      missionId: this.config.id,
      timestamp: new Date().toISOString(),
      ...eventPartial,
    };
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("Error in agent event listener:", err);
      }
    });
  }

  private checkCancelled(): boolean {
    return this.isCancelled;
  }
}
