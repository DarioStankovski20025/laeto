"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, FolderInput, FolderMinus, Loader2 } from "lucide-react";
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
import { setProductFolderAction } from "@/lib/actions/folder-actions";
import type { Folder } from "@/lib/data/folders";

interface FolderPickerDialogProps {
  productId: string;
  productTitle: string;
  currentFolderId: string | null;
  folders: Folder[];
}

/**
 * The folder icon on a product card: move this product into a folder, or —
 * when it is already in one — into a different folder, or out of folders
 * entirely.
 */
export function FolderPickerDialog({ productId, productTitle, currentFolderId, folders }: FolderPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  function move(folderId: string | null, label: string) {
    setPendingTarget(folderId ?? "__none__");
    startTransition(async () => {
      const result = await setProductFolderAction(productId, folderId);
      setPendingTarget(null);
      if (result.ok) {
        toast.success(folderId ? `Moved to "${label}".` : "Removed from folder.");
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  const others = folders.filter((f) => f.id !== currentFolderId);
  const current = folders.find((f) => f.id === currentFolderId) ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Move "${productTitle}" to a folder`}>
          <FolderInput className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move &quot;{productTitle}&quot;</DialogTitle>
          <DialogDescription>
            {current
              ? `Currently in "${current.name}". Choose another folder, or remove it from this one.`
              : "Choose a folder for this product. Folders only affect this dashboard."}
          </DialogDescription>
        </DialogHeader>

        {folders.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            No folders yet. Create one from the dashboard first.
          </p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {current && (
              <li>
                <div className="flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-status-completed" />
                  <span className="flex-1 truncate">{current.name}</span>
                  <span className="text-xs text-muted-foreground">Current</span>
                </div>
              </li>
            )}
            {others.map((folder) => (
              <li key={folder.id}>
                <button
                  type="button"
                  onClick={() => move(folder.id, folder.name)}
                  disabled={isPending}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                >
                  {pendingTarget === folder.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderInput className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate">{folder.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          {current && (
            <Button variant="outline" onClick={() => move(null, "")} disabled={isPending}>
              {pendingTarget === "__none__" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderMinus className="h-4 w-4" />
              )}
              Remove from folder
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
