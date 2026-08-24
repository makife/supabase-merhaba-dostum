import React from "react";
import { PressableZone } from "@/components/ui/pressable-zone";
import kazandinKarti from "@/assets/KazandinKarti.webp";
import kaybettinKarti from "@/assets/kaybettinKarti.webp";
import berabereKarti from "@/assets/berabereKarti.png";

type MatchResultKind = "win" | "lose" | "draw";

interface MatchResultCardProps {
  won: boolean;
  /** "draw" verilirse berabereKarti.png gösterilir. Verilmezse `won` kullanılır. */
  result?: MatchResultKind;
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
  /**
   * Rematch isteğinin durumu. "idle" -> animasyon gösterilmez.
   * "waiting" -> thinking/alert döngüsü, "accepted"/"declined" -> yes/no.
   */
  rematchStatus?: RematchStatus;
  /** yes/no animasyonu bitince çağrılır (örn. animasyonu kapatmak için) */
  onRematchAnimationFinished?: () => void;
}

/**
 * Kart görselleri piksel piksel ölçülerek çıkarılan alan koordinatları.
 * Yüzde bazlı olduğu için her ekran boyutunda doğru hizalanır.
 */
const LAYOUTS: Record<
  MatchResultKind,
  {
    scoreField: { left: string; width: string; height: string; playerTop: string; opponentTop: string };
    buttonsTop: string;
    buttonsHeight: string;
    buttons: Array<{ left: string; width: string }>;
  }
> = {
  win: {
    scoreField: { left: "9.9%", width: "80.2%", height: "4.7%", playerTop: "49%", opponentTop: "55.5%" },
    buttonsTop: "62.5%",
    buttonsHeight: "8.2%",
    buttons: [
      { left: "9.9%", width: "25.7%" },
      { left: "37.1%", width: "25.7%" },
      { left: "64.4%", width: "25.7%" },
    ],
  },
  lose: {
    scoreField: { left: "9.9%", width: "80.2%", height: "4.7%", playerTop: "49%", opponentTop: "55.5%" },
    buttonsTop: "62.5%",
    buttonsHeight: "8.2%",
    buttons: [
      { left: "9.9%", width: "25.7%" },
      { left: "37.1%", width: "25.7%" },
      { left: "64.4%", width: "25.7%" },
    ],
  },
  // berabereKarti.png (688x1519) ölçümleri
  draw: {
    scoreField: { left: "10.32%", width: "79.65%", height: "5.07%", playerTop: "49.9%", opponentTop: "56.55%" },
    buttonsTop: "63.9%",
    buttonsHeight: "9.1%",
    buttons: [
      { left: "9.45%", width: "25.5%" },
      { left: "37.21%", width: "25.5%" },
      { left: "64.97%", width: "25.5%" },
    ],
  },
};

const CARD_IMAGES: Record<MatchResultKind, string> = {
  win: kazandinKarti,
  lose: kaybettinKarti,
  draw: berabereKarti,
};

const CARD_ALTS: Record<MatchResultKind, string> = {
  win: "Kazandın",
  lose: "Kaybettin",
  draw: "Berabere",
};

/** PNG kart üzerine görünmez hit-zone butonlar giydirir. */
const MatchResultCard: React.FC<MatchResultCardProps> = ({
  won,
  result,
  playerScore,
  opponentScore,
  onWatchAd,
  adLoading,
  onPlayAgain,
  onHome,
  disabled,
  children,
  rematchStatus = "idle",
  onRematchAnimationFinished,
}) => {
  const kind: MatchResultKind = result ?? (won ? "win" : "lose");
  const layout = LAYOUTS[kind];

  const zone = (
    label: string,
    slot: number,
    handler?: () => void,
    isDisabled?: boolean,
    haptic: "light" | "medium" | "heavy" = "medium",
  ) => (
    <PressableZone
      label={label}
      onPress={handler}
      haptic={haptic}
      disabled={isDisabled || !handler}
      className="z-10 rounded-[2cqw] disabled:opacity-100"
      style={{
        left: layout.buttons[slot].left,
        width: layout.buttons[slot].width,
        top: layout.buttonsTop,
        height: layout.buttonsHeight,
      }}
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
    <div className="flex justify-center items-center w-full">
      <div
        className="relative w-full max-w-[400px] mx-auto animate-in fade-in zoom-in-95 duration-300"
        style={{ containerType: "inline-size" }}
      >
        <img
          src={CARD_IMAGES[kind]}
          alt={CARD_ALTS[kind]}
          className="w-full h-auto select-none pointer-events-none"
          draggable={false}
        />

        {/* Senin Puanın */}
        <div
          className="absolute flex items-center justify-end pointer-events-none"
          style={{
            left: layout.scoreField.left,
            width: layout.scoreField.width,
            top: layout.scoreField.playerTop,
            height: layout.scoreField.height,
            paddingRight: "4cqw",
          }}
        >
          <span className="font-extrabold text-[#1b3a5c]" style={{ fontSize: "6cqw" }}>
            {playerScore}
          </span>
        </div>

        {/* Rakip Puanı */}
        <div
          className="absolute flex items-center justify-end pointer-events-none"
          style={{
            left: layout.scoreField.left,
            width: layout.scoreField.width,
            top: layout.scoreField.opponentTop,
            height: layout.scoreField.height,
            paddingRight: "4cqw",
          }}
        >
          <span className="font-extrabold text-[#1b3a5c]" style={{ fontSize: "6cqw" }}>
            {opponentScore}
          </span>
        </div>

        {zone("Reklam İzle", 0, onWatchAd, disabled || adLoading)}
        {zone("Tekrar Oyna", 1, onPlayAgain, disabled)}
        {zone("Ana Menüye Dön", 2, onHome, disabled, "heavy")}


        {rematchStatus !== "idle" && (
          <div
            key={rematchStatus === "waiting" ? "waiting" : rematchStatus}
            className="absolute left-1/2 z-20 -translate-x-1/2 animate-rematch-slide-in pointer-events-none"
            style={{ top: "78%" }}
          >
            <RematchRoboAnimation
              status={rematchStatus}
              onResultFinished={onRematchAnimationFinished}
            />
          </div>
        )}

        {children}
      </div>

      <style>{`
        @keyframes rematch-slide-in {
          from {
            transform: translate(calc(-50% - 60vw), 0);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
        .animate-rematch-slide-in {
          animation: rematch-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default MatchResultCard;
