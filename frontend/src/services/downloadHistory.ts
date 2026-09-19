import { HistoryEntry } from '../types';

const STORAGE_KEY = 'insta_dl_history';
const MAX_ENTRIES = 50;

function notifyUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('instagrab_history_updated'));
  }
}

export function getHistory(): HistoryEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function addEntry(entry: HistoryEntry): void {
  const history = getHistory();
  // Deduplicate by filename or filepath or id
  const filtered = history.filter(e => {
    if (e.id === entry.id) return false;
    if (entry.filepath && e.filepath && entry.filepath === e.filepath) return false;
    if (entry.filename && e.filename && entry.filename === e.filename) return false;
    return true;
  });
  filtered.unshift(entry);
  if (filtered.length > MAX_ENTRIES) {
    filtered.pop();
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  notifyUpdate();
}

export function removeEntry(id: string): void {
  const history = getHistory();
  const updated = history.filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyUpdate();
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
  notifyUpdate();
}

export function mergeHelperHistory(helperEntries: HistoryEntry[]): HistoryEntry[] {
  const local = getHistory();
  const map = new Map<string, HistoryEntry>();

  // 1. Add helper disk entries (files that actually exist on PC)
  for (const h of helperEntries) {
    const key = h.filename.toLowerCase();
    map.set(key, h);
  }

  // 2. Overlay local entries (which have original source URLs)
  for (const l of local) {
    const key = l.filename.toLowerCase();
    if (map.has(key)) {
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        url: l.url || existing.url,
        platform: l.platform || existing.platform
      });
    } else {
      map.set(key, l);
    }
  }

  const combined = Array.from(map.values());
  combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return combined.slice(0, MAX_ENTRIES);
}

