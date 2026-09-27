/**
 * Core Type Definitions for TestFlow AI Autonomous Agentic QA Platform
 */

export type MissionPhase =
  | "MISSION_CREATED"
  | "PLANNING"
  | "DISCOVERING"
  | "TEST_DESIGN"
  | "EXECUTING"
  | "OBSERVING"
  | "INVESTIGATING"
  | "VERIFYING"
  | "BUG_CREATION"
  | "REPORTING"
  | "COMPLETED"
  | "WAITING_FOR_HUMAN"
  | "RETRYING"
  | "FAILED"
  | "CANCELLED";

export type TestingScopeItem =
  | "functional"
  | "regression"
  | "ui"
  | "responsive"
  | "form"
  | "accessibility"
  | "performance"
  | "api";

export interface MissionConfig {
  id: string;
  name: string;
  targetUrl: string;
  objective: string;
  environment: "development" | "staging" | "production" | "local";
  browser: "chrome" | "firefox" | "safari" | "edge";
  device: "desktop" | "tablet" | "mobile";
  authRequired: boolean;
  authConfig?: {
    loginUrl?: string;
    usernameOrEmail?: string;
    password?: string;
    token?: string;
  };
  scope: TestingScopeItem[];
  projectId?: string;
  workspaceId?: string;
  userId?: string;
  specificModule?: string;
  maxTestCases?: number;
  autoHealEnabled?: boolean;
}

export interface AgentStepEvent {
  id: string;
  missionId: string;
  phase: MissionPhase;
  agent: "Planner" | "Explorer" | "TestDesigner" | "Execution" | "Investigator" | "Visual" | "Performance" | "API";
  action: string;
  status: "pending" | "running" | "success" | "warning" | "failed" | "waiting_approval";
  tool?: string;
  toolInput?: Record<string, any>;
  toolOutput?: Record<string, any>;
  durationMs?: number;
  observedState?: string;
  evidenceId?: string;
  screenshotUrl?: string;
  timestamp: string;
  error?: string;
}

export interface ToolResult<T = any> {
  success: boolean;
  tool: string;
  target?: string;
  observedState?: string;
  screenshot?: string;
  data?: T;
  error?: string | null;
  durationMs?: number;
  requiresIntegration?: boolean;
}

export interface HumanApprovalRequest {
  id: string;
  missionId: string;
  stepId: string;
  action: string;
  reason: string;
  potentialImpact: string;
  tool: string;
  params: Record<string, any>;
  createdAt: string;
}

export interface DiscoveredElement {
  id: string;
  tag: string;
  type?: string;
  name?: string;
  label?: string;
  selector: string;
  text?: string;
  role?: string;
  isInteractive: boolean;
  attributes: Record<string, string>;
}

export interface DiscoveredForm {
  id: string;
  action?: string;
  method?: string;
  inputs: DiscoveredElement[];
  submitButton?: DiscoveredElement;
}

export interface DiscoveredPage {
  url: string;
  title: string;
  path: string;
  elements: DiscoveredElement[];
  forms: DiscoveredForm[];
  links: string[];
  screenshotUrl?: string;
  discoveredAt: string;
}

export interface ApplicationMap {
  missionId: string;
  baseUrl: string;
  pages: DiscoveredPage[];
  workflows: {
    id: string;
    name: string;
    startingPage: string;
    steps: string[];
    criticality: "low" | "medium" | "high" | "critical";
  }[];
  updatedAt: string;
}

export interface GeneratedScenario {
  id: string;
  missionId: string;
  title: string;
  category: "functional" | "ui" | "responsive" | "regression" | "boundary" | "edge";
  priority: "low" | "medium" | "high" | "critical";
  preconditions: string;
  steps: {
    stepNumber: number;
    action: string;
    tool: string;
    selector?: string;
    value?: string;
    expectedResult: string;
  }[];
  expectedOutcome: string;
  gherkin?: string;
  status: "pending" | "running" | "passed" | "failed" | "blocked" | "skipped" | "flaky" | "investigating";
  actualResult?: string;
  executionDurationMs?: number;
  screenshotUrl?: string;
  error?: string;
  healed?: boolean;
}

export type BugClassification =
  | "CONFIRMED_BUG"
  | "LIKELY_BUG"
  | "TEST_FAILURE"
  | "ENVIRONMENT_FAILURE"
  | "NETWORK_FAILURE"
  | "AUTHENTICATION_FAILURE"
  | "FLAKY_TEST"
  | "NEEDS_HUMAN_REVIEW";

export interface BugInvestigationResult {
  scenarioId: string;
  classification: BugClassification;
  confidence: number; // 0 - 100
  rootCauseHypothesis: string;
  explanation: string;
  evidence: {
    domSnapshot?: string;
    consoleErrors?: string[];
    networkFailures?: { url: string; status: number; method: string; statusText: string }[];
    screenshotUrl?: string;
  };
  reproductionAttempts: number;
  reproductionSuccesses: number;
  isConfirmed: boolean;
  suggestedBugReport?: {
    title: string;
    severity: "low" | "medium" | "high" | "critical";
    priority: "low" | "medium" | "high" | "urgent";
    description: string;
    stepsToReproduce: string;
    expectedResult: string;
    actualResult: string;
    environment: string;
    browser: string;
    device: string;
    tags: string[];
  };
}

export interface SelfHealingRecord {
  id: string;
  missionId: string;
  scenarioId: string;
  originalLocator: string;
  healedLocator: string;
  strategy: "text_match" | "aria_role" | "hierarchy_context" | "fuzzy_label" | "id_mutation";
  confidence: number;
  applied: boolean;
  timestamp: string;
}

export interface QAMissionReport {
  missionId: string;
  missionName: string;
  targetUrl: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  testsPlanned: number;
  testsExecuted: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  flaky: number;
  selfHealed: number;
  bugsCreated: number;
  bugs: {
    id: string;
    title: string;
    severity: "low" | "medium" | "high" | "critical";
    classification: BugClassification;
  }[];
  coverage: {
    functional: number;
    ui: number;
    responsive: number;
    accessibility: number;
    performance: number;
    api: number;
  };
  findings: {
    highRiskAreas: string[];
    repeatedFailures: string[];
    regressionRisks: string[];
    recommendations: string[];
  };
  aiAnalysis: string;
}
