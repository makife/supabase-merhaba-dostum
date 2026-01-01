import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Capacitor } from "@capacitor/core";

interface ConnectionRecoveryOverlayProps {
  isVisible: boolean;
}

// Sadece native platformlarda göster
const isNative = Capacitor.isNativePlatform();

export const ConnectionRecoveryOverlay = ({
  isVisible,
}: ConnectionRecoveryOverlayProps) => {

  const handleReload = () => {
    window.location.reload();
  };

  // Web'de gösterme - sadece native
  if (!isVisible || !isNative) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
        {/* Başlık */}
        <h2 className="text-xl font-bold text-foreground mb-2">
          Bağlantı Koptu
        </h2>

        {/* Açıklama */}
        <p className="text-muted-foreground text-sm mb-6">
          Uygulama arka planda kaldığı için sunucu bağlantısı kesildi. 
          Devam etmek için uygulamayı yenileyin.
        </p>

        {/* Buton */}
        <Button
          onClick={handleReload}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          Yenile
        </Button>

        {/* Bilgi notu */}
        <p className="text-xs text-muted-foreground mt-4">
          Verileriniz güvende. Yenileme sonrası kaldığınız yerden devam edebilirsiniz.
        </p>
      </div>
    </div>
  );
};
