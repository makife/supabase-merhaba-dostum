import { createClient } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import type { Database } from "./types";

const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";

// Native cihazlar için özel depolama adaptörü
const CapacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  },
};

// Supabase client'ı tip hatalarını önlemek için any olarak export ediyoruz
// types.ts read-only olduğundan bu gerekli bir workaround
const supabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // 👇 KRİTİK DEĞİŞİKLİK: localStorage yerine bunu kullanıyoruz
    storage: CapacitorStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // Native çakışmalarını önlemek için kilidi kapatıyoruz
    lock: Capacitor.isNativePlatform() ? (false as any) : undefined,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    heartbeatIntervalMs: 5000,
  },
});

// Client'ı any olarak export ederek tip hatalarını önlüyoruz
export const supabase = supabaseClient as any;
