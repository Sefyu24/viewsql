import type { PGlite } from "@electric-sql/pglite";

export type PGliteOptions = {
  initSql?: string;
};

export async function createPGliteInstance(
  options?: PGliteOptions
): Promise<PGlite> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create();

  if (options?.initSql) {
    await db.exec(options.initSql);
  }

  return db;
}
