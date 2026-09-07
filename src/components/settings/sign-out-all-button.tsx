"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAllSessionsAction } from "@/lib/actions/auth-actions";

export function SignOutAllButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await signOutAllSessionsAction();
      if (result && !result.ok) toast.error(result.message);
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Sign out of all sessions
    </Button>
  );
}
