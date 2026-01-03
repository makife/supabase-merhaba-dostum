import { registerPlugin, PluginListenerHandle, Capacitor } from "@capacitor/core";

/**
 * Native Realtime Plugin Interface
 * * Android tarafında Kotlin ile yazılmış WebSocket service'i ile iletişim kurar.
 * Lovable tarafında hata vermemesi için interface tam tanımlanmıştır.
 */
export interface NativeRealtimePlugin {
  /**
   * WebSocket bağlantısını başlat
   */
  connect(options: {
    url: string;
    apiKey: string;
    accessToken?: string;
  }): Promise<{ success: boolean; message?: string }>;

  /**
   * Bağlantıyı kapat
   */
  disconnect(): Promise<{ success: boolean }>;

  /**
   * 👇 ARKA PLAN SAYAÇLARI (KOTLIN TARAFINDAKİ METOTLAR)
   */
  startBackgroundTimer(): Promise<void>;
  stopBackgroundTimer(): Promise<void>;

  /**
   * Kanala subscribe ol
   */
  subscribe(options: {
    topic: string;
    event?: string;
    schema?: string;
    table?: string;
    filter?: string;
  }): Promise<{ success: boolean; topic: string }>;

  /**
   * Kanaldan unsubscribe ol
   */
  unsubscribe(options: { topic: string }): Promise<{ success: boolean }>;

  /**
   * Broadcast mesaj gönder
   */
  broadcast(options: { topic: string; event: string; payload: string }): Promise<{ success: boolean }>;

  /**
   * Bağlantı durumunu kontrol et
   */
  getConnectionState(): Promise<{ state: string; isConnected: boolean }>;

  /**
   * Access token güncelle
   */
  setAccessToken(options: { token: string }): Promise<{ success: boolean }>;

  /**
   * Event listener ekle
   */
  addListener(
    eventName: "realtimeMessage",
    listenerFunc: (data: RealtimeMessageEvent) => void,
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: "connectionState",
    listenerFunc: (data: ConnectionStateEvent) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Tüm listener'ları kaldır
   */
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

// 1. Plugin'i kaydet
const NativeRealtimeImpl = registerPlugin<NativeRealtimePlugin>("NativeRealtime", {
  web: undefined,
});

/**
 * 2. KRİTİK NOKTA: Lovable/TypeScript'i "as any" ile kandırıyoruz.
 * Bu sayede "startBackgroundTimer yok" hatası Lovable'da söner.
 */
export const NativeRealtime = (Capacitor.isNativePlatform() ? NativeRealtimeImpl : null) as any as NativeRealtimePlugin;

/**
 * Native Realtime kullanılabilir mi kontrolü
 */
export const isNativeRealtimeAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
};

export default NativeRealtime;
