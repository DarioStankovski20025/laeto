/**
 * IANA timezone list for the settings picker, sourced from Intl at runtime —
 * no timezone library needed (verified: Intl.supportedValuesOf('timeZone')
 * returns 400+ zones on Node 20+).
 */
export function listTimezones(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }
  // Fallback for older runtimes: a short, sane default list.
  return [
    "UTC",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
  ];
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The current local hour (0-23) for a given IANA timezone. */
export function localHourInTimezone(tz: string, at: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(at),
  );
}

/** The current local calendar date (YYYY-MM-DD) for a given IANA timezone. */
export function localDateInTimezone(tz: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
