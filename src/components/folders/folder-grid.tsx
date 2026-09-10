"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Folder as FolderIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FolderFormDialog } from "@/components/folders/folder-form-dialog";
import { DeleteFolderDialog } from "@/components/folders/delete-folder-dialog";
import type { Folder } from "@/lib/data/folders";

interface FolderGridProps {
  folders: Folder[];
  /** Product count per folder id, computed once by the dashboard page. */
  counts: Record<string, number>;
}

export function FolderGrid({ folders, counts }: FolderGridProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Folders</h2>
        <FolderFormDialog />
      </div>

      {folders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No folders yet. Create one to group products — it only affects this dashboard, never what gets reported.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {folders.map((folder, index) => (
            <motion.div
              key={folder.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2), ease: "easeOut" }}
            >
              <Card className="flex items-center gap-3 p-3 transition-shadow duration-200 hover:shadow-md">
                <Link
                  href={`/dashboard?folder=${folder.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted">
                    <FolderIcon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{folder.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {counts[folder.id] ?? 0} product{(counts[folder.id] ?? 0) === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
                <div className="flex shrink-0 items-center">
                  <FolderFormDialog folder={folder} />
                  <DeleteFolderDialog
                    folderId={folder.id}
                    folderName={folder.name}
                    productCount={counts[folder.id] ?? 0}
                  />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
