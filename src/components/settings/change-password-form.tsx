"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { changePasswordAction } from "@/lib/actions/auth-actions";
import type { ActionResult } from "@/lib/utils/result";

const initialState: ActionResult<null> = { ok: false, code: "validation", message: "" };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);
  const [show, setShow] = useState(false);
  const fieldErrors = !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.ok) toast.success("Password changed.");
  }, [state]);

  return (
    <form action={formAction} id="password" className="flex flex-col gap-4 scroll-mt-20">
      <Field label="Current password" htmlFor="currentPassword" error={fieldErrors?.currentPassword?.[0]}>
        <Input
          id="currentPassword"
          name="currentPassword"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          required
          invalid={Boolean(fieldErrors?.currentPassword)}
        />
      </Field>

      <Field label="New password" htmlFor="newPassword" error={fieldErrors?.newPassword?.[0]} hint="At least 8 characters.">
        <div className="relative">
          <Input
            id="newPassword"
            name="newPassword"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            invalid={Boolean(fieldErrors?.newPassword)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={show ? "Hide passwords" : "Show passwords"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      <Field label="Confirm new password" htmlFor="confirmPassword" error={fieldErrors?.confirmPassword?.[0]}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          invalid={Boolean(fieldErrors?.confirmPassword)}
        />
      </Field>

      {!state.ok && state.message && !fieldErrors && (
        <div role="alert" className="rounded-md border border-status-failed bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
          {state.message}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Change password
        </Button>
      </div>
    </form>
  );
}
