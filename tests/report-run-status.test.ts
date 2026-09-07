import { describe, it, expect } from "vitest";
import { canTransition, isTerminalStatus, REPORT_RUN_STATUS_RANK } from "@/lib/domain/report-run-status";
import type { ReportRunStatus } from "@/lib/types/database";

const ALL_STATUSES: ReportRunStatus[] = ["queued", "sent", "processing", "completed", "failed"];

describe("report run status transition rules", () => {
  it("follows the documented happy-path order: queued -> sent -> processing -> completed", () => {
    expect(canTransition("queued", "sent")).toBe(true);
    expect(canTransition("sent", "processing")).toBe(true);
    expect(canTransition("processing", "completed")).toBe(true);
  });

  it("allows a failure from any non-terminal status", () => {
    expect(canTransition("queued", "failed")).toBe(true);
    expect(canTransition("sent", "failed")).toBe(true);
    expect(canTransition("processing", "failed")).toBe(true);
    expect(canTransition("completed", "failed")).toBe(true);
  });

  it("rejects every backward transition", () => {
    expect(canTransition("processing", "queued")).toBe(false);
    expect(canTransition("completed", "sent")).toBe(false);
    expect(canTransition("failed", "processing")).toBe(false);
  });

  it("rejects a repeated (idempotent replay) transition to the same status", () => {
    for (const status of ALL_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("treats failed as strictly terminal — nothing may follow it", () => {
    for (const status of ALL_STATUSES) {
      expect(canTransition("failed", status)).toBe(false);
    }
  });

  it("rejects skipping backward even across two steps", () => {
    expect(canTransition("completed", "queued")).toBe(false);
  });

  it("marks completed and failed as terminal, and the rest as non-terminal", () => {
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("queued")).toBe(false);
    expect(isTerminalStatus("sent")).toBe(false);
    expect(isTerminalStatus("processing")).toBe(false);
  });

  it("gives failed the strictly highest rank of all statuses", () => {
    const maxOtherRank = Math.max(
      ...ALL_STATUSES.filter((s) => s !== "failed").map((s) => REPORT_RUN_STATUS_RANK[s]),
    );
    expect(REPORT_RUN_STATUS_RANK.failed).toBeGreaterThan(maxOtherRank);
  });
});
