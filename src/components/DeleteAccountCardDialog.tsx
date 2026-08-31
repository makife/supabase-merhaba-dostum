import React from "react";
import { createPortal } from "react-dom";
import { PressableZone } from "@/components/ui/pressable-zone";
import hesapSilmeOnayImg from "@/assets/hesapSilmeOnay.webp";
import hesapSilmeSonOnayImg from "@/assets/hesapSilmeSonOnay.webp";

interface DeleteAccountCardDialogProps {
  open: boolean;
  /** "confirm" = ilk uyarı kartı (mavi, "Hesap silme"), "final" = geri dönüşü olmayan son onay kartı (sarı, "Son Onay") */
  step: "confirm" | "final";
  /** Vazgeç */
  onCancel: () => void;
  /** Evet Sil */
  onConfirm: () => void;
  /** Silme işlemi sürerken butonları kilitlemek için */
  loading?: boolean;
}

/**
 * Hesap silme akışının iki adımında da (ilk onay + son onay) kullanılan,
 * görsel tabanlı kart diyalog. Vazgeç / Evet Sil butonları görseldeki
 * piksel konumlarına göre hesaplanmış, görünmez, haptic + ses geri
 * bildirimli PressableZone alanlarıdır.
 *
 * Not: iki kart da (hesapSilmeOnay.webp, hesapSilmeSonOnay.webp) aynı
 * şablon üzerine kurulu olduğundan buton koordinatları ortak.
 */
const DeleteAccountCardDialog: React.FC<DeleteAccountCardDialogProps> = ({
  open,
  step,
  onCancel,
  onConfirm,
  loading = false,
}) => {
  if (!open) return null;

  const imgSrc = step === "final" ? hesapSilmeSonOnayImg : hesapSilmeOnayImg;
  const alt = step === "final" ? "Son Onay" : "Hesap silme";

  const dialog = (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => !loading && onCancel()}
      />

      <div className="relative w-full max-w-[340px] animate-in fade-in zoom-in-95 duration-300">
        <img
          src={imgSrc}
          alt={alt}
          className="w-full h-auto select-none pointer-events-none"
          draggable={false}
        />

        {/* Vazgeç */}
        <PressableZone
          label="Vazgeç"
          haptic="medium"
          sound="buttonClick"
          style={{
            left: "13.8%",
            width: "35.3%",
            top: "72.9%",
            height: "7.7%",
            pointerEvents: loading ? "none" : "auto",
            opacity: loading ? 0.6 : 1,
          }}
          onPress={() => {
            if (loading) return;
            onCancel();
          }}
        />

        {/* Evet Sil */}
        <PressableZone
          label="Evet Sil"
          haptic="medium"
          sound="buttonClick"
          style={{
            left: "50.9%",
            width: "35.7%",
            top: "72.9%",
            height: "7.7%",
            pointerEvents: loading ? "none" : "auto",
            opacity: loading ? 0.6 : 1,
          }}
          onPress={() => {
            if (loading) return;
            onConfirm();
          }}
        />
      </div>
    </div>
  );

  if (typeof document === "undefined" || !document.body) return dialog;

  return createPortal(dialog, document.body);
};

export default DeleteAccountCardDialog;
