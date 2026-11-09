import initSqlJs, { type SqlJsStatic } from 'sql.js';

let sqlPromise: Promise<SqlJsStatic> | null = null;

/**
 * Loads and caches the SQL.js WebAssembly / JavaScript engine.
 * Automatically adapts between Node.js / Vitest environment and Vite browser bundling.
 */
export async function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = (async () => {
      const isNode = typeof window === 'undefined' || (typeof process !== 'undefined' && Boolean(process.versions?.node));

      if (isNode) {
        return initSqlJs();
      }

      try {
        // Vite asset url resolution
        const wasmModule = await import('sql.js/dist/sql-wasm.wasm?url');
        const wasmUrl = wasmModule.default;
        return initSqlJs({
          locateFile: () => wasmUrl,
        });
      } catch {
        return initSqlJs();
      }
    })();
  }

  return sqlPromise;
}
