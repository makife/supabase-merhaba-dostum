import { useState, useEffect, useCallback } from "react";
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

  const loadJokers = useCallback(async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("user_inventory")
        .select("item_type, quantity")
        .eq("user_id", user.id)
        // BURAYA 'joker_fisilida' (hatalı versiyonu) da ekledik ki geçmiş kayıplar görünsün
        .in("item_type", [
          "degistir",
          "joker_degistir",
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

        fisilida: "fisilida",
        joker_fisildi: "fisilida",
        joker_fisilida: "fisilida", // Hatalı yazılanı da 'fisilida' hanesine ekle

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
  }, [user]);

  // Realtime Listener (Markette satın alınanı Ana Sayfada görmek için ŞART)
  useEffect(() => {
    if (!user) return;

    // İlk yükleme
    loadJokers();

    // Veritabanı değişikliklerini dinle
    const channel = supabase
      .channel("inventory_updates")
      .on(
        "postgres_changes",
        {
          event: "*", // Ekleme, silme veya güncelleme
          schema: "public",
          table: "user_inventory",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("🔔 Envanter değişti, güncelleniyor...", payload);
          loadJokers();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadJokers]);

  const useJoker = async (jokerType: keyof JokerInventory) => {
    if (!user || jokers[jokerType] <= 0) return false;

    try {
      // Optimistik UI Güncellemesi (Kullanıcıya anında tepki vermek için)
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
        fisilida: ["joker_fisilida", "joker_fisildi", "fisilida"], // Burayı da güncelledim
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
        // Hata olursa UI'ı geri düzelt
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

      // İşlem başarılı, Realtime zaten loadJokers'ı tetikleyecek ama garanti olsun
      console.log(`✅ Joker başarıyla kullanıldı: ${jokerType}`);
      return true;
    } catch (error) {
      console.error("Joker kullanılırken hata:", error);
      // Hata durumunda gerçek veriyi geri yükle
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
