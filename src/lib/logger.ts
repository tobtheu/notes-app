/**
 * Thin logging wrapper that writes to both the browser console and the
 * Tauri log backend (visible in the terminal via `cargo tauri dev`).
 *
 * Uses @tauri-apps/plugin-log when running inside Tauri; falls back to
 * plain console.* in browser/test environments.
 */

let _info: (msg: string) => Promise<void> = async () => {};
let _warn: (msg: string) => Promise<void> = async () => {};
let _error: (msg: string) => Promise<void> = async () => {};

// Lazily import the Tauri log plugin so the module works in non-Tauri envs too
if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
  import('@tauri-apps/plugin-log').then(({ info, warn, error }) => {
    _info = info;
    _warn = warn;
    _error = error;
  }).catch(() => {});
}

function serialize(...args: unknown[]): string {
  return args.map(a => {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
}

export const log = {
  info(...args: unknown[]) {
    const msg = serialize(...args);
    console.log(msg);
    _info(msg).catch(() => {});
  },
  warn(...args: unknown[]) {
    const msg = serialize(...args);
    console.warn(msg);
    _warn(msg).catch(() => {});
  },
  error(...args: unknown[]) {
    const msg = serialize(...args);
    console.error(msg);
    _error(msg).catch(() => {});
  },
};
