/**
 * Per-browser persistence for convenience only (which toggles are on, where a flow was left).
 * Every access is guarded: private windows and blocked storage must not break the app.
 * Nothing here is shared between viewers and nothing sensitive is stored (all data is mock).
 */
const PREFIX = 'mol:';

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStore(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: state simply is not persisted */
  }
}

export function clearStore(key: string): void {
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** localStorage variant: survives closing the tab (used for Madfu Proposed resume). Guarded the same way. */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function clearLocal(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
