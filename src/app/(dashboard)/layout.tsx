import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/require-user";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return <AppShell userEmail={user.email ?? ""}>{children}</AppShell>;
}
