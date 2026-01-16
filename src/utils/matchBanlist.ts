// Simple persistent ban list for ended/abandoned Nakama matches
// Stores a small set of recent match IDs in native storage
// 🔥 V2: Native storage kullanır - localStorage Android'de güvenilmez!

import { nativeStorage, STORAGE_KEYS } from './nativeStorage';

const MAX_ITEMS = 20;

// 🔥 Cache - sık okumalar için
let cachedIds: string[] | null = null;

async function read(): Promise<string[]> {
  if (cachedIds !== null) return cachedIds;
  
  try {
    const arr = await nativeStorage.getJSON<string[]>(STORAGE_KEYS.BANNED_MATCH_IDS);
    cachedIds = Array.isArray(arr) ? arr.filter(Boolean) : [];
    return cachedIds;
  } catch {
    cachedIds = [];
    return [];
  }
}

async function write(ids: string[]): Promise<void> {
  const sliced = ids.slice(-MAX_ITEMS);
  cachedIds = sliced;
  await nativeStorage.setJSON(STORAGE_KEYS.BANNED_MATCH_IDS, sliced);
}

export const matchBanlist = {
  async add(id: string): Promise<void> {
    if (!id) return;
    const ids = await read();
    if (!ids.includes(id)) {
      ids.push(id);
      await write(ids);
    }
  },
  async has(id: string): Promise<boolean> {
    if (!id) return false;
    const ids = await read();
    return ids.includes(id);
  },
  async list(): Promise<string[]> {
    return read();
  },
  async clear(): Promise<void> {
    cachedIds = [];
    await write([]);
  }
};
