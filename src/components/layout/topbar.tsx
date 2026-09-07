"use client";

import Link from "next/link";
import { Search, Plus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetTrigger } from "@/components/ui/sheet";
import { UserMenu } from "@/components/layout/user-menu";
import { LogsDrawer } from "@/components/reports/logs-drawer";
import { useProductSearch } from "@/components/layout/search-context";

export function Topbar({ userEmail }: { userEmail: string }) {
  const { query, setQuery } = useProductSearch();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            L
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">LAETO LTD</span>
        </Link>

        <nav className="hidden shrink-0 items-center gap-1 md:flex">
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Dashboard
          </Link>
        </nav>

        <div className="relative ml-auto max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or ASIN..."
            aria-label="Search products by title or ASIN"
            className="pl-9"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/products/new">
              <Plus className="h-4 w-4" /> Add product
            </Link>
          </Button>
          <Button asChild size="icon" variant="primary" className="sm:hidden" aria-label="Add product">
            <Link href="/products/new">
              <Plus className="h-4 w-4" />
            </Link>
          </Button>

          <LogsDrawer>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Report activity logs">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Logs</span>
              </Button>
            </SheetTrigger>
          </LogsDrawer>

          <UserMenu email={userEmail} />
        </div>
      </div>
    </header>
  );
}
