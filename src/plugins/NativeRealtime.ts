import { registerPlugin, PluginListenerHandle, Capacitor } from "@capacitor/core";

/**
 * Native Realtime Plugin Interface
 */
export interface NativeRealtimePlugin {
  connect(options: {
    url: string;
    apiKey: string;
    accessToken?: string;
  }): Promise<{ success: boolean; message?: string }>;

  disconnect(): Promise<{ success: boolean }>;

  enterForegroundMode(): Promise<void>;
  enterBackgroundMode(): Promise<void>;

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

// 1. Plugin'i kaydet (Sadece tek bir isimde tutuyoruz)
const NativeRealtimeImpl = registerPlugin<NativeRealtimePlugin>("NativeRealtime", {
  web: undefined,
});

/**
 * 2. KRİTİK: Hem Lovable'ı susturuyoruz hem de çakışmayı önlüyoruz.
 * NativeRealtime isminden sadece BİR TANE var artık.
 */
export const NativeRealtime = (Capacitor.isNativePlatform() ? NativeRealtimeImpl : null) as any as NativeRealtimePlugin;

/**
 * Native Realtime kullanılabilir mi kontrolü
 */
export const isNativeRealtimeAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
};

// 3. Varsayılan export
export default NativeRealtime;
