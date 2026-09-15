import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Smile } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playNativeSound } from "@/services/nativeAudioService";

const EMOJIS = [
  { id: "gulen", src: "/emojiler/gulenEmoji.webp", label: "Gülen" },
  { id: "kahkaha", src: "/emojiler/kahkahaEmoji.webp", label: "Kahkaha" },
  { id: "opucuk", src: "/emojiler/opucukEmoji.webp", label: "Öpücük" },
  { id: "kizgin", src: "/emojiler/kizginEmoji.webp", label: "Kızgın" },
  { id: "aglayan", src: "/emojiler/aglayanEmoji.webp", label: "Ağlayan" },
  { id: "coksikici", src: "/emojiler/coksikiciEmoji.webp", label: "Çok Sıkıcı" },
  { id: "uyuyan", src: "/emojiler/uyuyanEmoji.webp", label: "Uyuyan" },
  { id: "fermuar", src: "/emojiler/fermuarEmoji.webp", label: "Fermuar" },
  { id: "aklimagelmiyor", src: "/emojiler/aklimagelmiyorEmoji.webp", label: "Aklıma Gelmiyor" },
  { id: "izgara", src: "/emojiler/izgaraEmoji.webp", label: "Izgara" },
  { id: "konfeti", src: "/emojiler/konfetiEmoji.webp", label: "Konfeti" },
  { id: "tekraroynayalim", src: "/emojiler/tekraroynayalimEmoji.webp", label: "Tekrar Oynayalım" },
  { id: "sanirim", src: "/emojiler/sanirimEmoji.webp", label: "Sanırım Kazanıyorum" },
  { id: "galiba", src: "/emojiler/galibaEmoji.webp", label: "Galiba Kaybettim" },
  { id: "iyiolan", src: "/emojiler/iyiolanEmoji.webp", label: "iyi olan kazansın" },
];

// Görseller public/emojiler/ klasöründe, AAB'ye derleniyor - fetch gereksiz
// Tarayıcı/WebView cache'i ile doğrudan yüklenir
const preloadedImages = new Set<string>();

function preloadEmojiImages() {
  EMOJIS.forEach((emoji) => {
    if (preloadedImages.has(emoji.id)) return;
    const img = new Image();
    img.src = emoji.src;
    img.onload = () => preloadedImages.add(emoji.id);
  });
}

preloadEmojiImages();

interface GameEmojiReactionsProps {
  roomId: string;
  userId: string;
  gameStarted: boolean;
  gameEnded: boolean;
  /** Rakip bot ise rastgele aralıklarla otomatik emoji gösterir */
  simulateOpponentBot?: boolean;
  /** Bot davranışını bağlamsal hale getirmek için kullanılır */
  botContext?: {
    botScore?: number;
    playerScore?: number;
    timeLeftSec?: number;
    totalTimeSec?: number;
    gridLetters?: string[];
  };
}

interface EmojiOverlay {
  userId: string;
  emojiSrc: string;
  timestamp: number;
}

