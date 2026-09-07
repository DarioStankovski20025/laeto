"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { createCompetitorAction, updateCompetitorAction } from "@/lib/actions/competitor-actions";
import type { ActionResult } from "@/lib/utils/result";
import type { Competitor } from "@/lib/data/competitors";

interface CompetitorFormDialogProps {
  productId: string;
  competitor?: Competitor;
  disabled?: boolean;
  disabledReason?: string;
}

export function CompetitorFormDialog({ productId, competitor, disabled, disabledReason }: CompetitorFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<Competitor> | null>(null);
  const isEdit = Boolean(competitor);
  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setResult(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Using onSubmit + preventDefault (rather than the form's `action`
    // prop) so a failed submission does NOT trigger React 19's automatic
    // form-reset-on-action-dispatch — the user's input must survive a
    // validation or conflict error so they can fix it in place.
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      // Calling the Server Action directly (rather than through
      // useActionState) lets the success path run as a normal async
      // callback here — the idiomatic place for a side effect like a toast
      // or closing the dialog — instead of reacting to state changes from
      // an effect.
      const action = isEdit
        ? updateCompetitorAction.bind(null, productId, competitor!.id)
        : createCompetitorAction.bind(null, productId);
      const outcome = await action(null, formData);
      if (outcome.ok) {
        toast.success(isEdit ? "Competitor updated." : "Competitor added.");
        setOpen(false);
      } else {
        setResult(outcome);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" aria-label="Edit competitor">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={disabled} title={disabled ? disabledReason : undefined}>
            <Plus className="h-4 w-4" /> Add competitor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit competitor" : "Add competitor"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this competitor's details." : "Track a new Amazon competitor for this product."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Competitor title" htmlFor="c-title" error={fieldErrors?.title?.[0]}>
            <Input id="c-title" name="title" required defaultValue={competitor?.title} invalid={Boolean(fieldErrors?.title)} />
          </Field>

          <Field label="ASIN" htmlFor="c-asin" error={fieldErrors?.asin?.[0]} hint="Exactly 10 letters or numbers.">
            <Input
              id="c-asin"
              name="asin"
              required
              maxLength={10}
              defaultValue={competitor?.asin}
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
              }}
              invalid={Boolean(fieldErrors?.asin)}
              className="font-mono uppercase"
            />
          </Field>

          <Field label="Amazon URL" htmlFor="c-url" error={fieldErrors?.amazonUrl?.[0]} hint="Full https://www.amazon.* product link.">
            <Input
              id="c-url"
              name="amazonUrl"
              type="url"
              required
              defaultValue={competitor?.amazon_url}
              invalid={Boolean(fieldErrors?.amazonUrl)}
            />
          </Field>

          {result && !result.ok && result.message && !fieldErrors && (
            <div role="alert" className="rounded-md border border-status-failed bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
              {result.message}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add competitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
