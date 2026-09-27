/**
 * Smart Regression Engine: Evaluates test history, previous failures, and dependency graphs
 * to prioritize the most critical regression scenarios and explain why each was selected.
 */

import { supabase } from "@/integrations/supabase/client";

export interface PrioritizedRegressionItem {
  testCaseId: string;
  title: string;
  priorityScore: number; // 0 - 100
  selectionReason: string;
  historicalFailureRate: number;
  criticality: "critical" | "high" | "medium" | "low";
}

export class SmartRegressionEngine {
  public static async prioritize(
    projectId: string,
    targetChangeSummary: string
  ): Promise<{
    prioritizedTests: PrioritizedRegressionItem[];
    rationale: string;
  }> {
    if (!projectId) {
      return { prioritizedTests: [], rationale: "No project selected." };
    }

    const [testsRes, bugsRes, execsRes] = await Promise.all([
      supabase.from("test_cases").select("id, title, priority, type").eq("project_id", projectId),
      supabase.from("bugs").select("id, title, linked_test_case, severity").eq("project_id", projectId),
      supabase.from("test_executions").select("test_case_id, status"),
    ]);

    const tests = testsRes.data ?? [];
    const bugs = bugsRes.data ?? [];
    const execs = execsRes.data ?? [];

    const bugMap = new Set(bugs.map((b) => b.linked_test_case).filter(Boolean));
    const execMap = new Map<string, { total: number; failed: number }>();

    for (const e of execs) {
      const entry = execMap.get(e.test_case_id) || { total: 0, failed: 0 };
      entry.total += 1;
      if (e.status === "fail" || e.status === "blocked") entry.failed += 1;
      execMap.set(e.test_case_id, entry);
    }

    const changeTokens = targetChangeSummary.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    const prioritized: PrioritizedRegressionItem[] = tests.map((t) => {
      let score = 50;
      const reasons: string[] = [];

      // 1. Direct relevance to modified areas
      const isRelevanceHit = changeTokens.some((tok) => t.title.toLowerCase().includes(tok));
      if (isRelevanceHit) {
        score += 30;
        reasons.push("Direct keyword match with modified area");
      }

      // 2. Previously associated with open/past defects
      if (bugMap.has(t.id)) {
        score += 25;
        reasons.push("Historically associated with verified defects");
      }

      // 3. Historical execution failure rate
      const stats = execMap.get(t.id);
      let failRate = 0;
      if (stats && stats.total > 0) {
        failRate = Math.round((stats.failed / stats.total) * 100);
        if (failRate > 30) {
          score += 20;
          reasons.push(`High failure rate (${failRate}%) in previous test runs`);
        }
      }

      // 4. Critical priority weighting
      if (t.priority === "critical") {
        score += 15;
        reasons.push("Marked as business-critical priority");
      }

      const finalScore = Math.min(100, score);
      return {
        testCaseId: t.id,
        title: t.title,
        priorityScore: finalScore,
        selectionReason: reasons.join("; ") || "Standard regression baseline",
        historicalFailureRate: failRate,
        criticality: finalScore >= 80 ? "critical" : finalScore >= 60 ? "high" : "medium",
      };
    });

    // Sort descending by priorityScore
    prioritized.sort((a, b) => b.priorityScore - a.priorityScore);

    const rationale = `Selected ${prioritized.length} regression candidate(s) weighted by keyword impact ("${targetChangeSummary}"), historical failure rates, and active defect linkage.`;

    return {
      prioritizedTests: prioritized,
      rationale,
    };
  }
}
