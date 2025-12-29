import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnectedAt: Date | null;
  reconnectAttempts: number;
  channelHealth: Map<string, "healthy" | "unhealthy" | "reconnecting">;
}

interface ConnectionContextType {
  state: ConnectionState;
  reconnect: (force?: boolean) => Promise<boolean>;
  registerChannel: (name: string, channel: RealtimeChannel) => void;
  unregisterChannel: (name: string) => void;
  isHealthy: boolean;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Singleton reconnection manager - closure problemini çözer
class ReconnectionManager {
  private isReconnecting = false;
  private reconnectPromise: Promise<boolean> | null = null;
  private consecutiveFailures = 0;
  private lastReconnectTime = 0;
  private channelsRef: Map<string, RealtimeChannel> = new Map();
  
  async performHealthCheck(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const status = await Network.getStatus();
        if (!status.connected) {
          console.log("[ReconnectMgr] Ağ yok");
          return false;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const { error } = await supabase.rpc("get_server_time");
        clearTimeout(timeoutId);
        
        if (error) {
          this.consecutiveFailures++;
          console.log("[ReconnectMgr] RPC hatası:", error.message);
          return false;
        }
        
        this.consecutiveFailures = 0;
        return true;
      } catch (e) {
        clearTimeout(timeoutId);
        this.consecutiveFailures++;
        return false;
      }
    } catch (e) {
      this.consecutiveFailures++;
      return false;
    }
  }

  async reconnect(force = false, session: any, onStateChange: (state: Partial<ConnectionState>) => void): Promise<boolean> {
    // Debounce - son 2 saniye içinde reconnect çağrıldıysa atla
    const now = Date.now();
    if (!force && now - this.lastReconnectTime < 2000) {
      console.log("[ReconnectMgr] Debounce - çok yakın zamanda çağrıldı");
      return false;
    }
    
    // Zaten reconnect yapılıyorsa bekle
    if (this.isReconnecting && this.reconnectPromise) {
      console.log("[ReconnectMgr] Zaten reconnect yapılıyor, bekleniyor...");
      return this.reconnectPromise;
    }

    this.isReconnecting = true;
    this.lastReconnectTime = now;
    onStateChange({ isReconnecting: true });

    this.reconnectPromise = this._doReconnect(force, session, onStateChange);
    
    try {
      return await this.reconnectPromise;
    } finally {
      this.isReconnecting = false;
      this.reconnectPromise = null;
    }
  }

