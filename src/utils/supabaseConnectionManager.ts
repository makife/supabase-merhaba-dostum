/**
 * Supabase Bağlantı Yöneticisi
 * JS SDK realtime bağlantısını izler ve otomatik kurtarma yapar
 */

import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { matchmakingMode } from "@/utils/matchmakingMode";

// Global state
let isMonitoring = false;
let healthCheckInterval: NodeJS.Timeout | null = null;
let lastHealthyState = Date.now();
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

// Bağlantı durumu
type ConnectionState = "healthy" | "degraded" | "disconnected" | "recovering";
let currentState: ConnectionState = "healthy";

// Listeners
const stateListeners = new Set<(state: ConnectionState) => void>();

export const getConnectionState = (): ConnectionState => currentState;

export const onConnectionStateChange = (listener: (state: ConnectionState) => void) => {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
};

const notifyStateChange = (newState: ConnectionState) => {
  if (currentState !== newState) {
    console.log(`[ConnectionManager] 🔌 State: ${currentState} → ${newState}`);
    currentState = newState;
    stateListeners.forEach((l) => l(newState));
  }
};

/**
 * Bağlantı sağlığını kontrol et
 */
const checkConnectionHealth = (): boolean => {
  try {
    // 1. Realtime bağlantı durumunu kontrol et
    const realtimeState = (supabase.realtime as any).connectionState?.();
    const isRealtimeOpen = realtimeState === "open" || realtimeState === "connecting";

    // 2. Kanal durumlarını kontrol et
    const channels = supabase.getChannels();
    const closedChannels = channels.filter((ch) => ch.state === "closed" || ch.state === "errored");
    const activeChannels = channels.filter((ch) => ch.state === "joined" || ch.state === "joining");

    // Debug log
    console.log("[ConnectionManager] 🔍 Health check:", {
      realtimeState,
      totalChannels: channels.length,
      activeChannels: activeChannels.length,
      closedChannels: closedChannels.length,
    });

    // Sağlıklı: realtime açık VE kapalı kanal yok
    if (isRealtimeOpen && closedChannels.length === 0) {
      return true;
    }

    // Sağlıksız: realtime kapalı VEYA kapalı kanallar var
    return false;
  } catch (e) {
    console.error("[ConnectionManager] Health check hatası:", e);
    return false;
  }
};

/**
 * Kapalı kanalları yeniden aç
 */
const recoverClosedChannels = async (): Promise<number> => {
  let recoveredCount = 0;

  try {
    const channels = supabase.getChannels();
    const closedChannels = channels.filter((ch) => ch.state === "closed" || ch.state === "errored");

    console.log(`[ConnectionManager] 🔄 ${closedChannels.length} kapalı kanal kurtarılıyor...`);

    for (const channel of closedChannels) {
      try {
        console.log(`[ConnectionManager] 📡 Kanal yeniden açılıyor: ${channel.topic}`);
        channel.subscribe();
        recoveredCount++;
      } catch (e) {
        console.error(`[ConnectionManager] Kanal kurtarma hatası (${channel.topic}):`, e);
      }
    }
  } catch (e) {
    console.error("[ConnectionManager] Recover hatası:", e);
  }

  return recoveredCount;
};

/**
 * Realtime bağlantısını yeniden kur
 */
const reconnectRealtime = async (): Promise<boolean> => {
  console.log("[ConnectionManager] 🔌 Realtime yeniden bağlanıyor...");

  try {
    // 1. Session token'ı güncelle
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      supabase.realtime.setAuth(data.session.access_token);
      console.log("[ConnectionManager] ✅ Token ayarlandı");
    }

    // 2. Bağlantıyı yeniden kur
    const realtimeState = (supabase.realtime as any).connectionState?.();
    if (realtimeState !== "open" && realtimeState !== "connecting") {
      try {
        (supabase.realtime as any).connect?.();
        console.log("[ConnectionManager] ✅ Realtime connect çağrıldı");
      } catch (e) {
        console.error("[ConnectionManager] Connect hatası:", e);
      }
    }

    // 3. Biraz bekle
    await new Promise((r) => setTimeout(r, 1000));

    // 4. Kapalı kanalları kurtar
    await recoverClosedChannels();

    return true;
  } catch (e) {
    console.error("[ConnectionManager] Reconnect hatası:", e);
    return false;
  }
};

/**
 * Ana sağlık kontrolü döngüsü
 */
