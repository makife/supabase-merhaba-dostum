import { useEffect, useCallback, useRef } from "react";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

type ChannelSetup = () => RealtimeChannel | null;

/**
 * Supabase reconnect olduğunda kanalları otomatik yeniden oluşturur.
 * Bu hook, arka plandan ön plana gelince kanalların yeniden kurulmasını sağlar.
 * 
 * @param channelSetup - Kanal oluşturan ve abone eden fonksiyon
 * @param dependencies - Effect'in bağımlılıkları
 */
export function useRealtimeReconnect(
  channelSetup: ChannelSetup,
  dependencies: any[] = []
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const setupFnRef = useRef<ChannelSetup>(channelSetup);

  // Setup fonksiyonunu güncel tut
  useEffect(() => {
    setupFnRef.current = channelSetup;
  }, [channelSetup]);

  // Kanal oluştur/yeniden oluştur
  // ⚠️ DEVRE DIŞI: removeChannel çağrısı kaldırıldı - bağlantı koruması
  const createChannel = useCallback(() => {
    // ❌ DEVRE DIŞI: Eski kanalı temizleme - bağlantıyı öldürüyordu
    // if (channelRef.current) {
    //   try {
    //     getSupabaseClient().removeChannel(channelRef.current);
    //   } catch (e) {}
    //   channelRef.current = null;
    // }

    // Sadece yeni kanal oluştur (mevcut yoksa)
    if (!channelRef.current) {
      try {
        const newChannel = setupFnRef.current();
        channelRef.current = newChannel;
        console.log("[useRealtimeReconnect] ✅ Kanal oluşturuldu");
      } catch (e) {
        console.error("[useRealtimeReconnect] ❌ Kanal oluşturma hatası:", e);
      }
    } else {
      console.log("[useRealtimeReconnect] ⚠️ Kanal zaten mevcut, atlanıyor (bağlantı koruması)");
    }
  }, []);

  // İlk mount ve dependencies değişince
  useEffect(() => {
    createChannel();

    // ⚠️ CLEANUP DEVRE DIŞI - Bağlantı koruması
    return () => {
      console.log("[useRealtimeReconnect] ⚠️ Cleanup ATLANYOR (bağlantı koruması)");
      // ❌ DEVRE DIŞI: removeChannel - bağlantıyı öldürüyordu
      // if (channelRef.current) {
      //   try {
      //     getSupabaseClient().removeChannel(channelRef.current);
      //   } catch (e) {}
      //   channelRef.current = null;
      // }
    };
  }, dependencies);

  // Reconnect event'ini dinle
  useEffect(() => {
    const handleReconnect = () => {
      console.log("[useRealtimeReconnect] 🔄 Reconnect algılandı, kanal yeniden oluşturuluyor...");
      
      // Kısa gecikme ile kanalı yeniden oluştur
      setTimeout(() => {
        createChannel();
      }, 300);
    };

    window.addEventListener("supabase-reconnected", handleReconnect);

    return () => {
      window.removeEventListener("supabase-reconnected", handleReconnect);
    };
  }, [createChannel]);

  return channelRef;
}

/**
 * Supabase reconnect event'ini dinler ve callback çağırır.
 * Daha genel amaçlı - kanallar dışında da kullanılabilir.
 */
export function useOnReconnect(callback: () => void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleReconnect = () => {
      console.log("[useOnReconnect] 🔄 Reconnect algılandı, callback çağrılıyor...");
      
      // Kısa gecikme
      setTimeout(() => {
        callbackRef.current();
      }, 200);
    };

    window.addEventListener("supabase-reconnected", handleReconnect);

    return () => {
      window.removeEventListener("supabase-reconnected", handleReconnect);
    };
  }, []);
}
