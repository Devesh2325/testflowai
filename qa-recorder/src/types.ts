export type ActionType =
  | "click"
  | "dblclick"
  | "input"
  | "select"
  | "check"
  | "uncheck"
  | "keypress"
  | "navigate"
  | "upload"
  | "scroll"
  | "assert_visible"
  | "assert_text_equals"
  | "assert_url_contains"
  | "assert_element_count";

export interface SelectorInfo {
  strategy: "data-testid" | "role" | "label" | "placeholder" | "text" | "css" | "xpath";
  value: string;
  playwrightCode: string;
}

export interface RecordedStep {
  id: string;
  action: ActionType;
  name: string;
  primarySelector?: SelectorInfo;
  fallbackSelectors?: SelectorInfo[];
  value?: string;
  isPassword?: boolean;
  url?: string;
  timestamp: number;
  targetDescription?: string;
}

export interface BaselineNoise {
  consoleErrors: Array<{ text: string; timestamp: number; url?: string }>;
  failedRequests: Array<{ url: string; method: string; status: number; timestamp: number }>;
  pageErrors: Array<{ error: string; timestamp: number }>;
}

export interface Scenario {
  id: string;
  name: string;
  startUrl: string;
  steps: RecordedStep[];
  baselineNoise: BaselineNoise;
  createdAt: string;
  updatedAt: string;
}

export interface RunnerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