  private async _doReconnect(force: boolean, session: any, onStateChange: (state: Partial<ConnectionState>) => void): Promise<boolean> {
    console.log(`[ReconnectMgr] 🔄 Reconnect başlıyor (force: ${force})`);

    try {
      // 1. Ağ kontrolü
      if (Capacitor.isNativePlatform()) {
        let networkReady = false;
        for (let i = 0; i < 5; i++) {
          const status = await Network.getStatus();
          if (status.connected) {
            networkReady = true;
            console.log(`[ReconnectMgr] ✅ Ağ hazır (deneme ${i + 1})`);
            break;
          }
          console.log(`[ReconnectMgr] ⏳ Ağ bekleniyor (${i + 1}/5)...`);
          await new Promise(r => setTimeout(r, 500));
        }
        
        if (!networkReady) {
          console.log("[ReconnectMgr] ❌ Ağ bulunamadı");
          onStateChange({ isReconnecting: false, isConnected: false });
          return false;
        }
      }

      // 2. Mevcut bağlantıyı temizle (force modunda)
      if (force) {
        console.log("[ReconnectMgr] 🔌 Eski bağlantı kesiliyor...");
        try {
          await supabase.realtime.disconnect();
        } catch (e) {
          console.log("[ReconnectMgr] Disconnect hatası (önemli değil):", e);
        }
        await new Promise(r => setTimeout(r, 500));
      }

      // 3. Token güncelle
      if (session?.access_token) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.access_token) {
            supabase.realtime.setAuth(data.session.access_token);
            console.log("[ReconnectMgr] 🔑 Token güncellendi");
          }
        } catch (e) {
          console.log("[ReconnectMgr] Token güncelleme hatası:", e);
        }
      }

      // 4. Yeniden bağlan
      console.log("[ReconnectMgr] 🚀 Bağlanılıyor...");
      supabase.realtime.connect();

      // 5. Bağlantı testi (retry ile)
      let isHealthy = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(r => setTimeout(r, 800));
        isHealthy = await this.performHealthCheck();
        if (isHealthy) {
          console.log(`[ReconnectMgr] ✅ Bağlantı başarılı (deneme ${attempt + 1})`);
          break;
        }
        console.log(`[ReconnectMgr] ⏳ Bağlantı kontrolü başarısız (${attempt + 1}/3)`);
      }

      // 6. Kanalları yenile
      if (isHealthy) {
        for (const [name, channel] of this.channelsRef) {
          if (channel.state !== "joined") {
            console.log(`[ReconnectMgr] 📡 Kanal yenileniyor: ${name}`);
            try {
              channel.subscribe();
            } catch (e) {
              console.log(`[ReconnectMgr] Kanal abone hatası: ${name}`, e);
            }
          }
        }
      }

      onStateChange({
        isConnected: isHealthy,
        isReconnecting: false,
        lastConnectedAt: isHealthy ? new Date() : undefined,
        reconnectAttempts: isHealthy ? 0 : undefined,
      });

      console.log(`[ReconnectMgr] ${isHealthy ? "✅ Başarılı" : "❌ Başarısız"}`);
      return isHealthy;
      
    } catch (e) {
      console.log("[ReconnectMgr] ❌ Hata:", e);
      onStateChange({ isReconnecting: false, isConnected: false });
      return false;
    }
  }

  registerChannel(name: string, channel: RealtimeChannel) {
    this.channelsRef.set(name, channel);
  }

  unregisterChannel(name: string) {
    this.channelsRef.delete(name);
  }

  getChannelsHealth(): Map<string, "healthy" | "unhealthy" | "reconnecting"> {
    const health = new Map<string, "healthy" | "unhealthy" | "reconnecting">();
    for (const [name, channel] of this.channelsRef) {
      if (channel.state === "joined") health.set(name, "healthy");
      else if (channel.state === "joining") health.set(name, "reconnecting");
      else health.set(name, "unhealthy");
    }
    return health;
  }

  getConsecutiveFailures() {
    return this.consecutiveFailures;
  }
}

