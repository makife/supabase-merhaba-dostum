import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  
  // 🔥 Subscription guard - aynı user için tekrar oluşturma
  const subscriptionUserIdRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);
  
  // 🔥 KRİTİK: User ref - closure sorununu çözmek için
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const loadJokers = useCallback(async () => {
    // 🔥 KRİTİK: userRef kullan - closure sorunu çözümü
    const currentUser = userRef.current;
    if (!currentUser?.id) {
      return;
    }
    
    console.log("[Joker] 🔄 Jokerler yükleniyor...", currentUser.id.slice(-8));

    try {
      const { data } = await supabase
        .from("user_inventory")
        .select("item_type, quantity")
        .eq("user_id", currentUser.id)
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

      setJokers(jokerInventory);
    } catch (error) {
      console.error("Joker envanteri yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // 🔥 BASİT YAKLAŞIM: app-resumed eventi dinle (GLOBAL LISTENER)
  useEffect(() => {
    const handleAppResumed = () => {
      console.log("[Joker] 🎯 App resumed eventi alındı!");
      const currentUser = userRef.current;
      if (currentUser?.id) {
        console.log("[Joker] 🔄 Jokerler yenileniyor...", currentUser.id.slice(-8));
        loadJokers().catch(e => {
          console.error("[Joker] ❌ Resume joker yenileme hatası:", e);
        });
      } else {
        console.log("[Joker] ⚠️ User yok, jokerler yenilenmedi");
      }
    };

    window.addEventListener("app-resumed", handleAppResumed);
    console.log("[Joker] ✅ app-resumed listener kaydedildi");
    
    return () => {
      window.removeEventListener("app-resumed", handleAppResumed);
    };
  }, [loadJokers]);

  // Realtime Listener
  useEffect(() => {
    if (!user?.id) return;

    // 🔥 GUARD: Aynı user için zaten subscription varsa atla
    if (subscriptionUserIdRef.current === user.id && channelRef.current) {
      loadJokers(); // Sadece veriyi yenile
      return;
    }

    console.log("[Joker] 🔌 Yeni subscription oluşturuluyor:", user.id.slice(-8));
    subscriptionUserIdRef.current = user.id;

    // İlk yükleme
    loadJokers();

    // Veritabanı değişikliklerini dinle
    const channel = supabase
      .channel(`inventory_updates_${user.id}`)
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
          setTimeout(() => loadJokers(), 3000);
        }
      });
    
    channelRef.current = channel;

    // ✅ Polling kaldırıldı - sadece Realtime subscription ile güncelleniyor
  }, [user?.id, loadJokers]);

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
