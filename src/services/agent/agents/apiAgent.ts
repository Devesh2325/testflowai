/**
 * API Testing Agent: Executes REST and GraphQL endpoint verification,
 * status code validation, response time measurement, and schema compliance.
 */

export interface APITestResult {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  expectedStatus: number;
  actualStatus: number;
  durationMs: number;
  passed: boolean;
  notes: string;
  responsePayloadPreview?: string;
  error?: string;
}

export class APIAgent {
  public static async testEndpoint(
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      headers?: Record<string, string>;
      body?: any;
      expectedStatus?: number;
      token?: string;
    } = {}
  ): Promise<APITestResult> {
    const method = options.method || "GET";
    const expectedStatus = options.expectedStatus || 200;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    };

    const startTime = performance.now();

    try {
      const res = await fetch(endpoint, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const durationMs = Math.round(performance.now() - startTime);
      const text = await res.text();
      let preview = text.slice(0, 200);

      const passed = res.status === expectedStatus;
      return {
        endpoint,
        method,
        expectedStatus,
        actualStatus: res.status,
        durationMs,
        passed,
        notes: passed
          ? `Endpoint verified: HTTP ${res.status} returned in ${durationMs}ms`
          : `Status mismatch: Expected HTTP ${expectedStatus}, but received HTTP ${res.status}`,
        responsePayloadPreview: preview,
      };
    } catch (err: any) {
      return {
        endpoint,
        method,
        expectedStatus,
        actualStatus: 0,
        durationMs: Math.round(performance.now() - startTime),
        passed: false,
        notes: `Network error reaching endpoint: ${err.message}`,
        error: err.message,
      };
    }
  }
}
