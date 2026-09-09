"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { RefreshCw, ClipboardList, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getRecentRunsAction } from "@/lib/actions/run-actions";
import { RunLogTable } from "@/components/reports/run-log-table";
import { useRunPolling } from "@/hooks/use-run-polling";
import type { ReportRunWithAttribution } from "@/lib/data/report-runs";

const ACTIVE_STATUSES = new Set(["queued", "sent", "processing"]);

export function LogsDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<ReportRunWithAttribution[]>([]);
  const [isPending, startTransition] = useTransition();
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = useCallback(() => {
    startTransition(async () => {
      const result = await getRecentRunsAction();
      if (result.ok) setRuns(result.data);
      setLoadedOnce(true);
    });
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const activeIds = open ? runs.filter((r) => ACTIVE_STATUSES.has(r.status)).map((r) => r.id) : [];
  const { runs: liveStatuses } = useRunPolling(activeIds);

  // Merge live poll results into the displayed list without a full reload.
  const mergedRuns = runs.map((run) => {
    const live = liveStatuses.find((r) => r.id === run.id);
    return live ? { ...run, status: live.status, error_message: live.error_message, report_file_url: live.report_file_url } : run;
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {children}
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Report activity
          </SheetTitle>
          <SheetDescription>Recent feed and manual report runs.</SheetDescription>
        </SheetHeader>

        <div className="mb-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={load} disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!loadedOnce ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
          ) : (
            <RunLogTable runs={mergedRuns} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
