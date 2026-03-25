import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Smile } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playNativeSound } from "@/services/nativeAudioService";

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
  { id: "iyiolan", src: "/emojiler/iyiolanEmoji.png", label: "iyi olan kazansın" },
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
          className="h-12 w-full bg-blue-500/20 text-blue-300 border-blue-400/50 hover:bg-blue-500/30 hover:border-blue-400 hover:text-blue-200 transition-all"
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
