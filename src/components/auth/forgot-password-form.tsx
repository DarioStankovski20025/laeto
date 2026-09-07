"use client";

import { useActionState } from "react";
import { motion } from "motion/react";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import type { ActionResult } from "@/lib/utils/result";

const initialState: ActionResult<null> = { ok: false, code: "validation", message: "" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);
  const fieldErrors = !state.ok ? state.fieldErrors : undefined;

  if (state.ok) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start gap-4"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-status-completed-bg">
          <MailCheck className="h-5 w-5 text-status-completed" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            If an account exists for that address, a password reset link is on its way.
          </p>
        </div>
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-4 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset your password</h1>
        <p className="text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <Field label="Email" htmlFor="email" error={fieldErrors?.email?.[0]}>
          <Input id="email" name="email" type="email" autoComplete="email" required invalid={Boolean(fieldErrors?.email)} />
        </Field>

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Sending..." : "Send reset link"}
        </Button>

        <Link href="/login" className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </form>
    </motion.div>
  );
}
