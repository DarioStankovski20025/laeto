"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createTeamMemberSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/utils/result";

export interface CreatedTeamMember {
  id: string;
  email: string;
}

/**
 * Creates a new login for a colleague. Any authenticated team member may do
 * this (shared-workspace model, no admin/staff role distinction) — the
 * password is set directly here (rather than an emailed invite link) since
 * the app has no SMTP configuration to rely on. Uses the service-role
 * client: account creation is a privileged operation with no RLS policy of
 * its own, gated only by requireUser() (must already be logged in).
 */
export async function createTeamMemberAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<CreatedTeamMember>> {
  await requireUser();

  const parsed = createTeamMemberSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (error) {
    const message = /already.*registered|already.*exists/i.test(error.message)
      ? "An account with that email already exists."
      : "Could not create the account. Please try again.";
    return fail("conflict", message);
  }

  revalidatePath("/settings");
  return ok({ id: data.user.id, email: data.user.email ?? parsed.data.email });
}
