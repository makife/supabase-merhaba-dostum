import { registerPlugin, PluginListenerHandle, Capacitor } from "@capacitor/core";

/**
 * Native Realtime Plugin Interface - Basitleştirilmiş
 * 
 * NOT: enterForegroundMode/enterBackgroundMode kaldırıldı.
 * Yeni sistem: Silent Push Notification ile arka planda canlı tutma.
 */
export interface NativeRealtimePlugin {
  connect(options: {
    url: string;
    apiKey: string;
    accessToken?: string;
  }): Promise<{ success: boolean; message?: string }>;

  disconnect(): Promise<{ success: boolean }>;

  subscribe(options: {
    topic: string;
    event?: string;
    schema?: string;
    table?: string;
    filter?: string;
  }): Promise<{ success: boolean; topic: string }>;

  unsubscribe(options: { topic: string }): Promise<{ success: boolean }>;

  broadcast(options: { topic: string; event: string; payload: string }): Promise<{ success: boolean }>;

  getConnectionState(): Promise<{ state: string; isConnected: boolean }>;

  setAccessToken(options: { token: string }): Promise<{ success: boolean }>;

  addListener(
    eventName: "realtimeMessage",
    listenerFunc: (data: RealtimeMessageEvent) => void,
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: "connectionState",
    listenerFunc: (data: ConnectionStateEvent) => void,
  ): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}

export interface RealtimeMessageEvent {
  topic: string;
  event: string;
  payload: string;
}

export interface ConnectionStateEvent {
  state: "connecting" | "connected" | "disconnected";
  reason?: string;
}

// Plugin'i kaydet
const NativeRealtimeImpl = registerPlugin<NativeRealtimePlugin>("NativeRealtime", {
  web: undefined,
});

export const NativeRealtime = (Capacitor.isNativePlatform() ? NativeRealtimeImpl : null) as any as NativeRealtimePlugin;

export const isNativeRealtimeAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
};

export default NativeRealtime;
