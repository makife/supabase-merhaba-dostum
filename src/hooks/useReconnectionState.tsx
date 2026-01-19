/**
 * useReconnectionState Hook
 * Bağlantı durumunu global olarak yönetir ve UI State Lock sağlar
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Capacitor } from "@capacitor/core";
// NativeRealtime kaldırıldı
import { onConnectionStateChange, forceRecovery, getConnectionState } from "@/utils/supabaseConnectionManager";

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
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to global state changes
  useEffect(() => {
    const handler = (newState: ReconnectionState) => setState(newState);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  // 🆕 ConnectionManager state değişikliklerini dinle
  useEffect(() => {
    const unsubscribe = onConnectionStateChange((managerState) => {
      console.log("[ReconnectionState] 📡 Manager state:", managerState);

      if (managerState === "healthy") {
        // Overlay'i hemen kapatma, biraz bekle
        if (overlayTimeoutRef.current) {
          clearTimeout(overlayTimeoutRef.current);
        }
        overlayTimeoutRef.current = setTimeout(() => {
          updateGlobalState({
            status: "connected",
            isOverlayVisible: false,
            lastConnectedAt: Date.now(),
            reconnectAttempts: 0,
          });
        }, 1000);
      } else if (managerState === "recovering") {
        updateGlobalState({
          status: "reconnecting",
          isOverlayVisible: true,
        });
      } else if (managerState === "disconnected") {
        updateGlobalState({
          status: "disconnected",
          isOverlayVisible: true,
          reconnectAttempts: globalState.reconnectAttempts + 1,
        });
      } else if (managerState === "degraded") {
        // Degraded durumunda overlay gösterme, sadece status güncelle
        updateGlobalState({
          status: "connecting",
        });
      }
    });

    return () => {
      unsubscribe();
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, []);

  // isSystemConnected değişimlerini izle (Native için)
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
      // 🆕 ConnectionManager üzerinden kurtarma yap
      const recovered = await forceRecovery();

      if (recovered) {
        console.log("[ReconnectionState] ✅ Kurtarma başarılı");
        // Manager state callback'i overlay'i kapatacak
      } else {
        // Native realtime kaldırıldı

        // 3 saniye sonra overlay'i kapat
        setTimeout(() => {
          updateGlobalState({
            status: "connected",
            isOverlayVisible: false,
            lastConnectedAt: Date.now(),
            reconnectAttempts: 0,
          });
        }, 3000);
      }
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
