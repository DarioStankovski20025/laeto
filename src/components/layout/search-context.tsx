"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SearchContextValue {
  query: string;
  setQuery: (value: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * Holds the global product search query as plain client state — deliberately
 * NOT wired through Next's router. Filtering ~30 already-fetched products is
 * instant client-side work; routing a query param through router.replace
 * would trigger a soft navigation (an RSC re-render round trip) for
 * something that should never leave the browser.
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQueryState] = useState("");
  const setQuery = useCallback((value: string) => setQueryState(value), []);
  return <SearchContext.Provider value={{ query, setQuery }}>{children}</SearchContext.Provider>;
}

export function useProductSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useProductSearch must be used within a SearchProvider");
  return ctx;
}
