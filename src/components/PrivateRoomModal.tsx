import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Clock, Trophy, Play, LogIn, X, Hash, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGame } from "@/contexts/GameContext";
import { useSounds } from "@/hooks/useSounds";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { toast as sonnerToast } from "sonner";
import { useNavigate } from "react-router-dom";

interface PrivateRoomModalProps {
  onClose: () => void;
  onStartGame: (roomId: string, gameType: "timed" | "score") => void;
}

const PrivateRoomModal = ({ onClose, onStartGame }: PrivateRoomModalProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [gameType, setGameType] = useState<"timed" | "score">("timed");
  const [loading, setLoading] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const { currentRoom, participants, leaveRoom } = useGame();
  const { playSound } = useSounds();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, isPremium } = useUser();

  const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateRoom = async () => {
    if (!isPremium && (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0) {
      sonnerToast.error("Yetersiz oyun hakkı!", {
        description: "Özel oda oluşturmak için hak satın alın veya dolmasını bekleyin.",
        duration: 4000,
      });
      return;
    }

    setLoading(true);
    playSound("buttonClick");

    try {
      if (!user) return;

      const roomId = crypto.randomUUID();
      const shortCode = generateRoomCode();

      setRoomCode(shortCode);

      localStorage.setItem(`room_${shortCode}`, roomId);
      localStorage.setItem(`room_type_${shortCode}`, gameType);

      const generateGridFromSeed = (seed: string): string[] => {
        const seedNum = parseInt(seed.replace(/[^0-9]/g, "").slice(0, 10)) || Date.now();
        let currentSeed = seedNum;
        const seededRandom = () => {
          currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
          return currentSeed / 4294967296;
        };

        // ⚠️ DİKKAT: Buraya uzun harf havuzunu yapıştırmayı unutma!
        const letterPool = [
          "A",
          "A",
          "A",
          "A",
          "A",
          "A",
          "A",
          "A",
          "E",
          "E",
          "E",
          "E",
          "E",
          "E",
          "E",
          "İ",
          "İ",
          "İ",
          "İ",
          "İ",
          "İ",
          "I",
          "I",
          "I",
          "I",
          "I",
          "O",
          "O",
          "O",
          "O",
          "O",
          "U",
          "U",
          "U",
          "U",
          "Ü",
          "Ü",
          "Ü",
          "Ö",
          "Ö",
          "Ö",
          "L",
          "L",
          "L",
          "L",
          "L",
          "N",
          "N",
          "N",
          "N",
          "N",
          "R",
          "R",
          "R",
          "R",
          "R",
          "K",
          "K",
          "K",
          "K",
          "M",
          "M",
          "M",
          "M",
          "T",
          "T",
          "T",
          "T",
          "S",
          "S",
          "S",
          "S",
          "D",
          "D",
          "D",
          "Y",
          "Y",
          "Y",
          "B",
          "B",
          "B",
          "C",
          "C",
          "Ç",
          "Ç",
          "F",
          "F",
          "G",
          "G",
          "Ğ",
          "Ğ",
          "H",
          "H",
          "J",
          "P",
          "P",
          "Ş",
          "Ş",
          "V",
          "V",
          "Z",
        ];

        const grid: string[] = [];
        for (let i = 0; i < 16; i++) {
          const randomIndex = Math.floor(seededRandom() * letterPool.length);
          grid.push(letterPool[randomIndex]);
        }
        return grid;
      };

      const gridArray = generateGridFromSeed(roomId);

      const { error: roomError } = await supabase.from("game_rooms").insert({
        id: roomId,
        room_code: shortCode,
        host_id: user.id,
        game_mode: `private-room`,
        game_type_new: gameType,
        status: "waiting",
        max_players: 2,
        time_limit: gameType === "timed" ? 120 : 0,
        max_score: gameType === "score" ? 500 : 0,
        current_grid: gridArray,
      });

      if (roomError && !roomError.message?.includes("duplicate")) throw roomError;

      const { error: participantError } = await supabase.from("game_participants").insert({
        room_id: roomId,
        user_id: user.id,
      });

      if (participantError && !participantError.message?.includes("duplicate")) {
        console.error("Participant insert failed:", participantError);
      }

      navigate(`/private-room-waiting?code=${shortCode}&roomId=${roomId}&gameType=${gameType}`);
      onClose();
    } catch (error: any) {
      console.error("Error creating room:", error);
      toast({
        title: "Hata",
        description: error.message || "Oda oluşturulamadı",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      toast({ title: "Hata", description: "Oda kodu girin", variant: "destructive" });
      return;
    }

    if (!isPremium && (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0) {
      sonnerToast.error("Yetersiz oyun hakkı!", {
        description: "Odaya katılmak için hak satın alın veya dolmasını bekleyin.",
        duration: 4000,
      });
      return;
    }

    setLoading(true);
    playSound("buttonClick");

    try {
      if (!user) return;
      let actualRoomId = joinCode.trim();

      if (joinCode.length === 6) {
        const storedRoomId = localStorage.getItem(`room_${joinCode.toUpperCase()}`);
        if (storedRoomId) actualRoomId = storedRoomId;
      }

      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("room_code", joinCode.toUpperCase())
        .eq("status", "waiting")
        .maybeSingle();

      if (roomError || !room) throw new Error("Oda bulunamadı veya oda dolu");

      actualRoomId = room.id;

      const { error: participantError } = await supabase.from("game_participants").insert({
        room_id: actualRoomId,
        user_id: user.id,
      });

      if (participantError && participantError.code !== "23505") throw new Error("Odaya katılım başarısız");

      const savedGameType =
        (localStorage.getItem(`room_type_${joinCode.toUpperCase()}`) as "timed" | "score") ||
        room.game_type_new ||
        "timed";

      navigate(`/private-room-waiting?code=${joinCode.toUpperCase()}&roomId=${actualRoomId}&gameType=${savedGameType}`);
      onClose();
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Odaya katılamadı", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    playSound("buttonClick");
    if (currentRoom && participants.length > 1) {
      setShowExitDialog(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      <Dialog open={true} onOpenChange={() => handleClose()}>
        <DialogContent className="sm:max-w-lg w-full bg-zinc-950/90 backdrop-blur-xl border border-green-500/20 text-white shadow-[0_0_50px_rgba(16,185,129,0.2)] p-0 overflow-hidden gap-0 [&>button]:hidden">
          {/* Dekoratif Yeşil Işık */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-48 bg-gradient-to-b from-green-600 via-emerald-500 to-transparent opacity-20 blur-3xl pointer-events-none" />

          {/* --- HEADER --- */}
          <div className="relative pt-8 pb-4 px-6 text-center z-10">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 mb-4 border border-white/20">
              <Users className="w-10 h-10 text-white drop-shadow-md" />
            </div>

            <h2 className="text-2xl font-black uppercase tracking-wider text-white drop-shadow-lg">ÖZEL ODA</h2>
            <p className="text-white/60 text-sm font-medium mt-1">Arkadaşınla kozlarını paylaş</p>
          </div>

          {/* --- TABS --- */}
          <div className="px-6 pb-2 z-10">
            <div className="grid grid-cols-2 p-1 bg-black/40 rounded-xl border border-white/10">
              <button
                onClick={() => {
                  playSound("buttonClick");
                  setActiveTab("create");
                }}
                className={`py-2 text-sm font-bold rounded-lg transition-all duration-300 ${
                  activeTab === "create" ? "bg-green-600 text-white shadow-lg" : "text-zinc-500 hover:text-white"
                }`}
              >
                ODA KUR
              </button>
              <button
                onClick={() => {
                  playSound("buttonClick");
                  setActiveTab("join");
                }}
                className={`py-2 text-sm font-bold rounded-lg transition-all duration-300 ${
                  activeTab === "join" ? "bg-emerald-600 text-white shadow-lg" : "text-zinc-500 hover:text-white"
                }`}
              >
                ODAYA KATIL
              </button>
            </div>
          </div>

          {/* --- İÇERİK --- */}
          {/* Yükseklik ve padding ayarları diğer modalla eşitlendi */}
          <div className="p-6 space-y-4 z-10 min-h-[300px]">
            {/* ODA KURMA SEKMESİ */}
            {activeTab === "create" && (
              <div className="space-y-4 animate-in slide-in-from-left-8 fade-in duration-500">
                <p className="text-xs text-center text-zinc-400 font-medium uppercase tracking-widest">
                  Oyun Modunu Seç
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* ZAMANA KARŞI - YÜKSEKLİK h-44 OLARAK GÜNCELLENDİ */}
                  <button
                    onClick={() => {
                      playSound("buttonClick");
                      setGameType("timed");
                    }}
                    className={`relative group flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-300 h-44 justify-between
                            ${
                              gameType === "timed"
                                ? "border-green-500 bg-green-500/10 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-[1.02]"
                                : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20" // hover:border-white/20 eklendi
                            }
                        `}
                  >
                    <div
                      className={`p-3 rounded-full ${gameType === "timed" ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white" : "bg-zinc-800 text-zinc-500"}`}
                    >
                      <Clock className="w-6 h-6" />
                    </div>

                    <div className="text-center">
                      <span
                        className={`block font-bold text-lg ${gameType === "timed" ? "text-white" : "text-zinc-400"}`}
                      >
                        Zamana Karşı
                      </span>
                      {/* Metin güncellendi: GameModeSelector'daki stile daha yakın */}
                      <span className="text-xs text-zinc-500 mt-1 block px-2">2 dakika içinde maksimum kelime bul</span>
                    </div>

                    {/* Badge eklendi (isteğe bağlı ama GameModeSelector'da var) */}
                    <Badge variant="outline" className="border-white/10 text-zinc-400 text-[10px] bg-black/20">
                      ⚡ Standart
                    </Badge>

                    {/* Aktiflik işareti - GameModeSelector'a daha yakın bir stil korundu */}
                    {gameType === "timed" && (
                      <div className="absolute inset-0 border-2 border-green-500 rounded-xl blur-[2px] pointer-events-none" />
                    )}
                  </button>

                  {/* SKOR MODU - YÜKSEKLİK h-44 OLARAK GÜNCELLENDİ */}
                  <button
                    onClick={() => {
                      playSound("buttonClick");
                      setGameType("score");
                    }}
                    className={`relative group flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-300 h-44 justify-between
                            ${
                              gameType === "score"
                                ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-[1.02]"
                                : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20" // hover:border-white/20 eklendi
                            }
                        `}
                  >
                    <div
                      className={`p-3 rounded-full ${gameType === "score" ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white" : "bg-zinc-800 text-zinc-500"}`}
                    >
                      <Trophy className="w-6 h-6" />
                    </div>

                    <div className="text-center">
                      <span
                        className={`block font-bold text-lg ${gameType === "score" ? "text-white" : "text-zinc-400"}`}
                      >
                        Skor Modu
                      </span>
                      {/* Metin güncellendi: GameModeSelector'daki stile daha yakın */}
                      <span className="text-xs text-zinc-500 mt-1 block px-2">500 puana ulaşan ilk kişi kazanır</span>
                    </div>

                    {/* Badge eklendi (isteğe bağlı ama GameModeSelector'da var) */}
                    <Badge variant="outline" className="border-white/10 text-zinc-400 text-[10px] bg-black/20">
                      🎯 Stratejik
                    </Badge>

                    {/* Aktiflik işareti - GameModeSelector'a daha yakın bir stil korundu */}
                    {gameType === "score" && (
                      <div className="absolute inset-0 border-2 border-emerald-500 rounded-xl blur-[2px] pointer-events-none" />
                    )}
                  </button>
                </div>

                {/* Butonun stiline GameModeSelector'daki gibi hover efekti eklendi */}
                <Button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="w-full py-6 mt-2 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg border-0 transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                >
                  {loading ? (
                    <span className="animate-pulse">Oda Hazırlanıyor...</span>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2 fill-current" /> ODAYI OLUŞTUR
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* ODAYA KATILMA SEKMESİ */}
            {activeTab === "join" && (
              <div className="space-y-6 py-4 animate-in slide-in-from-right-8 fade-in duration-500">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 border border-white/10">
                    <Hash className="w-6 h-6 text-zinc-400" />
                  </div>
                  <h3 className="text-white font-bold">Davet Kodunu Gir</h3>
                  <p className="text-sm text-zinc-500 px-4">Arkadaşının sana gönderdiği 6 haneli kodu aşağıya yaz.</p>
                </div>

                <div className="relative group">
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Örn: A4K7B2"
                    maxLength={6}
                    className="bg-black/30 border-green-500/30 text-white text-center h-16 text-2xl font-mono tracking-[0.5em] focus-visible:ring-green-500 placeholder:text-zinc-700 placeholder:tracking-normal placeholder:text-sm uppercase transition-all focus:border-green-500 focus:bg-black/50"
                  />
                </div>

                <Button
                  onClick={handleJoinRoom}
                  disabled={loading || joinCode.length < 3}
                  className="w-full py-6 text-lg font-bold bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 transition-all hover:scale-[1.02]"
                >
                  {loading ? "Bağlanılıyor..." : "ODAYA GİRİŞ YAP"} <LogIn className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ÇIKIŞ UYARI MODALI */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent className="bg-zinc-950 border border-white/10 text-white">
          <AlertDialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <AlertDialogTitle className="text-lg font-semibold text-center text-white">
              Odadan Çıkmak İstiyorsun?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-zinc-400">
              Odadan çıkarsan işlem iptal edilecek.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-2">
            <AlertDialogCancel
              onClick={() => setShowExitDialog(false)}
              className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white"
            >
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                playSound("buttonClick");
                await leaveRoom();
                setShowExitDialog(false);
                onClose();
              }}
              className="bg-red-600 hover:bg-red-700 text-white border-0"
            >
              Evet, Çık
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PrivateRoomModal;
