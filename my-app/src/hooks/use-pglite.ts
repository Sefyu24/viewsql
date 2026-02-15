"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PGlite } from "@electric-sql/pglite";
import { createPGliteInstance, type PGliteOptions } from "@/lib/pglite";

export type UsePGliteReturn = {
  db: PGlite | null;
  isLoading: boolean;
  error: Error | null;
  reinitialize: (options?: PGliteOptions) => Promise<void>;
};

export function usePGlite(options?: PGliteOptions): UsePGliteReturn {
  const [db, setDb] = useState<PGlite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const dbRef = useRef<PGlite | null>(null);

  const initialize = useCallback(async (opts?: PGliteOptions) => {
    setIsLoading(true);
    setError(null);

    // Close existing instance
    if (dbRef.current) {
      try {
        await dbRef.current.close();
      } catch {
        // ignore close errors
      }
      dbRef.current = null;
    }

    try {
      const instance = await createPGliteInstance(opts);
      if (!mountedRef.current) {
        await instance.close();
        return;
      }
      dbRef.current = instance;
      setDb(instance);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    initialize(options);

    return () => {
      mountedRef.current = false;
      if (dbRef.current) {
        dbRef.current.close().catch(() => {});
        dbRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reinitialize = useCallback(
    async (opts?: PGliteOptions) => {
      await initialize(opts);
    },
    [initialize]
  );

  return { db, isLoading, error, reinitialize };
}
