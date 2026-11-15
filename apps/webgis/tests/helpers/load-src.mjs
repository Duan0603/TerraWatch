import { register } from 'node:module';

// Registers the test-only hooks once per process, then imports a module from src/ (path relative to src/).
let registered = false;
// fresh=true bypasses the module cache so module-level state (e.g. a cached AudioContext) starts clean.
let n = 0;
export async function importSrc(relPath, { fresh = false } = {}) {
  if (!registered) {
    register('./stub-loader.mjs', import.meta.url);
    registered = true;
  }
  return import(new URL(`../../src/${relPath}`, import.meta.url).href + (fresh ? `?fresh=${++n}` : ''));
}

// Replaces globalThis[name] (e.g. localStorage, window, document) and returns a restore function.
export function setGlobal(name, value) {
  const prev = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  return () => (prev ? Object.defineProperty(globalThis, name, prev) : delete globalThis[name]);
}

// Minimal localStorage backed by a Map.
export function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    keys: () => [...m.keys()]
  };
}
