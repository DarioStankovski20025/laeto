import { Package, Bell, Users, CheckCircle2, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RunStatusBadge } from "@/components/reports/run-status-badge";
import { formatRelativeTime } from "@/lib/utils/format";
import type { ReportRun } from "@/lib/data/report-runs";

interface StatTilesProps {
  totalProducts: number;
  monitoredCount: number;
  totalCompetitors: number;
  latestCompletedRun: ReportRun | null;
  mostRecentRun: ReportRun | null;
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export function StatTiles({
  totalProducts,
  monitoredCount,
  totalCompetitors,
  latestCompletedRun,
  mostRecentRun,
}: StatTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tile icon={Package} label="Products" value={totalProducts} />
      <Tile icon={Bell} label="Monitored" value={monitoredCount} sub={`of ${totalProducts} products`} />
      <Tile icon={Users} label="Competitors" value={totalCompetitors} />
      <Tile
        icon={CheckCircle2}
        label="Last completed"
        value={latestCompletedRun ? formatRelativeTime(latestCompletedRun.completed_at) : "Never"}
      />
      <Tile
        icon={Activity}
        label="Latest run"
        value={mostRecentRun ? <RunStatusBadge status={mostRecentRun.status} /> : <span className="text-base text-muted-foreground">—</span>}
      />
    </div>
  );
}
