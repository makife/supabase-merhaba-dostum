import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, User } from "lucide-react";
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";

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

export const SlotMatchmaking = ({ onCancel, searchProgress }: SlotMatchmakingProps) => {
  const [slots, setSlots] = useState<Player[][]>(() =>
    Array(SLOT_COUNT)
      .fill(null)
      .map(() =>
        Array(30)
          .fill(null)
          .map(() => SAMPLE_PLAYERS[Math.floor(Math.random() * SAMPLE_PLAYERS.length)]),
      ),
  );
  const [positions, setPositions] = useState<number[]>(Array(SLOT_COUNT).fill(0));
  const [speeds, setSpeeds] = useState<number[]>(Array(SLOT_COUNT).fill(INITIAL_SPEED));
  const [stopped, setStopped] = useState<boolean[]>(Array(SLOT_COUNT).fill(false));
  const [isSpinning, setIsSpinning] = useState(true);
  const { restartSearch, currentGameType } = useMatchmaking();

  useEffect(() => {
    console.log("🎰 SlotMatchmaking mounted - fresh start");
    setPositions(Array(SLOT_COUNT).fill(0));
    setSpeeds(Array(SLOT_COUNT).fill(INITIAL_SPEED));
    setStopped(Array(SLOT_COUNT).fill(false));
    setIsSpinning(true);

    return () => {
      console.log("🎰 SlotMatchmaking unmounted - cleanup");
    };
  }, []);

  useEffect(() => {
    if (!isSpinning) return;

    const interval = setInterval(() => {
      setPositions((prev) =>
        prev.map((pos, i) => {
          if (stopped[i]) return pos;
          const speed = speeds[i];
          return (pos + speed) % (30 * SLOT_ITEM_HEIGHT);
        }),
      );

      setSpeeds((prev) =>
        prev.map((speed, i) => {
          if (stopped[i]) {
            return Math.max(0, speed - 2);
          }
          return speed;
        }),
      );
    }, 50);

    return () => clearInterval(interval);
  }, [isSpinning, stopped, speeds]);

  useEffect(() => {
    if (searchProgress > 50 && !stopped[0]) {
      setStopped((prev) => {
        const newStopped = [...prev];
        newStopped[0] = true;
        return newStopped;
      });
    }
    if (searchProgress > 90 && !stopped[1]) {
      setStopped((prev) => {
        const newStopped = [...prev];
        newStopped[1] = true;
        return newStopped;
      });
      setTimeout(() => setIsSpinning(false), 1500);
    }
  }, [searchProgress, stopped]);

  const handleCancel = () => {
    console.log("🛑 SlotMatchmaking iptal ediliyor");
    setIsSpinning(false);
    onCancel();
    console.log("✅ SlotMatchmaking iptal edildi");
  };

  const handleRetry = () => {
    console.log("🔄 Tekrar arama başlatılıyor");
    setPositions(Array(SLOT_COUNT).fill(0));
    setSpeeds(Array(SLOT_COUNT).fill(INITIAL_SPEED));
    setStopped(Array(SLOT_COUNT).fill(false));
    setIsSpinning(true);
    restartSearch(currentGameType);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg bg-black/40 backdrop-blur-xl border-2 border-yellow-500/50 shadow-2xl">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-yellow-400 mb-2 animate-pulse">Rakip Aranıyor</h2>
            <p className="text-white/70">Eşleşme bekleniyor...</p>
          </div>

          <div className="bg-gradient-to-b from-yellow-600 to-yellow-800 rounded-2xl p-6 mb-6 shadow-2xl border-4 border-yellow-500">
            <div className="flex justify-center gap-6">
              {slots.map((slotData, slotIndex) => (
                <div
                  key={slotIndex}
                  className="relative bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl overflow-hidden shadow-inner border-2 border-yellow-600/30"
                  style={{ width: "120px", height: "160px" }}
                >
                  <div className="absolute inset-0 overflow-hidden">
                    <div
                      className="flex flex-col"
                      style={{
                        transform: `translateY(-${positions[slotIndex]}px)`,
                        transition: stopped[slotIndex] ? "transform 1.2s cubic-bezier(0.22, 0.61, 0.36, 1)" : "none",
                      }}
                    >
                      {slotData.map((player, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center justify-center p-2"
                          style={{ height: `${SLOT_ITEM_HEIGHT}px` }}
                        >
                          <Avatar className="w-14 h-14 border-2 border-yellow-400/50 shadow-lg">
                            <AvatarImage src={player.avatar} alt={player.name} />
                            <AvatarFallback className="bg-purple-600">
                              <User className="w-7 h-7 text-white" />
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-gray-900 to-transparent pointer-events-none z-10" />
                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none z-10" />

                  <div className="absolute left-0 right-0 top-1/2 transform -translate-y-1/2 h-20 border-y-2 border-yellow-400/70 pointer-events-none z-20 bg-yellow-400/5" />
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm text-white/70 mb-2">
              <span>Arama İlerlemesi</span>
              <span>{Math.round(searchProgress)}%</span>
            </div>
            <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-300 rounded-full"
                style={{ width: `${searchProgress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6 text-white/90">
            {searchProgress < 100 && <Loader2 className="w-5 h-5 animate-spin" />}
            <span className="text-sm">
              {searchProgress >= 100
                ? "Uygun oyuncu bulunamadı"
                : searchProgress < 30
                  ? "Oyuncular taranıyor..."
                  : searchProgress < 60
                    ? "Uygun rakip aranıyor..."
                    : searchProgress < 90
                      ? "Eşleşme kontrol ediliyor..."
                      : "Neredeyse hazır..."}
            </span>
          </div>

          {searchProgress >= 100 && (
            <Button onClick={handleRetry} className="w-full mb-3">
              Tekrar Ara
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="w-full bg-red-600/20 border-red-500 hover:bg-red-600/40 text-white"
          >
            Aramayı İptal Et
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
