/**
 * Amazon marketplaces and the product-link derivation.
 *
 * Users enter an ASIN and pick a marketplace; the full `amazon_url` stored in
 * the database is built from those two here, in one place, so a client can
 * never submit an ASIN and a mismatched URL. Edit forms reverse the
 * derivation with `marketplaceFromUrl`.
 *
 * Deliberately NOT `server-only` — the client forms import the list to render
 * the dropdown.
 */

export const AMAZON_MARKETPLACES = [
  { domain: "amazon.co.uk", label: "United Kingdom — amazon.co.uk" },
  { domain: "amazon.de", label: "Germany — amazon.de" },
  { domain: "amazon.fr", label: "France — amazon.fr" },
  { domain: "amazon.it", label: "Italy — amazon.it" },
  { domain: "amazon.es", label: "Spain — amazon.es" },
  { domain: "amazon.nl", label: "Netherlands — amazon.nl" },
  { domain: "amazon.se", label: "Sweden — amazon.se" },
  { domain: "amazon.pl", label: "Poland — amazon.pl" },
  { domain: "amazon.com.be", label: "Belgium — amazon.com.be" },
  { domain: "amazon.ie", label: "Ireland — amazon.ie" },
  { domain: "amazon.com", label: "United States — amazon.com" },
  { domain: "amazon.ca", label: "Canada — amazon.ca" },
  { domain: "amazon.com.mx", label: "Mexico — amazon.com.mx" },
  { domain: "amazon.com.br", label: "Brazil — amazon.com.br" },
  { domain: "amazon.co.jp", label: "Japan — amazon.co.jp" },
  { domain: "amazon.in", label: "India — amazon.in" },
  { domain: "amazon.com.au", label: "Australia — amazon.com.au" },
  { domain: "amazon.sg", label: "Singapore — amazon.sg" },
  { domain: "amazon.ae", label: "United Arab Emirates — amazon.ae" },
  { domain: "amazon.sa", label: "Saudi Arabia — amazon.sa" },
  { domain: "amazon.com.tr", label: "Turkey — amazon.com.tr" },
  { domain: "amazon.eg", label: "Egypt — amazon.eg" },
] as const;

export type AmazonMarketplace = (typeof AMAZON_MARKETPLACES)[number]["domain"];

/** Tuple form, for `z.enum` (which needs at least one literal). */
export const AMAZON_MARKETPLACE_DOMAINS = AMAZON_MARKETPLACES.map((m) => m.domain) as unknown as [
  AmazonMarketplace,
  ...AmazonMarketplace[],
];

export const DEFAULT_MARKETPLACE: AmazonMarketplace = "amazon.co.uk";

/** e.g. ("amazon.co.uk", "B09D8DT9H3") -> "https://www.amazon.co.uk/dp/B09D8DT9H3" */
export function buildAmazonUrl(marketplace: string, asin: string): string {
  return `https://www.${marketplace}/dp/${asin.trim().toUpperCase()}`;
}

export function isAmazonMarketplace(value: string): value is AmazonMarketplace {
  return AMAZON_MARKETPLACES.some((m) => m.domain === value);
}

/**
 * Reverse of buildAmazonUrl, for edit forms. Falls back to
 * DEFAULT_MARKETPLACE for a missing, malformed, or unrecognized host — a row
 * saved before this field existed, or one pointing at a marketplace not in the
 * list. Saving that row then normalizes it to the selected marketplace.
 */
export function marketplaceFromUrl(url: string | null | undefined): AmazonMarketplace {
  if (!url) return DEFAULT_MARKETPLACE;

  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return DEFAULT_MARKETPLACE;
  }

  const bare = host.replace(/^www\./, "");
  return isAmazonMarketplace(bare) ? bare : DEFAULT_MARKETPLACE;
}
