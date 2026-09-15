/**
 * Persistent State Manager
 * Uygulama arka planda uyurken bile kalıcı olarak room_id, chat_id, match_id saklar
 * 
 * 🔥 V2: SADECE Preferences kullan - localStorage Android'de güvenilmez!
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

const isNative = Capacitor.isNativePlatform();

// 🔥 SADECE Preferences kullan - localStorage Android'de temizlenebilir!
async function setItem(key: string, value: string): Promise<void> {
  if (isNative) {
    await Preferences.set({ key, value });
  } else {
    // Web'de localStorage kullan
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("[PersistentState] localStorage yazma hatası:", e);
    }
  }
}

async function getItem(key: string): Promise<string | null> {
  if (isNative) {
    const { value } = await Preferences.get({ key });
    return value;
  } else {
    // Web'de localStorage kullan
    return localStorage.getItem(key);
  }
}

async function removeItem(key: string): Promise<void> {
  if (isNative) {
    await Preferences.remove({ key });
  } else {
    localStorage.removeItem(key);
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
// 🔥 DEPRECATED - Artık client.ts'deki loadSessionFromStorage kullanılıyor
// Bu fonksiyonlar geriye uyumluluk için kalıyor ama client.ts'e yönlendiriyor

export async function setCachedSession(_session: any): Promise<void> {
  // NOOP - client.ts saveSessionToStorage kullan
  console.log("[PersistentState] ⚠️ setCachedSession DEPRECATED");
}

export async function getCachedSession(): Promise<any> {
  // NOOP - client.ts loadSessionFromStorage kullan
  console.log("[PersistentState] ⚠️ getCachedSession DEPRECATED");
  return null;
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
