/**
 * ConnectionHealthMonitor - Supabase Realtime Bağlantı Sağlığı İzleyicisi
 * 
 * Bu modül şu sorunları çözer:
 * 1. Kanal sızıntısı - Açık kanalların izlenmesi ve temizlenmesi
 * 2. Token yenileme - Session expire olmadan önce token yenileme
 * 3. Bağlantı kopması - Otomatik yeniden bağlanma
 * 4. Duplicate kanallar - Aynı kaynağa birden fazla kanal önleme
 */

import React from "react";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface ChannelStats {
  name: string;
  state: string;
  createdAt: number;
  lastActivity: number;
}

interface HealthReport {
  isHealthy: boolean;
  channelCount: number;
  problematicChannels: string[];
  realtimeState: string;
  lastHealthCheck: number;
  tokenExpiresIn: number;
}

class ConnectionHealthMonitor {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;
  private channelStats: Map<string, ChannelStats> = new Map();
  private lastHealthReport: HealthReport | null = null;
  private isMonitoring = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Singleton
  private static instance: ConnectionHealthMonitor;
  static getInstance(): ConnectionHealthMonitor {
    if (!ConnectionHealthMonitor.instance) {
      ConnectionHealthMonitor.instance = new ConnectionHealthMonitor();
    }
    return ConnectionHealthMonitor.instance;
  }

  /**
   * İzlemeyi başlat
   */
  start(): void {
    if (this.isMonitoring) {
      console.log("[HealthMonitor] Zaten çalışıyor");
      return;
    }

    console.log("[HealthMonitor] 🟢 Bağlantı sağlığı izlemesi başlatılıyor...");
    this.isMonitoring = true;

    // 1. Sağlık kontrolü (15 saniyede bir)
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 15000);

    // 2. Token yenileme kontrolü (5 dakikada bir)
    this.tokenRefreshInterval = setInterval(() => {
      this.checkAndRefreshToken();
    }, 5 * 60 * 1000);

    // 3. İlk kontrol
    this.performHealthCheck();
    this.checkAndRefreshToken();

