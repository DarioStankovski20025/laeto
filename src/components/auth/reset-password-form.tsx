"use client";

import { useActionState, useState } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { resetPasswordAction } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import type { ActionResult } from "@/lib/utils/result";

const initialState: ActionResult<null> = { ok: false, code: "validation", message: "" };

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const fieldErrors = !state.ok ? state.fieldErrors : undefined;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Choose a strong password for your account.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <Field label="New password" htmlFor="password" error={fieldErrors?.password?.[0]} hint="At least 8 characters.">
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              invalid={Boolean(fieldErrors?.password)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword" error={fieldErrors?.confirmPassword?.[0]}>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
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

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Saving..." : "Save new password"}
        </Button>
      </form>
    </motion.div>
  );
}
