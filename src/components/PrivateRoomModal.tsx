import { useState, useEffect } from "react";
// Import listesine DialogDescription eklendi
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Play, LogIn, X, Hash, AlertTriangle } from "lucide-react";
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
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [existingRoom, setExistingRoom] = useState<{ room_code: string; id: string } | null>(null);
  const [showExistingRoomPrompt, setShowExistingRoomPrompt] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  const { currentRoom, participants, leaveRoom } = useGame();
  const { playSound } = useSounds();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, isPremium } = useUser();

  // Check for existing waiting room on mount
  useEffect(() => {
    const checkExistingRoom = async () => {
      if (!user) {
        setCheckingExisting(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("game_rooms")
          .select("id, room_code")
          .eq("host_id", user.id)
          .eq("status", "waiting")
          .eq("game_mode", "private-room")
          .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.room_code) {
          setExistingRoom({ room_code: data.room_code, id: data.id });
          setShowExistingRoomPrompt(true);
        }
      } catch (e) {
        // ignore
      } finally {
        setCheckingExisting(false);
      }
    };
    checkExistingRoom();
  }, [user]);

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
      sonnerToast.error("Oyun için sayfaların yetersiz!", {
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

      localStorage.setItem(`room_${shortCode}`, roomId);
      localStorage.setItem(`room_type_${shortCode}`, "timed");

      const letterPool = [
        "A",
        "A",
        "E",
        "E",
        "İ",
        "İ",
        "I",
        "O",
        "U",
        "L",
        "L",
        "N",
        "R",
        "K",
        "M",
        "T",
        "S",
        "D",
        "Y",
        "B",
        "C",
        "Ç",
        "F",
        "G",
        "Ğ",
        "H",
        "P",
        "Ş",
        "V",
        "Z",
      ];
      const grid: string[] = [];
      for (let i = 0; i < 16; i++) {
        grid.push(letterPool[Math.floor(Math.random() * letterPool.length)]);
      }

      const { error: roomError } = await supabase.from("game_rooms").insert({
        id: roomId,
        room_code: shortCode,
        host_id: user.id,
        game_mode: `private-room`,
        game_type_new: "timed",
        status: "waiting",
        max_players: 2,
        time_limit: 120,
        max_score: 0,
        current_grid: grid,
      });

      if (roomError) throw roomError;

      await supabase.from("game_participants").insert({
        room_id: roomId,
        user_id: user.id,
      });

      // DÜZELTME 1: onClose() kaldırıldı. Sayfa değiştiği için modal zaten kapanacak.
      navigate(`/private-room/waiting/${shortCode}`);
    } catch (error: any) {
      toast({ title: "❗", description: "Oda oluşturulamadı", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    playSound("buttonClick");

    try {
      if (!user) return;
      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("room_code", joinCode.toUpperCase())
        .eq("status", "waiting")
        .maybeSingle();

      if (roomError || !room) throw new Error("Oda bulunamadı veya dolu");

      await supabase.from("game_participants").insert({
        room_id: room.id,
        user_id: user.id,
      });

      // DÜZELTME 2: onClose() kaldırıldı.
      navigate(`/private-room/waiting/${joinCode.toUpperCase()}`);
    } catch (error: any) {
      toast({ title: "❗", description: error.message, variant: "destructive" });
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
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-sm w-full bg-zinc-950/90 backdrop-blur-xl border border-white/10 text-white shadow-2xl p-0 overflow-hidden gap-0 [&>button]:hidden rounded-3xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-green-600 to-transparent opacity-20 blur-3xl pointer-events-none" />

          {/* HEADER */}
          <div className="relative pt-10 pb-4 px-6 text-center z-10">
            <button
              onClick={() => {
                playSound("buttonClick");
                onClose();
              }}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <img src="/icons/ozeloda.svg" alt="" className="w-16 h-16 object-contain mx-auto mb-4 drop-shadow-lg" />

            <DialogTitle className="text-xl font-black uppercase tracking-tighter text-white">ÖZEL ODA</DialogTitle>

            {/* DÜZELTME 3: Erişim hatasını gidermek için Description eklendi */}
            <DialogDescription className="text-zinc-400 text-xs mt-1">
              Arkadaşlarınla oynamak için oda oluştur veya var olan bir odaya katıl.
            </DialogDescription>
          </div>

          {/* EXISTING ROOM PROMPT */}
          {showExistingRoomPrompt && existingRoom && (
            <div className="px-6 pb-4 z-10 animate-in fade-in duration-300">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-bold">Bekleyen odanız var!</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Yakın zamanda oluşturduğunuz <span className="font-bold text-white">{existingRoom.room_code}</span>{" "}
                  kodlu oda hâlâ aktif.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      playSound("buttonClick");
                      navigate(`/private-room/waiting/${existingRoom.room_code}`);
                    }}
                    className="py-2.5 text-[10px] font-black uppercase tracking-wider bg-green-600 hover:bg-green-500 text-white rounded-xl transition-colors"
                  >
                    ODAMA DÖN
                  </button>
                  <button
                    onClick={async () => {
                      playSound("buttonClick");
                      // Expire old room
                      await supabase
                        .from("game_rooms")
                        .update({ status: "expired", updated_at: new Date().toISOString() })
                        .eq("id", existingRoom.id);
                      setShowExistingRoomPrompt(false);
                      setExistingRoom(null);
                    }}
                    className="py-2.5 text-[10px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-zinc-400 rounded-xl transition-colors"
                  >
                    YENİ ODA
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TABS */}
          <div className="px-8 pb-4 z-10">
            <div className="grid grid-cols-2 p-1 bg-black/40 rounded-xl border border-white/5">
              <button
                onClick={() => {
                  playSound("buttonClick");
                  setActiveTab("create");
                }}
                className={`py-2 text-xs font-black rounded-lg transition-all ${activeTab === "create" ? "bg-green-600 text-white shadow-lg" : "text-zinc-500"}`}
              >
                ODA KUR
              </button>
              <button
                onClick={() => {
                  playSound("buttonClick");
                  setActiveTab("join");
                }}
                className={`py-2 text-xs font-black rounded-lg transition-all ${activeTab === "join" ? "bg-green-600 text-white shadow-lg" : "text-zinc-500"}`}
              >
                KATIL
              </button>
            </div>
          </div>

          {/* CONTENT */}
          <div className="px-8 pb-8 space-y-4 z-10 min-h-[300px]">
            {activeTab === "create" ? (
              <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-center">
                  <div className="w-full flex flex-col items-center p-6 rounded-2xl border-2 border-green-500/50 bg-green-500/10 scale-[1.02]">
                    <div className="p-3 rounded-xl mb-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <span className="block font-bold text-base text-white">Zamana Karşı</span>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        2 Dakika içinde maksimum
                        <br />
                        kelimeyi bul!
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="w-full py-7 text-base font-black uppercase tracking-widest bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl transition-all hover:scale-[1.02] shadow-lg shadow-green-900/20"
                >
                  {loading ? "HAZIRLANIYOR..." : "ODAYI OLUŞTUR"}
                </Button>
              </div>
            ) : (
              <div className="space-y-6 py-4 animate-in slide-in-from-bottom-4 duration-500">
                <div className="relative">
                  <div className="flex justify-center mb-4">
                    <Hash className="w-8 h-8 text-green-500 opacity-50" />
                  </div>
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ODA KODU"
                    maxLength={6}
                    className="bg-white/5 border-white/10 text-white text-center h-16 text-2xl font-black tracking-[0.3em] rounded-2xl focus-visible:ring-green-500"
                  />
                </div>
                <button
                  onClick={handleJoinRoom}
                  disabled={loading || joinCode.length < 3}
                  className="w-full py-4 text-base font-black uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white rounded-2xl transition-colors border-0 disabled:bg-zinc-800/50 disabled:text-zinc-500 disabled:pointer-events-none outline-none"
                >
                  {loading ? "BAĞLANILIYOR..." : "ODAYA GİRİŞ YAP"}
                </button>
              </div>
            )}

            <button
              onClick={() => {
                playSound("buttonClick");
                onClose();
              }}
              className="w-full mt-6 py-3 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors tracking-widest uppercase border border-red-500/50 rounded-xl bg-red-500/5 hover:bg-red-500/10"
            >
              İPTAL ET
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent className="bg-zinc-950 border border-white/10 text-white rounded-3xl max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">Odadan Çık?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-zinc-400 text-sm">
              İşlem iptal edilecek. Emin misin?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1 bg-white/5 border-0 rounded-xl m-0">HAYIR</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await leaveRoom();
                onClose();
              }}
              className="flex-1 bg-red-600 rounded-xl m-0"
            >
              EVET
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PrivateRoomModal;
