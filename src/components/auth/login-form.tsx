"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signInAction } from "@/lib/actions/auth-actions";
import type { ActionResult } from "@/lib/utils/result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import Link from "next/link";

const initialState: ActionResult<null> = { ok: false, code: "validation", message: "" };

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const linkError = searchParams.get("error");

  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  const fieldErrors = !state.ok ? state.fieldErrors : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
        <p className="text-sm text-muted-foreground">Access the LAETO LTD price tracker.</p>
      </div>

      {linkError && (
        <div role="alert" className="rounded-md border border-status-failed bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
          {linkError === "expired_link"
            ? "That link has expired or already been used. Request a new one."
            : "That link is invalid. Please try again."}
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="next" value={next} />

        <Field label="Email" htmlFor="email" error={fieldErrors?.email?.[0]}>
          <Input id="email" name="email" type="email" autoComplete="email" required invalid={Boolean(fieldErrors?.email)} />
        </Field>

        <Field label="Password" htmlFor="password" error={fieldErrors?.password?.[0]}>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
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

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Forgot password?
          </Link>
        </div>

        {!state.ok && state.message && !fieldErrors && (
          <div role="alert" className="rounded-md border border-status-failed bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
            {state.message}
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </motion.div>
  );
}
