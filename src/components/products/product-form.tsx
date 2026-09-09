"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/products/image-uploader";
import { createProductAction, updateProductAction } from "@/lib/actions/product-actions";
import type { ActionResult } from "@/lib/utils/result";
import type { Product } from "@/lib/data/products";

interface ProductFormProps {
  mode: "create" | "edit";
  product?: Product;
  existingImageUrl?: string | null;
}

export function ProductForm({ mode, product, existingImageUrl }: ProductFormProps) {
  const router = useRouter();
  const [productId] = useState(() => product?.id ?? crypto.randomUUID());
  const [imagePath, setImagePath] = useState<string | null>(product?.image_path ?? null);
  const [notifyEnabled, setNotifyEnabled] = useState(product?.notify_enabled ?? true);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<Product> | null>(null);
  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // onSubmit + preventDefault (rather than the form's `action` prop) so a
    // failed submission — e.g. a duplicate ASIN — does NOT trigger React's
    // automatic form-reset-on-action-dispatch. The user's typed title/ASIN
    // must survive a validation error so they can fix it in place.
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const action = mode === "create" ? createProductAction : updateProductAction.bind(null, productId);
      const outcome = await action(null, formData);
      if (outcome.ok) {
        toast.success(mode === "create" ? "Product created." : "Product updated.");
        router.push("/dashboard");
      } else {
        setResult(outcome);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={productId} />
      <input type="hidden" name="notifyEnabled" value={String(notifyEnabled)} />
      <input type="hidden" name="imagePath" value={imagePath ?? ""} />

      <Field label="Product image" htmlFor="product-image-input">
        <ImageUploader
          productId={productId}
          existingImageUrl={existingImageUrl}
          onChange={setImagePath}
        />
      </Field>

      <Field label="ASIN" htmlFor="asin" error={fieldErrors?.asin?.[0]} hint="Exactly 10 letters or numbers.">
        <Input
          id="asin"
          name="asin"
          required
          maxLength={10}
          defaultValue={product?.asin}
          onChange={(e) => {
            e.target.value = e.target.value.toUpperCase();
          }}
          invalid={Boolean(fieldErrors?.asin)}
          className="font-mono uppercase"
        />
      </Field>

      <Field label="Product title" htmlFor="title" error={fieldErrors?.title?.[0]}>
        <Input id="title" name="title" required defaultValue={product?.title} invalid={Boolean(fieldErrors?.title)} />
      </Field>

      <Field
        label="Amazon URL"
        htmlFor="amazonUrl"
        error={fieldErrors?.amazonUrl?.[0]}
        hint="Full https://www.amazon.* product link."
      >
        <Input
          id="amazonUrl"
          name="amazonUrl"
          type="url"
          required
          defaultValue={product?.amazon_url ?? ""}
          invalid={Boolean(fieldErrors?.amazonUrl)}
        />
      </Field>

      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <p className="text-sm font-medium text-foreground">Notify me</p>
          <p className="text-xs text-muted-foreground">Include this product in daily monitoring.</p>
        </div>
        <Switch checked={notifyEnabled} onCheckedChange={setNotifyEnabled} aria-label="Toggle daily monitoring" />
      </div>

      {result && !result.ok && result.message && !fieldErrors && (
        <div role="alert" className="rounded-md border border-status-failed bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
          {result.message}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "create" ? "Create product" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
