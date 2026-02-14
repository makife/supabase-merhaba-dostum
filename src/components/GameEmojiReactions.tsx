import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Smile } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const EMOJIS = [
  { id: "gulen", src: "/emojiler/gulenEmoji.png", label: "Gülen" },
  { id: "kahkaha", src: "/emojiler/kahkahaEmoji.png", label: "Kahkaha" },
  { id: "opucuk", src: "/emojiler/opucukEmoji.png", label: "Öpücük" },
  { id: "kizgin", src: "/emojiler/kizginEmoji.png", label: "Kızgın" },
  { id: "aglayan", src: "/emojiler/aglayanEmoji.png", label: "Ağlayan" },
  { id: "coksikici", src: "/emojiler/coksikiciEmoji.png", label: "Çok Sıkıcı" },
  { id: "uyuyan", src: "/emojiler/uyuyanEmoji.png", label: "Uyuyan" },
  { id: "fermuar", src: "/emojiler/fermuarEmoji.png", label: "Fermuar" },
  { id: "aklimagelmiyor", src: "/emojiler/aklimagelmiyorEmoji.png", label: "Aklıma Gelmiyor" },
  { id: "izgara", src: "/emojiler/izgaraEmoji.png", label: "Izgara" },
  { id: "konfeti", src: "/emojiler/konfetiEmoji.png", label: "Konfeti" },
  { id: "tekraroynayalim", src: "/emojiler/tekraroynayalimEmoji.png", label: "Tekrar Oynayalım" },
  { id: "sanirim", src: "/emojiler/sanirimEmoji.png", label: "Sanırım Kazanıyorum" },
  { id: "galiba", src: "/emojiler/galibaEmoji.png", label: "Galiba Kaybettim" },
];

// Preload all emoji images once at module level with retry
const preloadedImages = new Map<string, HTMLImageElement>();
const loadedStatus = new Map<string, boolean>();

function preloadEmoji(emoji: { id: string; src: string }, retries = 3) {
  const img = new Image();
  img.onload = () => {
    loadedStatus.set(emoji.id, true);
    preloadedImages.set(emoji.id, img);
  };
  img.onerror = () => {
    if (retries > 0) {
      setTimeout(() => preloadEmoji(emoji, retries - 1), 1000);
    }
  };
  img.src = emoji.src + "?v=" + Date.now(); // cache-bust on retry
  preloadedImages.set(emoji.id, img);
}

EMOJIS.forEach((emoji) => preloadEmoji(emoji));

interface GameEmojiReactionsProps {
  roomId: string;
  userId: string;
  gameStarted: boolean;
  gameEnded: boolean;
}

interface EmojiOverlay {
  userId: string;
  emojiSrc: string;
  timestamp: number;
}

export function GameEmojiReactions({ roomId, userId, gameStarted, gameEnded }: GameEmojiReactionsProps) {
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
          className="h-12 w-full text-amber-700 border-amber-300 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-800 transition-all"
          onClick={() => setShowPicker(!showPicker)}
          disabled={cooldown}
        >
          <Smile className="w-4 h-4 mr-2" />
          İfadeler
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
            className="absolute bottom-full left-0 mb-2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-amber-200 p-2 will-change-transform"
          >
            <div className="grid grid-cols-6 gap-1.5">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji.id}
                  onClick={() => sendEmoji(emoji.src)}
                  className="w-10 h-10 rounded-lg hover:bg-amber-100 transition-colors flex items-center justify-center active:scale-90"
                  title={emoji.label}
                >
                  <img
                    src={emoji.src}
                    alt={emoji.label}
                    className="w-8 h-8 object-contain"
                    loading="eager"
                    decoding="async"
                    onError={(e) => {
                      const target = e.currentTarget;
                      // Retry with cache-bust
                      setTimeout(() => {
                        target.src = emoji.src + "?retry=" + Date.now();
                      }, 500);
                    }}
                  />
                </button>
              ))}
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
            className="absolute inset-0 z-10 flex items-center justify-center bg-white rounded-lg"
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
            className="absolute inset-0 z-10 flex items-center justify-center bg-white rounded-lg"
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
