import React from "react";
import { createPortal } from "react-dom";
import { PressableZone } from "@/components/ui/pressable-zone";
import guncellemeImg from "@/assets/guncelleme.webp";

interface UpdateCardDialogProps {
  open: boolean;
  /** true ise "Daha Sonra" pasif olur, dışarı tıklama/ESC ile kapanmaz (zorunlu güncelleme) */
  forceUpdate: boolean;
  /** Güncelle */
  onUpdate: () => void;
  /** Daha Sonra */
  onLater: () => void;
}

/**
 * Uygulama güncelleme uyarısı - guncelleme.webp tabanlı kart.
 * Güncelle / Daha Sonra butonları görseldeki piksel konumlarına göre
 * hesaplanmış, görünmez, haptic + ses geri bildirimli PressableZone
 * alanlarıdır (DeleteAccountCardDialog / ExitConfirmCardDialog ile aynı aile).
 */
const UpdateCardDialog: React.FC<UpdateCardDialogProps> = ({
  open,
  forceUpdate,
  onUpdate,
  onLater,
}) => {
  if (!open) return null;

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Uygulama güncellemesi"
      className="fixed inset-0 z-[2147483647] isolate flex items-center justify-center px-4 pointer-events-auto touch-none"
      style={{ pointerEvents: "auto" }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="absolute inset-0 pointer-events-auto bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => !forceUpdate && onLater()}
      />

      <div className="relative z-10 w-full max-w-[340px] pointer-events-auto animate-in fade-in zoom-in-95 duration-300">
        <img
          src={guncellemeImg}
          alt="Güncelleme"
          className="w-full h-auto select-none pointer-events-none"
          draggable={false}
        />

        {/* Güncelle */}
        <PressableZone
          label="Güncelle"
          haptic="medium"
          sound="buttonClick"
          style={{ left: "13.8%", width: "35.3%", top: "72.9%", height: "7.7%" }}
          onPress={onUpdate}
        />

        {/* Daha Sonra: zorunlu güncellemede pasif */}
        <PressableZone
          label="Daha Sonra"
          haptic="medium"
          sound="buttonClick"
          style={{
            left: "50.9%",
            width: "35.7%",
            top: "72.9%",
            height: "7.7%",
            pointerEvents: forceUpdate ? "none" : "auto",
            opacity: forceUpdate ? 0.5 : 1,
          }}
          onPress={() => {
            if (forceUpdate) return;
            onLater();
          }}
        />
      </div>
    </div>
  );

  if (typeof document === "undefined" || !document.body) return dialog;

  return createPortal(dialog, document.body);
};

export default UpdateCardDialog;
