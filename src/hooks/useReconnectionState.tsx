/**
 * useReconnectionState Hook
 * Bağlantı durumunu global olarak yönetir ve UI State Lock sağlar
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Capacitor } from "@capacitor/core";
import { isNativeRealtimeAvailable, NativeRealtime } from "@/plugins/NativeRealtime";

type ConnectionStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

interface ReconnectionState {
  status: ConnectionStatus;
  isOverlayVisible: boolean;
  lastConnectedAt: number | null;
  reconnectAttempts: number;
}

// Global state - sayfa değişikliklerinde korunur
let globalState: ReconnectionState = {
  status: "connected",
  isOverlayVisible: false,
  lastConnectedAt: Date.now(),
  reconnectAttempts: 0,
};

const listeners = new Set<(state: ReconnectionState) => void>();

function notifyListeners() {
  listeners.forEach((l) => l({ ...globalState }));
}

function updateGlobalState(partial: Partial<ReconnectionState>) {
  globalState = { ...globalState, ...partial };
  notifyListeners();
}

export function useReconnectionState() {
  const [state, setState] = useState<ReconnectionState>(globalState);
  const { isSystemConnected } = useUser();
  const isNative = Capacitor.isNativePlatform();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to global state changes
  useEffect(() => {
    const handler = (newState: ReconnectionState) => setState(newState);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  // Monitor Supabase realtime connection
  useEffect(() => {
    const checkConnection = () => {
      const channels = supabase.getChannels();
      const hasActiveChannel = channels.some(
        (ch) => ch.state === "joined" || ch.state === "joining"
      );
      const hasClosedChannel = channels.some(
        (ch) => ch.state === "closed" || ch.state === "errored"
      );

      if (hasClosedChannel && !hasActiveChannel) {
        console.log("[ReconnectionState] ⚠️ Kapalı kanal tespit edildi");
        updateGlobalState({
          status: "reconnecting",
          isOverlayVisible: true,
          reconnectAttempts: globalState.reconnectAttempts + 1,
        });
      } else if (hasActiveChannel) {
        if (globalState.status !== "connected") {
          console.log("[ReconnectionState] ✅ Bağlantı geri geldi");
          updateGlobalState({
            status: "connected",
            isOverlayVisible: false,
            lastConnectedAt: Date.now(),
            reconnectAttempts: 0,
          });
        }
      }
    };

    // Her 3 saniyede kontrol et
    const interval = setInterval(checkConnection, 3000);
    checkConnection(); // İlk kontrol

    return () => clearInterval(interval);
  }, []);

  // isSystemConnected değişimlerini izle
  useEffect(() => {
    if (isSystemConnected) {
      // Native bağlantı sağlandı
      if (globalState.status === "disconnected" || globalState.status === "reconnecting") {
        console.log("[ReconnectionState] 📱 Native bağlantı sağlandı, overlay kapatılacak");
        
        // 2 saniye bekle, Supabase'in de bağlanmasını bekle
        reconnectTimeoutRef.current = setTimeout(() => {
          updateGlobalState({
            status: "connected",
            isOverlayVisible: false,
            lastConnectedAt: Date.now(),
            reconnectAttempts: 0,
          });
        }, 2000);
      }
    } else if (isNative) {
      // Native bağlantı koptu
      console.log("[ReconnectionState] 📱 Native bağlantı koptu, overlay gösterilecek");
      updateGlobalState({
        status: "disconnected",
        isOverlayVisible: true,
      });
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isSystemConnected, isNative]);

  // Force reconnect function
  const forceReconnect = useCallback(async () => {
    console.log("[ReconnectionState] 🔄 Force reconnect tetiklendi");
    updateGlobalState({
      status: "reconnecting",
      isOverlayVisible: true,
    });

    try {
      // Supabase realtime'ı yeniden bağla
      const channels = supabase.getChannels();
      for (const channel of channels) {
        if (channel.state === "closed" || channel.state === "errored") {
          channel.subscribe();
        }
      }

      // Native Realtime varsa onu da tetikle
      if (isNativeRealtimeAvailable() && NativeRealtime) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await NativeRealtime.setAccessToken({ token: session.access_token });
        }
      }

      // 3 saniye sonra overlay'i kapat
      setTimeout(() => {
        updateGlobalState({
          status: "connected",
          isOverlayVisible: false,
          lastConnectedAt: Date.now(),
          reconnectAttempts: 0,
        });
      }, 3000);
    } catch (e) {
      console.error("[ReconnectionState] Force reconnect hatası:", e);
      updateGlobalState({
        status: "disconnected",
        reconnectAttempts: globalState.reconnectAttempts + 1,
      });
    }
  }, []);

  // Hide overlay function (manual dismiss)
  const hideOverlay = useCallback(() => {
    updateGlobalState({ isOverlayVisible: false });
  }, []);

  return {
    ...state,
    forceReconnect,
    hideOverlay,
  };
}