const runHealthCheck = async () => {
  // 🚀 Matchmaking aktifken health check atla
  if (matchmakingMode.isActive()) {
    return;
  }

  const isHealthy = checkConnectionHealth();

  if (isHealthy) {
    consecutiveFailures = 0;
    lastHealthyState = Date.now();
    
    // Daha önce sağlıksız durumdaydık ve şimdi sağlıklıyız - reconnect event dispatch et
    if (currentState !== "healthy") {
      console.log("[ConnectionManager] ✅ Bağlantı sağlıklı duruma geçti, event dispatch ediliyor...");
      window.dispatchEvent(new CustomEvent("supabase-reconnected"));
    }
    
    notifyStateChange("healthy");

    // Her sağlıklı durumda kapalı kanalları kontrol et
    const channels = supabase.getChannels();
    const closedChannels = channels.filter((ch) => ch.state === "closed" || ch.state === "errored");
    if (closedChannels.length > 0) {
      console.log("[ConnectionManager] ⚠️ Kapalı kanallar bulundu, kurtarılıyor...");
      await recoverClosedChannels();
    }
  } else {
    consecutiveFailures++;
    console.log(`[ConnectionManager] ⚠️ Sağlıksız durum (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      notifyStateChange("recovering");
      console.log("[ConnectionManager] 🚨 Maksimum hata sayısına ulaşıldı, kurtarma başlatılıyor...");

      const recovered = await reconnectRealtime();
      if (recovered) {
        consecutiveFailures = 0;

        // Reconnect event dispatch et
        window.dispatchEvent(new CustomEvent("supabase-reconnected"));
        console.log("[ConnectionManager] ✅ Kurtarma tamamlandı, event dispatch edildi");
      } else {
        notifyStateChange("disconnected");
      }
    } else {
      notifyStateChange("degraded");

      // Hemen kapalı kanalları kurtarmaya çalış
      await recoverClosedChannels();
    }
  }
};

/**
 * İzlemeyi başlat
 */
export const startConnectionMonitor = () => {
  if (isMonitoring) {
    console.log("[ConnectionManager] Zaten izleniyor");
    return;
  }

  console.log("[ConnectionManager] 🚀 Bağlantı izleyici başlatıldı");
  isMonitoring = true;

  // İlk kontrol
  runHealthCheck();

  // Periyodik kontrol - her 15 saniyede bir (optimize edildi, eskisi 3s idi)
  healthCheckInterval = setInterval(runHealthCheck, 15000);

  // Visibility change - sayfa görünür olduğunda hemen kontrol et
  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      console.log("[ConnectionManager] 👁️ Sayfa görünür, sağlık kontrolü...");
      setTimeout(runHealthCheck, 500);
    }
  };

  // Online event - internet geldiğinde hemen kontrol et
  const handleOnline = () => {
    console.log("[ConnectionManager] 🌐 İnternet geldi, sağlık kontrolü...");
    setTimeout(runHealthCheck, 1000);
  };

  // Native foreground event
  const handleForeground = () => {
    if (Capacitor.isNativePlatform()) {
      console.log("[ConnectionManager] 📱 Foreground, sağlık kontrolü...");
      setTimeout(runHealthCheck, 500);
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("online", handleOnline);
  window.addEventListener("app-foreground", handleForeground);

  // Cleanup fonksiyonunu kaydet
  (window as any).__connectionManagerCleanup = () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("app-foreground", handleForeground);
  };
};

/**
 * İzlemeyi durdur
 */
export const stopConnectionMonitor = () => {
  if (!isMonitoring) return;

  console.log("[ConnectionManager] 🛑 Bağlantı izleyici durduruldu");
  isMonitoring = false;

  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // Cleanup
  const cleanup = (window as any).__connectionManagerCleanup;
  if (cleanup) cleanup();
};

/**
 * Manuel kurtarma tetikle
 */
export const forceRecovery = async (): Promise<boolean> => {
  console.log("[ConnectionManager] 💥 Manuel kurtarma tetiklendi");
  notifyStateChange("recovering");

  const recovered = await reconnectRealtime();
  if (recovered) {
    consecutiveFailures = 0;
    window.dispatchEvent(new CustomEvent("supabase-reconnected"));
    notifyStateChange("healthy");
  } else {
    notifyStateChange("disconnected");
  }

  return recovered;
};

// Debug için global'e ekle
if (typeof window !== "undefined") {
  (window as any).supabaseConnectionManager = {
    getState: getConnectionState,
    forceRecovery,
    start: startConnectionMonitor,
    stop: stopConnectionMonitor,
    checkHealth: checkConnectionHealth,
  };
}
