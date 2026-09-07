export const SCRAPER_SCHEMA_VERSION = 1 as const;

export type ScraperTriggerType = "daily" | "manual";

export interface ScraperCompetitorPayload {
  id: string;
  asin: string;
  title: string;
  amazonUrl: string;
}

export interface ScraperProductPayload {
  id: string;
  asin: string;
  title: string;
  imageUrl: string | null;
  competitors: ScraperCompetitorPayload[];
}

export interface ScraperReportSettings {
  recipientEmail: string;
  timezone: string;
}

export interface ScraperJobPayload {
  schemaVersion: typeof SCRAPER_SCHEMA_VERSION;
  reportRunId: string;
  triggerType: ScraperTriggerType;
  requestedAt: string;
  callbackUrl: string;
  reportSettings: ScraperReportSettings;
  products: ScraperProductPayload[];
}
