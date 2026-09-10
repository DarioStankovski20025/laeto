"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FolderPlus, Loader2, Pencil } from "lucide-react";
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
import { createFolderAction, renameFolderAction } from "@/lib/actions/folder-actions";
import type { ActionResult } from "@/lib/utils/result";
import type { Folder } from "@/lib/data/folders";

interface FolderFormDialogProps {
  /** Present for rename; omitted for create. */
  folder?: Folder;
}

export function FolderFormDialog({ folder }: FolderFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<Folder> | null>(null);
  const isEdit = Boolean(folder);
  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setResult(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // onSubmit + preventDefault so a failed submission does not trigger
    // React's automatic form reset — the typed name must survive an error.
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const action = isEdit ? renameFolderAction.bind(null, folder!.id) : createFolderAction;
      const outcome = await action(null, formData);
      if (outcome.ok) {
        toast.success(isEdit ? "Folder renamed." : "Folder created.");
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
          <Button variant="ghost" size="icon" aria-label={`Rename ${folder!.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline">
            <FolderPlus className="h-4 w-4" /> New folder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rename folder" : "New folder"}</DialogTitle>
          <DialogDescription>
            Folders only group products in this dashboard — they never change what gets reported.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Folder name" htmlFor="folder-name" error={fieldErrors?.name?.[0]}>
            <Input
              id="folder-name"
              name="name"
              required
              maxLength={100}
              autoFocus
              defaultValue={folder?.name}
              invalid={Boolean(fieldErrors?.name)}
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
              {isEdit ? "Save changes" : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
