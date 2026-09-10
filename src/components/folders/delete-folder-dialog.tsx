"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteFolderAction } from "@/lib/actions/folder-actions";

interface DeleteFolderDialogProps {
  folderId: string;
  folderName: string;
  productCount: number;
  /** Send the user back to the root after deleting the folder they're inside. */
  redirectToRoot?: boolean;
}

export function DeleteFolderDialog({ folderId, folderName, productCount, redirectToRoot }: DeleteFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteFolderAction(folderId);
      if (result.ok) {
        toast.success(`Folder "${folderName}" was deleted.`);
        setOpen(false);
        if (redirectToRoot) router.push("/dashboard");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Delete folder ${folderName}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete folder &quot;{folderName}&quot;?</DialogTitle>
          <DialogDescription>
            {productCount === 0
              ? "This folder is empty. Only the folder is removed."
              : `The ${productCount} product${productCount === 1 ? "" : "s"} in this folder will move back to the main list — nothing is deleted and monitoring is unaffected.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
