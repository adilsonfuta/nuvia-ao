const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function readLocalDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const record = JSON.parse(raw) as { savedAt: number; value: T };
    if (!Number.isFinite(record.savedAt) || Date.now() - record.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return record.value;
  } catch { return null; }
}

export function writeLocalDraft<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value })); }
  catch { /* Storage can be unavailable or full; the form remains usable. */ }
}

export function clearLocalDraft(key: string) {
  try { localStorage.removeItem(key); } catch { /* Storage can be unavailable. */ }
}
