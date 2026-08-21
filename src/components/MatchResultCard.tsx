import React from "react";
import { PressableZone } from "@/components/ui/pressable-zone";
import kazandinKarti from "@/assets/KazandinKarti.webp";
import kaybettinKarti from "@/assets/kaybettinKarti.webp";

interface MatchResultCardProps {
  won: boolean;
  playerScore: number | string;
  opponentScore: number | string;
  /** Reklam izle butonu - undefined ise buton devre dışı görünür */
  onWatchAd?: () => void;
  adLoading?: boolean;
  /** Tekrar oyna - undefined ise devre dışı */
  onPlayAgain?: () => void;
  onHome?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

/** PNG kart üzerine görünmez hit-zone butonlar giydirir. */
const MatchResultCard: React.FC<MatchResultCardProps> = ({
  won,
  playerScore,
  opponentScore,
  onWatchAd,
  adLoading,
  onPlayAgain,
  onHome,
  disabled,
  children,
}) => {
  const zone = (label: string, left: string, width: string, handler?: () => void, isDisabled?: boolean) => (
    <PressableZone
      label={label}
      onPress={handler}
      disabled={isDisabled || !handler}
      className="z-10 rounded-[2cqw] disabled:opacity-100"
      style={{ left, width, top: "62.5%", height: "8.2%" }}
    >
      {(isDisabled || !handler) && <span className="absolute inset-0 rounded-[2cqw] bg-black/45" />}
      {label === "Reklam İzle" && adLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-[5cqw] h-[5cqw] border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </span>
      )}
    </PressableZone>
  );

  return (
    /* h-full (veya min-h-screen) ve flex items-center justify-center eklendi */
    <div className="flex justify-center items-center w-full overflow-hidden">
      <div
        className="relative w-full max-w-[400px] mx-auto animate-in fade-in zoom-in-95 duration-300"
        style={{ containerType: "inline-size" }}
      >
        <img
          src={won ? kazandinKarti : kaybettinKarti}
          alt={won ? "Kazandın" : "Kaybettin"}
          className="w-full h-auto select-none pointer-events-none"
          draggable={false}
        />

        {/* Senin Puanın */}
        <div
          className="absolute flex items-center justify-end pointer-events-none"
          style={{ left: "9.9%", width: "80.2%", top: "49%", height: "4.7%", paddingRight: "4cqw" }}
        >
          <span className="font-extrabold text-[#1b3a5c]" style={{ fontSize: "6cqw" }}>
            {playerScore}
          </span>
        </div>

        {/* Rakip Puanı */}
        <div
          className="absolute flex items-center justify-end pointer-events-none"
          style={{ left: "9.9%", width: "80.2%", top: "55.5%", height: "4.6%", paddingRight: "4cqw" }}
        >
          <span className="font-extrabold text-[#1b3a5c]" style={{ fontSize: "6cqw" }}>
            {opponentScore}
          </span>
        </div>

        {zone("Reklam İzle", "9.9%", "25.7%", onWatchAd, disabled || adLoading)}
        {zone("Tekrar Oyna", "37.1%", "25.7%", onPlayAgain, disabled)}
        {zone("Ana Menüye Dön", "64.4%", "25.7%", onHome, disabled)}

        {children}
      </div>
    </div>
  );
};

export default MatchResultCard;
