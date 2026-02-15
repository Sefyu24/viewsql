"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePGlite, type UsePGliteReturn } from "@/hooks/use-pglite";
import type { PGliteOptions } from "@/lib/pglite";

const PGliteContext = createContext<UsePGliteReturn | null>(null);

export function PGliteProvider({
  children,
  options,
}: {
  children: ReactNode;
  options?: PGliteOptions;
}) {
  const pglite = usePGlite(options);

  return (
    <PGliteContext.Provider value={pglite}>{children}</PGliteContext.Provider>
  );
}

export function usePGliteContext(): UsePGliteReturn {
  const context = useContext(PGliteContext);
  if (!context) {
    throw new Error("usePGliteContext must be used within a PGliteProvider");
  }
  return context;
}