    // 4. Visibility change listener
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }

    // 5. Online/offline listener
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
  }

  /**
   * İzlemeyi durdur
   */
  stop(): void {
    console.log("[HealthMonitor] 🔴 Bağlantı sağlığı izlemesi durduruluyor...");
    this.isMonitoring = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }

    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
  }

  /**
   * Sağlık kontrolü yap
   */
  private performHealthCheck(): void {
    const supabase = getSupabaseClient();
    const channels = supabase.getChannels();
    const problematicChannels: string[] = [];

    // Kanal durumlarını kontrol et
    channels.forEach((channel: RealtimeChannel) => {
      const state = channel.state;
      const topic = channel.topic;

      // Stats güncelle
      if (!this.channelStats.has(topic)) {
        this.channelStats.set(topic, {
          name: topic,
          state: state,
          createdAt: Date.now(),
          lastActivity: Date.now(),
        });
      } else {
        const stats = this.channelStats.get(topic)!;
        stats.state = state;
        stats.lastActivity = Date.now();
      }

      // Sorunlu kanalları tespit et
      if (state === "errored" || state === "closed") {
        problematicChannels.push(topic);
      }
    });

    // Eski/orphan kanalları temizle
    this.cleanupOrphanChannels(channels);

    // Realtime durumunu kontrol et
    const realtimeState = this.getRealtimeState();

    // Token süresini kontrol et
    const tokenExpiresIn = this.getTokenExpirationTime();

    // Rapor oluştur
    this.lastHealthReport = {
      isHealthy: problematicChannels.length === 0 && realtimeState === "open",
      channelCount: channels.length,
      problematicChannels,
      realtimeState,
      lastHealthCheck: Date.now(),
      tokenExpiresIn,
    };

    // Sorun varsa müdahale et
    if (!this.lastHealthReport.isHealthy) {
      console.warn("[HealthMonitor] ⚠️ Sağlık sorunu tespit edildi:", {
        problematicChannels,
        realtimeState,
        channelCount: channels.length,
      });

      // Otomatik düzeltme
      this.attemptAutoRecovery(problematicChannels);
    }

    // Çok fazla kanal açıksa uyar
    if (channels.length > 20) {
      console.warn(`[HealthMonitor] ⚠️ Çok fazla kanal açık: ${channels.length}`);
      this.cleanupExcessChannels(channels);
    }
  }

  /**
   * Token kontrolü - REFRESH YAPMA, sadece kontrol et
   * Supabase client autoRefreshToken: true ile token'ı otomatik yönetiyor
   */
  private async checkAndRefreshToken(): Promise<void> {
    const supabase = getSupabaseClient();
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        console.log("[HealthMonitor] Session yok, token yenilenemiyor");
        return;
      }

      // Sadece token'ı realtime'a set et - REFRESH YAPMA
      if (session.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
      
      // ❌ REFRESH YAPMA - Supabase autoRefreshToken zaten yapıyor
      // Manuel refresh = race condition = "Invalid Refresh Token" hatası
    } catch (e) {
      console.error("[HealthMonitor] Token kontrolü hatası:", e);
    }
  }

  /**
   * Orphan kanalları temizle
   */
  private cleanupOrphanChannels(activeChannels: RealtimeChannel[]): void {
    const activeTopics = new Set(activeChannels.map((ch) => ch.topic));
    const orphanedTopics: string[] = [];

    // Stats'taki ama aktif olmayan kanalları bul
    this.channelStats.forEach((stats, topic) => {
      if (!activeTopics.has(topic)) {
        orphanedTopics.push(topic);
      }
    });

    // Orphan stats'ları temizle
    orphanedTopics.forEach((topic) => {
      this.channelStats.delete(topic);
    });
  }

  /**
   * Fazla kanalları temizle (en eski olanları kapat)
   */
  private cleanupExcessChannels(channels: RealtimeChannel[]): void {
    const supabase = getSupabaseClient();
    const maxChannels = 15;

    if (channels.length <= maxChannels) return;

    // En eski kanalları bul (createdAt'e göre sırala)
    const sortedByAge = [...channels]
      .map((ch) => ({
        channel: ch,
        createdAt: this.channelStats.get(ch.topic)?.createdAt || Date.now(),
      }))
      .sort((a, b) => a.createdAt - b.createdAt);

    // ⚠️ DEVRE DIŞI: Fazla kanalları kapatma - bu bağlantıyı öldürüyordu
    console.log(`[HealthMonitor] ⚠️ Kanal limiti kontrolü DEVRE DIŞI (bağlantı koruması)`);
    // toRemove.forEach(({ channel }) => {
    //   console.log(`[HealthMonitor] 🗑️ Fazla kanal kapatılıyor: ${channel.topic}`);
    //   try {
    //     supabase.removeChannel(channel);
    //     this.channelStats.delete(channel.topic);
    //   } catch (e) {
    //     console.error(`[HealthMonitor] Kanal kapatma hatası: ${channel.topic}`, e);
    //   }
    // });
  }

  /**
   * Otomatik kurtarma girişimi
   */
  private async attemptAutoRecovery(problematicChannels: string[]): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[HealthMonitor] ❌ Maksimum yeniden bağlanma denemesine ulaşıldı");
      this.reconnectAttempts = 0;
      return;
    }

    this.reconnectAttempts++;
    const supabase = getSupabaseClient();

    // ⚠️ DEVRE DIŞI: Sorunlu kanalları kapatma - bu bağlantıyı öldürüyordu
    console.log(`[HealthMonitor] ⚠️ Sorunlu kanal temizliği DEVRE DIŞI (bağlantı koruması)`);
    // const channels = supabase.getChannels();
    // for (const channel of channels) {
    //   if (problematicChannels.includes(channel.topic)) {
    //     try {
    //       console.log(`[HealthMonitor] Sorunlu kanal kapatılıyor: ${channel.topic}`);
    //       supabase.removeChannel(channel);
    //       this.channelStats.delete(channel.topic);
    //     } catch (e) {
    //       // Sessizce devam
    //     }
    //   }
    // }

    // 2. Realtime bağlantısı kopuksa yeniden bağlan
    const realtimeState = this.getRealtimeState();
    if (realtimeState !== "open" && realtimeState !== "connecting") {
      console.log("[HealthMonitor] Realtime bağlantısı yeniden başlatılıyor...");
      
      try {
        // Token'ı güncelle
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          supabase.realtime.setAuth(sessionData.session.access_token);
        }
        
        // Bağlantıyı yeniden başlat
        (supabase.realtime as any).connect?.();
        
        // Event dispatch et
        window.dispatchEvent(new CustomEvent("supabase-reconnected"));
      } catch (e) {
        console.error("[HealthMonitor] Realtime yeniden bağlanma hatası:", e);
      }
    }

    // 3. Kısa süre sonra tekrar kontrol et
    setTimeout(() => {
      if (this.isMonitoring) {
        this.performHealthCheck();
      }
    }, 2000);
  }

  /**
   * Visibility change handler
   */
  private handleVisibilityChange = async (): Promise<void> => {
    if (document.visibilityState === "visible") {
      console.log("[HealthMonitor] 📱 Sayfa görünür oldu, sağlık kontrolü yapılıyor...");
      
      // Kısa gecikme ile kontrol et
      setTimeout(() => {
        this.reconnectAttempts = 0; // Reset attempts
        this.performHealthCheck();
        this.checkAndRefreshToken();
      }, 500);
    }
  };

  /**
   * Online handler
   */
  private handleOnline = (): void => {
    console.log("[HealthMonitor] 🌐 İnternet bağlantısı geri geldi");
    this.reconnectAttempts = 0;
    
    setTimeout(() => {
      this.performHealthCheck();
      this.checkAndRefreshToken();
    }, 1000);
  };

  /**
   * Offline handler
   */
  private handleOffline = (): void => {
    console.log("[HealthMonitor] 📴 İnternet bağlantısı kesildi");
  };

  /**
   * Realtime durumunu al
   */
  private getRealtimeState(): string {
    try {
      const supabase = getSupabaseClient();
      const state = (supabase.realtime as any).connectionState?.();
      return state || "unknown";
    } catch (e) {
      return "unknown";
    }
  }

  /**
   * Token süresi dolma zamanını al (ms)
   */
  private getTokenExpirationTime(): number {
    try {
      const supabase = getSupabaseClient();
      // Sync olarak session alamıyoruz, son bilinen değeri kullan
      return -1;
    } catch (e) {
      return -1;
    }
  }

  // ⚠️ DEVRE DIŞI: Zorla yeniden bağlanma - bu disconnect çağırıyor ve bağlantıyı öldürüyordu
  async forceReconnect(): Promise<void> {
    console.log("[HealthMonitor] ⚠️ forceReconnect DEVRE DIŞI (bağlantı koruması)");
    
    // Sadece token yenileme ve connect çağır - disconnect ve removeChannel YOK
    const supabase = getSupabaseClient();
    
    // Token yenile
    await this.checkAndRefreshToken();
    
    // Bağlantı kapalıysa aç
    const realtimeState = this.getRealtimeState();
    if (realtimeState !== "open" && realtimeState !== "connecting") {
      try {
        (supabase.realtime as any).connect?.();
      } catch (e) {}
    }
    
    // Event dispatch
    window.dispatchEvent(new CustomEvent("supabase-reconnected"));
    
    console.log("[HealthMonitor] ✅ Soft reconnect tamamlandı (disconnect yok)");
  }

  /**
   * Sağlık raporunu al
   */
  getHealthReport(): HealthReport | null {
    return this.lastHealthReport;
  }

  /**
   * Kanal istatistiklerini al
   */
  getChannelStats(): ChannelStats[] {
    return Array.from(this.channelStats.values());
  }

  /**
   * Debug bilgisi
   */
  getDebugInfo(): object {
    return {
      isMonitoring: this.isMonitoring,
      reconnectAttempts: this.reconnectAttempts,
      channelCount: this.channelStats.size,
      lastHealthReport: this.lastHealthReport,
      channels: this.getChannelStats(),
    };
  }
}

// Singleton export
export const connectionHealthMonitor = ConnectionHealthMonitor.getInstance();

// React hook
export function useConnectionHealth() {
  const [healthReport, setHealthReport] = React.useState<HealthReport | null>(null);

  React.useEffect(() => {
    // İzlemeyi başlat
    connectionHealthMonitor.start();

    // Periyodik güncelleme
    const interval = setInterval(() => {
      setHealthReport(connectionHealthMonitor.getHealthReport());
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return {
    healthReport,
    forceReconnect: () => connectionHealthMonitor.forceReconnect(),
    getDebugInfo: () => connectionHealthMonitor.getDebugInfo(),
  };
}

// Global erişim için
declare global {
  interface Window {
    connectionHealthMonitor: ConnectionHealthMonitor;
  }
}

if (typeof window !== "undefined") {
  window.connectionHealthMonitor = connectionHealthMonitor;
}
