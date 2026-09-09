"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Search, User, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CompetitorFormDialog } from "@/components/competitors/competitor-form-dialog";
import { DeleteCompetitorDialog } from "@/components/competitors/delete-competitor-dialog";
import { MAX_COMPETITORS_PER_PRODUCT } from "@/lib/validation/schemas";
import type { Product } from "@/lib/data/products";
import type { CompetitorWithAttribution } from "@/lib/data/competitors";

interface CompetitorsPageClientProps {
  product: Product;
  competitors: CompetitorWithAttribution[];
}

export function CompetitorsPageClient({ product, competitors }: CompetitorsPageClientProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return competitors;
    return competitors.filter((c) => c.title.toLowerCase().includes(q) || c.asin.toLowerCase().includes(q));
  }, [competitors, query]);

  const count = competitors.length;
  const atLimit = count >= MAX_COMPETITORS_PER_PRODUCT;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>

        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">{product.title}</h1>
            <p className="font-mono text-xs text-muted-foreground">{product.asin}</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span
            className={
              "text-sm font-medium " + (atLimit ? "text-status-processing" : "text-muted-foreground")
            }
          >
            {count} of {MAX_COMPETITORS_PER_PRODUCT} competitors
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search competitors..."
              aria-label="Search competitors by title or ASIN"
              className="pl-9 sm:w-64"
            />
          </div>
          <CompetitorFormDialog
            productId={product.id}
            disabled={atLimit}
            disabledReason={`Limit of ${MAX_COMPETITORS_PER_PRODUCT} competitors reached. Remove one before adding another.`}
          />
        </div>
      </div>

      {atLimit && (
        <div className="rounded-md border border-status-processing bg-status-processing-bg px-3 py-2 text-sm text-status-processing">
          This product has reached the limit of {MAX_COMPETITORS_PER_PRODUCT} competitors. Remove one before adding another.
        </div>
      )}

      {competitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No competitors yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add up to {MAX_COMPETITORS_PER_PRODUCT} Amazon competitors to track alongside this product.
          </p>
          <CompetitorFormDialog productId={product.id} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No competitors match &quot;{query}&quot;.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">ASIN</th>
                <th className="px-4 py-2.5 font-medium">Link</th>
                <th className="px-4 py-2.5 font-medium">Added by</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((competitor) => (
                <tr key={competitor.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">{competitor.title}</td>
                  <td className="px-4 py-3 font-mono text-xs">{competitor.asin}</td>
                  <td className="px-4 py-3">
                    <a
                      href={competitor.amazon_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                    >
                      View on Amazon <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {competitor.created_by_profile ? (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {competitor.created_by_profile.full_name ?? competitor.created_by_profile.email}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <CompetitorFormDialog productId={product.id} competitor={competitor} />
                      <DeleteCompetitorDialog
                        productId={product.id}
                        competitorId={competitor.id}
                        competitorTitle={competitor.title}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
