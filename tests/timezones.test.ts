import { describe, it, expect } from "vitest";
import { isValidTimezone, localHourInTimezone, localDateInTimezone } from "@/lib/utils/timezones";

describe("isValidTimezone", () => {
  it("accepts well-known IANA zones", () => {
    expect(isValidTimezone("Europe/London")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
  });

  it("rejects a made-up zone name", () => {
    expect(isValidTimezone("Not/A_Zone")).toBe(false);
  });
});

describe("localHourInTimezone / localDateInTimezone", () => {
  it("returns an hour in the valid 0-23 range for every zone", () => {
    for (const tz of ["Europe/London", "Asia/Tokyo", "America/Los_Angeles", "UTC"]) {
      const hour = localHourInTimezone(tz);
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
    }
  });

  it("computes different local hours for zones with different UTC offsets, at a fixed instant", () => {
    const at = new Date("2026-06-15T12:00:00Z"); // fixed instant, no DST ambiguity for these zones
    const london = localHourInTimezone("Europe/London", at);
    const tokyo = localHourInTimezone("Asia/Tokyo", at);
    expect(london).not.toBe(tokyo);
  });

  it("can compute a different LOCAL DATE than UTC for a zone far ahead of UTC", () => {
    // Late in the UTC day, Tokyo (UTC+9) has already rolled over to the next calendar date.
    const at = new Date("2026-06-15T20:00:00Z");
    const utcDate = at.toISOString().slice(0, 10);
    const tokyoDate = localDateInTimezone("Asia/Tokyo", at);
    expect(tokyoDate).not.toBe(utcDate);
  });

  it("returns dates in YYYY-MM-DD format", () => {
    const date = localDateInTimezone("UTC", new Date("2026-06-15T12:00:00Z"));
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
