import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReportRunStatus } from "@/lib/types/database";

const LABELS: Record<ReportRunStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

export function RunStatusBadge({ status }: { status: ReportRunStatus }) {
  const isActive = status === "queued" || status === "sent" || status === "processing";
  return (
    <Badge variant={status}>
      {isActive && <Loader2 className="h-3 w-3 animate-spin" />}
      {LABELS[status]}
    </Badge>
  );
}
