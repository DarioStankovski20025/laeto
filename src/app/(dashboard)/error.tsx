"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
      <AlertTriangle className="h-8 w-8 text-status-failed" />
      <div>
        <h2 className="text-base font-semibold text-foreground">Could not load this page</h2>
        <p className="mt-1 text-sm text-muted-foreground">Something went wrong loading your data.</p>
      </div>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