// Singleton instance
const reconnectionManager = new ReconnectionManager();

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const { session, loading: authLoading } = useAuth();

  const [state, setState] = useState<ConnectionState>({
    isConnected: true,
    isReconnecting: false,
    lastConnectedAt: new Date(),
    reconnectAttempts: 0,
    channelHealth: new Map(),
  });

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const appStateListenerRef = useRef<any>(null);
  const networkListenerRef = useRef<any>(null);
  const sessionRef = useRef(session);
  const mountedRef = useRef(true);

  // Session'ı ref'te tut - closure problemini önler
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const updateState = useCallback((partial: Partial<ConnectionState>) => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  const reconnect = useCallback(async (force = false): Promise<boolean> => {
    if (authLoading && !sessionRef.current) {
      console.log("[Connection] Auth yükleniyor, bekleniyor...");
      return false;
    }
    return reconnectionManager.reconnect(force, sessionRef.current, updateState);
  }, [authLoading, updateState]);

  // Cold start - Auth hazır olduğunda bağlan
  useEffect(() => {
    if (!authLoading && session) {
      console.log("[Connection] ✅ Auth Hazır (Cold Start) -> Bağlanılıyor...");
      setTimeout(() => reconnect(), 200);
    }
  }, [authLoading, session, reconnect]);

  // Native uygulama state listener - KRITIK DÜZELTME
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let isInitialized = false;

    const setupListeners = async () => {
      // Eski listener'ları temizle
      if (appStateListenerRef.current) {
        try { await appStateListenerRef.current.remove(); } catch (e) {}
      }
      if (networkListenerRef.current) {
        try { await networkListenerRef.current.remove(); } catch (e) {}
      }

      // App State Listener
      appStateListenerRef.current = await App.addListener("appStateChange", async ({ isActive }) => {
        console.log(`📱 [Connection] App State: ${isActive ? "FOREGROUND" : "BACKGROUND"}`);
        
        if (isActive) {
          // Ön plana geldi - FORCE reconnect yap
          console.log("📱 [Connection] 🔄 Foreground - Force Reconnect başlatılıyor...");
          
          // Mevcut bağlantıyı kopar ve yeniden bağlan
          try {
            await supabase.realtime.disconnect();
          } catch (e) {}
          
          // Kısa bekle ve reconnect
          await new Promise(r => setTimeout(r, 300));
          
          // Reconnect manager'ı kullan
          await reconnectionManager.reconnect(true, sessionRef.current, updateState);
          
          // Heartbeat'i yeniden başlat
          startHeartbeat();
        } else {
          // Arka plana gitti - heartbeat durdur
          console.log("💤 [Connection] Uyku modu - Heartbeat durduruluyor");
          stopHeartbeat();
        }
      });

      // Network State Listener
      networkListenerRef.current = await Network.addListener("networkStatusChange", async (status) => {
        console.log(`📡 [Connection] Network: ${status.connected ? "CONNECTED" : "DISCONNECTED"}`);
        
        if (status.connected) {
          // Ağ geldi - reconnect
          console.log("📡 [Connection] Ağ geri geldi - Reconnect...");
          await new Promise(r => setTimeout(r, 500));
          await reconnectionManager.reconnect(true, sessionRef.current, updateState);
        } else {
          updateState({ isConnected: false });
        }
      });

      isInitialized = true;
      console.log("[Connection] ✅ Native listeners kuruldu");
    };

    setupListeners();

    return () => {
      if (appStateListenerRef.current) {
        try { appStateListenerRef.current.remove(); } catch (e) {}
      }
      if (networkListenerRef.current) {
        try { networkListenerRef.current.remove(); } catch (e) {}
      }
    };
  }, [updateState]);

  // Heartbeat yönetimi
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    
    heartbeatRef.current = setInterval(async () => {
      if (authLoading) return;

      const isHealthy = await reconnectionManager.performHealthCheck();
      const channelHealth = reconnectionManager.getChannelsHealth();

      if (!isHealthy && reconnectionManager.getConsecutiveFailures() >= 2) {
        console.log("[Connection] 💔 Heartbeat - Bağlantı kopuk, reconnect...");
        await reconnectionManager.reconnect(false, sessionRef.current, updateState);
      }

      updateState({
        isConnected: isHealthy || reconnectionManager.getConsecutiveFailures() < 3,
        channelHealth,
      });
    }, 15000); // 15 saniyede bir kontrol
  }, [authLoading, updateState]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // İlk mount'ta heartbeat başlat
  useEffect(() => {
    mountedRef.current = true;
    startHeartbeat();
    
    return () => {
      mountedRef.current = false;
      stopHeartbeat();
    };
  }, [startHeartbeat, stopHeartbeat]);

  // Channel registration
  const registerChannel = useCallback((name: string, channel: RealtimeChannel) => {
    reconnectionManager.registerChannel(name, channel);
    updateState({ channelHealth: reconnectionManager.getChannelsHealth() });
  }, [updateState]);

  const unregisterChannel = useCallback((name: string) => {
    reconnectionManager.unregisterChannel(name);
    updateState({ channelHealth: reconnectionManager.getChannelsHealth() });
  }, [updateState]);

  const isHealthy = state.isConnected && !state.isReconnecting;

  return (
    <ConnectionContext.Provider
      value={{
        state,
        reconnect,
        registerChannel,
        unregisterChannel,
        isHealthy,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) throw new Error("useConnection must be used within ConnectionProvider");
  return context;
};

export const useConnectionStatus = () => {
  const { state, isHealthy } = useConnection();
  return {
    isConnected: state.isConnected,
    isReconnecting: state.isReconnecting,
    isHealthy,
  };
};
