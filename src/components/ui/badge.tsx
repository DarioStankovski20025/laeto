import * as React from "react";
import { cn } from "@/lib/utils/cn";

type BadgeVariant = "neutral" | "queued" | "sent" | "processing" | "completed" | "failed";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-surface-muted text-muted-foreground",
  queued: "bg-status-queued-bg text-status-queued",
  sent: "bg-status-sent-bg text-status-sent",
  processing: "bg-status-processing-bg text-status-processing",
  completed: "bg-status-completed-bg text-status-completed",
  failed: "bg-status-failed-bg text-status-failed",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
