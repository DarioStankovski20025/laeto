"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, PlayCircle, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "@/components/reports/run-status-badge";
import { useRunPolling } from "@/hooks/use-run-polling";

interface CheckNowModalProps {
  productId: string;
  productTitle: string;
  competitorCount: number;
}

export function CheckNowModal({ productId, productTitle, competitorCount }: CheckNowModalProps) {
  const [open, setOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [ackMessage, setAckMessage] = useState<string | null>(null);

  const { runs } = useRunPolling(runId ? [runId] : []);
  const currentRun = runs.find((r) => r.id === runId);

  async function handleStart() {
    setIsDispatching(true);
    setDispatchError(null);
    try {
      const res = await fetch(`/api/products/${productId}/check-now`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setDispatchError(body.error ?? "Could not start the check.");
        return;
      }
      setRunId(body.data.runId);
      setAckMessage(body.data.message ?? null);
      toast.success("Price check started.");
    } catch {
      setDispatchError("Could not reach the server. Please try again.");
    } finally {
      setIsDispatching(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Closing the modal does not cancel the server-side job — it keeps
      // running and the dashboard will reflect its result on completion.
      setRunId(null);
      setDispatchError(null);
      setAckMessage(null);
    }
  }

  const hasNoCompetitors = competitorCount === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlayCircle className="h-4 w-4" /> Check now
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check &quot;{productTitle}&quot; now</DialogTitle>
          <DialogDescription>
            Sends this product and its competitors to the report service for an immediate price check.
          </DialogDescription>
        </DialogHeader>

        {hasNoCompetitors ? (
          <div className="rounded-md border border-status-processing bg-status-processing-bg px-3 py-2 text-sm text-status-processing">
            Add at least one competitor before checking this product&apos;s price.
          </div>
        ) : !runId ? (
          <>
            {dispatchError && (
              <div className="rounded-md border border-status-failed bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
                {dispatchError}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleStart} disabled={isDispatching}>
                {isDispatching && <Loader2 className="h-4 w-4 animate-spin" />}
                Start check
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-muted px-3 py-2">
              <span className="text-sm text-foreground">Status</span>
              <RunStatusBadge status={currentRun?.status ?? "sent"} />
            </div>

            {ackMessage && <p className="text-xs text-muted-foreground">{ackMessage}</p>}

            {currentRun?.status === "completed" && (
              <div className="flex items-center gap-2 text-sm text-status-completed">
                <CheckCircle2 className="h-4 w-4" /> Check completed.
              </div>
            )}
            {currentRun?.status === "failed" && (
              <div className="flex items-center gap-2 text-sm text-status-failed">
                <XCircle className="h-4 w-4" /> {currentRun.error_message ?? "The check failed."}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              You can close this window — the check keeps running and the dashboard will update automatically.
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
