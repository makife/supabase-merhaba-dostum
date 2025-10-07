// Simple persistent ban list for ended/abandoned Nakama matches
// Stores a small set of recent match IDs in localStorage

const STORAGE_KEY = 'banned_match_ids_v1';
const MAX_ITEMS = 20;

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-MAX_ITEMS)));
  } catch {}
}

export const matchBanlist = {
  add(id: string) {
    if (!id) return;
    const ids = read();
    if (!ids.includes(id)) {
      ids.push(id);
      write(ids);
    }
  },
  has(id: string) {
    if (!id) return false;
    return read().includes(id);
  },
  list() {
    return read();
  },
  clear() {
    write([]);
  }
};
