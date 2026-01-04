/**
 * Persistent State Manager
 * Uygulama arka planda uyurken bile kalıcı olarak room_id, chat_id, match_id saklar
 */
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

// Keys
const KEYS = {
  LAST_ROOM_ID: "persistent_last_room_id",
  LAST_CHAT_ID: "persistent_last_chat_id",
  LAST_MATCH_ID: "persistent_last_match_id",
  LAST_TOURNAMENT_ID: "persistent_last_tournament_id",
  CACHED_SESSION: "persistent_cached_session",
  BUFFERED_MESSAGES: "persistent_buffered_messages",
  LAST_CONNECTION_STATE: "persistent_last_connection_state",
};

// Generic get/set with fallback for web
// 🔧 KRİTİK: Hem localStorage hem Preferences kullan (sync + kalıcı)
const isNative = Capacitor.isNativePlatform();

async function setItem(key: string, value: string): Promise<void> {
  // Her zaman localStorage'a yaz (sync erişim için)
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // localStorage doluysa sessizce devam et
  }
  
  if (isNative) {
    await Preferences.set({ key, value });
  }
}

async function getItem(key: string): Promise<string | null> {
  // Önce localStorage'dan dene (sync, hızlı)
  const localValue = localStorage.getItem(key);
  if (localValue) {
    return localValue;
  }
  
  // Native'de Preferences'dan da kontrol et
  if (isNative) {
    const { value } = await Preferences.get({ key });
    
    // Preferences'da varsa localStorage'a da kopyala
    if (value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        // localStorage doluysa sessizce devam et
      }
    }
    
    return value;
  }
  
  return null;
}

async function removeItem(key: string): Promise<void> {
  localStorage.removeItem(key);
  
  if (isNative) {
    await Preferences.remove({ key });
  }
}

// ==================== ROOM ID ====================
export async function setLastRoomId(roomId: string | null): Promise<void> {
  console.log("[PersistentState] 💾 Setting last room ID:", roomId);
  if (roomId) {
    await setItem(KEYS.LAST_ROOM_ID, roomId);
  } else {
    await removeItem(KEYS.LAST_ROOM_ID);
  }
}

export async function getLastRoomId(): Promise<string | null> {
  const value = await getItem(KEYS.LAST_ROOM_ID);
  console.log("[PersistentState] 📖 Read last room ID:", value);
  return value;
}

// ==================== CHAT ID ====================
export async function setLastChatId(chatId: string | null): Promise<void> {
  console.log("[PersistentState] 💾 Setting last chat ID:", chatId);
  if (chatId) {
    await setItem(KEYS.LAST_CHAT_ID, chatId);
  } else {
    await removeItem(KEYS.LAST_CHAT_ID);
  }
}

export async function getLastChatId(): Promise<string | null> {
  const value = await getItem(KEYS.LAST_CHAT_ID);
  console.log("[PersistentState] 📖 Read last chat ID:", value);
  return value;
}

// ==================== MATCH ID (Tournament) ====================
export async function setLastMatchId(matchId: string | null): Promise<void> {
  console.log("[PersistentState] 💾 Setting last match ID:", matchId);
  if (matchId) {
    await setItem(KEYS.LAST_MATCH_ID, matchId);
  } else {
    await removeItem(KEYS.LAST_MATCH_ID);
  }
}

export async function getLastMatchId(): Promise<string | null> {
  const value = await getItem(KEYS.LAST_MATCH_ID);
  console.log("[PersistentState] 📖 Read last match ID:", value);
  return value;
}

// ==================== TOURNAMENT ID ====================
export async function setLastTournamentId(tournamentId: string | null): Promise<void> {
  console.log("[PersistentState] 💾 Setting last tournament ID:", tournamentId);
  if (tournamentId) {
    await setItem(KEYS.LAST_TOURNAMENT_ID, tournamentId);
  } else {
    await removeItem(KEYS.LAST_TOURNAMENT_ID);
  }
}

export async function getLastTournamentId(): Promise<string | null> {
  const value = await getItem(KEYS.LAST_TOURNAMENT_ID);
  console.log("[PersistentState] 📖 Read last tournament ID:", value);
  return value;
}

// ==================== CACHED SESSION ====================
interface CachedSession {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function setCachedSession(session: CachedSession | null): Promise<void> {
  console.log("[PersistentState] 💾 Setting cached session:", session?.userId?.slice(-8));
  if (session) {
    await setItem(KEYS.CACHED_SESSION, JSON.stringify(session));
  } else {
    await removeItem(KEYS.CACHED_SESSION);
  }
}

export async function getCachedSession(): Promise<CachedSession | null> {
  try {
    const value = await getItem(KEYS.CACHED_SESSION);
    if (!value) return null;
    const session = JSON.parse(value) as CachedSession;
    console.log("[PersistentState] 📖 Read cached session:", session?.userId?.slice(-8));
    return session;
  } catch {
    return null;
  }
}

// ==================== BUFFERED MESSAGES ====================
interface BufferedMessage {
  topic: string;
  event: string;
  payload: any;
  timestamp: number;
}

export async function addBufferedMessage(message: BufferedMessage): Promise<void> {
  try {
    const existing = await getBufferedMessages();
    // Max 50 mesaj tut
    const updated = [...existing, message].slice(-50);
    await setItem(KEYS.BUFFERED_MESSAGES, JSON.stringify(updated));
    console.log("[PersistentState] 📨 Buffered message added, total:", updated.length);
  } catch (e) {
    console.error("[PersistentState] Error buffering message:", e);
  }
}

export async function getBufferedMessages(): Promise<BufferedMessage[]> {
  try {
    const value = await getItem(KEYS.BUFFERED_MESSAGES);
    if (!value) return [];
    return JSON.parse(value) as BufferedMessage[];
  } catch {
    return [];
  }
}

export async function clearBufferedMessages(): Promise<void> {
  await removeItem(KEYS.BUFFERED_MESSAGES);
  console.log("[PersistentState] 🗑️ Buffered messages cleared");
}

// ==================== CONNECTION STATE ====================
interface ConnectionState {
  isConnected: boolean;
  lastConnectedAt: number;
  reconnectAttempts: number;
}

export async function setConnectionState(state: ConnectionState): Promise<void> {
  await setItem(KEYS.LAST_CONNECTION_STATE, JSON.stringify(state));
}

export async function getConnectionState(): Promise<ConnectionState | null> {
  try {
    const value = await getItem(KEYS.LAST_CONNECTION_STATE);
    if (!value) return null;
    return JSON.parse(value) as ConnectionState;
  } catch {
    return null;
  }
}

// ==================== CLEAR ALL ====================
export async function clearAllPersistentState(): Promise<void> {
  console.log("[PersistentState] 🗑️ Clearing all persistent state");
  await Promise.all([
    removeItem(KEYS.LAST_ROOM_ID),
    removeItem(KEYS.LAST_CHAT_ID),
    removeItem(KEYS.LAST_MATCH_ID),
    removeItem(KEYS.LAST_TOURNAMENT_ID),
    removeItem(KEYS.BUFFERED_MESSAGES),
    removeItem(KEYS.LAST_CONNECTION_STATE),
    // Session'ı silmiyoruz - optimistic auth için gerekli
  ]);
}
