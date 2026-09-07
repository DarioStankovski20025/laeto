import type { ReactNode } from "react";
import { SearchProvider } from "@/components/layout/search-context";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail: string;
}) {
  return (
    <SearchProvider>
      <div className="flex min-h-screen flex-col">
        <Topbar userEmail={userEmail} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </SearchProvider>
  );
}
