import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import * as productsData from "@/lib/data/products";
import * as reportRunsData from "@/lib/data/report-runs";
import * as foldersData from "@/lib/data/folders";
import { signProductImages } from "@/lib/data/storage";
import { StatTiles } from "@/components/products/stat-tiles";
import { ProductGrid } from "@/components/products/product-grid";
import { FolderGrid } from "@/components/folders/folder-grid";
import { FolderFormDialog } from "@/components/folders/folder-form-dialog";
import { DeleteFolderDialog } from "@/components/folders/delete-folder-dialog";

export const metadata: Metadata = { title: "Dashboard — LAETO LTD" };
export const dynamic = "force-dynamic";

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  await requireUser();
  const supabase = await createServerSupabase();

  const { folder: folderParam } = await props.searchParams;
  const folderId = typeof folderParam === "string" && folderParam ? folderParam : null;

  const [products, folders, latestCompletedRun, mostRecentRun, recentRuns] = await Promise.all([
    productsData.listProducts(supabase),
    foldersData.listFolders(supabase),
    reportRunsData.getLatestCompletedRun(supabase),
    reportRunsData.getMostRecentRun(supabase),
    reportRunsData.listRuns(supabase),
  ]);

  const currentFolder = folderId ? (folders.find((f) => f.id === folderId) ?? null) : null;
  if (folderId && !currentFolder) notFound();

  const signedUrls = await signProductImages(
    supabase,
    products.map((p) => p.image_path),
  );

  // Stat tiles stay account-wide even inside a folder — they describe overall
  // monitoring coverage, not the current view.
  const totalCompetitors = products.reduce((sum, p) => sum + p.competitor_count, 0);
  const monitoredCount = products.filter((p) => p.notify_enabled).length;

  const folderCounts: Record<string, number> = {};
  for (const product of products) {
    if (product.folder_id) folderCounts[product.folder_id] = (folderCounts[product.folder_id] ?? 0) + 1;
  }

  // Most recent run touching each product: either a manual run for that
  // specific product, or any feed run (which covers every monitored
  // product) — whichever happened more recently. recentRuns is already
  // ordered newest-first, so the first match per product wins.
  const lastRunStatusByProduct: Record<string, (typeof recentRuns)[number]["status"]> = {};
  for (const product of products) {
    const match = recentRuns.find((run) => run.product_id === product.id || run.product_id === null);
    if (match) lastRunStatusByProduct[product.id] = match.status;
  }

  return (
    <div className="flex flex-col gap-6">
      {currentFolder ? (
        <div>
          <Link
            href="/dashboard"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All products
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{currentFolder.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {folderCounts[currentFolder.id] ?? 0} product
                {(folderCounts[currentFolder.id] ?? 0) === 1 ? "" : "s"} in this folder.
              </p>
            </div>
            {/* No "New folder" here — folders never nest. */}
            <div className="flex items-center">
              <FolderFormDialog folder={currentFolder} />
              <DeleteFolderDialog
                folderId={currentFolder.id}
                folderName={currentFolder.name}
                productCount={folderCounts[currentFolder.id] ?? 0}
                redirectToRoot
              />
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor LAETO&apos;s Amazon products against their tracked competitors.
          </p>
        </div>
      )}

      <StatTiles
        totalProducts={products.length}
        monitoredCount={monitoredCount}
        totalCompetitors={totalCompetitors}
        latestCompletedRun={latestCompletedRun}
        mostRecentRun={mostRecentRun}
      />

      {!currentFolder && <FolderGrid folders={folders} counts={folderCounts} />}

      <ProductGrid
        products={products}
        signedImageUrls={Object.fromEntries(signedUrls)}
        lastRunStatusByProduct={lastRunStatusByProduct}
        folders={folders}
        folderId={currentFolder?.id ?? null}
      />
    </div>
  );
}
