import React from "react";
import { createPortal } from "react-dom";
import Lottie from "lottie-react";
import dialogImg from "@/assets/cikmakDiyalogPenceresi.png";
import tournamentDialogImg from "@/assets/turnuvaCikmakDiyalogPenceresi.png";
import merakliKopek from "@/assets/merakliKopek.json";

interface ExitConfirmCardDialogProps {
  open: boolean;
  onContinue: () => void;
  onExit: () => void;
  variant?: "default" | "tournament";
}

/**
 * Aktif maçtan çıkış onayı - cikmakDiyalogPenceresi.png tabanlı kart.
 * Açık mor alanın alt kenarına hizalanmış merakliKopek.json animasyonu içerir.
 *
 * Portal'a body üzerinden render edilir; böylece geri sayım / maç overlay
 * gibi üst katman elementlerinin üzerinde gösterilir.
 */
const ExitConfirmCardDialog: React.FC<ExitConfirmCardDialogProps> = ({
  open,
  onContinue,
  onExit,
}) => {
  if (!open) return null;

  const dialog = (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center px-4">
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
          className="absolute pointer-events-none flex items-end justify-center"
          style={{ left: "11%", right: "11%", top: "38.5%", bottom: "30.1%" }}
        >
          <Lottie
            animationData={merakliKopek}
            loop
            autoplay
            rendererSettings={{ preserveAspectRatio: "xMidYMax meet" }}
            style={{ width: "128%", height: "128%", marginBottom: "1%" }}
          />
        </div>

        {/* Devam Et */}
        <button
          type="button"
          onClick={onContinue}
          aria-label="Devam Et"
          className="absolute z-10 active:scale-95 transition-transform bg-transparent"
          style={{ left: "13.8%", width: "34.5%", top: "72.9%", height: "7.5%" }}
        />

        {/* Çıkış Yap */}
        <button
          type="button"
          onClick={onExit}
          aria-label="Çıkış Yap"
          className="absolute z-10 active:scale-95 transition-transform bg-transparent"
          style={{ left: "51.6%", width: "34.6%", top: "72.9%", height: "7.7%" }}
        />

      </div>
    </div>
  );

  if (typeof document === "undefined" || !document.body) return dialog;

  return createPortal(dialog, document.body);
};

export default ExitConfirmCardDialog;
