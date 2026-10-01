"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, PlayCircle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CheckNowModalProps {
  productId: string;
  productTitle: string;
  competitorCount: number;
}

export function CheckNowModal({ productId, productTitle, competitorCount }: CheckNowModalProps) {
  const [open, setOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [sentTo, setSentTo] = useState<string[] | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

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
      setSentTo(body.data.emails ?? []);
      toast.success("Price check sent. The report will arrive by email.");
    } catch {
      setDispatchError("Could not reach the server. Please try again.");
    } finally {
      setIsDispatching(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSentTo(null);
      setDispatchError(null);
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
        ) : !sentTo ? (
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
            <div className="flex items-start gap-3 rounded-md border border-status-completed bg-status-completed-bg px-3 py-3 text-sm text-status-completed">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="font-medium">Everything is OK — the check has been sent.</p>
                <p>
                  You will receive the report by email
                  {sentTo.length > 0 && (
                    <>
                      {" "}at <span className="font-medium break-all">{sentTo.join(", ")}</span>
                    </>
                  )}
                  .
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
