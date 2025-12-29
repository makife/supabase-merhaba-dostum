import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnectedAt: Date | null;
  reconnectAttempts: number;
  appIsActive: boolean;
}

interface ConnectionContextType {
  state: ConnectionState;
  reconnect: (force?: boolean) => Promise<boolean>;
  registerChannel: (name: string, channel: RealtimeChannel) => void;
  unregisterChannel: (name: string) => void;
  isHealthy: boolean;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// ============= SINGLETON MANAGER =============
class ConnectionManager {
  private static instance: ConnectionManager;
  private isReconnecting = false;
  private reconnectPromise: Promise<boolean> | null = null;
  private lastReconnectTime = 0;
  private channels = new Map<string, RealtimeChannel>();
  private healthCheckFailures = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private appListenerHandle: any = null;
  private networkListenerHandle: any = null;
  private isAppActive = true;
  private onStateChange: ((state: Partial<ConnectionState>) => void) | null = null;
  private sessionRef: any = null;
  private isInitialized = false;

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  setSession(session: any) {
    this.sessionRef = session;
  }

  setStateCallback(callback: (state: Partial<ConnectionState>) => void) {
    this.onStateChange = callback;
  }

  private updateState(partial: Partial<ConnectionState>) {
    if (this.onStateChange) {
      this.onStateChange(partial);
    }
  }

  async initialize() {
    if (this.isInitialized) {
      console.log("[ConnMgr] Zaten başlatılmış");
      return;
    }

    console.log("[ConnMgr] 🚀 Başlatılıyor...");

    if (Capacitor.isNativePlatform()) {
      await this.setupNativeListeners();
    } else {
      this.setupWebListeners();
    }

    this.startHeartbeat();
    this.isInitialized = true;
  }

  private async setupNativeListeners() {
    // Önce eski listener'ları temizle
    await this.removeListeners();

    console.log("[ConnMgr] 📱 Native listener'lar kuruluyor...");

    // App State Listener - TEK NOKTA
    this.appListenerHandle = await CapApp.addListener("appStateChange", async ({ isActive }) => {
      console.log(`[ConnMgr] 📱 App State: ${isActive ? "FOREGROUND ▶️" : "BACKGROUND 💤"}`);
      
      this.isAppActive = isActive;
      this.updateState({ appIsActive: isActive });

      if (isActive) {
        // Foreground'a döndü - agresif reconnect
        await this.handleForegroundReturn();
      } else {
        // Background'a gitti - heartbeat durdur
        this.stopHeartbeat();
      }
    });

    // Network Listener - TEK NOKTA
    this.networkListenerHandle = await Network.addListener("networkStatusChange", async (status) => {
      console.log(`[ConnMgr] 📡 Network: ${status.connected ? "CONNECTED ✅" : "DISCONNECTED ❌"}`);
      
      if (status.connected && this.isAppActive) {
        await new Promise(r => setTimeout(r, 500));
        await this.forceReconnect();
      } else if (!status.connected) {
        this.updateState({ isConnected: false });
      }
    });

    console.log("[ConnMgr] ✅ Native listener'lar kuruldu");
  }

  private setupWebListeners() {
    console.log("[ConnMgr] 🌐 Web listener'lar kuruluyor...");
    
    document.addEventListener("visibilitychange", async () => {
      const isVisible = !document.hidden;
      console.log(`[ConnMgr] 🌐 Visibility: ${isVisible ? "VISIBLE" : "HIDDEN"}`);
      
      this.isAppActive = isVisible;
      this.updateState({ appIsActive: isVisible });

      if (isVisible) {
        await this.handleForegroundReturn();
      } else {
        this.stopHeartbeat();
      }
    });

    window.addEventListener("online", async () => {
      console.log("[ConnMgr] 🌐 Online");
      if (this.isAppActive) {
        await this.forceReconnect();
      }
    });

    window.addEventListener("offline", () => {
      console.log("[ConnMgr] 🌐 Offline");
      this.updateState({ isConnected: false });
    });
  }

  private async handleForegroundReturn() {
    console.log("[ConnMgr] 🔄 Foreground dönüşü - reconnect başlıyor...");
    
    this.updateState({ isReconnecting: true });

    try {
      // 1. Ağ kontrolü
      if (Capacitor.isNativePlatform()) {
        let networkReady = false;
        for (let i = 0; i < 5; i++) {
          const status = await Network.getStatus();
          if (status.connected) {
            networkReady = true;
            break;
          }
          await new Promise(r => setTimeout(r, 300));
        }
        
        if (!networkReady) {
          console.log("[ConnMgr] ❌ Ağ yok");
          this.updateState({ isConnected: false, isReconnecting: false });
          return;
        }
      }

      // 2. Supabase bağlantısını zorla yenile
      try {
        supabase.realtime.disconnect();
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {}

      // 3. Token güncelle
      if (this.sessionRef?.access_token) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.access_token) {
            supabase.realtime.setAuth(data.session.access_token);
          }
        } catch (e) {}
      }

      // 4. Yeniden bağlan
      supabase.realtime.connect();
      await new Promise(r => setTimeout(r, 500));

      // 5. Bağlantı testi
      const isHealthy = await this.healthCheck();
      
