"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/utils/result";
import { getSiteUrl } from "@/lib/utils/env";

export async function signInAction(_prev: unknown, formData: FormData): Promise<ActionResult<null>> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return fail("unauthenticated", "Incorrect email or password.");
  }

  const next = typeof formData.get("next") === "string" ? (formData.get("next") as string) : "/dashboard";
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signOutAction(scope: "local" | "global" = "local"): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope });
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return fail("validation", "Enter a valid email address.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabase();
  // Always return success regardless of whether the email exists, so this
  // endpoint cannot be used to enumerate registered accounts.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?type=recovery`,
  });
  return ok(null);
}

export async function resetPasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult<null>> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabase();
  // Requires an active (recovery) session, established by /auth/confirm.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail("unknown", "Could not reset your password. Request a new reset link and try again.");
  }
  redirect("/dashboard");
}

export async function changePasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabase();
  // Re-verify the current password before allowing the change.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    return fail("validation", "Current password is incorrect.", { currentPassword: ["Current password is incorrect."] });
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) {
    return fail("unknown", "Could not change your password. Please try again.");
  }
  return ok(null);
}

export async function signOutAllSessionsAction(): Promise<ActionResult<null>> {
  await requireUser();
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    return fail("unknown", "Could not sign out of all sessions. Please try again.");
  }
  redirect("/login");
}
