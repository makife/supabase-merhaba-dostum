import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw, Power, Loader2 } from "lucide-react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { recreateSupabaseClient } from "@/integrations/supabase/client";

interface ConnectionRecoveryOverlayProps {
  isVisible: boolean;
  onReconnectSuccess: () => void;
}

// Sadece native platformlarda göster
const isNative = Capacitor.isNativePlatform();

export const ConnectionRecoveryOverlay = ({
  isVisible,
  onReconnectSuccess,
}: ConnectionRecoveryOverlayProps) => {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReconnect = async () => {
    console.log("🔄 [ConnectionRecovery] Manuel yeniden bağlanma başlatıldı...");
    setIsReconnecting(true);
    setError(null);

    try {
      // Supabase client'ı tamamen yeniden oluştur
      const newClient = await recreateSupabaseClient();
      
      // Bağlantı testi
      const { data, error: testError } = await newClient.rpc("get_server_time");
      
      if (testError || !data) {
        throw new Error("Bağlantı testi başarısız");
      }

      console.log("✅ [ConnectionRecovery] Bağlantı başarıyla kuruldu!");
      
      // Tüm dinleyicilere haber ver
      window.dispatchEvent(new CustomEvent("supabase-reconnected"));
      
      onReconnectSuccess();
    } catch (err) {
      console.error("❌ [ConnectionRecovery] Yeniden bağlanma hatası:", err);
      setError("Bağlantı kurulamadı. Lütfen tekrar deneyin veya uygulamayı yeniden başlatın.");
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleRestartApp = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await App.exitApp();
      } catch (e) {
        // iOS'ta exitApp çalışmaz, sayfayı yenile
        window.location.reload();
      }
    } else {
      window.location.reload();
    }
  };

  // Web'de gösterme - sadece native
  if (!isVisible || !isNative) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        {/* İkon */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <WifiOff className="w-10 h-10 text-destructive" />
          </div>
        </div>

        {/* Başlık */}
        <h2 className="text-xl font-bold text-center text-foreground mb-2">
          Bağlantı Koptu
        </h2>

        {/* Açıklama */}
        <p className="text-muted-foreground text-center text-sm mb-6">
          Uygulama arka planda kaldığı için sunucu bağlantısı kesildi. 
          Devam etmek için yeniden bağlanın.
        </p>

        {/* Hata mesajı */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
            <p className="text-destructive text-sm text-center">{error}</p>
          </div>
        )}

        {/* Butonlar */}
        <div className="space-y-3">
          <Button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            {isReconnecting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Bağlanıyor...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                Tekrar Bağlan
              </>
            )}
          </Button>

          <Button
            onClick={handleRestartApp}
            variant="outline"
            className="w-full h-12 text-base"
            size="lg"
            disabled={isReconnecting}
          >
            <Power className="w-5 h-5 mr-2" />
            Uygulamayı Yeniden Başlat
          </Button>
        </div>

        {/* Bilgi notu */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          Verileriniz güvende. Yeniden bağlandığınızda kaldığınız yerden devam edebilirsiniz.
        </p>
      </div>
    </div>
  );
};
