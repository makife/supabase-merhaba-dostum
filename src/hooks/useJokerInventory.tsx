import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Capacitor } from "@capacitor/core";
import { 
  registerForegroundCleanup,
  subscribeToRecoveryComplete
} from "@/utils/foregroundOrchestrator";

interface JokerInventory {
  degistir: number;
  fisilida: number;
  senYaz: number;
}

export const useJokerInventory = () => {
  const { user } = useAuth();
  const [jokers, setJokers] = useState<JokerInventory>({
    degistir: 0,
    fisilida: 0,
    senYaz: 0,
  });
  const [loading, setLoading] = useState(true);
  
  // 🔥 Subscription state
  const channelRef = useRef<any>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const loadJokers = useCallback(async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("user_inventory")
        .select("item_type, quantity")
        .eq("user_id", user.id)
        .in("item_type", [
          "degistir",
          "joker_degistir",
          "fisilda",
          "fisilida",
          "joker_fisildi",
          "joker_fisilida",
          "senYaz",
          "senyaz",
          "joker_senyaz",
        ]);

      const jokerInventory: JokerInventory = {
        degistir: 0,
        fisilida: 0,
        senYaz: 0,
      };

      const keyMap: Record<string, keyof JokerInventory> = {
        degistir: "degistir",
        joker_degistir: "degistir",
        fisilda: "fisilida",
        fisilida: "fisilida",
        joker_fisildi: "fisilida",
        joker_fisilida: "fisilida",
        senYaz: "senYaz",
        senyaz: "senYaz",
        joker_senyaz: "senYaz",
      };

      data?.forEach((item) => {
        const mapped = keyMap[item.item_type];
        if (mapped) {
          jokerInventory[mapped] = item.quantity + (jokerInventory[mapped] || 0);
        }
      });

      if (isMountedRef.current) {
        setJokers(jokerInventory);
      }
    } catch (error) {
      console.error("Joker envanteri yüklenirken hata:", error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  // 🔥 Subscription'ı kapat
  const closeSubscription = useCallback(() => {
    console.log("[Joker] 🧹 Subscription kapatılıyor...");
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // 🔥 Subscription'ı aç
  const openSubscription = useCallback(() => {
    if (!user?.id || channelRef.current) return;

    console.log("[Joker] 🔌 Subscription açılıyor:", user.id.slice(-8));

    // Veritabanı değişikliklerini dinle
    const channel = supabase
      .channel(`inventory_updates_${user.id}_${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_inventory",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("🔔 Envanter değişti, güncelleniyor...", payload);
          loadJokers();
        },
      )
      .subscribe((status) => {
        console.log(`[Joker] 📡 Channel status: ${status}`);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.log("[Joker] ⚠️ Channel error, 3 saniye sonra yeniden denenecek...");
          setTimeout(() => loadJokers(), 3000);
        }
      });
    
    channelRef.current = channel;

    // Fallback polling
    pollingRef.current = setInterval(() => {
      console.log("[Joker] ⏱️ Polling - jokerler kontrol ediliyor...");
      loadJokers();
    }, 15000);
  }, [user?.id, loadJokers]);

  // Ana effect
  useEffect(() => {
    isMountedRef.current = true;

    if (!user?.id) {
      setLoading(false);
      return;
    }

    // İlk yükleme
    loadJokers();

    // Native platformda orchestrator'a kayıt ol
    if (Capacitor.isNativePlatform()) {
      // Cleanup fonksiyonunu kaydet
      const unregisterCleanup = registerForegroundCleanup(closeSubscription);
      
      // Recovery complete'de subscription'ı aç
      const unsubscribeRecovery = subscribeToRecoveryComplete(() => {
        console.log("[Joker] 🔄 Recovery complete - subscription yeniden açılıyor");
        openSubscription();
        loadJokers();
      });

      // İlk subscription'ı aç
      openSubscription();

      return () => {
        isMountedRef.current = false;
        unregisterCleanup();
        unsubscribeRecovery();
        closeSubscription();
      };
    } else {
      // Web platformda normal davranış
      openSubscription();

      const handleVisibility = () => {
        if (document.visibilityState === "visible") {
          console.log("[Joker] 👁️ Sayfa görünür, jokerler yeniden yükleniyor...");
          loadJokers();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);

      return () => {
        isMountedRef.current = false;
        document.removeEventListener("visibilitychange", handleVisibility);
        closeSubscription();
      };
    }
  }, [user?.id, loadJokers, openSubscription, closeSubscription]);

  const useJoker = async (jokerType: keyof JokerInventory) => {
    if (!user || jokers[jokerType] <= 0) return false;

    try {
      // Optimistik UI Güncellemesi
      setJokers((prev) => ({
        ...prev,
        [jokerType]: Math.max(0, prev[jokerType] - 1),
      }));

      const columnMap = {
        degistir: "degistir_joker_used",
        fisilida: "fisilida_joker_used",
        senYaz: "senyaz_joker_used",
      };

      // İstatistik Güncelleme
      const { data: profile } = await supabase.from("profiles").select(columnMap[jokerType]).eq("id", user.id).single();

      const currentValue = (profile as any)?.[columnMap[jokerType]] || 0;

      await supabase
        .from("profiles")
        .update({ [columnMap[jokerType]]: currentValue + 1 })
        .eq("id", user.id);

      // Rozet kontrolü
      await supabase.rpc("check_and_award_badges_simple", { p_user_id: user.id });

      // Inventory Veritabanı Güncelleme
      const aliasMap: Record<keyof JokerInventory, string[]> = {
        degistir: ["joker_degistir", "degistir"],
        fisilida: ["fisilda", "fisilida", "joker_fisilida", "joker_fisildi"],
        senYaz: ["joker_senyaz", "senYaz", "senyaz"],
      };
      const aliases = aliasMap[jokerType];

      const { data: rows, error: selectError } = await supabase
        .from("user_inventory")
        .select("id, item_type, quantity")
        .eq("user_id", user.id)
        .in("item_type", aliases)
        .limit(1);

      if (selectError) throw selectError;

      const row = rows?.[0];
      if (!row) {
        console.warn("⚠️ Joker kaydı bulunamadı (Veritabanı), geri alınıyor:", jokerType);
        loadJokers();
        return false;
      }

      const currentQty = row.quantity ?? 0;
      const newQuantity = Math.max(0, currentQty - 1);

      if (newQuantity === 0) {
        await supabase.from("user_inventory").delete().eq("id", row.id);
      } else {
        await supabase.from("user_inventory").update({ quantity: newQuantity }).eq("id", row.id);
      }

      console.log(`✅ Joker başarıyla kullanıldı: ${jokerType}`);
      return true;
    } catch (error) {
      console.error("Joker kullanılırken hata:", error);
      loadJokers();
      return false;
    }
  };

  return {
    jokers,
    loading,
    useJoker,
    loadJokers,
  };
};
