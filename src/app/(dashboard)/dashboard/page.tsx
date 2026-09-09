import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import * as productsData from "@/lib/data/products";
import * as reportRunsData from "@/lib/data/report-runs";
import { signProductImages } from "@/lib/data/storage";
import { StatTiles } from "@/components/products/stat-tiles";
import { ProductGrid } from "@/components/products/product-grid";

export const metadata: Metadata = { title: "Dashboard — LAETO LTD" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  const supabase = await createServerSupabase();

  const [products, latestCompletedRun, mostRecentRun, recentRuns] = await Promise.all([
    productsData.listProducts(supabase),
    reportRunsData.getLatestCompletedRun(supabase),
    reportRunsData.getMostRecentRun(supabase),
    reportRunsData.listRuns(supabase),
  ]);

  const signedUrls = await signProductImages(
    supabase,
    products.map((p) => p.image_path),
  );

  const totalCompetitors = products.reduce((sum, p) => sum + p.competitor_count, 0);
  const monitoredCount = products.filter((p) => p.notify_enabled).length;

  // Most recent run touching each product: either a manual run for that
  // specific product, or any daily run (which covers every monitored
  // product) — whichever happened more recently. recentRuns is already
  // ordered newest-first, so the first match per product wins.
  const lastRunStatusByProduct: Record<string, (typeof recentRuns)[number]["status"]> = {};
  for (const product of products) {
    const match = recentRuns.find((run) => run.product_id === product.id || run.product_id === null);
    if (match) lastRunStatusByProduct[product.id] = match.status;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor LAETO&apos;s Amazon products against their tracked competitors.
        </p>
      </div>

      <StatTiles
        totalProducts={products.length}
        monitoredCount={monitoredCount}
        totalCompetitors={totalCompetitors}
        latestCompletedRun={latestCompletedRun}
        mostRecentRun={mostRecentRun}
      />

      <ProductGrid
        products={products}
        signedImageUrls={Object.fromEntries(signedUrls)}
        lastRunStatusByProduct={lastRunStatusByProduct}
      />
    </div>
  );
}
