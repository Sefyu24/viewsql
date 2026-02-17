import type { PGlite } from "@electric-sql/pglite";

export type PGliteOptions = {
  initSql?: string;
};

/**
 * Cache the compiled WASM module so we only fetch/compile once per session.
 * WebAssembly.Module is safely reusable across multiple instantiations,
 * unlike a Response whose body can only be read once.
 */
let cachedWasmModule: WebAssembly.Module | null = null;

async function getWasmModule(): Promise<WebAssembly.Module> {
  if (cachedWasmModule) return cachedWasmModule;
  const resp = await fetch("/pglite/pglite.wasm");
  const bytes = await resp.arrayBuffer();
  cachedWasmModule = await WebAssembly.compile(bytes);
  return cachedWasmModule;
}

export async function createPGliteInstance(
  options?: PGliteOptions
): Promise<PGlite> {
  const { PGlite } = await import("@electric-sql/pglite");
  const wasmModule = await getWasmModule();
  const db = await PGlite.create({ wasmModule });

  if (options?.initSql) {
    await db.exec(options.initSql);
  }

  return db;
}
