"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "!bg-surface !text-foreground !border-border",
          title: "!text-foreground",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}
