import { registerPlugin, PluginListenerHandle, Capacitor } from "@capacitor/core";

/**
 * Native Realtime Plugin Interface
 * 
 * Kotlin tarafında mesaj buffering destekler:
 * - Arka plandayken mesajlar buffer'lanır
 * - Ön plana dönünce buffer'daki mesajlar JS'e gönderilir
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

  // 🆕 App foreground/background durumunu Kotlin'e bildir
  setAppForegroundState(options: { inForeground: boolean }): Promise<{ 
    success: boolean; 
    inForeground: boolean;
    bufferedMessages: number;
  }>;

  // 🆕 Buffer'daki mesaj sayısını al
  getBufferedMessageCount(): Promise<{ count: number }>;

  // 🆕 JS uyanınca buffer'daki mesajları ÇEK (PULL model)
  getBufferedMessages(): Promise<{ 
    messages: Array<{ topic: string; event: string; payload: string; timestamp: number }>; 
    count: number 
  }>;

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
