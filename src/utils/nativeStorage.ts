/**
 * Native Storage Utility
 * 🔥 Android/iOS'te Capacitor Preferences kullanır
 * Web'de localStorage kullanır
 * 
 * Bu dosya tüm localStorage kullanımlarını native storage ile değiştirir
 */

import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();

// ==================== TEMEL FONKSİYONLAR ====================

/**
 * Değer kaydet - Native'de Preferences, Web'de localStorage
 */
export async function setItem(key: string, value: string): Promise<void> {
  if (isNative) {
    await Preferences.set({ key, value });
  } else {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("[NativeStorage] localStorage yazma hatası:", e);
    }
  }
}

/**
 * Değer oku - Native'de Preferences, Web'de localStorage
 */
export async function getItem(key: string): Promise<string | null> {
  if (isNative) {
    const { value } = await Preferences.get({ key });
    return value;
  } else {
    return localStorage.getItem(key);
  }
}

/**
 * Değer sil - Native'de Preferences, Web'de localStorage
 */
export async function removeItem(key: string): Promise<void> {
  if (isNative) {
    await Preferences.remove({ key });
  } else {
    localStorage.removeItem(key);
  }
}

/**
 * Tüm verileri temizle - Native'de Preferences, Web'de localStorage
 */
export async function clear(): Promise<void> {
  if (isNative) {
    await Preferences.clear();
  } else {
    localStorage.clear();
  }
}

// ==================== JSON HELPER'LAR ====================

/**
 * JSON objesi kaydet
 */
export async function setJSON<T>(key: string, value: T): Promise<void> {
  try {
    await setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("[NativeStorage] JSON stringify hatası:", e);
  }
}

/**
 * JSON objesi oku
 */
export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const value = await getItem(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (e) {
    console.error("[NativeStorage] JSON parse hatası:", e);
    return null;
  }
}

// ==================== SYNC VERSİYONLAR (Web için) ====================
// Native'de kullanılmamalı! Sadece web fallback için

/**
 * Senkron değer oku - SADECE WEB'DE KULLAN
 * Native'de null döner!
 */
export function getItemSync(key: string): string | null {
  if (isNative) {
    console.warn("[NativeStorage] ⚠️ getItemSync native'de çalışmaz! getItem kullanın.");
    return null;
  }
  return localStorage.getItem(key);
}

/**
 * Senkron değer kaydet - SADECE WEB'DE KULLAN
 * Native'de çalışmaz!
 */
export function setItemSync(key: string, value: string): void {
  if (isNative) {
    console.warn("[NativeStorage] ⚠️ setItemSync native'de çalışmaz! setItem kullanın.");
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("[NativeStorage] localStorage yazma hatası:", e);
  }
}

// ==================== ÖZEL STORAGE KEY'LER ====================

export const STORAGE_KEYS = {
  // Profile & Cache
  CACHED_PROFILE: "cached_profile",
  
  // Settings
  SETTINGS: "kelimeci-settings",
  THEME: "kelimeci-theme",
  PERMISSIONS_COMPLETED: "kelimeci-permissions-completed",
  
  // Games
  MEMORY_GAME_PREFIX: "memoryGame_",
  PUZZLE_BEST_TIME_PREFIX: "bestTime",
  
  // Ads
  LAST_AD_DATE: "lastAdDate",
  AD_COUNT: "adCount",
  
  // Match
  BANNED_MATCH_IDS: "banned_match_ids_v1",
  TOURNAMENT_MATCH_COMPLETED_PREFIX: "tournament_match_completed_",
} as const;

// ==================== EXPORT ALL ====================

export const nativeStorage = {
  setItem,
  getItem,
  removeItem,
  clear,
  setJSON,
  getJSON,
  getItemSync,
  setItemSync,
  isNative,
  KEYS: STORAGE_KEYS,
};

export default nativeStorage;
