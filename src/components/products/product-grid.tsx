"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { PackageSearch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProductSearch } from "@/components/layout/search-context";
import { ProductCard } from "@/components/products/product-card";
import type { ProductListItem } from "@/lib/data/products";
import type { Folder } from "@/lib/data/folders";
import type { ReportRunStatus } from "@/lib/types/database";

interface ProductGridProps {
  /** ALWAYS every product, regardless of folder — scoping happens here. */
  products: ProductListItem[];
  signedImageUrls: Record<string, string>;
  lastRunStatusByProduct: Record<string, ReportRunStatus>;
  folders: Folder[];
  /** Current view: a folder id, or null for the root (products with no folder). */
  folderId: string | null;
}

export function ProductGrid({
  products,
  signedImageUrls,
  lastRunStatusByProduct,
  folders,
  folderId,
}: ProductGridProps) {
  const { query } = useProductSearch();
  const q = query.trim().toLowerCase();
  const isSearching = q.length > 0;

  // Searching deliberately ignores the folder scope: a product filed away in
  // a folder must never be invisible to a search from the root.
  const inScope = useMemo(
    () => products.filter((p) => (folderId === null ? p.folder_id === null : p.folder_id === folderId)),
    [products, folderId],
  );

  const visible = useMemo(() => {
    if (!isSearching) return inScope;
    return products.filter((p) => p.title.toLowerCase().includes(q) || p.asin.toLowerCase().includes(q));
  }, [isSearching, inScope, products, q]);

  const crossesFolders = isSearching && visible.some((p) => p.folder_id !== folderId);

  if (!isSearching && inScope.length === 0) {
    const isRoot = folderId === null;
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted">
          <PackageSearch className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {isRoot ? "No products yet" : "This folder is empty"}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {isRoot
              ? "Add your first Amazon product to start tracking its competitors."
              : "Move products in from the main list, or add a new one directly to this folder."}
          </p>
        </div>
        <Button asChild>
          <Link href={isRoot ? "/products/new" : `/products/new?folder=${folderId}`}>
            <Plus className="h-4 w-4" /> {isRoot ? "Add your first product" : "Add product to this folder"}
          </Link>
        </Button>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-foreground">No products match &quot;{query}&quot;</p>
        <p className="text-sm text-muted-foreground">Try a different title or ASIN.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {crossesFolders && (
        <p className="text-xs text-muted-foreground">Showing matches from every folder.</p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence initial={false}>
          {visible.map((product, index) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: "easeOut" }}
            >
              <ProductCard
                product={product}
                imageUrl={product.image_path ? signedImageUrls[product.image_path] : undefined}
                lastRunStatus={lastRunStatusByProduct[product.id]}
                folders={folders}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
