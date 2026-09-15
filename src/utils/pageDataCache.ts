import { supabase } from "@/integrations/supabase/client";

/**
 * 🔥 Sayfa verisi ön-yükleme (prefetch) cache'i
 *
 * Amaç: kullanıcı parmağıyla kaydırmaya başladığı ANDA hedef sayfanın verisi
 * çekilmeye başlasın; sayfa açıldığında veri hazır olsun (spinner görünmesin).
 */

type CacheEntry = { data: any; at: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();

const DEFAULT_TTL = 20_000; // 20s

export function getCached<T = any>(key: string, ttl = DEFAULT_TTL): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > ttl) return null;
  return entry.data as T;
}

export function setCached(key: string, data: any) {
  cache.set(key, { data, at: Date.now() });
}

export function prefetch<T>(key: string, fetcher: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
  const cached = getCached<T>(key, ttl);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const p = fetcher()
    .then((data) => {
      setCached(key, data);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

/* ------------------------------------------------------------------ */
/* Liderlik tabloları                                                  */
/* ------------------------------------------------------------------ */

export const LB_KEYS = {
  season: "lb:season",
  weekly: "lb:weekly",
  monthly: "lb:monthly",
} as const;

export const prefetchLeaderboard = () => {
  prefetch(LB_KEYS.season, async () => {
    const { data } = await supabase.rpc("get_season_leaderboard", { limit_count: 50 });
    return Array.isArray(data) ? data : [];
  });
  prefetch(LB_KEYS.weekly, async () => {
    const { data } = await supabase.rpc("get_weekly_leaderboard", { limit_count: 100 });
    return Array.isArray(data) ? data : [];
  });
  prefetch(LB_KEYS.monthly, async () => {
    const { data } = await supabase.rpc("get_monthly_leaderboard", { limit_count: 100 });
    return Array.isArray(data) ? data : [];
  });
};

/* ------------------------------------------------------------------ */
/* Route bazlı prefetch                                               */
/* ------------------------------------------------------------------ */

export function prefetchRoute(route: string) {
  try {
    if (route === "/leaderboard") prefetchLeaderboard();
    // /profile, /market, /settings verileri UserContext üzerinden bellekte
  } catch (e) {
    // sessizce yut - prefetch kritik değil
  }
}
