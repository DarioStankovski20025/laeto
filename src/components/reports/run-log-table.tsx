"use client";

import { ExternalLink } from "lucide-react";
import { RunStatusBadge } from "@/components/reports/run-status-badge";
import { formatDateTime } from "@/lib/utils/format";
import type { ReportRunWithProductTitle } from "@/lib/data/report-runs";

export function RunLogTable({ runs }: { runs: ReportRunWithProductTitle[] }) {
  if (runs.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No report runs yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Trigger</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium">Requested</th>
            <th className="py-2 pr-3 font-medium">Completed</th>
            <th className="py-2 pr-3 font-medium">Products</th>
            <th className="py-2 pr-3 font-medium">Competitors</th>
            <th className="py-2 pr-3 font-medium">Report</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-border/60 align-top">
              <td className="py-3 pr-3">
                <div className="font-medium capitalize">{run.trigger_type}</div>
                {run.product_id && (
                  <div className="text-xs text-muted-foreground">{run.product_title ?? "Deleted product"}</div>
                )}
              </td>
              <td className="py-3 pr-3">
                <RunStatusBadge status={run.status} />
                {run.status === "failed" && run.error_message && (
                  <p className="mt-1 max-w-[16rem] text-xs text-status-failed">{run.error_message}</p>
                )}
              </td>
              <td className="py-3 pr-3 whitespace-nowrap font-mono text-xs">{formatDateTime(run.requested_at)}</td>
              <td className="py-3 pr-3 whitespace-nowrap font-mono text-xs">{formatDateTime(run.completed_at)}</td>
              <td className="py-3 pr-3">{run.products_count}</td>
              <td className="py-3 pr-3">{run.competitors_count}</td>
              <td className="py-3 pr-3">
                {run.report_file_url ? (
                  <a
                    href={run.report_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                  >
                    Download <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
