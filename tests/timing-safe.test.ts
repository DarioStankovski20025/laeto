import { describe, it, expect } from "vitest";
import { bearerMatches } from "@/lib/utils/timing-safe";

const SECRET = "super-secret-token-value";

describe("bearerMatches", () => {
  it("accepts a correctly formatted matching bearer token", () => {
    expect(bearerMatches(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("rejects a wrong token of the same length", () => {
    const wrong = "x".repeat(SECRET.length);
    expect(bearerMatches(`Bearer ${wrong}`, SECRET)).toBe(false);
  });

  it("rejects a wrong token of a different length", () => {
    expect(bearerMatches("Bearer short", SECRET)).toBe(false);
  });

  it("rejects a missing Authorization header", () => {
    expect(bearerMatches(null, SECRET)).toBe(false);
  });

  it("rejects a header without the Bearer prefix", () => {
    expect(bearerMatches(SECRET, SECRET)).toBe(false);
  });

  it("rejects an empty header", () => {
    expect(bearerMatches("", SECRET)).toBe(false);
  });

  it("is case-sensitive on the token value", () => {
    expect(bearerMatches(`Bearer ${SECRET.toUpperCase()}`, SECRET)).toBe(false);
  });
});
