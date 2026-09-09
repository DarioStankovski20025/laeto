/**
 * Link-only payload sent for a manual, single-product "Check now" — the
 * external report service gets exactly the Amazon links and a recipient
 * email, nothing else. (The daily/full-catalog case is no longer pushed at
 * all; the report service pulls it from GET /api/reports/feed instead,
 * using the same shape, one array entry per product.)
 */
export interface ScraperFeedItem {
  our_product: string;
  competitors: string[];
  email: string;
}
