import React, { createContext, useContext, ReactNode } from "react";

/**
 * ConnectionContext - DEVRE DIŞI
 * 
 * Bağlantı yönetimi artık:
 * - Android: Kotlin WebSocket + Foreground Service (useNativeRealtime)
 * - Web: Supabase JS client direkt kullanılıyor
 * 
 * Bu context sadece uyumluluk için boş wrapper olarak kalıyor.
 */

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnectedAt: Date | null;
  reconnectAttempts: number;
}

interface ConnectionContextType {
  state: ConnectionState;
  reconnect: (force?: boolean) => Promise<boolean>;
  registerChannel: (name: string, channel: any) => void;
  unregisterChannel: (name: string) => void;
  isHealthy: boolean;
  forceReconnect: () => Promise<boolean>;
  isUsingNativeRealtime: boolean;
}

const defaultState: ConnectionState = {
  isConnected: true,
  isReconnecting: false,
  lastConnectedAt: new Date(),
  reconnectAttempts: 0,
};

const ConnectionContext = createContext<ConnectionContextType>({
  state: defaultState,
  reconnect: async () => true,
  registerChannel: () => {},
  unregisterChannel: () => {},
  isHealthy: true,
  forceReconnect: async () => true,
  isUsingNativeRealtime: false,
});

/**
 * ConnectionProvider - Artık sadece boş wrapper
 * Tüm bağlantı yönetimi useNativeRealtime hook'una taşındı
 */
export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  console.log("[ConnectionContext] ⚠️ DEVRE DIŞI - Sadece wrapper olarak çalışıyor");

  return (
    <ConnectionContext.Provider
      value={{
        state: defaultState,
        reconnect: async () => true,
        registerChannel: () => {},
        unregisterChannel: () => {},
        isHealthy: true,
        forceReconnect: async () => true,
        isUsingNativeRealtime: false,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => {
  return useContext(ConnectionContext);
};

export const useConnectionStatus = () => {
  return {
    isConnected: true,
    isReconnecting: false,
    isHealthy: true,
  };
};