export function GameEmojiReactions({ roomId, userId, gameStarted, gameEnded, simulateOpponentBot = false, botContext }: GameEmojiReactionsProps) {


  const [showPicker, setShowPicker] = useState(false);
  const [playerEmoji, setPlayerEmoji] = useState<EmojiOverlay | null>(null);
  const [opponentEmoji, setOpponentEmoji] = useState<EmojiOverlay | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const channelRef = useRef<any>(null);
  const playerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const opponentTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to emoji broadcast channel
  useEffect(() => {
    if (!roomId || !userId) return;

    const channel = supabase
      .channel(`emoji-reactions-${roomId}`)
      .on("broadcast", { event: "emoji_reaction" }, (payload) => {
        const { senderId, emojiSrc } = payload.payload;
        const overlay = { userId: senderId, emojiSrc, timestamp: Date.now() };

        if (senderId === userId) {
          // Sender's emoji → show on player's own card
          setPlayerEmoji(overlay);
          if (playerTimerRef.current) clearTimeout(playerTimerRef.current);
          playerTimerRef.current = setTimeout(() => setPlayerEmoji(null), 3000);
        } else {
          // Opponent's emoji → show on opponent's card
          setOpponentEmoji(overlay);
          if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
          opponentTimerRef.current = setTimeout(() => setOpponentEmoji(null), 3000);
          // Rakipten emoji geldiğinde ses çal
          playNativeSound('beep', 0.5);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (playerTimerRef.current) clearTimeout(playerTimerRef.current);
      if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
    };
  }, [roomId, userId]);

  // Bot context'i ref'te tut, effect'i yeniden tetiklemeden güncel oku
  const botContextRef = useRef(botContext);
  useEffect(() => {
    botContextRef.current = botContext;
  }, [botContext]);

  // 🤖 Bot rakip bağlamsal emoji simülasyonu
  useEffect(() => {
    if (!simulateOpponentBot || !gameStarted || gameEnded) return;

    let cancelled = false;
    let timerId: NodeJS.Timeout | null = null;
    const sentOnce = new Set<string>(); // tek seferlik emojiler için
    let sentCount = 0;

    // Maç başında %10-60 arası rastgele olasılık belirle
    const willSendEmojis = Math.random() < (0.10 + Math.random() * 0.50);
    if (!willSendEmojis) {
      return; // Bu maçta hiç emoji gönderme
    }

    const pickContextualEmoji = (): { id: string; src: string } | null => {
      const ctx = botContextRef.current || {};
      const botScore = ctx.botScore ?? 0;
      const playerScore = ctx.playerScore ?? 0;
      const diff = botScore - playerScore;
      const timeLeft = ctx.timeLeftSec ?? 999;
      const totalTime = ctx.totalTimeSec ?? 120;
      const elapsed = totalTime - timeLeft;
      const grid = ctx.gridLetters || [];
      const hasAE = grid.some((l) => {
        const lower = (l || "").toLocaleLowerCase("tr-TR");
        return lower === "a" || lower === "e";
      });

      const candidates: Array<{ id: string; weight: number }> = [];

      // Bot öndeyse → "sanırım kazanıyorum"
      if (diff >= 25 && !sentOnce.has("sanirim")) {
        candidates.push({ id: "sanirim", weight: 4 });
      }
      // Bot geride ise → "galiba kaybediyorum"
      if (diff <= -25 && !sentOnce.has("galiba")) {
        candidates.push({ id: "galiba", weight: 4 });
      }
      // Maç sonuna doğru (son 30sn, ama bitmemiş) → "tekrar oynayalım"
      if (timeLeft > 5 && timeLeft <= 30 && !sentOnce.has("tekraroynayalim")) {
        candidates.push({ id: "tekraroynayalim", weight: 3 });
      }
      // Izgarada a ve e harfi yoksa (oyun başında) → "ızgara zormuş"
      if (grid.length > 0 && !hasAE && elapsed < 45 && !sentOnce.has("izgara")) {
        candidates.push({ id: "izgara", weight: 5 });
      }

      // Genel doğal hissiyat için arada hafif emojiler
      const fillerIds = ["gulen", "kahkaha", "iyiolan", "aklimagelmiyor"];
      fillerIds.forEach((id) => candidates.push({ id, weight: 1 }));

      if (candidates.length === 0) return null;
      const total = candidates.reduce((s, c) => s + c.weight, 0);
      let r = Math.random() * total;
      let chosenId = candidates[0].id;
      for (const c of candidates) {
        if ((r -= c.weight) <= 0) {
          chosenId = c.id;
          break;
        }
      }
      const found = EMOJIS.find((e) => e.id === chosenId);
      if (!found) return null;
      // Tek seferlik kategorideyse işaretle
      if (["sanirim", "galiba", "tekraroynayalim", "izgara"].includes(chosenId)) {
        sentOnce.add(chosenId);
      }
      return { id: found.id, src: found.src };
    };

    const showEmoji = () => {
      if (sentCount >= 2) return; // En fazla 2 emoji
      const picked = pickContextualEmoji();
      if (!picked) return;
      sentCount++;
      setOpponentEmoji({ userId: "bot", emojiSrc: picked.src, timestamp: Date.now() });
      if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = setTimeout(() => setOpponentEmoji(null), 3000);
      try { playNativeSound('beep', 0.5); } catch {}
    };

    const scheduleNext = () => {
      if (cancelled || sentCount >= 2) return;
      // 18-40s arasında rastgele aralık
      const delay = 18000 + Math.random() * 22000;
      timerId = setTimeout(() => {
        if (cancelled || sentCount >= 2) return;
        showEmoji();
        if (sentCount < 2) {
          scheduleNext();
        }
      }, delay);
    };

    // İlk emoji 12-30s sonra
    timerId = setTimeout(() => {
      if (cancelled) return;
      showEmoji();
      if (sentCount < 2) {
        scheduleNext();
      }
    }, 12000 + Math.random() * 18000);

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [simulateOpponentBot, gameStarted, gameEnded]);



  const sendEmoji = useCallback(
    (emojiSrc: string) => {
      if (!channelRef.current || cooldown || gameEnded) return;

      channelRef.current.send({
        type: "broadcast",
        event: "emoji_reaction",
        payload: { senderId: userId, emojiSrc },
      });

      // Broadcast doesn't echo back to sender, so show locally
      setPlayerEmoji({ userId, emojiSrc, timestamp: Date.now() });
      if (playerTimerRef.current) clearTimeout(playerTimerRef.current);
      playerTimerRef.current = setTimeout(() => setPlayerEmoji(null), 3000);

      // Emoji gönderildiğinde ses çal
      playNativeSound('beep', 0.5);

      setShowPicker(false);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 4000); // 4s cooldown
    },
    [userId, cooldown, gameEnded],
  );

  return {
    // Picker button (rendered externally)
    PickerButton:
      gameStarted && !gameEnded ? (
        <Button
          variant="outline"
          className="h-12 w-full bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 text-white border-blue-600 hover:from-blue-400 hover:via-cyan-400 hover:to-blue-500 transition-none"
          onClick={() => setShowPicker(!showPicker)}
          disabled={cooldown}
        >
          <img src="/icons/ifadeler-gorsel.svg" className="w-5 h-5" alt="" />
        </Button>
      ) : null,

    // Picker panel
    PickerPanel: (
      <AnimatePresence>
        {showPicker && gameStarted && !gameEnded && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col justify-end"
            onClick={() => setShowPicker(false)}
          >
            <div
              className="bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.15)] border-t border-amber-200 px-1 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 w-max px-1">
                  {EMOJIS.map((emoji, index) => (
                    <motion.button
                      key={emoji.id}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                        delay: index * 0.03,
                      }}
                      onClick={() => sendEmoji(emoji.src)}
                      className="w-24 h-24 flex-shrink-0 rounded-xl hover:bg-amber-100 transition-colors flex items-center justify-center active:scale-90"
                      title={emoji.label}
                    >
                      <img
                        src={emoji.src}
                        alt={emoji.label}
                        className="w-20 h-20 object-contain"
                        loading="eager"
                        decoding="async"
                      />
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ),

    // Emoji overlay for player card
    PlayerEmojiOverlay: (
      <AnimatePresence>
        {playerEmoji && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-white rounded-lg"
          >
            <img src={playerEmoji.emojiSrc} alt="emoji" className="w-40 h-40 object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    ),

    // Emoji overlay for opponent card
    OpponentEmojiOverlay: (
      <AnimatePresence>
        {opponentEmoji && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-white rounded-lg"
          >
            <img src={opponentEmoji.emojiSrc} alt="emoji" className="w-40 h-40 object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    ),

    showPicker,
    setShowPicker,
  };
}
