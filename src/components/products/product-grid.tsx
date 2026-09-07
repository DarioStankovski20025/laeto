"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { PackageSearch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProductSearch } from "@/components/layout/search-context";
import { ProductCard } from "@/components/products/product-card";
import type { ProductListItem } from "@/lib/data/products";
import type { ReportRunStatus } from "@/lib/types/database";

interface ProductGridProps {
  products: ProductListItem[];
  signedImageUrls: Record<string, string>;
  lastRunStatusByProduct: Record<string, ReportRunStatus>;
}

export function ProductGrid({ products, signedImageUrls, lastRunStatusByProduct }: ProductGridProps) {
  const { query } = useProductSearch();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q) || p.asin.toLowerCase().includes(q));
  }, [products, query]);

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted">
          <PackageSearch className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">No products yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add your first Amazon product to start tracking its competitors.
          </p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="h-4 w-4" /> Add your first product
          </Link>
        </Button>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-foreground">No products match &quot;{query}&quot;</p>
        <p className="text-sm text-muted-foreground">Try a different title or ASIN.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <AnimatePresence initial={false}>
        {filtered.map((product, index) => (
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
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
