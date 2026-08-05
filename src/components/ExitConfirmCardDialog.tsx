import React from "react";
import Lottie from "lottie-react";
import dialogImg from "@/assets/cikmakDiyalogPenceresi.png";
import merakliKopek from "@/assets/merakliKopek.json";

interface ExitConfirmCardDialogProps {
  open: boolean;
  onContinue: () => void;
  onExit: () => void;
}

/**
 * Aktif maçtan çıkış onayı - cikmakDiyalogPenceresi.png tabanlı kart.
 * Açık mor alanın alt kenarına hizalanmış merakliKopek.json animasyonu içerir.
 */
const ExitConfirmCardDialog: React.FC<ExitConfirmCardDialogProps> = ({
  open,
  onContinue,
  onExit,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onContinue}
      />

      <div className="relative w-full max-w-[340px] animate-in fade-in zoom-in-95 duration-300">
        <img
          src={dialogImg}
          alt="Çıkmak istediğine emin misin?"
          className="w-full h-auto select-none pointer-events-none"
          draggable={false}
        />

        {/* Açık mor alan: köpek animasyonu alt kenara hizalı */}
        <div
          className="absolute pointer-events-none flex items-end justify-center overflow-hidden"
          style={{ left: "9.5%", right: "10%", top: "36.8%", bottom: "21.4%" }}
        >
          <Lottie
            animationData={merakliKopek}
            loop
            autoplay
            rendererSettings={{ preserveAspectRatio: "xMidYMax meet" }}
            style={{ width: "88%", height: "96%" }}
          />
        </div>

        {/* Devam Et */}
        <button
          type="button"
          onClick={onContinue}
          aria-label="Devam Et"
          className="absolute active:scale-95 transition-transform"
          style={{ left: "9%", width: "39.8%", top: "83.3%", height: "10.2%" }}
        />

        {/* Çıkış Yap */}
        <button
          type="button"
          onClick={onExit}
          aria-label="Çıkış Yap"
          className="absolute active:scale-95 transition-transform"
          style={{ left: "51.6%", width: "38.5%", top: "83.3%", height: "10.2%" }}
        />
      </div>
    </div>
  );
};

export default ExitConfirmCardDialog;
