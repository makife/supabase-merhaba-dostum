import { registerPlugin, PluginListenerHandle, Capacitor } from '@capacitor/core';

/**
 * Native Realtime Plugin Interface
 * 
 * Android tarafında Kotlin ile yazılmış WebSocket service'i ile iletişim kurar.
 * WebView'den bağımsız çalışır, arka planda bile bağlantı kopmaz.
 */
export interface NativeRealtimePlugin {
  /**
   * WebSocket bağlantısını başlat
   */
  connect(options: { 
    url: string; 
    apiKey: string; 
    accessToken?: string 
  }): Promise<{ success: boolean; message?: string }>;

  /**
   * Bağlantıyı kapat
   */
  disconnect(): Promise<{ success: boolean }>;

  /**
   * Kanala subscribe ol
   */
  subscribe(options: { 
    topic: string; 
    event?: string; 
    schema?: string; 
    table?: string; 
    filter?: string 
  }): Promise<{ success: boolean; topic: string }>;

  /**
   * Kanaldan unsubscribe ol
   */
  unsubscribe(options: { topic: string }): Promise<{ success: boolean }>;

  /**
   * Broadcast mesaj gönder
   */
  broadcast(options: { 
    topic: string; 
    event: string; 
    payload: string 
  }): Promise<{ success: boolean }>;

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
    eventName: 'realtimeMessage',
    listenerFunc: (data: RealtimeMessageEvent) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'connectionState',
    listenerFunc: (data: ConnectionStateEvent) => void
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
  state: 'connecting' | 'connected' | 'disconnected';
  reason?: string;
}

// Plugin'i kaydet (sadece native platformda)
const NativeRealtimeImpl = registerPlugin<NativeRealtimePlugin>('NativeRealtime', {
  web: undefined, // Web'de çalışmaz
});

/**
 * Native Realtime Plugin
 * 
 * Sadece Android'de çalışır. Web'de null döner.
 */
export const NativeRealtime = Capacitor.isNativePlatform() ? NativeRealtimeImpl : null;

/**
 * Native Realtime kullanılabilir mi?
 */
export const isNativeRealtimeAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};
