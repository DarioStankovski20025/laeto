"use client";

import { useEffect, useRef, useState } from "react";
import type { ReportRunStatus } from "@/lib/types/database";
import { isTerminalStatus } from "@/lib/domain/report-run-status";

export interface RunStatusRow {
  id: string;
  status: ReportRunStatus;
  product_id: string | null;
  error_message: string | null;
  report_file_url: string | null;
  updated_at: string;
}

const MIN_DELAY_MS = 2000;
const MAX_DELAY_MS = 15000;
const BACKOFF_FACTOR = 1.6;
const MAX_WALL_CLOCK_MS = 10 * 60 * 1000;

/**
 * Polls GET /api/runs/status for a set of run ids while any of them is
 * non-terminal. Uses recursive setTimeout (not setInterval) with backoff so
 * a slow network never stacks overlapping requests, resets to the fast
 * interval whenever a status actually changes, stops entirely once every
 * tracked run reaches a terminal status, and never issues a request when the
 * id set is empty or the tab is hidden.
 */
export function useRunPolling(ids: string[]): { runs: RunStatusRow[]; isPolling: boolean } {
  const [runs, setRuns] = useState<RunStatusRow[]>([]);
  const isPollingRef = useRef(false);
  const [isPolling, setIsPolling] = useState(false);

  // Stable key so the effect only restarts when the actual set of ids changes.
  const idsKey = [...ids].sort().join(",");

  useEffect(() => {
    // Nothing to derive here via setState: when there are no ids, the
    // returned `isPolling` below is forced to false directly from `idsKey`
    // itself (already known at render time), so no effect is needed for
    // that case at all.
    if (!idsKey) return;

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let delay = MIN_DELAY_MS;
    const startedAt = Date.now();
    let cancelled = false;
    let lastSignature = "";

    isPollingRef.current = true;
    // This is the imperative "subscription started" signal for a polling
    // loop, not state derivable from props — the equivalent of setting
    // connection status in React's own documented subscription-effect
    // pattern. Every subsequent update to this state happens from within an
    // async callback (inside poll()), which is the pattern this lint rule
    // otherwise asks for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPolling(true);

    async function poll() {
      if (cancelled) return;

      if (document.visibilityState === "hidden") {
        schedule(delay);
        return;
      }

      if (Date.now() - startedAt > MAX_WALL_CLOCK_MS) {
        isPollingRef.current = false;
        setIsPolling(false);
        return;
      }

      try {
        const res = await fetch(`/api/runs/status?ids=${encodeURIComponent(idsKey)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as { runs: RunStatusRow[]; next_poll_ms: number };

        if (cancelled) return;
        setRuns(body.runs);

        const signature = body.runs.map((r) => `${r.id}:${r.status}`).join("|");
        if (signature !== lastSignature) {
          delay = MIN_DELAY_MS;
          lastSignature = signature;
        } else {
          delay = Math.min(delay * BACKOFF_FACTOR, MAX_DELAY_MS);
        }

        const allTerminal = body.runs.length > 0 && body.runs.every((r) => isTerminalStatus(r.status));
        if (allTerminal) {
          isPollingRef.current = false;
          setIsPolling(false);
          return;
        }
      } catch {
        // Network hiccup: back off and try again rather than giving up.
        delay = Math.min(delay * BACKOFF_FACTOR, MAX_DELAY_MS);
      }

      schedule(delay);
    }

    function schedule(ms: number) {
      if (cancelled) return;
      timeoutId = setTimeout(poll, ms);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && timeoutId) {
        clearTimeout(timeoutId);
        void poll();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void poll();

    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      isPollingRef.current = false;
    };
  }, [idsKey]);

  return { runs, isPolling: Boolean(idsKey) && isPolling };
}
