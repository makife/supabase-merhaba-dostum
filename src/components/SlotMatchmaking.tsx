import { useEffect, useRef, useState } from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import modalBg from "@/assets/rakipAraniyorModal.png";
import rakipBulundu from "@/assets/rakipBulundu.png";
import dunyaHaritasiArama from "@/assets/dunyaHaritasiArama.json";
import { PressableZone } from "@/components/ui/pressable-zone";


interface SlotMatchmakingProps {
  onCancel: () => void;
  searchProgress: number;
}

interface Player {
  avatar: string;
  name: string;
}

const SAMPLE_PLAYERS: Player[] = [
  { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=1", name: "Oyuncu 1" },
  { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=2", name: "Oyuncu 2" },
  { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=3", name: "Oyuncu 3" },
  { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=4", name: "Oyuncu 4" },
  { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=5", name: "Oyuncu 5" },
  { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=6", name: "Oyuncu 6" },
  { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=7", name: "Oyuncu 7" },
  { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=8", name: "Oyuncu 8" },
];

const SLOT_COUNT = 2;
const INITIAL_SPEED = 30;
const SLOT_ITEM_HEIGHT = 80;
const REEL_LENGTH = 30;

// Normalized coordinates measured from rakipAraniyorModal.png (832 x 1248)
const BOXES = [
  { left: 15.4, top: 24.8, width: 32.7, height: 21.3 },
  { left: 52.3, top: 24.8, width: 32.7, height: 21.3 },
];
const CANCEL_ZONE = { left: 22.8, top: 82.5, width: 54.5, height: 7.2 };
const MAP_ZONE = { left: 12, top: 48, width: 76, height: 32 };

// Haritanın kara parçalarına denk gelen olası "rakip konumu" noktaları (% cinsinden, MAP_ZONE içinde)
const PIN_SPOTS = [
  { x: 22, y: 34 },
  { x: 31, y: 58 },
  { x: 46, y: 30 },
  { x: 52, y: 62 },
  { x: 58, y: 42 },
  { x: 68, y: 36 },
  { x: 74, y: 66 },
  { x: 84, y: 44 },
];

export const SlotMatchmaking = ({ onCancel, searchProgress }: SlotMatchmakingProps) => {
  const [slots] = useState<Player[][]>(() =>
    Array(SLOT_COUNT)
      .fill(null)
      .map(() =>
        Array(REEL_LENGTH)
          .fill(null)
          .map(() => SAMPLE_PLAYERS[Math.floor(Math.random() * SAMPLE_PLAYERS.length)]),
      ),
  );
  const [positions, setPositions] = useState<number[]>(Array(SLOT_COUNT).fill(0));
  const [stopped, setStopped] = useState<boolean[]>(Array(SLOT_COUNT).fill(false));
  const [isSpinning, setIsSpinning] = useState(true);
  const [pinnedSpot, setPinnedSpot] = useState<{ x: number; y: number } | null>(null);
  const [showFound, setShowFound] = useState(false);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);
  const { restartSearch, currentGameType, matchFound } = useMatchmaking();

  useEffect(() => {
    setPositions(Array(SLOT_COUNT).fill(0));
    setStopped(Array(SLOT_COUNT).fill(false));
    setIsSpinning(true);
    setPinnedSpot(null);
    setShowFound(false);
  }, []);

  useEffect(() => {
    if (!isSpinning) return;
    const interval = setInterval(() => {
      setPositions((prev) =>
        prev.map((pos, i) => (stopped[i] ? pos : (pos + INITIAL_SPEED) % (REEL_LENGTH * SLOT_ITEM_HEIGHT))),
      );
    }, 50);
    return () => clearInterval(interval);
  }, [isSpinning, stopped]);

  // Rakip bulunduğu an haritayı sabitle ve kartı gecikmesiz göster.
  useEffect(() => {
    if (!matchFound) return;

    setPinnedSpot((prev) => prev ?? PIN_SPOTS[Math.floor(Math.random() * PIN_SPOTS.length)]);
    lottieRef.current?.pause();
    setStopped([true, true]);
    setIsSpinning(false);
    setShowFound(true);
  }, [matchFound]);



  const handleCancel = () => {
    setIsSpinning(false);
    onCancel();
  };

  const handleRetry = () => {
    setPositions(Array(SLOT_COUNT).fill(0));
    setStopped(Array(SLOT_COUNT).fill(false));
    setIsSpinning(true);
    restartSearch(currentGameType);
  };

  return (
    <div className={cn("fixed inset-0 flex items-center justify-center p-4 z-[9999]", showFound ? "bg-transparent" : "bg-black/70 backdrop-blur-sm")}>
      <div
        className={cn(
          "relative w-full max-w-[380px] animate-in fade-in zoom-in-95 duration-300 transition-transform duration-300",
          showFound && "-translate-y-[12%]"
        )}
      >
        <img src={modalBg} alt="Rakip aranıyor" className="w-full h-auto select-none pointer-events-none" />

        {/* Slot reels inside the white boxes */}
        {BOXES.map((box, slotIndex) => (
          <div
            key={slotIndex}
            className="absolute overflow-hidden rounded-[14%]"
            style={{
              left: `${box.left}%`,
              top: `${box.top}%`,
              width: `${box.width}%`,
              height: `${box.height}%`,
            }}
          >
            <div
              className="flex flex-col items-center"
              style={{
                transform: `translateY(-${positions[slotIndex]}px)`,
                transition: stopped[slotIndex] ? "transform 1.2s cubic-bezier(0.22, 0.61, 0.36, 1)" : "none",
              }}
            >
              {slots[slotIndex].map((player, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-center w-full"
                  style={{ height: `${SLOT_ITEM_HEIGHT}px` }}
                >
                  <Avatar className="w-14 h-14 border-2 border-primary/30 shadow-md">
                    <AvatarImage src={player.avatar} alt={player.name} />
                    <AvatarFallback className="bg-primary/20">
                      <User className="w-7 h-7 text-foreground" />
                    </AvatarFallback>
                  </Avatar>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* World map searching animation */}
        <div
          className="absolute pointer-events-none flex items-center justify-center"
          style={{
            left: `${MAP_ZONE.left}%`,
            top: `${MAP_ZONE.top}%`,
            width: `${MAP_ZONE.width}%`,
            height: `${MAP_ZONE.height}%`,
          }}
        >
          <Lottie
            lottieRef={lottieRef}
            animationData={dunyaHaritasiArama}
            loop
            autoplay
            rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
            style={{ width: "100%", height: "100%", opacity: pinnedSpot ? 0.45 : 1 }}
          />

          {/* Sabitlenen rakip konumu - sarı yanıp sönen nokta */}
          {pinnedSpot && (
            <div
              className="absolute"
              style={{ left: `${pinnedSpot.x}%`, top: `${pinnedSpot.y}%`, transform: "translate3d(-50%,-50%,0)" }}
            >
              <span className="absolute inset-0 m-auto block w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/40 animate-ping" />
              <span className="relative block w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_12px_4px_rgba(250,204,21,0.8)] animate-pulse" />
            </div>
          )}
        </div>

        {/* Rakip bulundu görseli - arama kartının altında, arka plan kararmadan */}
        {showFound && (
          <img
            src={rakipBulundu}
            alt="Rakip bulundu"
            className="absolute top-[92%] left-0 w-full h-auto select-none pointer-events-none animate-in zoom-in-95 duration-200 drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
            draggable={false}
          />
        )}

        {/* Cancel / retry hot zone over the "Aramadan Vazgeç" button */}
        <PressableZone
          label={searchProgress >= 100 ? "Tekrar ara" : "Aramadan vazgeç"}
          onPress={searchProgress >= 100 ? handleRetry : handleCancel}
          className="z-10 rounded-2xl"
          style={{
            left: `${CANCEL_ZONE.left}%`,
            top: `${CANCEL_ZONE.top}%`,
            width: `${CANCEL_ZONE.width}%`,
            height: `${CANCEL_ZONE.height}%`,
          }}
        />
      </div>
    </div>
  );
};
