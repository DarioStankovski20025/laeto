"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { ImageOff, Pencil, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "@/components/reports/run-status-badge";
import { CheckNowModal } from "@/components/products/check-now-modal";
import { DeleteProductDialog } from "@/components/products/delete-product-dialog";
import { setProductNotifyAction } from "@/lib/actions/product-actions";
import { formatRelativeTime } from "@/lib/utils/format";
import type { ProductListItem } from "@/lib/data/products";
import type { ReportRunStatus } from "@/lib/types/database";

interface ProductCardProps {
  product: ProductListItem;
  imageUrl: string | undefined;
  lastRunStatus: ReportRunStatus | undefined;
}

export function ProductCard({ product, imageUrl, lastRunStatus }: ProductCardProps) {
  const [notifyEnabled, setNotifyEnabled] = useState(product.notify_enabled);
  const [isPending, startTransition] = useTransition();
  const [imageFailed, setImageFailed] = useState(false);

  function handleNotifyChange(checked: boolean) {
    setNotifyEnabled(checked);
    startTransition(async () => {
      const result = await setProductNotifyAction(product.id, checked);
      if (!result.ok) {
        setNotifyEnabled(!checked);
        toast.error(result.message);
      }
    });
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-md">
      <div className="relative aspect-square w-full bg-surface-muted">
        {imageUrl && !imageFailed ? (
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            unoptimized
            className="object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{product.title}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{product.asin}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {product.competitor_count} of 20 competitors
          </span>
          {lastRunStatus && <RunStatusBadge status={lastRunStatus} />}
        </div>

        <p className="text-xs text-muted-foreground">
          Last checked: {formatRelativeTime(product.last_checked_at)}
        </p>

        <div className="mt-auto flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Notify me</span>
            <Switch checked={notifyEnabled} onCheckedChange={handleNotifyChange} disabled={isPending} aria-label="Toggle daily monitoring" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CheckNowModal productId={product.id} productTitle={product.title} competitorCount={product.competitor_count} />
            <Button asChild variant="outline" size="sm">
              <Link href={`/products/${product.id}/competitors`}>
                <Users className="h-4 w-4" /> Competitors
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label={`Edit ${product.title}`}>
              <Link href={`/products/${product.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <DeleteProductDialog productId={product.id} productTitle={product.title} />
          </div>
        </div>
      </div>
    </Card>
  );
}