      if (isHealthy) {
        console.log("[ConnMgr] ✅ Foreground reconnect başarılı");
        
        // Kanalları yenile
        for (const [name, channel] of this.channels) {
          if (channel.state !== "joined") {
            console.log(`[ConnMgr] 📡 Kanal yenileniyor: ${name}`);
            try {
              await channel.subscribe();
            } catch (e) {}
          }
        }
      }

      this.updateState({
        isConnected: isHealthy,
        isReconnecting: false,
        lastConnectedAt: isHealthy ? new Date() : undefined,
      });

      // Heartbeat'i yeniden başlat
      this.startHeartbeat();

    } catch (e) {
      console.log("[ConnMgr] ❌ Foreground reconnect hatası:", e);
      this.updateState({ isConnected: false, isReconnecting: false });
    }
  }

  private async forceReconnect(): Promise<boolean> {
    // Debounce
    const now = Date.now();
    if (now - this.lastReconnectTime < 2000) {
      return false;
    }

    if (this.isReconnecting && this.reconnectPromise) {
      return this.reconnectPromise;
    }

    this.isReconnecting = true;
    this.lastReconnectTime = now;

    this.reconnectPromise = this._doReconnect();
    
    try {
      return await this.reconnectPromise;
    } finally {
      this.isReconnecting = false;
      this.reconnectPromise = null;
    }
  }

  private async _doReconnect(): Promise<boolean> {
    console.log("[ConnMgr] 🔄 Force reconnect...");
    this.updateState({ isReconnecting: true });

    try {
      // Disconnect & reconnect
      try {
        supabase.realtime.disconnect();
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {}

      if (this.sessionRef?.access_token) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.access_token) {
            supabase.realtime.setAuth(data.session.access_token);
          }
        } catch (e) {}
      }

      supabase.realtime.connect();
      await new Promise(r => setTimeout(r, 600));

      const isHealthy = await this.healthCheck();
      
      this.updateState({
        isConnected: isHealthy,
        isReconnecting: false,
        lastConnectedAt: isHealthy ? new Date() : undefined,
      });

      return isHealthy;
    } catch (e) {
      this.updateState({ isConnected: false, isReconnecting: false });
      return false;
    }
  }

  async reconnect(force = false): Promise<boolean> {
    if (force) {
      return this.forceReconnect();
    }
    
    const isHealthy = await this.healthCheck();
    if (!isHealthy) {
      return this.forceReconnect();
    }
    return true;
  }

  private async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const { error } = await supabase.rpc("get_server_time");
      clearTimeout(timeoutId);
      
      if (error) {
        this.healthCheckFailures++;
        return false;
      }
      
      this.healthCheckFailures = 0;
      return true;
    } catch (e) {
      this.healthCheckFailures++;
      return false;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    
    console.log("[ConnMgr] 💓 Heartbeat başlatılıyor (20s)");
    
    this.heartbeatInterval = setInterval(async () => {
      if (!this.isAppActive) return;
      
      const isHealthy = await this.healthCheck();
      
      if (!isHealthy && this.healthCheckFailures >= 2) {
        console.log("[ConnMgr] 💔 Heartbeat başarısız, reconnect...");
        await this.forceReconnect();
      } else {
        this.updateState({ isConnected: isHealthy || this.healthCheckFailures < 3 });
      }
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log("[ConnMgr] 💤 Heartbeat durduruldu");
    }
  }

  registerChannel(name: string, channel: RealtimeChannel) {
    this.channels.set(name, channel);
  }

  unregisterChannel(name: string) {
    this.channels.delete(name);
  }

  private async removeListeners() {
    if (this.appListenerHandle) {
      try { await this.appListenerHandle.remove(); } catch (e) {}
      this.appListenerHandle = null;
    }
    if (this.networkListenerHandle) {
      try { await this.networkListenerHandle.remove(); } catch (e) {}
      this.networkListenerHandle = null;
    }
  }

  cleanup() {
    this.stopHeartbeat();
    this.removeListeners();
    this.isInitialized = false;
  }
}

// Singleton instance
const connectionManager = ConnectionManager.getInstance();

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const { session, loading: authLoading } = useAuth();

  const [state, setState] = useState<ConnectionState>({
    isConnected: true,
    isReconnecting: false,
    lastConnectedAt: new Date(),
    reconnectAttempts: 0,
    appIsActive: true,
  });

  const mountedRef = useRef(true);

  // State callback
  const updateState = useCallback((partial: Partial<ConnectionState>) => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  // Session ve callback'i manager'a set et
  useEffect(() => {
    connectionManager.setSession(session);
    connectionManager.setStateCallback(updateState);
  }, [session, updateState]);

  // Auth hazır olduğunda initialize et
  useEffect(() => {
    if (!authLoading && session) {
      console.log("[ConnectionProvider] ✅ Auth hazır - Manager başlatılıyor");
      connectionManager.initialize();
    }
  }, [authLoading, session]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reconnect = useCallback(async (force = false): Promise<boolean> => {
    return connectionManager.reconnect(force);
  }, []);

  const registerChannel = useCallback((name: string, channel: RealtimeChannel) => {
    connectionManager.registerChannel(name, channel);
  }, []);

  const unregisterChannel = useCallback((name: string) => {
    connectionManager.unregisterChannel(name);
  }, []);

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
    appIsActive: state.appIsActive,
  };
};
