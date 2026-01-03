import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
  NativeRealtime, 
  isNativeRealtimeAvailable,
  RealtimeMessageEvent,
  ConnectionStateEvent 
} from '@/plugins/NativeRealtime';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";

interface UseNativeRealtimeOptions {
  /** Otomatik bağlan */
  autoConnect?: boolean;
  /** Bağlantı durumu değiştiğinde çağrılır */
  onConnectionChange?: (state: string, reason?: string) => void;
}

interface SubscriptionOptions {
  topic: string;
  event?: string;
  schema?: string;
  table?: string;
  filter?: string;
  onMessage: (payload: any) => void;
}

/**
 * Native Realtime Hook
 * 
 * Android'de native WebSocket kullanır, web'de normal Supabase realtime kullanır.
 * 
 * Kullanım:
 * ```tsx
 * const { isConnected, subscribe, unsubscribe } = useNativeRealtime();
 * 
 * useEffect(() => {
 *   const unsub = subscribe({
 *     topic: 'realtime:public:game_rooms',
 *     table: 'game_rooms',
 *     filter: `id=eq.${roomId}`,
 *     onMessage: (payload) => {
 *       console.log('Değişiklik:', payload);
 *     }
 *   });
 *   
 *   return () => unsub();
 * }, [roomId]);
 * ```
 */
export function useNativeRealtime(options: UseNativeRealtimeOptions = {}) {
  const { autoConnect = true, onConnectionChange } = options;
  
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const subscriptionsRef = useRef<Map<string, SubscriptionOptions>>(new Map());
  const listenersRef = useRef<{ message?: any; connection?: any }>({});
  const isNative = isNativeRealtimeAvailable();

  // Bağlantı durumu değişikliklerini dinle
  useEffect(() => {
    if (!isNative || !NativeRealtime) return;

    const setupListeners = async () => {
      // Mesaj listener
      listenersRef.current.message = await NativeRealtime.addListener(
        'realtimeMessage',
        (data: RealtimeMessageEvent) => {
          console.log('[NativeRealtime] 📩 Mesaj:', data.topic, data.event);
          
          // İlgili subscription'ı bul ve callback'i çağır
          subscriptionsRef.current.forEach((sub, key) => {
            if (data.topic === sub.topic || data.topic.includes(sub.table || '')) {
              try {
                const payload = JSON.parse(data.payload);
                sub.onMessage(payload);
              } catch (e) {
                sub.onMessage(data.payload);
              }
            }
          });
        }
      );

      // Bağlantı durumu listener
      listenersRef.current.connection = await NativeRealtime.addListener(
        'connectionState',
        (data: ConnectionStateEvent) => {
          console.log('[NativeRealtime] 🔌 Durum:', data.state, data.reason);
          setConnectionState(data.state);
          setIsConnected(data.state === 'connected');
          onConnectionChange?.(data.state, data.reason);
        }
      );
    };

    setupListeners();

    return () => {
      listenersRef.current.message?.remove();
      listenersRef.current.connection?.remove();
    };
  }, [isNative, onConnectionChange]);

  // Otomatik bağlan
  useEffect(() => {
    if (!isNative || !autoConnect) return;
    
    connect();
    
    return () => {
      // Component unmount olduğunda bağlantıyı KAPATMA
      // Çünkü arka planda çalışmaya devam etmeli
    };
  }, [isNative, autoConnect]);

  // Access token değiştiğinde güncelle
  useEffect(() => {
    if (!isNative || !NativeRealtime) return;

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.access_token) {
          console.log('[NativeRealtime] 🔑 Token güncelleniyor...');
          try {
            await NativeRealtime.setAccessToken({ token: session.access_token });
          } catch (e) {
            console.error('[NativeRealtime] Token güncelleme hatası:', e);
          }
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [isNative]);

  /**
   * Bağlantıyı başlat
   */
  const connect = useCallback(async () => {
    if (!isNative || !NativeRealtime) {
      console.log('[NativeRealtime] ⚠️ Native değil, atlanıyor');
      return;
    }

    try {
      setError(null);
      
      // Mevcut session'ı al
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || '';

      // WebSocket URL
      const wsUrl = SUPABASE_URL.replace('https://', 'wss://') + '/realtime/v1/websocket';

      console.log('[NativeRealtime] 🔌 Bağlanıyor...');
      
      const result = await NativeRealtime.connect({
        url: wsUrl,
        apiKey: SUPABASE_ANON_KEY,
        accessToken
      });

      console.log('[NativeRealtime] ✅ Bağlantı sonucu:', result);
    } catch (e: any) {
      console.error('[NativeRealtime] ❌ Bağlantı hatası:', e);
      setError(e.message || 'Bağlantı hatası');
    }
  }, [isNative]);

  /**
   * Bağlantıyı kapat
   */
  const disconnect = useCallback(async () => {
    if (!isNative || !NativeRealtime) return;

    try {
      await NativeRealtime.disconnect();
      subscriptionsRef.current.clear();
    } catch (e) {
      console.error('[NativeRealtime] Disconnect hatası:', e);
    }
  }, [isNative]);

  /**
   * Kanala subscribe ol
   */
  const subscribe = useCallback((options: SubscriptionOptions): (() => void) => {
    const { topic, event = '*', schema = 'public', table = '*', filter, onMessage } = options;

    // Unique key oluştur
    const key = `${topic}:${table}:${filter || 'all'}`;
    
    // Subscription'ı kaydet
    subscriptionsRef.current.set(key, options);

    if (isNative && NativeRealtime) {
      // Native subscribe
      NativeRealtime.subscribe({
        topic,
        event,
        schema,
        table,
        filter
      }).then(result => {
        console.log('[NativeRealtime] ✅ Subscribe:', topic, result);
      }).catch(e => {
        console.error('[NativeRealtime] ❌ Subscribe hatası:', e);
      });

      // Unsubscribe fonksiyonu
      return () => {
        subscriptionsRef.current.delete(key);
        NativeRealtime.unsubscribe({ topic }).catch(() => {});
      };
    } else {
      // Web'de normal Supabase kullan
      console.log('[NativeRealtime] 🌐 Web modu - Supabase realtime kullanılıyor');
      
      const channel = supabase
        .channel(key)
        .on(
          'postgres_changes',
          {
            event: event as any,
            schema,
            table,
            filter
          },
          (payload) => {
            onMessage(payload);
          }
        )
        .subscribe();

      return () => {
        subscriptionsRef.current.delete(key);
        supabase.removeChannel(channel);
      };
    }
  }, [isNative]);

  /**
   * Broadcast mesaj gönder
   */
  const broadcast = useCallback(async (topic: string, event: string, payload: any) => {
    if (isNative && NativeRealtime) {
      await NativeRealtime.broadcast({
        topic,
        event,
        payload: JSON.stringify(payload)
      });
    } else {
      // Web'de Supabase broadcast kullan
      const channel = supabase.channel(topic);
      await channel.send({
        type: 'broadcast',
        event,
        payload
      });
    }
  }, [isNative]);

  return {
    /** Native realtime kullanılabilir mi? */
    isNative,
    /** Bağlantı durumu */
    connectionState,
    /** Bağlı mı? */
    isConnected,
    /** Hata mesajı */
    error,
    /** Bağlan */
    connect,
    /** Bağlantıyı kes */
    disconnect,
    /** Subscribe ol */
    subscribe,
    /** Broadcast gönder */
    broadcast
  };
}

export default useNativeRealtime;
