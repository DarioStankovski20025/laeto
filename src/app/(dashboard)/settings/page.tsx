import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import * as profilesData from "@/lib/data/profiles";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { SignOutAllButton } from "@/components/settings/sign-out-all-button";

export const metadata: Metadata = { title: "Settings — LAETO LTD" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const profile = await profilesData.getProfile(supabase, user.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and report preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account email and session controls.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
            <p className="mt-1 text-sm text-foreground">{user.email}</p>
          </div>

          <div className="h-px bg-border" />

          <ChangePasswordForm />

          <div className="h-px bg-border" />

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Sessions</p>
            <SignOutAllButton />
          </div>
        </CardContent>
      </Card>

      {profile && <SettingsForm profile={profile} />}
    </div>
  );
}
