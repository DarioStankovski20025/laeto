export type ScraperErrorCode = "not_configured" | "timeout" | "rejected" | "network" | "bad_response";

export interface ScraperErrorDetail {
  status?: number;
  bodySnippet?: string;
  missingEnv?: string[];
  cause?: unknown;
}

export class ScraperError extends Error {
  readonly code: ScraperErrorCode;
  readonly detail?: ScraperErrorDetail;

  constructor(code: ScraperErrorCode, message: string, detail?: ScraperErrorDetail) {
    super(message);
    this.name = "ScraperError";
    this.code = code;
    this.detail = detail;
  }

  /** Safe to persist into report_runs.error_message and show to the user. */
  toUserMessage(): string {
    switch (this.code) {
      case "not_configured":
        return "Report service is not configured. Contact your administrator.";
      case "timeout":
        return "The report service did not respond in time. Please try again.";
      case "network":
        return "Could not reach the report service. Please try again.";
      case "rejected":
        return `The report service rejected the request (HTTP ${this.detail?.status ?? "unknown"}).`;
      case "bad_response":
        return "The report service returned an unexpected response.";
    }
  }
}
