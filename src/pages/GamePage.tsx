import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useAppState } from "@/hooks/useAppState";
import { Button } from "@/components/ui/button";
import { useAdMob } from "@/hooks/useAdMob";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import ExitConfirmCardDialog from "@/components/ExitConfirmCardDialog";
import { homeBackPath } from "@/utils/challengeBackPath";
import { useNavigate, useSearchParams, useLocation, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useGame } from "@/contexts/GameContext";
import { useMusic } from "@/contexts/MusicContext";
import { useWordValidation } from "@/hooks/useWordValidation";
import { useSounds } from "@/hooks/useSounds";
import { useJokerInventory } from "@/hooks/useJokerInventory";
import { useUserPurchases } from "@/hooks/useUserPurchases";
import { useNativeGameplay } from "@/hooks/useNativeGameplay";
import { useRematchContext } from "@/contexts/RematchContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateServerOffset } from "@/utils/serverTimeSync";
import { useServerTimeContext, subscribeToOffsetChange } from "@/contexts/ServerTimeContext";
import GameCountdown, { ensureImagesLoaded } from "@/components/GameCountdown";
import FinalCountdown from "@/components/FinalCountdown";
import ComboBoost from "@/components/ComboBoost";
import NiceCatchText from "@/components/NiceCatchText";
import { playNativeSound } from "@/services/nativeAudioService";

import sureAzaliyorAnim from "@/assets/sureAzaliyor.json";
const MAC_ARKA_PLANLAR: string[] = [
  "/macArkaPlanlar/macArkaPlan1.jpg",
  "/macArkaPlanlar/macArkaPlan2.jpg",
  "/macArkaPlanlar/macArkaPlan3.jpg",
  "/macArkaPlanlar/macArkaPlan4.jpg",
  "/macArkaPlanlar/macArkaPlan5.jpg",
  "/macArkaPlanlar/macArkaPlan6.jpg",
  "/macArkaPlanlar/macArkaPlan7.jpg",
  "/macArkaPlanlar/macArkaPlan8.jpg",
  "/macArkaPlanlar/macArkaPlan9.jpg",
  "/macArkaPlanlar/macArkaPlan10.webp",
  "/macArkaPlanlar/macArkaPlan11.jpg",
  "/macArkaPlanlar/macArkaPlan12.webp",
  "/macArkaPlanlar/macArkaPlan13.jpg",
  "/macArkaPlanlar/macArkaPlan14.jpg",
  "/macArkaPlanlar/macArkaPlan15.jpg",
  "/macArkaPlanlar/macArkaPlan16.jpg",
  "/macArkaPlanlar/macArkaPlan17.jpg",
  "/macArkaPlanlar/macArkaPlan18.jpg",
  "/macArkaPlanlar/macArkaPlan19.webp",
  "/macArkaPlanlar/macArkaPlan20.jpg",
  "/macArkaPlanlar/macArkaPlan21.jpg",
  "/macArkaPlanlar/macArkaPlan22.jpg",
  "/macArkaPlanlar/macArkaPlan23.jpg",
  "/macArkaPlanlar/macArkaPlan24.jpg",
  "/macArkaPlanlar/macArkaPlan25.jpg",
  "/macArkaPlanlar/macArkaPlan26.jpg",
  "/macArkaPlanlar/macArkaPlan27.jpeg",
  "/macArkaPlanlar/macArkaPlan28.jpeg",
  "/macArkaPlanlar/macArkaPlan29.jpeg",
  "/macArkaPlanlar/macArkaPlan30.jpeg",
  "/macArkaPlanlar/macArkaPlan31.jpeg",
  "/macArkaPlanlar/macArkaPlan32.jpg",
  "/macArkaPlanlar/macArkaPlan33.webp",
  "/macArkaPlanlar/macArkaPlan34.jpg",
  "/macArkaPlanlar/macArkaPlan35.jpg",
  "/macArkaPlanlar/macArkaPlan36.jpg",
  "/macArkaPlanlar/macArkaPlan37.jpg",
  "/macArkaPlanlar/macArkaPlan38.jpg",
  "/macArkaPlanlar/macArkaPlan39.jpeg",
];
import {
  ArrowLeft,
  Clock,
  Target,
  Trash2,
  Send,
  Trophy,
  User,
  Bot,
  Shuffle,
  Lightbulb,
  PenTool,
  Loader2,
  Crown,
} from "lucide-react";
import { generateBotName, generateBotAvatar } from "@/utils/tournamentHelpers";
import { matchBanlist } from "@/utils/matchBanlist";
import { GameEmojiReactions } from "@/components/GameEmojiReactions";
import { LevelUpDialog } from "@/components/LevelUpDialog";
import MatchResultCard from "@/components/MatchResultCard";

// RankUpDialog kaldırıldı: seviye/rank yükselişinde sadece LevelUpDialog animasyonu gösteriliyor
import { getRankTier, RankTier } from "@/utils/rankSystem";
import robotAvatar from "@/assets/robot-avatar.webp";
import yariFinaldesinGorsel from "@/assets/yariFinaldesinGorsel.webp";
import finaldesinGorsel from "@/assets/finaldesinGorsel.webp";
import sampiyonsunGorsel from "@/assets/sampiyonsunGorsel.webp";
import { VipBadge } from "@/components/VipBadge";
import { useQueryClient } from "@tanstack/react-query";
import { useGlobalResync } from "@/hooks/useGlobalResync";
import nativeStorage, { STORAGE_KEYS } from "@/utils/nativeStorage";
import { useAppReviewPrompt } from "@/hooks/useAppReviewPrompt";
import SoundEffectsToggle from "@/components/SoundEffectsToggle";

// Level calculation helper (same formula as LevelProgress)
function calcLevelFromScore(totalScore: number): number {
  let level = 1;
  let totalExpNeeded = 0;
  let currentLevelExp = 1000;
  while (totalScore >= totalExpNeeded + currentLevelExp) {
    totalExpNeeded += currentLevelExp;
    level++;
    currentLevelExp = level * 1000;
  }
  return level;
}

// Safe helpers
const shortId = (v?: string | null) => (v ? String(v).slice(-8) : "NULL");
const isUuid = (v?: string | null) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const BOT_REMATCH_META_PREFIX = "botRematchMeta:";
type BotIdentity = { seed: number; name: string; avatar: string };
const seedFromText = (text: string) => Array.from(text).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) || 7;
let inGamePresenceSession = 0;

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score?: number;
  player2_score?: number;
  winner_id: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  room_id?: string;
  countdown_started_at?: string;
  ends_at?: string | null;
}

interface GamePageProps {
  gameMode: "vs-computer" | "private-room" | "random-match" | "tournament";
  onGameComplete?: (winnerId: string, player1Score: number, player2Score: number) => void;
  tournamentMatch?: TournamentMatch;
  gameType?: "timed" | "score";
  participants?: any[];
}

// Joker türleri
interface JokerState {
  degistir: number; // Kalan kullanım sayısı
  fisilida: number;
  senYaz: number;
}

const GamePage = ({
  gameMode = "vs-computer",
  onGameComplete,
  tournamentMatch: propTournamentMatch,
  gameType: propGameType,
  participants: propsParticipants = [],
}: GamePageProps) => {
  const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const { user } = useAuth();
  const { consumeCredit, isPremium, addBonusCredits, forceRefreshProfile, profile } = useUser();
  const { hasPurchased, settings } = useUserPurchases();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 🚀 Liderlik birinciliği boost'u: maç sonu puanlarına +1 katsayı (premium ile toplanır)
  const hasScoreBoost = (() => {
    const until = (profile as any)?.score_boost_until;
    if (!until) return false;
    return new Date(until) > new Date();
  })();

  // Lottie animation data for game end
  const [winAnim, setWinAnim] = useState<any>(null);
  const [loseAnim, setLoseAnim] = useState<any>(null);
  const [tieAnim, setTieAnim] = useState<any>(null);
  const [confettiAnim, setConfettiAnim] = useState<any>(null);
  const [showKelimeleAnim, setShowKelimeleAnim] = useState(false);
  const [altiHarfAnim, setAltiHarfAnim] = useState<any>(null);
  const [showAltiHarfAnim, setShowAltiHarfAnim] = useState(false);
  const [gunlukKonfetiAnim, setGunlukKonfetiAnim] = useState<any>(null);
  const [showGunlukKonfetiAnim, setShowGunlukKonfetiAnim] = useState(false);
  const [kelimeGondermedinAnim, setKelimeGondermedinAnim] = useState<any>(null);
  const [showKelimeGondermedinAnim, setShowKelimeGondermedinAnim] = useState(false);
  const [matchBgAnim, setMatchBgAnim] = useState<string>(
    () => MAC_ARKA_PLANLAR[Math.floor(Math.random() * MAC_ARKA_PLANLAR.length)],
  );
  const matchBgLottieRef = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/oyunkazanmajson.json").then((r) => r.json()),
      fetch("/oyunkatbetmejson.json").then((r) => r.json()),
      fetch("/beraberlikjson.json").then((r) => r.json()),
      fetch("/kazanmajson.json").then((r) => r.json()),
      fetch("/altiharf.json").then((r) => r.json()),
      fetch("/gunlukKonfeti.json").then((r) => r.json()),
      fetch("/kelimeGondermedinGoz.json").then((r) => r.json()),
    ])
      .then(([win, lose, tie, confetti, altiHarf, gunlukKonfeti, kelimeGondermedin]) => {
        setWinAnim(win);
        setLoseAnim(lose);
        setTieAnim(tie);
        setConfettiAnim(confetti);
        setAltiHarfAnim(altiHarf);
        setGunlukKonfetiAnim(gunlukKonfeti);
        setKelimeGondermedinAnim(kelimeGondermedin);
      })
      .catch(console.error);
  }, []);
  const {
    currentRoom,
    updateScore,
    participants: gameParticipants,
    endGame,
    leaveRoom,
    joinRoom,
    createRoom,
    addAIOpponent,
  } = useGame();
  const { triggerHapticFeedback, optimizeTouchEvent, isNative } = useNativeGameplay();

  // Tournament match bilgisini URL'den al
  const [tournamentMatch, setTournamentMatch] = useState(propTournamentMatch || null);

  // Tournament participant state
  const [tournamentParticipants, setTournamentParticipants] = useState<any[]>([]);

  // ⚠️ KRİTİK: Optimistic update flag - maç bitişinde race condition'ı önle
  const [isMatchFinishing, setIsMatchFinishing] = useState(false);

  const participants = useMemo(() => {
    if (gameMode === "tournament") {
      const tournamentParts = propsParticipants?.length > 0 ? propsParticipants : tournamentParticipants;
      return tournamentParts || [];
    }

    return gameParticipants || [];
  }, [gameMode, propsParticipants, gameParticipants, tournamentParticipants]);

  const hasRandomMatchBotOpponent = useMemo(
    () => gameMode === "random-match" && participants.some((p) => p.is_bot === true),
    [gameMode, participants],
  );
  const hasMultiplayerBotOpponent = useMemo(
    () => (gameMode === "random-match" || gameMode === "private-room") && participants.some((p) => p.is_bot === true),
    [gameMode, participants],
  );

  const { validateWord, isValidating } = useWordValidation();
  const {
    playSound,
    playTimeWarningSequence,
    playCelebrationSound,
    playGameLoseSound,
    playTieSound,
    playSpecialSound,
  } = useSounds();
  const { jokers: jokerInventory, useJoker, loadJokers } = useJokerInventory();
  const { fadeOutBackgroundMusic, fadeInBackgroundMusic } = useMusic();
  const [searchParams] = useSearchParams();
  const { matchId: urlMatchId } = useParams<{ matchId?: string }>();
  const [urlGameType] = useState<"timed" | "score">(() => {
    const type = searchParams.get("type") as "timed" | "score";
    return type || "timed";
  });

  const { loadRewardedAd, showRewardedAd, isAdLoading, initializeAdMob } = useAdMob();
  const [adWatched, setAdWatched] = useState(false);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const cleanupRef = useRef<(() => void)[]>([]);
  const syncingRef = useRef(false);
  const submissionLockRef = useRef(false);
  const timerStartedRef = useRef(false);
  const recentSubmissionsRef = useRef<Set<string>>(new Set());
  const randomMatchInitRef = useRef(false);
  const privateRoomInitRef = useRef(false);
  const lastInitializedRoomRef = useRef<string | null>(null);
  const serverMatchStartRef = useRef<number | null>(null);
  const syncSuppressUntilRef = useRef<number>(0);
  const countdownCompletedAtRef = useRef<number | null>(null);
  const processedCountdownRef = useRef<string | null>(null); // 🔒 İşlenmiş countdown timestamp'ini sakla - çift tetiklemeyi önler
  const roomVersionRef = useRef<number | null>(null); // 🔢 game_rooms.version takibi - realtime paket kaybını yakalar
  // Touch/click double-fire koruması: Gönder butonu için son touch zaman damgası
  const submitTouchTsRef = useRef(0);

  // 🔒 REMATCH FIX: Closure sorunu çözümü - güncel değerleri ref'lerde sakla
  const participantsRef = useRef(participants);
  const currentRoomIdRef = useRef<string | null>(currentRoom?.id || null);
  const roomSessionRef = useRef(0);
  const pendingEndGameTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameEndFinalizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [comboResetId, setComboResetId] = useState(0);

  const [globalUsedWords, setGlobalUsedWords] = useState<Set<string>>(new Set());
  const globalUsedWordsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    globalUsedWordsRef.current = globalUsedWords;
  }, [globalUsedWords]);

  // 🔄 Server Time Context - Tüm uygulama genelinde senkronize offset
  const { offset: contextOffset, serverNow, isReady: contextServerTimeReady, triggerResync } = useServerTimeContext();
  // Geriye uyumluluk için local state'i context'ten al
  const serverTimeOffset = contextOffset;

  const addCleanup = useCallback((cleanupFn: () => void) => {
    cleanupRef.current.push(cleanupFn);
  }, []);

  // Joker state'leri artık envanter hook'undan geliyor
  const jokers = jokerInventory;
  const [selectedJoker, setSelectedJoker] = useState<string | null>(null);
  const [highlightedLetters, setHighlightedLetters] = useState<{ row: number; col: number }[]>([]);
  const [isJokerActive, setIsJokerActive] = useState(false);
  const [isFisildaAnimating, setIsFisildaAnimating] = useState(false);

  // Wordlist for local validation
  const [wordlist, setWordlist] = useState<Set<string>>(new Set());
  const [wordlistLoaded, setWordlistLoaded] = useState(false);

  // Get game type from room or URL params - DÜZELTME
  const getGameType = useCallback((): "timed" | "score" => {
    // TURNUVA MODU HER ZAMAN SÜRELİ!
    if (gameMode === "tournament") {
      return "timed";
    }

    if (gameMode === "vs-computer") {
      return urlGameType;
    }

    // RANDOM MATCH için öncelikle URL type'ı kullan
    if (gameMode === "random-match") {
      return urlGameType;
    }

    // Diğer modlar için mevcut mantık
    if (currentRoom?.game_mode) {
      if (currentRoom.game_mode.includes("score")) return "score";
      else return "timed";
    }

    return urlGameType;
  }, [gameMode, currentRoom?.game_mode, urlGameType]);

  const gameType = getGameType();
  const getCurrentBotIdentity = useCallback((): BotIdentity | null => {
    const seedParam = Number(searchParams.get("botSeed"));
    const nameParam = searchParams.get("botName");
    const avatarParam = searchParams.get("botAvatar");
    if (Number.isFinite(seedParam) && nameParam) {
      return { seed: seedParam, name: nameParam, avatar: avatarParam || generateBotAvatar(seedParam, nameParam) };
    }

    const storedMeta = currentRoom?.id ? sessionStorage.getItem(`${BOT_REMATCH_META_PREFIX}${currentRoom.id}`) : null;
    if (storedMeta) {
      try {
        const parsed = JSON.parse(storedMeta) as BotIdentity;
        if (typeof parsed?.seed === "number" && parsed.name) {
          return {
            seed: parsed.seed,
            name: parsed.name,
            avatar: parsed.avatar || generateBotAvatar(parsed.seed, parsed.name),
          };
        }
      } catch {
        sessionStorage.removeItem(`${BOT_REMATCH_META_PREFIX}${currentRoom?.id}`);
      }
    }

    const botParticipant = participants.find((p) => p.is_bot === true);
    if (!botParticipant) return null;
    const seedSrc = `${currentRoom?.id || ""}${botParticipant.id || ""}`;
    const seed = seedFromText(seedSrc);
    const name = generateBotName(seed);
    return { seed, name, avatar: generateBotAvatar(seed, name) };
  }, [currentRoom?.id, participants, searchParams]);

  const currentBotIdentity = useMemo(() => getCurrentBotIdentity(), [getCurrentBotIdentity]);
  const [timeWarningPlayed, setTimeWarningPlayed] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showTournamentExitDialog, setShowTournamentExitDialog] = useState(false);
  const [isInBackground, setIsInBackground] = useState(false);

  // Ref'ler - arka plan disconnect için güncel değerleri tut
  const gameStartedRef = useRef(false);
  const currentRoomRef = useRef(currentRoom);

  // Ref'leri güncel tut
  useEffect(() => {
    currentRoomRef.current = currentRoom;
    // 🆕 Room ID'yi de kalıcı ref'e kaydet (disconnect handler için)
    if (currentRoom?.id) {
      savedRoomIdRef.current = currentRoom.id;
    }
  }, [currentRoom]);

  // 💓 HEARTBEAT (NABIZ) KONTROLÜ
  const lastOpponentHeartbeat = useRef<number>(Date.now());
  const presenceChannelRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkOpponentAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isChannelSubscribedRef = useRef(false);
  const lastSeenDataRef = useRef<string>(""); // Rakibin son sinyal verisini tutar

  // Arka plan yönetimi - oyun sırasında disconnect mantığı (10 saniye)
  const handleBackgroundDisconnect = useCallback(async () => {
    console.log("⚠️ 10 saniye arka planda kaldı - oyuncu disconnect ediliyor");

    // Sadece multiplayer oyunlarda ve oyun başladıysa çalış
    if (!gameStartedRef.current) {
      console.log("⏭️ Oyun başlamadı, arka plan disconnect atlanıyor");
      return;
    }
    if (gameMode !== "random-match" && gameMode !== "private-room" && gameMode !== "tournament") {
      console.log("⏭️ Multiplayer mod değil, arka plan disconnect atlanıyor");
      return;
    }

    // TURNUVA MODU için ayrı işlem
    if (gameMode === "tournament" && tournamentMatch) {
      console.log("🏆 Turnuva modu - arka plan disconnect işleniyor");

      const isPlayer1 = String(tournamentMatch.player1_id) === String(user?.id);
      const opponentUserId = isPlayer1 ? tournamentMatch.player2_id : tournamentMatch.player1_id;

      // Oyuncuya disconnect cezası uygula
      try {
        await supabase.rpc("apply_disconnect_penalty", {
          p_offender_id: user?.id,
          p_room_id: tournamentMatch.id,
        });
        console.log("✅ Turnuva disconnect penalty uygulandı");
      } catch (err) {
        console.error("❌ Turnuva disconnect penalty hatası:", err);
      }

      // Rakibe 200 exp/puan bonus ver (TÜM TABLOLARA ATOMIK OLARAK)
      if (opponentUserId && !opponentUserId.startsWith("bot_")) {
        try {
          await supabase.rpc("award_disconnect_bonus", {
            p_user_id: opponentUserId,
            p_bonus_points: 200,
          });
          console.log("🏆 Turnuva rakibine 200 disconnect bonus verildi (tüm tablolar):", opponentUserId?.slice(-8));
        } catch (err) {
          console.error("❌ Turnuva rakibe bonus verme hatası:", err);
        }
      }

      // Turnuva maçını rakibin kazandığı şekilde tamamla
      try {
        const player1Score = isPlayer1 ? 0 : 100;
        const player2Score = isPlayer1 ? 100 : 0;

        await supabase
          .from("tournament_matches")
          .update({
            status: "completed",
            player1_score: player1Score,
            player2_score: player2Score,
            winner_id: opponentUserId,
          })
          .eq("id", tournamentMatch.id);
        console.log("✅ Turnuva maçı rakip kazandı olarak güncellendi:", opponentUserId?.slice(-8));

        // 🔒 Bu maçı tamamlanmış olarak işaretle - tekrar oyun sayfası açılmasını önle
        const completedMatchKey = `${STORAGE_KEYS.TOURNAMENT_MATCH_COMPLETED_PREFIX}${tournamentMatch.id}`;
        await nativeStorage.setItem(completedMatchKey, "true");
        console.log("✅ Turnuva maçı local olarak tamamlandı işaretlendi:", tournamentMatch.id.slice(-8));
      } catch (err) {
        console.error("❌ Turnuva maç güncelleme hatası:", err);
      }

      toast({
        title: "Bağlantı Kesildi",
        description: "Uygulama 10 saniyeden fazla arka planda kaldı",
        variant: "destructive",
      });

      // 🔒 isMatchFinishing flag'ini set et - tekrar render'ı önle
      setIsMatchFinishing(true);
      setWinner("opponent");
      setGameEnded(true);
      setShowResults(true);
      setButtonsEnabled(true);
      return;
    }

    // NORMAL MODLAR (random-match, private-room) için
    const room = currentRoomRef.current;
    if (!user?.id || !room?.id) {
      console.log("⏭️ Room veya user yok, arka plan disconnect atlanıyor");
      return;
    }

    // Oyuncuya disconnect cezası uygula
    try {
      const { data: penaltyResult, error: penaltyError } = await supabase.rpc("apply_disconnect_penalty", {
        p_offender_id: user.id,
        p_room_id: room.id,
      });

      if (penaltyError) {
        console.error("❌ Background disconnect penalty hatası:", penaltyError);
      } else if (penaltyResult && penaltyResult.length > 0) {
        console.log("✅ Background disconnect penalty uygulandı:", penaltyResult[0]);
      }
    } catch (err) {
      console.error("❌ Background disconnect penalty exception:", err);
    }

    // Rakibi kazanan olarak işaretle
    const opponentUserId = room.player1_id === user.id ? room.player2_id : room.player1_id;

    // Rakibe 200 exp/puan bonus ver (TÜM TABLOLARA ATOMIK OLARAK)
    if (opponentUserId) {
      try {
        await supabase.rpc("award_disconnect_bonus", {
          p_user_id: opponentUserId,
          p_bonus_points: 200,
        });
        console.log("🏆 Rakibe 200 disconnect bonus verildi (tüm tablolar):", opponentUserId?.slice(-8));
      } catch (err) {
        console.error("❌ Rakibe bonus verme hatası:", err);
      }
    }

    try {
      await supabase
        .from("game_rooms")
        .update({
          status: "finished",
          winner_id: opponentUserId,
          finished_at: new Date().toISOString(),
        })
        .eq("id", room.id);
      console.log("✅ Arka plan disconnect - oda finished olarak güncellendi, kazanan:", opponentUserId?.slice(-8));
    } catch (err) {
      console.error("❌ Oda güncelleme hatası:", err);
    }

    // Participant kaydını sil (rakibe disconnect eventi tetikler)
    try {
      await supabase.from("game_participants").delete().eq("room_id", room.id).eq("user_id", user.id);
      console.log("✅ Participant kaydı silindi - rakibe bildirim gönderildi");
    } catch (err) {
      console.error("❌ Participant silme hatası:", err);
    }

    toast({
      title: "Bağlantı Kesildi",
      description: "Uygulama 10 saniyeden fazla arka planda kaldı",
      variant: "destructive",
    });

    // Oyunu bitir ve kaybeden kartı göster - Ana Menü butonu hemen aktif olsun
    setWinner("opponent");
    setGameEnded(true);
    setShowResults(true);
    setButtonsEnabled(true); // ✅ Butonları hemen aktif et

    // Room temizle
    leaveRoom();
  }, [gameMode, user?.id, toast, leaveRoom, tournamentMatch]);

  // Arka plan disconnect sonrası winner state'ini koru
  const backgroundDisconnectedRef = useRef(false);
  const [backgroundDisconnected, setBackgroundDisconnected] = useState(false);

  const wrappedHandleBackgroundDisconnect = useCallback(() => {
    backgroundDisconnectedRef.current = true;
    setBackgroundDisconnected(true);
    handleBackgroundDisconnect();
  }, [handleBackgroundDisconnect]);

  useAppState({
    onBackground: () => {
      console.log("🎮 Oyun arka plana gitti");
      setIsInBackground(true);
    },
    onForeground: () => {
      console.log("🎮 Oyun ön plana geldi, backgroundDisconnected:", backgroundDisconnectedRef.current);
      setIsInBackground(false);

      // Eğer arka plan disconnect olduysa, winner state'ini "opponent" olarak zorla
      // Çünkü realtime event'ler yanlış winner set etmiş olabilir
      if (backgroundDisconnectedRef.current) {
        console.log("🎮 Arka plan disconnect sonrası - winner 'opponent' olarak korunuyor");
        setTimeout(() => {
          setWinner("opponent");
          setGameEnded(true);
          setShowResults(true);
          setButtonsEnabled(true);
        }, 100);
        return;
      }

      // Native'de arka plandayken setTimeout çalışmaz
      // Oyun bitmişse ve butonlar hala deaktifse, aktif et
      setTimeout(() => {
        setButtonsEnabled((prev) => {
          console.log("🎮 Ön plan buton kontrolü - mevcut değer:", prev);
          return true;
        });
      }, 100);
    },
    backgroundDelay: 10000, // 10 saniye
    onBackgroundTimeout: wrappedHandleBackgroundDisconnect,
  });

  // Game state - Generate random letters each time
  const generateRandomGrid = useCallback((): string[][] => {
    const letterPool = [
      "A",
      "A",
      "A",
      "A",
      "A",
      "A",
      "A",
      "A", // A - very common
      "E",
      "E",
      "E",
      "E",
      "E",
      "E",
      "E", // E - very common
      "İ",
      "İ",
      "İ",
      "İ",
      "İ",
      "İ", // İ - common
      "I",
      "I",
      "I",
      "I",
      "I", // I - common
      "O",
      "O",
      "O",
      "O",
      "O", // O - common
      "U",
      "U",
      "U",
      "U", // U - common
      "Ü",
      "Ü",
      "Ü", // Ü - common
      "Ö",
      "Ö",
      "Ö", // Ö - common
      "L",
      "L",
      "L",
      "L",
      "L", // L - common
      "N",
      "N",
      "N",
      "N",
      "N", // N - common
      "R",
      "R",
      "R",
      "R",
      "R", // R - common
      "K",
      "K",
      "K",
      "K", // K - common
      "M",
      "M",
      "M",
      "M", // M - common
      "T",
      "T",
      "T",
      "T", // T - common
      "S",
      "S",
      "S",
      "S", // S - common
      "D",
      "D",
      "D", // D - common
      "Y",
      "Y",
      "Y", // Y - common
      "B",
      "B",
      "B", // B - medium
      "C",
      "C", // C - medium
      "Ç",
      "Ç", // Ç - medium
      "F",
      "F", // F - medium
      "G",
      "G", // G - medium
      "Ğ",
      "Ğ", // Ğ - medium
      "H",
      "H", // H - medium
      "J", // J - rare
      "P",
      "P", // P - medium
      "Ş",
      "Ş", // Ş - medium
      "V",
      "V", // V - medium
      "Z", // Z - rare
    ];

    const grid: string[][] = [];
    for (let i = 0; i < 4; i++) {
      const row: string[] = [];
      for (let j = 0; j < 4; j++) {
        const randomIndex = Math.floor(Math.random() * letterPool.length);
        row.push(letterPool[randomIndex]);
      }
      grid.push(row);
    }
    return grid;
  }, []);

  const generateTournamentGrid = useCallback((seed: string): string[][] => {
    // Basit LCG (Linear Congruential Generator) ile seed-based random
    const seedNum = parseInt(seed.slice(-8), 16) || Date.now();
    let currentSeed = seedNum;

    const seededRandom = () => {
      currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
      return currentSeed / 4294967296;
    };

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

    const grid: string[][] = [];
    for (let i = 0; i < 4; i++) {
      const row: string[] = [];
      for (let j = 0; j < 4; j++) {
        const randomIndex = Math.floor(seededRandom() * letterPool.length);
        row.push(letterPool[randomIndex]);
      }
      grid.push(row);
    }

    console.log("🎯 Tournament grid generated with seed:", seed, "Grid preview:", grid[0]);
    return grid;
  }, []);

  const [gameGrid, setGameGrid] = useState<string[][]>(() => {
    // Turnuva modunda grid sadece ortak seed ile oluşturulur
    if (gameMode === "tournament") {
      if (tournamentMatch?.id) {
        console.log("🎯 Turnuva grid - match ID seed kullanılıyor:", tournamentMatch.id);
        return generateTournamentGrid(tournamentMatch.id);
      }
      // Match bilgisi gelene kadar placeholder grid (farklı grid oluşmasını engeller)
      return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ""));
    }

    // ÖZEL ODA VE RANDOM MATCH: HEMEN PLACEHOLDER GRID KULLAN
    // Supabase'den senkronize edilecek
    if (gameMode === "random-match" || gameMode === "private-room") {
      console.log("🎲 Private/Random room: Waiting for server grid...");
      return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ""));
    }

    // Sadece vs-computer modunda random grid
    console.log("🤖 vs-computer: Generating random grid");
    return generateRandomGrid();
  });

  // Turnuva maçı yüklendiğinde grid'i senkronize et
  useEffect(() => {
    if (gameMode === "tournament" && tournamentMatch?.id) {
      const grid = generateTournamentGrid(tournamentMatch.id);
      console.log("🎯 Tournament grid set from match ID:", tournamentMatch.id, "Preview:", grid[0]);
      setGameGrid(grid);
    }
  }, [gameMode, tournamentMatch?.id, generateTournamentGrid]);

  // Random/private odalarda sunucu grid'ini senkronize et (ZORUNLU)
  // ⚠️ DEĞİŞTİR JOKER KORUMASI: Joker kullanımından sonra kısa süre sync'i devre dışı bırak
  const [gridSyncPaused, setGridSyncPaused] = useState(false);

  useEffect(() => {
    if (gameMode === "tournament") return;
    if (gameMode !== "random-match" && gameMode !== "private-room") return;
    if (!currentRoom?.current_grid) {
      console.log("⏳ Waiting for room grid data...");
      return;
    }

    // Joker kullanımından sonra grid sync'i duraklat
    if (gridSyncPaused) {
      console.log("⏸️ Grid sync paused (joker protection)");
      return;
    }

    const flat = currentRoom.current_grid as string[];
    const grid: string[][] = [];
    for (let i = 0; i < 4; i++) {
      grid.push(flat.slice(i * 4, (i + 1) * 4));
    }

    console.log("✅ Grid SYNC - Both players see same grid:", {
      mode: gameMode,
      roomId: shortId(currentRoom?.id),
      gridPreview: grid[0],
    });

    setGameGrid(grid);
  }, [gameMode, currentRoom?.current_grid, currentRoom?.id, gridSyncPaused]);

  // Cleanup on unmount - oda ID'sini banla ve matchmaking'i temizle
  useEffect(() => {
    return () => {
      console.log("🧹 GamePage unmount - cleanup başlatılıyor");
      if (currentRoom?.id) {
        matchBanlist.add(currentRoom.id);
        console.log("🚫 Unmount: Oda banlist'e eklendi:", shortId(currentRoom?.id));
      }
      window.dispatchEvent(new CustomEvent("cleanupMatchmaking"));
    };
  }, [currentRoom?.id]);

  const [selectedLetters, setSelectedLetters] = useState<{ letter: string; row: number; col: number }[]>([]);
  // currentWord artık derived value - selectedLetters'dan otomatik hesaplanır
  const currentWord = useMemo(() => selectedLetters.map((s) => s.letter).join(""), [selectedLetters]);
  const [inputFlash, setInputFlash] = useState<"success" | "success-long" | "success-xlong" | "error" | null>(null);
  const [inputFeedback, setInputFeedback] = useState<{
    text: string;
    type: "success" | "success-long" | "success-xlong" | "error" | "bonus";
  } | null>(null);
  const inputFeedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [playerWords, setPlayerWords] = useState<string[]>([]);
  const [opponentWords, setOpponentWords] = useState<string[]>([]);
  const [playerWordsWithScores, setPlayerWordsWithScores] = useState<
    Array<{ word: string; score: number; timestamp?: number }>
  >([]);
  const [opponentWordsWithScores, setOpponentWordsWithScores] = useState<
    Array<{ word: string; score: number; timestamp?: number }>
  >([]);
  const [firstWordTime, setFirstWordTime] = useState<number | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const playerScoreRef = useRef(0);
  const opponentScoreRef = useRef(0);
  useEffect(() => {
    playerScoreRef.current = playerScore;
  }, [playerScore]);
  useEffect(() => {
    opponentScoreRef.current = opponentScore;
  }, [opponentScore]);

  // 🔥 COMBO BOOST SYSTEM
  const comboCountRef = useRef<number>(0);
  const comboBreakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [comboEvent, setComboEvent] = useState<{ id: number; count: number }>({ id: 0, count: 0 });
  const [niceCatchEvent, setNiceCatchEvent] = useState<{ id: number; length: number }>({ id: 0, length: 0 });
  const [hintEvent, setHintEvent] = useState<{ id: number; text: string }>({ id: 0, text: "" });
  const jokerUsedInMatchRef = useRef<boolean>(false);
  const [bonusEvent, setBonusEvent] = useState<{ id: number; amount: 0 | 10 | 20 | 30 | 50 | 100 }>({
    id: 0,
    amount: 0,
  });

  const breakCombo = useCallback(() => {
    if (comboBreakTimerRef.current) {
      clearTimeout(comboBreakTimerRef.current);
      comboBreakTimerRef.current = null;
    }
    const reached = comboCountRef.current;
    comboCountRef.current = 0;
    const bonusMap: Record<number, 10 | 20 | 30 | 50 | 100> = {
      5: 10,
      6: 20,
      7: 30,
      8: 50,
      9: 100,
    };
    const bonus = bonusMap[Math.min(9, reached)];
    if (reached >= 5 && bonus) {
      setPlayerScore((s) => s + bonus);
      setBonusEvent((prev) => ({ id: prev.id + 1, amount: bonus }));
    }
  }, []);

  const tickCombo = useCallback(() => {
    comboCountRef.current = Math.min(9, comboCountRef.current + 1);
    if (comboCountRef.current >= 2) {
      setComboEvent((prev) => ({ id: prev.id + 1, count: comboCountRef.current }));
    }

    // 9x'e ulaşınca animasyon bitince sıfırla
    if (comboCountRef.current === 9) {
      if (comboBreakTimerRef.current) clearTimeout(comboBreakTimerRef.current);
      comboBreakTimerRef.current = null;
      setTimeout(() => breakCombo(), 1200);
      return;
    }

    // 3sn timer reset
    if (comboBreakTimerRef.current) clearTimeout(comboBreakTimerRef.current);
    comboBreakTimerRef.current = setTimeout(() => {
      breakCombo();
    }, 2000);
  }, [breakCombo]);

  useEffect(() => {
    return () => {
      if (comboBreakTimerRef.current) clearTimeout(comboBreakTimerRef.current);
    };
  }, []);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeLeftRef = useRef<number>(gameType === "timed" ? 120 : 0);
  const [displayTime, setDisplayTime] = useState<number>(timeLeftRef.current);
  const isMountedRef = useRef<boolean>(true); // ⚠️ Track if component is mounted
  const endsAtTimestampRef = useRef<number | null>(null); // 🔒 REMATCH FIX: Timestamp ref for timer
  const [timerWatchdogTick, setTimerWatchdogTick] = useState(0); // 🩺 WATCHDOG: Donmuş timer'ı yeniden tetikler
  const watchdogRecoveringRef = useRef(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownServerTime, setCountdownServerTime] = useState<string | null>(null);
  const [preparingOpponent, setPreparingOpponent] = useState<"preparing" | "ready" | null>(null);

  // 🔒 CRITICAL: Countdown tek seferlik başlatma guard'ı
  // Bu ref true olduktan sonra countdown ASLA yeniden başlatılamaz
  // Production oyunlardaki gibi: sunucu zamanı bir kez belirlenir, client sadece hesaplar
  const countdownInitiatedRef = useRef(false);

  // ⚠️ CRITICAL: Track component mount status to prevent ghost timer updates
  useEffect(() => {
    isMountedRef.current = true;
    console.log("✅ GamePage mounted - isMounted = true");
    return () => {
      isMountedRef.current = false;
      console.log("❌ GamePage unmounting - isMounted = false");
    };
  }, []);

  // 🔵 in_game flag: sadece GERÇEK bir maç varken heartbeat at (mavi nokta = maçta)
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    const activityMatchId = currentRoom?.id || tournamentMatch?.id;
    // Gerçek match yoksa heartbeat atma - aksi halde oyuncu maçta olmadan mavi nokta görünür
    if (!activityMatchId) return;
    const sessionId = ++inGamePresenceSession;

    const markInGame = async () => {
      const now = new Date().toISOString();
      const [{ error }, { error: activityError }] = await Promise.all([
        supabase.from("profiles").update({ in_game: true, last_seen: now }).eq("id", uid),
        supabase.from("player_activities").upsert(
          {
            player_id: uid,
            match_id: activityMatchId,
            last_action_time: now,
            updated_at: now,
          },
          { onConflict: "match_id,player_id" },
        ),
      ]);
      if (error) console.error("🔵 in_game true error:", error);
      if (activityError) console.error("🔵 player activity error:", activityError);
      else if (inGamePresenceSession === sessionId) console.log("🔵 in_game heartbeat = true");
    };

    markInGame();
    const heartbeat = window.setInterval(markInGame, 10_000);

    const clear = () => {
      supabase
        .from("profiles")
        .update({ in_game: false })
        .eq("id", uid)
        .then(() => {
          console.log("⚪ in_game = false");
        });
    };
    window.addEventListener("beforeunload", clear);
    return () => {
      window.removeEventListener("beforeunload", clear);
      window.clearInterval(heartbeat);
      window.setTimeout(() => {
        if (inGamePresenceSession === sessionId) clear();
      }, 1500);
    };
  }, [user?.id, currentRoom?.id, tournamentMatch?.id]);

  const [gameStarted, setGameStarted] = useState(false);
  const countdownCheckDoneRef = useRef(false);
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const gameEndedRef = useRef(false); // 🔒 Ref for synchronous guard in timer
  const statsUpdatedRef = useRef(false);
  const attemptedAutoCompleteRef = useRef(false);
  const reviewPromptedRef = useRef(false);
  const { maybeRequestReview, incrementMatchCount } = useAppReviewPrompt();

  // Arka plan artık statik görsel; Lottie efekti kaldırıldı.

  // 🎨 Arka plan mount'ta seçilir ve maç boyunca sabit kalır (geri sayımda değişmez)

  // 🌟 Maç bitiminde native review dialog tetikle (cooldown + min match guard'lı)
  useEffect(() => {
    if (!gameEnded || reviewPromptedRef.current) return;
    reviewPromptedRef.current = true;
    // Maç bitiş animasyonları + diğer dialog'ların oturması için kısa gecikme
    const t = setTimeout(async () => {
      try {
        await incrementMatchCount();
        await maybeRequestReview("match_end", {
          accountCreatedAt: (profile as any)?.created_at ?? null,
        });
      } catch {
        /* noop */
      }
    }, 4500);
    return () => clearTimeout(t);
  }, [gameEnded, maybeRequestReview, incrementMatchCount, profile]);

  useEffect(() => {
    if (gameEnded && user?.id) {
      // Kredi iadesinin DB'ye yazılması için kısa gecikme (disconnect refund race condition fix)
      const timer = setTimeout(() => {
        supabase
          .from("profiles")
          .select("game_credits, bonus_credits")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            const total = (data?.game_credits ?? 0) + (data?.bonus_credits ?? 0);
            console.log("💰 Toplam kredi:", total, "game:", data?.game_credits, "bonus:", data?.bonus_credits);
            setUserCredits(total);
          });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameEnded, user?.id]);

  const handleWatchAd = async () => {
    if (!user?.id) return;

    // Reklam izlemeye başlayınca opt-out yap: karşı taraf rematch isteği gönderemesin
    await supabase.from("rematch_opt_outs").upsert({
      user_id: user.id,
      opt_out_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Reklam sürecinde rematch kabul butonunu kilitle
    window.dispatchEvent(new CustomEvent("adBusyChange", { detail: { busy: true } }));

    // Güncel kredi sayısını kontrol et
    const { data: profileData } = await supabase
      .from("profiles")
      .select("game_credits, bonus_credits")
      .eq("id", user.id)
      .single();

    const currentCredits = (profileData?.game_credits ?? 0) + (profileData?.bonus_credits ?? 0);
    setUserCredits(currentCredits);

    // Kredi kısıtlaması yok - her zaman reklam izlenebilir

    await initializeAdMob();

    let loaded: any = await loadRewardedAd();
    if (!loaded || (typeof loaded === "object" && loaded !== null && !loaded.success)) {
      console.log("[GamePage] ⚠️ İlk reklam yükleme başarısız, retry...");
      await new Promise((r) => setTimeout(r, 2000));
      loaded = await loadRewardedAd();
    }
    if (!loaded || (typeof loaded === "object" && loaded !== null && !loaded.success)) {
      const errorDetail =
        typeof loaded === "object" && loaded !== null && loaded.error
          ? String(loaded.error)
          : "Reklam sunucusuna ulaşılamadı";
      toast({
        title: "Reklam Yüklenemedi",
        description: `Hata: ${errorDetail}`,
        variant: "destructive",
      });
      window.dispatchEvent(new CustomEvent("adBusyChange", { detail: { busy: false } }));
      return;
    }

    // Custom reward: +1 game_credits
    const customReward = async () => {
      const { data: freshProfile } = await supabase.from("profiles").select("game_credits").eq("id", user.id).single();
      const currentGameCredits = freshProfile?.game_credits ?? 0;
      const newGameCredits = currentGameCredits + 1;

      const { error } = await supabase
        .from("profiles")
        .update({ game_credits: newGameCredits, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) {
        console.error("[Ad Reward] Kredi verme hatası:", error);
      } else {
        console.log("[Ad Reward] ✅ +1 kredi verildi, yeni:", newGameCredits);
        toast({ title: "Tebrikler! 🎉", description: "+1 Oyun Sayfası Kazandınız!" });
        window.dispatchEvent(new CustomEvent("refreshProfile"));
      }
    };

    const success = await showRewardedAd(customReward);
    if (success) {
      setAdWatched(true);
      setUserCredits((prev) => prev + 1);
    }
    // Reklam süreci bitti, rematch kilidini aç
    window.dispatchEvent(new CustomEvent("adBusyChange", { detail: { busy: false } }));
  };

  // 🎵 Oyun bitince müziği geri başlat
  useEffect(() => {
    if (gameEnded) {
      console.log("🎵 [GamePage] Oyun bitti, müzik fade in başlıyor...");
      // 1 saniye bekle sonra müziği yavaşça başlat
      const timer = setTimeout(() => {
        fadeInBackgroundMusic(2000); // 2 saniyede fade in
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [gameEnded, fadeInBackgroundMusic]);

  // 💓 HEARTBEAT SİSTEMİ: Database-based + Server Time (Kill/Arka plan korumalı)
  // Supabase Presence yerine player_activities tablosunu kullanır
  // Server time kullanarak saat farkı sorunlarını önler
  // TURNUVA MODU DAHİL!
  // ⚡ Page Visibility API ile ön plana gelince hemen kontrol!
  useEffect(() => {
    // 1. GÜVENLİK KONTROLLERİ - TURNUVA MODU EKLENDİ
    const isTournamentMode = gameMode === "tournament" && tournamentMatch;
    const isMultiplayerMode = gameMode === "private-room" || gameMode === "random-match";

    if (!(isTournamentMode || isMultiplayerMode)) {
      return;
    }

    if (!gameStarted || gameEnded || !user?.id) {
      return;
    }

    // Turnuva veya normal mod için room/match ID belirle
    let matchId: string;
    let myUserId: string;
    let opponentId: string | null;

    if (isTournamentMode && tournamentMatch) {
      matchId = tournamentMatch.id;
      myUserId = user.id;
      const isPlayer1 = String(tournamentMatch.player1_id) === String(user.id);
      opponentId = isPlayer1 ? tournamentMatch.player2_id : tournamentMatch.player1_id;

      // Bot rakip ise heartbeat gerekli değil
      if (opponentId && String(opponentId).startsWith("bot_")) {
        console.log("💓 Turnuva bot rakip, heartbeat atlanıyor");
        return;
      }
    } else if (currentRoom?.id) {
      matchId = currentRoom.id;
      myUserId = user.id;
      if (hasMultiplayerBotOpponent) {
        console.log("💓 Multiplayer bot rakip, heartbeat atlanıyor");
        return;
      }
      opponentId = currentRoom.player1_id === myUserId ? currentRoom.player2_id : currentRoom.player1_id;
    } else {
      return;
    }

    if (!opponentId) {
      console.log("💓 Rakip ID bulunamadı, heartbeat başlatılmıyor");
      return;
    }

    console.log("💓 Database Heartbeat sistemi başlatılıyor (Server Time + Visibility API)...");
    console.log("   Ben:", myUserId.slice(-8), "Rakip:", opponentId.slice(-8));

    let isCleanedUp = false;
    let consecutiveTimeouts = 0; // Üst üste timeout sayacı

    // Server time al (Supabase RPC)
    const getServerTime = async (): Promise<Date | null> => {
      try {
        const { data, error } = await supabase.rpc("get_server_time");
        if (error || !data) return null;
        return new Date(data);
      } catch {
        return null;
      }
    };

    // 2. KENDİ HEARTBEAT'İMİ DATABASE'E YAZ (Her 2 saniyede)
    const writeMyHeartbeat = async () => {
      if (isCleanedUp || gameEndedRef.current) return;

      try {
        // Server time kullan - daha güvenilir
        const serverTime = await getServerTime();
        const now = serverTime ? serverTime.toISOString() : new Date().toISOString();

        const { error } = await supabase.from("player_activities").upsert(
          {
            player_id: myUserId,
            match_id: matchId,
            last_action_time: now,
            updated_at: now,
          },
          {
            onConflict: "match_id,player_id",
          },
        );

        if (error) {
          console.warn("💓 Heartbeat yazma hatası:", error.message);
        }
      } catch (err) {
        console.warn("💓 Heartbeat yazma exception:", err);
      }
    };

    // İlk heartbeat'i hemen yaz
    writeMyHeartbeat();

    // Sonra her 2 saniyede bir
    heartbeatIntervalRef.current = setInterval(writeMyHeartbeat, 2000);

    // 3. RAKİBİN HEARTBEAT'İNİ KONTROL ET (Her 2 saniye - server time ile)
    const TIMEOUT_SECONDS = 10; // 10 saniye timeout
    const REQUIRED_CONSECUTIVE_TIMEOUTS = 2; // 2 kez üst üste timeout olmalı

    const checkOpponentHeartbeat = async (isVisibilityTrigger = false) => {
      if (isCleanedUp || gameEndedRef.current) return;

      try {
        // Server time al
        const serverTime = await getServerTime();
        if (!serverTime) {
          console.warn("💓 Server time alınamadı, kontrol atlanıyor");
          return;
        }

        // Rakibin son heartbeat'ini oku
        const { data: opponentActivity, error } = await supabase
          .from("player_activities")
          .select("last_action_time")
          .eq("player_id", opponentId)
          .eq("match_id", matchId)
          .maybeSingle();

        if (error) {
          console.warn("💓 Rakip heartbeat okuma hatası:", error.message);
          return;
        }

        // Rakip hiç heartbeat yazmamışsa, henüz bağlanmamış olabilir - bekle
        if (!opponentActivity?.last_action_time) {
          console.log("💓 Rakip henüz heartbeat yazmamış, bekleniyor...");
          consecutiveTimeouts = 0;
          return;
        }

        const lastHeartbeatTime = new Date(opponentActivity.last_action_time).getTime();
        const serverNow = serverTime.getTime();
        const timeSinceLastHeartbeat = serverNow - lastHeartbeatTime;
        const secondsSinceLastHeartbeat = Math.round(timeSinceLastHeartbeat / 1000);

        console.log(
          `💓 Rakip son heartbeat: ${secondsSinceLastHeartbeat} sn önce${isVisibilityTrigger ? " (visibility trigger)" : ""}`,
        );

        // Timeout kontrolü
        if (timeSinceLastHeartbeat > TIMEOUT_SECONDS * 1000) {
          consecutiveTimeouts++;
          console.log(`⚠️ Timeout tespit! (${consecutiveTimeouts}/${REQUIRED_CONSECUTIVE_TIMEOUTS})`);

          // Visibility trigger'da daha agresif ol (1 kez yeter) çünkü uzun süre arka plandaydı
          const requiredTimeouts = isVisibilityTrigger ? 1 : REQUIRED_CONSECUTIVE_TIMEOUTS;

          // Üst üste belirli sayıda timeout olmalı (false positive önleme)
          if (consecutiveTimeouts >= requiredTimeouts) {
            console.log("💀 RAKİP ÖLDÜ! (Kill/Disconnect tespit edildi)");

            // Temizlik
            isCleanedUp = true;
            if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
            if (checkOpponentAliveIntervalRef.current) clearInterval(checkOpponentAliveIntervalRef.current);

            // Oyunu bitir
            window.dispatchEvent(
              new CustomEvent("playerDisconnected", {
                detail: {
                  winner: "player",
                  reason: "opponent_killed",
                  roomId: matchId,
                  isTournament: isTournamentMode,
                },
              }),
            );

            toast({
              title: "Rakip Bağlantısı Koptu",
              description: "Rakip oyundan düştü. Kazandınız!",
              variant: "default",
            });
          }
        } else {
          // Heartbeat geldi, sayaç sıfırla
          consecutiveTimeouts = 0;
        }
      } catch (err) {
        console.warn("💓 Heartbeat kontrol hatası:", err);
      }
    };

    // Normal interval kontrolü
    checkOpponentAliveIntervalRef.current = setInterval(() => checkOpponentHeartbeat(false), 2000);

    // ⚡ PAGE VISIBILITY API: Ön plana gelince HEMEN kontrol et
    // Mobil cihazlarda uygulama arka plana alındığında interval'ler durur
    // Bu sayede ön plana gelince rakibin düşüp düşmediğini hemen anlarız
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("👁️ Sayfa ön plana geldi, heartbeat kontrolü yapılıyor...");

        // Önce kendi heartbeat'imizi yaz (arka planda durmamış olabilir)
        writeMyHeartbeat();

        // Sonra rakibin heartbeat'ini kontrol et (visibility trigger = true)
        setTimeout(() => checkOpponentHeartbeat(true), 500);
      } else {
        console.log("👁️ Sayfa arka plana alındı");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. TEMİZLİK
    return () => {
      console.log("💓 Database Heartbeat temizleniyor");
      isCleanedUp = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (checkOpponentAliveIntervalRef.current) clearInterval(checkOpponentAliveIntervalRef.current);

      // Kendi activity kaydımı sil (best effort - uygulama kill edilirse çalışmaz)
      supabase
        .from("player_activities")
        .delete()
        .eq("player_id", myUserId)
        .eq("match_id", matchId)
        .then(() => {});
    };
  }, [
    gameMode,
    gameStarted,
    gameEnded,
    currentRoom?.id,
    currentRoom?.player1_id,
    currentRoom?.player2_id,
    hasMultiplayerBotOpponent,
    user?.id,
    tournamentMatch?.id,
    tournamentMatch?.player1_id,
    tournamentMatch?.player2_id,
  ]);

  // Reset duplicate stats guard when game resets
  useEffect(() => {
    if (!gameEnded) {
      statsUpdatedRef.current = false;
      gameEndedRef.current = false; // 🔒 Reset ref too
    } else {
      gameEndedRef.current = true; // 🔒 Sync ref with state
    }
  }, [gameEnded]);

  // 🏆 Level-up detection: save level when game starts
  const levelUpCheckedRef = useRef(false);
  const preScoreRef = useRef<number | null>(null);

  // Capture score snapshot when game starts OR before game starts (whichever comes first)
  useEffect(() => {
    if (gameEnded) return; // Don't recapture after game ends
    if (profile?.total_score != null) {
      if (preScoreRef.current === null) {
        preScoreRef.current = profile.total_score;
        preLevelRef.current = calcLevelFromScore(profile.total_score || 0);
        console.log(
          "🏆 Pre-level captured:",
          preLevelRef.current,
          "score:",
          profile.total_score,
          "gameStarted:",
          gameStarted,
        );
      }
    }
  }, [profile?.total_score, gameStarted, gameEnded]);

  // 🏆 Level-up detection: check after game ends with polling fallback
  useEffect(() => {
    if (!gameEnded || levelUpCheckedRef.current || preLevelRef.current <= 0) return;

    const checkLevelUp = () => {
      const currentScore = profile?.total_score ?? 0;
      const preScore = preScoreRef.current ?? 0;
      console.log("🏆 Level check:", { preLevel: preLevelRef.current, currentScore, preScore });
      if (currentScore > preScore) {
        const currentLevel = calcLevelFromScore(currentScore);
        console.log("🏆 Level compare:", { preLevel: preLevelRef.current, currentLevel });
        if (currentLevel > preLevelRef.current) {
          levelUpCheckedRef.current = true;
          setNewLevel(currentLevel);
          setTimeout(() => setShowLevelUp(true), 1500);
          return true;
        }
      }
      return false;
    };

    // Immediate check
    if (checkLevelUp()) return;

    // Poll every 2s for up to 10s to catch delayed profile refresh
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      console.log("🏆 Level poll attempt:", attempts);
      if (checkLevelUp() || attempts >= 5) {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [gameEnded, profile?.total_score]);

  // 🎮 Arka plan disconnect için gameStarted ref'ini senkronize tut
  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted]);

  // 💡 Maç içi ipucu yazıları (NiceCatchText ile aynı animasyon)
  useEffect(() => {
    if (!gameStarted || gameEnded) return;
    const HINT_POOL_60 = [
      "Değiştir jokeri 5 harf değiştirir",
      "Fısılda jokeri yolu gösterir",
      "SenYaz jokeri senin yerine yazar",
    ];
    const t15 = setTimeout(() => {
      if (gameEndedRef.current) return;
      if (playerScoreRef.current === 0) {
        setHintEvent((p) => ({ id: p.id + 1, text: "Henüz kelime göndermedin..." }));
        playNativeSound("beep", 0.5);
        setShowKelimeGondermedinAnim(true);
        setTimeout(() => setShowKelimeGondermedinAnim(false), 4000);
      }
    }, 15000);
    const t30 = setTimeout(() => {
      if (gameEndedRef.current) return;
      if (!jokerUsedInMatchRef.current && playerScoreRef.current < opponentScoreRef.current) {
        setHintEvent((p) => ({ id: p.id + 1, text: "Joker avantaj sağlar. İyi kullan!" }));
        playNativeSound("beep", 0.5);
      }
    }, 30000);
    const t60 = setTimeout(() => {
      if (gameEndedRef.current) return;
      if (!jokerUsedInMatchRef.current) {
        const txt = HINT_POOL_60[Math.floor(Math.random() * HINT_POOL_60.length)];
        setHintEvent((p) => ({ id: p.id + 1, text: txt }));
        playNativeSound("beep", 0.5);
      }
    }, 60000);
    return () => {
      clearTimeout(t15);
      clearTimeout(t30);
      clearTimeout(t60);
    };
  }, [gameStarted, gameEnded]);

  const [winner, setWinner] = useState<"player" | "opponent" | "tie" | null>(null);
  const winnerRef = useRef<"player" | "opponent" | "tie" | null>(null);
  const [disconnectWin, setDisconnectWin] = useState(false);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);

  // 🔊 Maç sonu sesi - winner set olduğunda kesin oynat (her path için tek noktadan)
  // checkWinnerWithScores'taki early-return ve native'de çift 'celebration' çağrısı
  // (playSound("gameWin") + playCelebrationSound) sesi susturuyordu.
  const endSoundPlayedRef = useRef(false);
  const playEndResultSoundOnce = useCallback(
    (result: "player" | "opponent" | "tie") => {
      if (endSoundPlayedRef.current) return;
      endSoundPlayedRef.current = true;
      if (gameMode === "tournament" && result === "player") {
        console.log("🔇 [GamePage] Turnuva galibiyet sesi bracket sayfasına bırakıldı");
        return;
      }
      console.log("🔊 [GamePage] Maç sonu sesi tetikleniyor, winner:", result);
      try {
        if (result === "player") {
          playCelebrationSound();
        } else if (result === "opponent") {
          playGameLoseSound();
        } else {
          playTieSound();
        }
      } catch (err) {
        console.warn("⚠️ Maç sonu sesi oynatılamadı:", err);
      }
    },
    [gameMode, playCelebrationSound, playGameLoseSound, playTieSound],
  );

  useEffect(() => {
    winnerRef.current = winner;
    if (!winner) {
      endSoundPlayedRef.current = false;
      return;
    }
    playEndResultSoundOnce(winner);
  }, [winner, playEndResultSoundOnce]);
  //
  const [hasShownStartMessage, setHasShownStartMessage] = useState(false);
  const [lastPlayerAction, setLastPlayerAction] = useState<number>(0);
  const [matchmakingTimeout, setMatchmakingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [timeoutCountdown, setTimeoutCountdown] = useState(30);
  const [showResults, setShowResults] = useState(false);
  // Level-up detection
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const preLevelRef = useRef<number>(0);
  // Rank-up detection
  const [showRankUp, setShowRankUp] = useState(false);
  const [rankUpTier, setRankUpTier] = useState<RankTier | null>(null);

  // 🌟 Rank atlama → match-end review dialog'unu ezerek native review tetikle
  useEffect(() => {
    if (!showRankUp || !rankUpTier) return;
    const t = setTimeout(() => {
      maybeRequestReview("rank_up", {
        accountCreatedAt: (profile as any)?.created_at ?? null,
      });
    }, 3500);
    return () => clearTimeout(t);
  }, [showRankUp, rankUpTier, maybeRequestReview, profile]);
  // Rematch state
  const [rematchRequested, setRematchRequested] = useState(false);
  const [waitingForRematchResponse, setWaitingForRematchResponse] = useState(false);
  const [botRematchStatus, setBotRematchStatus] = useState<"idle" | "waiting" | "accepted" | "declined">("idle");
  const rematchSendingRef = useRef(false);
  // 🔒 Bu maç sonucu ekranında rematch isteği bir kez gönderilir (spam/çoklu istek engeli)
  const [rematchSentOnce, setRematchSentOnce] = useState(false);

  // 🎮 Opponent ID - ref ile sakla ki oyun bittiğinde kaybolmasın
  const savedOpponentIdRef = useRef<string | null>(null);
  const savedRoomIdRef = useRef<string | null>(null);
  // Opponent ID'yi hesapla ve ref'e kaydet
  const opponentId = useMemo(() => {
    if (hasMultiplayerBotOpponent) {
      return null;
    }

    // Önce participants'tan bul
    const opponent = participants.find((p) => !p.is_bot && p.user_id !== user?.id);
    if (opponent?.user_id) {
      savedOpponentIdRef.current = opponent.user_id;
      return opponent.user_id;
    }

    // Yoksa currentRoom'dan bul
    if (currentRoom) {
      const id = currentRoom.player1_id === user?.id ? currentRoom.player2_id : currentRoom.player1_id;
      if (id) {
        savedOpponentIdRef.current = id;
        return id;
      }
    }

    // State temizlenmiş olabilir, ref'ten al
    return savedOpponentIdRef.current;
  }, [hasMultiplayerBotOpponent, participants, currentRoom, user?.id]);

  // RematchContext'ten rematch fonksiyonlarını al
  const {
    isWaiting: rematchIsWaiting,
    sendRematchRequest: sendRematchContext,
    rematchStatus,
    resetRematchState,
  } = useRematchContext();

  // ============= GLOBAL RESYNC - Bağlantı kopup geldiğinde oda, skor ve veri senkronizasyonu =============
  const handleGameResync = useCallback(async () => {
    // Oyun bittiyse resync gereksiz
    if (gameEndedRef.current) {
      console.log("🔄 [GamePage] Oyun bitti, resync atlanıyor");
      return;
    }

    console.log("🔄 [GamePage] Bağlantı geri geldi - veri senkronizasyonu başlıyor...");

    try {
      // 1. TURNUVA MODU SYNC
      if (gameMode === "tournament" && tournamentMatch?.id) {
        const { data: matchData, error } = await supabase
          .from("tournament_matches")
          .select("*")
          .eq("id", tournamentMatch.id)
          .single();

        if (!error && matchData) {
          console.log("✅ [GamePage Resync] Turnuva maçı güncellendi:", matchData.status);

          // Skorları güncelle
          const isPlayer1 = String(matchData.player1_id) === String(user?.id);
          if (isPlayer1) {
            setOpponentScore(matchData.player2_score || 0);
          } else {
            setOpponentScore(matchData.player1_score || 0);
          }

          // Maç tamamlandıysa UI'ı güncelle
          if (matchData.status === "completed" && matchData.winner_id) {
            const iWon = matchData.winner_id === user?.id;
            setWinner(iWon ? "player" : "opponent");
            setGameEnded(true);
            setShowResults(true);
          }
        }
        return;
      }

      // 2. MULTIPLAYER ROOM SYNC (random-match, private-room)
      // 🔒 STALE ROOM GUARD: currentRoom hâlâ önceki (bitmiş) maçı gösteriyorsa resync yapma.
      // Aksi halde eski odanın status="finished" + winner_id değeri okunup yeni maçın üstüne
      // önceki maçın kazandın/kaybettin kartı açılıyor.
      if (gameMode === "random-match" || gameMode === "private-room") {
        const urlRoomParam = searchParams.get("room");
        if (
          urlRoomParam &&
          currentRoom?.id &&
          currentRoom.id !== urlRoomParam &&
          (currentRoom as any).room_code !== urlRoomParam
        ) {
          console.log("⏭️ [GamePage Resync] currentRoom URL odası ile eşleşmiyor, resync atlandı", {
            urlRoomParam,
            currentRoomId: currentRoom.id?.slice(-8),
          });
          return;
        }
      }

      if ((gameMode === "random-match" || gameMode === "private-room") && currentRoom?.id) {
        const { data: roomData, error: roomError } = await supabase
          .from("game_rooms")
          .select("*")
          .eq("id", currentRoom.id)
          .single();

        if (!roomError && roomData) {
          console.log("✅ [GamePage Resync] Oda verisi güncellendi - status:", roomData.status);

          // Skorları güncelle
          const isPlayer1 = roomData.player1_id === user?.id;
          if (isPlayer1) {
            setOpponentScore(roomData.player2_score || 0);
          } else {
            setOpponentScore(roomData.player1_score || 0);
          }

          // Oda bittiyse UI'ı güncelle
          if (roomData.status === "finished" && roomData.winner_id) {
            const iWon = roomData.winner_id === user?.id;
            setWinner(iWon ? "player" : "opponent");
            setGameEnded(true);
            setShowResults(true);
          }

          // Grid sync (joker koruması yoksa)
          if (!gridSyncPaused && roomData.current_grid && Array.isArray(roomData.current_grid)) {
            const flat = roomData.current_grid as string[];
            const grid: string[][] = [];
            for (let i = 0; i < 4; i++) {
              grid.push(flat.slice(i * 4, (i + 1) * 4));
            }
            setGameGrid(grid);
            console.log("✅ [GamePage Resync] Grid senkronize edildi");
          }
        }
      }

      // 3. Server time sync yeniden kalibre et (Context üzerinden otomatik yapılıyor)
      try {
        await triggerResync();
        console.log("✅ [GamePage Resync] Server time re-synced via context");
      } catch (e) {
        console.warn("⚠️ [GamePage Resync] Server time sync hatası:", e);
      }
    } catch (err) {
      console.error("❌ [GamePage Resync] Hata:", err);
    }
  }, [gameMode, tournamentMatch?.id, currentRoom?.id, user?.id, gridSyncPaused, triggerResync, searchParams]);

  // Priority: true - GamePage en kritik sayfa!
  useGlobalResync({
    onResync: handleGameResync,
    isActive:
      !gameEndedRef.current &&
      (gameMode === "tournament" || gameMode === "random-match" || gameMode === "private-room"),
    isPriority: true,
    pageName: "GamePage",
  });

  // 🔒 Server time sync için state ve ref'ler - Context'ten geliyor
  const serverTimeReadyRef = useRef(false);
  const [serverTimeReady, setServerTimeReady] = useState(false);

  // Server time context'ten ready durumunu al
  useEffect(() => {
    if (contextServerTimeReady) {
      serverTimeReadyRef.current = true;
      setServerTimeReady(true);
      console.log("⏰ Server time ready from context, offset:", contextOffset, "ms");
    }
  }, [contextServerTimeReady, contextOffset]);

  // Context offset değiştiğinde (foreground/reconnect sonrası) log
  useEffect(() => {
    const unsubscribe = subscribeToOffsetChange((newOffset) => {
      console.log(`🔄 [GamePage] Server time offset updated: ${newOffset}ms`);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Rakip ayrıldığında işlem yap
  useEffect(() => {
    const handler = async (e: any) => {
      const evtRoomId = e?.detail?.roomId;
      const eventWinner = e?.detail?.winner; // 'player' veya 'opponent'
      const isTournamentEvent = e?.detail?.isTournament;

      // TURNUVA MODU İÇİN ÖZEL HANDLER
      if (isTournamentEvent && gameMode === "tournament" && tournamentMatch) {
        if (evtRoomId !== tournamentMatch.id) {
          console.log("🚫 Farklı turnuva maçına ait disconnect eventi yok sayıldı");
          return;
        }

        console.log("🏆 Turnuva: Rakip disconnect/kill tespit edildi, maç kazanılıyor!");

        // Maçı kazanan olarak güncelle
        const isPlayer1 = String(tournamentMatch.player1_id) === String(user?.id);
        const player1Score = isPlayer1 ? playerScoreRef.current + 100 : 0; // +100 bonus
        const player2Score = isPlayer1 ? 0 : playerScoreRef.current + 100;

        try {
          await supabase
            .from("tournament_matches")
            .update({
              status: "completed",
              player1_score: player1Score,
              player2_score: player2Score,
              winner_id: user?.id,
            })
            .eq("id", tournamentMatch.id);
          console.log("✅ Turnuva maçı kazanan olarak güncellendi");
        } catch (err) {
          console.error("❌ Turnuva maç güncelleme hatası:", err);
        }

        setDisconnectWin(true);
        setWinner("player");
        setButtonsEnabled(false);
        setTimeout(() => setButtonsEnabled(true), 1000);
        setGameEnded(true);
        setShowResults(true);

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Ses: tek noktadan, tekrar çalmayı engelleyerek tetikle
        if (!endSoundPlayedRef.current) {
          endSoundPlayedRef.current = true;
          playCelebrationSound();
        }

        toast({
          title: "Rakip Bağlantısı Koptu",
          description: "Rakip oyundan düştü. Kazandınız! 🎉",
          duration: 3000,
        });
        return;
      }

      // NORMAL MOD KONTROLLARI
      if (!evtRoomId || evtRoomId !== currentRoom?.id) {
        console.log("🚫 Farklı odaya ait disconnect eventi yok sayıldı", { evtRoomId, current: currentRoom?.id });
        return;
      }

      // 🔒 STALE ROOM GUARD: rematch sonrası yeni odaya geçtiysek, currentRoom hâlâ eski odayı
      // gösterirken gelen "rakip ayrıldı" eventi yeni maçın üstüne yanlış kazandın kartı açıyordu.
      const urlRoomForEvent = searchParams.get("room");
      const currentRoomMatchesUrl =
        !urlRoomForEvent ||
        currentRoom?.id === urlRoomForEvent ||
        (currentRoom as any)?.room_code === urlRoomForEvent;
      if (!currentRoomMatchesUrl) {
        console.log("🚫 Eski (rematch öncesi) odaya ait disconnect eventi yok sayıldı", {
          evtRoomId,
          urlRoomForEvent,
        });
        return;
      }

      // Eğer ben kaybettim (opponent kazandı), sadece kaybetme ekranını göster
      if (eventWinner === "opponent") {
        console.log("😢 Ben oyundan ayrıldım veya kaybettim");
        setWinner("opponent");
        setButtonsEnabled(false);
        setTimeout(() => setButtonsEnabled(true), 1000);
        setGameEnded(true);
        setShowResults(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      // Turnuva modunda rakip ayrıldı bildirimi
      if (gameMode?.includes("tournament") && e?.detail?.reason === "player_left_tournament") {
        console.log("🏆 Turnuva: Rakip ayrıldı, +500 puan bonusu verildi");

        toast({
          title: "⚠️ Rakip Ayrıldı",
          description: "Rakip oyundan ayrıldı veya bağlantısı koptu. Size +500 puan verildi.",
          duration: 5000,
        });

        // Oyunu devam ettir
        return;
      }

      // Normal modlarda: Kazanan benim, disconnect win göster
      console.log("🚪 Rakip oyundan ayrıldı eventi alındı");
      setDisconnectWin(true);
      setWinner("player");
      setButtonsEnabled(false);
      setTimeout(() => setButtonsEnabled(true), 1000);
      setGameEnded(true);
      setShowResults(true);

      // 🎯 Disconnect kazanımında istatistikleri güncelle (haftalık/aylık/sezon)
      if (user && !statsUpdatedRef.current) {
        statsUpdatedRef.current = true;
        const gameDuration = gameType === "timed" ? 120 : Math.floor((Date.now() - gameStartTime) / 1000);
        const disconnectScore = playerScoreRef.current;
        // 🔧 Premium x2 + Liderlik boost x2 artık SUNUCU TARAFINDA (update_game_stats RPC) uygulanıyor.
        const disconnectMultiplier = 10; // Sadece kazan/kaybet çarpanı (disconnect win)

        console.log("📊 Disconnect win - istatistikler güncelleniyor:", {
          score: disconnectScore,
          multiplied: disconnectScore * disconnectMultiplier,
          words: playerWordsWithScores.length,
          isPremium,
        });

        try {
          const { error: statsError } = await (supabase.rpc as any)("update_game_stats", {
            p_user_id: user.id,
            p_score: disconnectScore * disconnectMultiplier,
            p_words: playerWordsWithScores,
            p_is_winner: true,
            p_game_duration: gameDuration,
            p_first_word_time: firstWordTime,
            p_game_mode: gameMode,
          });

          if (statsError) {
            console.error("❌ Disconnect win stats hatası:", statsError);
          } else {
            console.log("✅ Disconnect win istatistikleri güncellendi");
            await forceRefreshProfile?.();
          }
        } catch (err) {
          console.error("❌ Disconnect win stats exception:", err);
        }

        // Rank puanı güncelle - rastgele eşleşme ve özel oda
        if (
          gameMode === "random-match" ||
          (gameMode as string) === "random-match-timed" ||
          (gameMode as string) === "random-match-score" ||
          gameMode === "private-room"
        ) {
          try {
            const rpChange = 50; // Disconnect win = galibiyet
            const { data: currentProfile } = await supabase
              .from("profiles")
              .select("rank_points")
              .eq("id", user.id)
              .single();
            const currentRP = (currentProfile as any)?.rank_points || 0;
            const newRP = Math.max(0, currentRP + rpChange);
            const oldTier = getRankTier(currentRP);
            const newTier = getRankTier(newRP);
            await supabase
              .from("profiles")
              .update({ rank_points: newRP } as any)
              .eq("id", user.id);
            console.log(`🏅 Disconnect win - Rank: ${currentRP} → ${newRP} (+${rpChange} RP)`);
            if (newTier.id !== oldTier.id && newRP > currentRP && newTier.id !== "cirak") {
              setRankUpTier(newTier);
              setTimeout(() => setShowRankUp(true), 2000);
            }
          } catch (err) {
            console.error("❌ Disconnect win rank hatası:", err);
          }
        }
      }

      // Oyunu durduran işlemleri
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // 🎯 REMATCH FIX: Rakibe disconnect cezası uygula
      const disconnectedOpponentId = savedOpponentIdRef.current;
      const roomIdForPenalty = currentRoom?.id || savedRoomIdRef.current; // ← FIX
      if (disconnectedOpponentId && roomIdForPenalty) {
        console.log(
          "⚖️ Disconnect penalty uygulanıyor (GamePage handler):",
          disconnectedOpponentId.slice(-8),
          "room:",
          roomIdForPenalty.slice(-8),
        );
        try {
          const { data: penaltyResult, error: penaltyError } = await supabase.rpc("apply_disconnect_penalty", {
            p_offender_id: disconnectedOpponentId,
            p_room_id: roomIdForPenalty, // ← FIX
          });

          if (penaltyError) {
            console.error("❌ Disconnect penalty hatası:", penaltyError);
          } else if (penaltyResult && penaltyResult.length > 0) {
            const result = penaltyResult[0];
            console.log("✅ Disconnect penalty uygulandı:", {
              penalty: result.penalty,
              newScore: result.new_score,
              disconnectCount: result.new_disconnect_count,
            });
          }
        } catch (err) {
          console.error("❌ Disconnect penalty exception:", err);
        }
      }

      toast({
        title: "Rakip oyundan ayrıldı",
        description: "Maçı kazandınız! 🎉",
        duration: 3000,
      });

      // Çok erken kopan eşleşmelerde hak iadesi (premium değilse) - SADECE KAZANAN OYUNCUYA
      try {
        if (!isPremium) {
          const earlyDc = Date.now() - gameStartTime < 15000; // 15s altında
          const noPlay = playerWordsWithScores.length === 0 && opponentWordsWithScores.length === 0;
          if (earlyDc || noPlay) {
            await addBonusCredits(1);
            // Refund sonrası güncel krediyi DB'den çek ve state'e yaz
            const { data: freshCredits } = await supabase
              .from("profiles")
              .select("game_credits, bonus_credits")
              .eq("id", user?.id)
              .single();
            if (freshCredits) {
              setUserCredits((freshCredits.game_credits ?? 0) + (freshCredits.bonus_credits ?? 0));
            }
            toast({
              title: "🎟 Hak iade edildi",
              description: "Rakip erken ayrıldığı için oyun hakkınız iade edildi.",
              duration: 2500,
            });
          }
        }
      } catch (err) {
        console.log("Credit refund skipped/failed:", err);
      }

      // Ses efekti çal (disconnect-win akışı) - sadece bir kez
      if (!endSoundPlayedRef.current) {
        endSoundPlayedRef.current = true;
        playCelebrationSound();
      }

      // 🎯 Odayı finished yap ve kazananı belirle
      if (currentRoom?.id && user?.id) {
        console.log("🏁 Disconnect sonrası oda sonlandırılıyor");
        try {
          await supabase
            .from("game_rooms")
            .update({
              status: "finished",
              winner_id: user.id,
              finished_at: new Date().toISOString(),
            })
            .eq("id", currentRoom.id);
          console.log("✅ Oda finished olarak güncellendi");
        } catch (err) {
          console.error("❌ Oda güncelleme hatası:", err);
        }
      }

      // Room state'ini hemen temizle (RoomAutoNavigator yeniden yönlendirmeyi önle)
      console.log("🧹 Disconnect sonrası room temizleniyor");
      leaveRoom();
    };

    window.addEventListener("playerDisconnected", handler as EventListener);
    return () => window.removeEventListener("playerDisconnected", handler as EventListener);
  }, [
    gameMode,
    playSound,
    playCelebrationSound,
    toast,
    currentRoom?.id,
    user?.id,
    isPremium,
    playerWordsWithScores.length,
    opponentWordsWithScores.length,
    addBonusCredits,
    leaveRoom,
    tournamentMatch?.id,
    tournamentMatch?.player1_id,
  ]);

  // Fallback: Katılımcı azalınca disconnect'i yakala - 3-4sn gecikme ile
  const disconnectHandledRef = useRef(false);
  const gameHasStartedRef = useRef(false);
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Temizlik: Önceki timer'ı iptal et
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    // Oyun gerçekten başladıktan sonra disconnect kontrolü yap
    // REMATCH SIRASINDA DISCONNECT KONTROL ETMEYİN!
    if (disconnectHandledRef.current || waitingForRematchResponse || rematchRequested) {
      return;
    }

    if (
      (gameMode === "private-room" || gameMode === "random-match") &&
      gameStarted &&
      !gameEnded &&
      gameHasStartedRef.current &&
      participants.length > 0
    ) {
      const realPlayers = participants.filter((p) => !p.is_bot);
      const hasBotOpponent = participants.some((p) => p.is_bot === true);
      const amIStillParticipant = participants.some((p) => p.user_id === user?.id);

      // 🤖 Bot rakip varsa disconnect detection ÇALIŞMAZ (bot zaten "rakip" sayılır)
      if (realPlayers.length < 2 && !hasBotOpponent && amIStillParticipant && !disconnectHandledRef.current) {
        console.log("⏳ Fallback disconnect tespit edildi, 3.5 saniye doğrulanacak...");

        // 🔒 REMATCH FIX: Room ID'yi capture et
        const capturedRoomId = currentRoom?.id;

        // 🛡️ 3.5 saniye bekle, tekrar kontrol et (oyuncu geri dönebilir)
        disconnectTimerRef.current = setTimeout(() => {
          // 🔒 REMATCH FIX: Ref'lerden güncel değerleri oku (closure sorunu çözümü)
          const latestParticipants = participantsRef.current;
          const latestRoomId = currentRoomIdRef.current;

          // 🔒 REMATCH GUARD: Room değiştiyse işlem yapma
          if (latestRoomId !== capturedRoomId) {
            console.log("🔄 Room değişti (rematch?), fallback disconnect iptal", {
              captured: capturedRoomId?.slice(-8),
              latest: latestRoomId?.slice(-8),
            });
            return;
          }

          const currentRealPlayers = latestParticipants.filter((p) => !p.is_bot);
          const currentHasBot = latestParticipants.some((p) => p.is_bot === true);
          const stillAmIInRoom = latestParticipants.some((p) => p.user_id === user?.id);

          if (currentRealPlayers.length < 2 && !currentHasBot && stillAmIInRoom && !disconnectHandledRef.current) {
            console.log("🚪 Fallback disconnect doğrulandı - oyun sonlandırılıyor");
            disconnectHandledRef.current = true;
            window.dispatchEvent(
              new CustomEvent("playerDisconnected", {
                detail: { winner: "player", reason: "opponent_left_fallback", roomId: capturedRoomId },
              }),
            );
          } else {
            console.log("✅ Oyuncu geri döndü, disconnect iptal edildi");
          }
        }, 3500);
      }
    }

    return () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
    };
  }, [
    participants.length,
    gameMode,
    gameStarted,
    gameEnded,
    user?.id,
    waitingForRematchResponse,
    rematchRequested,
    currentRoom?.id,
  ]);

  // Oyunun gerçekten başladığını işaretle - Countdown TAMAMLANDIKTAN sonra
  useEffect(() => {
    if (
      (gameMode === "private-room" || gameMode === "random-match") &&
      participants.length >= 2 &&
      gameStarted &&
      !gameEnded &&
      !showCountdown
    ) {
      // showCountdown false olmalı
      console.log("🎮 Game truly started with participants:", participants.length);
      // Küçük delay - hemen disconnect kontrolü yapmasın
      const timer = setTimeout(() => {
        gameHasStartedRef.current = true;
      }, 2000); // Countdown bitip oyun başladıktan 2sn sonra
      return () => clearTimeout(timer);
    }
  }, [participants.length, gameMode, gameStarted, gameEnded, showCountdown]);

  // 🔒 REMATCH FIX: Ref'leri güncel tut (closure sorunu çözümü)
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    currentRoomIdRef.current = currentRoom?.id || null;
  }, [currentRoom?.id]);

  // Oda değiştiğinde tüm disconnect/game state bayraklarını sıfırla
  // 🎯 REMATCH FIX: Yeni rematch oyununda disconnect detection çalışması için kritik
  useEffect(() => {
    console.log("🔄 Room changed, resetting all disconnect flags:", shortId(currentRoom?.id));
    disconnectHandledRef.current = false;
    gameHasStartedRef.current = false;
    gameStartedRef.current = false; // Arka plan disconnect kontrolü için sıfırla
    countdownCheckDoneRef.current = false;
    // 🎯 REMATCH FIX: Rematch state'lerini de sıfırla ki disconnect detection çalışsın
    setRematchRequested(false);
    setWaitingForRematchResponse(false);
    // 🤖 KRİTİK: Bot rematch akışında "accepted/declined" durumu bir önceki maçtan sonra
    // hiç sıfırlanmıyordu. GamePage aynı route'ta kalıp yeniden mount olmadığından,
    // botRematchStatus "accepted" olarak takılı kalıyor ve YENİ maç bittiğinde
    // MatchResultCard + RematchRoboAnimation bunu görüp eski maçın "yes" animasyonunu
    // hiç istenmeden hemen tekrar oynatıyordu. Oda değişince mutlaka idle'a çek.
    setBotRematchStatus("idle");
    // İnsan rakip akışında da aynı sınıf sızıntı: RematchContext içindeki rematchStatus
    // (accepted/declined) ve bu sayfadaki "tek istek gönderildi" bayrağı sıfırlanmazsa
    // yeni maçın sonuç kartı eski maçın animasyonunu/kilidini miras alır.
    resetRematchState();
    setRematchSentOnce(false);
    comboCountRef.current = 0;
    setComboEvent({ id: 0, count: 0 });
    setBonusEvent({ id: 0, amount: 0 });
    setComboResetId((prev) => prev + 1);
  }, [currentRoom?.id, resetRematchState]);

  // 🎯 REALTIME SUBSCRIPTION: Rakip participant silindiyinde anında tespit et
  // Polling yerine Supabase Realtime kullanıyoruz
  useEffect(() => {
    // Sadece multiplayer modlarda ve oyun aktifken çalış
    if (
      !(gameMode === "private-room" || gameMode === "random-match") ||
      !gameStarted ||
      gameEnded ||
      !currentRoom?.id ||
      !user?.id ||
      disconnectHandledRef.current
    ) {
      return;
    }

    const capturedRoomId = currentRoom.id;
    const capturedUserId = user.id;

    // Rakip ID'yi hesapla
    const opponentId = currentRoom.player1_id === capturedUserId ? currentRoom.player2_id : currentRoom.player1_id;

    if (!opponentId) {
      console.log("⚠️ Realtime disconnect: Rakip ID bulunamadı");
      return;
    }

    console.log("📡 Realtime disconnect subscription başlatılıyor:", {
      roomId: shortId(capturedRoomId),
      opponentId: shortId(opponentId),
    });

    // game_participants tablosundaki DELETE eventlerini dinle
    const channel = supabase
      .channel(`disconnect-detection-${capturedRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "game_participants",
          filter: `room_id=eq.${capturedRoomId}`,
        },
        (payload) => {
          console.log("🔔 Participant DELETE event:", payload);

          // Guard: Room değiştiyse veya zaten handled ise işlem yapma
          const latestRoomId = currentRoomIdRef.current;
          if (latestRoomId !== capturedRoomId || disconnectHandledRef.current) {
            console.log("🔄 Room değişti veya disconnect handled, event yoksayılıyor");
            return;
          }

          // Silinen participant rakip mi kontrol et
          const deletedUserId = (payload.old as any)?.user_id;
          if (deletedUserId === opponentId) {
            console.log("🚨 REALTIME: Rakip participant silindi - DISCONNECT TETİKLENİYOR!");
            disconnectHandledRef.current = true;

            // Opponent ID'yi kaydet (ceza için)
            savedOpponentIdRef.current = opponentId;

            // ✅ Kendi topic'ini kapat - global realtime bağlantısını ETKİLEMEZ,
            // sadece bu odaya özel kanalı kapatır. Event zaten işlendiği için artık gerekmiyor.
            supabase.removeChannel(channel);
            console.log("🧹 [GamePage] Disconnect kanalı kapatıldı (event işlendi):", shortId(capturedRoomId));

            // Disconnect event'i dispatch et
            window.dispatchEvent(
              new CustomEvent("playerDisconnected", {
                detail: {
                  winner: "player",
                  reason: "opponent_left_realtime",
                  roomId: capturedRoomId,
                },
              }),
            );
          }
        },
      )
      .subscribe((status) => {
        console.log("📡 Disconnect channel status:", status);
      });

    // ✅ Oda değiştiğinde (rematch) veya component unmount olduğunda eski kanalı MUTLAKA kapat.
    // Aksi halde eski odanın aboneliği açık kalır ve arka planda gelen bir event
    // yeni maçın üstüne eski "kazandın/kaybettin" kartını tekrar açabilir (bot rematch bug'ı).
    return () => {
      console.log("🧹 [GamePage] Disconnect subscription temizleniyor:", shortId(capturedRoomId));
      supabase.removeChannel(channel);
    };
  }, [gameMode, gameStarted, gameEnded, currentRoom?.id, currentRoom?.player1_id, currentRoom?.player2_id, user?.id]);

  const [isAIOpponent, setIsAIOpponent] = useState(false);
  const [opponentName, setOpponentName] = useState("");
  const [targetScore, setTargetScore] = useState(gameType === "score" ? 500 : 0);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  const [finalPlayerScore, setFinalPlayerScore] = useState(0);
  const [finalOpponentScore, setFinalOpponentScore] = useState(0);

  const handleTournamentGameEnd = async (userScore: number, opponentScore: number) => {
    if (!user || !tournamentMatch) return;

    const activeTournamentMatch = tournamentMatch;

    try {
      // Kullanıcının hangi oyuncu olduğunu belirle
      const isPlayer1 = String(activeTournamentMatch.player1_id) === String(user.id);
      const opponentId = isPlayer1 ? activeTournamentMatch.player2_id : activeTournamentMatch.player1_id;

      // Skorları doğru oyunculara ata
      const player1Score = isPlayer1 ? userScore : opponentScore;
      const player2Score = isPlayer1 ? opponentScore : userScore;

      console.log("🏆 Tournament match completion:", {
        matchId: activeTournamentMatch.id,
        user: user.id,
        isPlayer1,
        player1Score,
        player2Score,
        originalUserScore: userScore,
        originalOpponentScore: opponentScore,
      });

      // Beraberlik durumunda önce backend tie-breaker ile kazananı belirle
      let determinedWinnerId: string | null = null;

      if (player1Score === player2Score) {
        console.log("🤝 Beraberlik durumu - tie-breaker kriterleri uygulanıyor");

        // 0-0 beraberlik: Rastgele kazanan seç
        if (player1Score === 0 && player2Score === 0) {
          console.log("🎲 0-0 beraberlik - rastgele kazanan seçiliyor");
          determinedWinnerId =
            Math.random() < 0.5 ? activeTournamentMatch.player1_id : activeTournamentMatch.player2_id;
          console.log("✅ Rastgele seçilen kazanan:", determinedWinnerId);
        } else {
          // 0'dan farklı beraberlik: Backend tie-breaker RPC çağır
          console.log("📊 Backend tie-breaker kriterleri uygulanıyor");
          const { data: tieResult, error: tieError } = await supabase.rpc(
            "determine_tournament_winner_with_tiebreaker",
            {
              p_match_id: activeTournamentMatch.id,
              p_player1_id: activeTournamentMatch.player1_id,
              p_player2_id: activeTournamentMatch.player2_id,
              p_player1_score: player1Score,
              p_player2_score: player2Score,
            },
          );

          if (tieError) {
            console.error("❌ Tie-breaker hatası:", tieError);
            // Fallback: Rastgele seç
            determinedWinnerId =
              Math.random() < 0.5 ? activeTournamentMatch.player1_id : activeTournamentMatch.player2_id;
            console.log("⚠️ Tie-breaker hatası, rastgele seçildi:", determinedWinnerId);
          } else {
            determinedWinnerId = tieResult as string;
            console.log("✅ Backend tie-breaker kazananı:", determinedWinnerId);
          }
        }
      } else {
        // Normal kazanan belirleme
        determinedWinnerId =
          player1Score > player2Score ? activeTournamentMatch.player1_id : activeTournamentMatch.player2_id;
      }

      // ✅ Winner'ı HEMEN belirle ve state'i güncelle
      const userIsWinner = determinedWinnerId === user.id;
      if (userIsWinner) {
        setGameEnded(true);
        setShowResults(true);
        setWinner("player");
        setButtonsEnabled(false);
        setTimeout(() => setButtonsEnabled(true), 1000);
      } else {
        // Turnuva mağlubiyetinde eski "Elendiniz" maç sonu Lottie ekranını hiç gösterme.
        setGameEnded(false);
        setShowResults(false);
        setWinner(null);
        setButtonsEnabled(false);
      }

      // 🔊 Ses: setWinner üstte tetiklendi → winner-effect (playEndResultSoundOnce)
      // celebration/gameLose sesini tek seferde çalacak. Burada tekrar çağırmıyoruz
      // (aksi halde native NativeAudio.stop+play çakışıp ses tamamen susuyor).
      if (userIsWinner) {
        console.log("✅ User WINS - Setting winner to player");
      } else {
        console.log("❌ User LOSES - Setting winner to opponent");
      }

      // Backend'e maç sonucunu ve belirlenmiş kazananı gönder (doğrudan update)
      const { error: updateError } = await supabase
        .from("tournament_matches")
        .update({
          status: "completed",
          player1_score: player1Score,
          player2_score: player2Score,
          winner_id: determinedWinnerId!, // Kesin winner_id
        })
        .eq("id", activeTournamentMatch.id);

      if (updateError) {
        console.error("❌ Maç tamamlama hatası:", updateError);
        // Hata olsa bile winner zaten belirlendi, 3 saniye sonra yönlendir
        setTimeout(() => {
          navigate(`/tournament/bracket/${activeTournamentMatch.tournament_id}`);
        }, 3000);
        return;
      }

      console.log("✅ Maç başarıyla tamamlandı - backend trigger winner'ı promote edecek");

      console.log("✅ Maç başarıyla tamamlandı - backend trigger winner'ı promote edecek");

      // Backend'den gelen güncellenmiş maç bilgisini al
      const { data: updatedMatch, error: matchError } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("id", activeTournamentMatch.id)
        .single();

      if (matchError || !updatedMatch) {
        console.error("❌ Güncellenmiş maç bilgisi alınamadı:", matchError);
        // Winner zaten belirlendi, 3 saniye sonra yönlendir
        setTimeout(() => {
          navigate(`/tournament/bracket/${activeTournamentMatch.tournament_id}`);
        }, 3000);
        return;
      }

      console.log("📊 Backend'den gelen güncel maç bilgisi:", updatedMatch);

      // Backend'in belirlediği kazananı kullan
      const winnerIdRaw = updatedMatch.winner_id;
      const winnerId = winnerIdRaw || determinedWinnerId;
      if (!winnerIdRaw && determinedWinnerId) {
        console.warn("⚠️ winner_id DB'de boş; local tie-breaker kazananı kullanılacak:", determinedWinnerId);
      }
      const finalUserScore = isPlayer1 ? updatedMatch.player1_score : updatedMatch.player2_score;
      const finalOpponentScore = isPlayer1 ? updatedMatch.player2_score : updatedMatch.player1_score;

      // ✅ Bu maçı tamamlanmış olarak işaretle (tekrar oynamayı engelle)
      const completedMatchKey = `${STORAGE_KEYS.TOURNAMENT_MATCH_COMPLETED_PREFIX}${tournamentMatch.id}`;
      nativeStorage.setItem(
        completedMatchKey,
        JSON.stringify({
          matchId: activeTournamentMatch.id,
          tournamentId: activeTournamentMatch.tournament_id,
          completedAt: new Date().toISOString(),
          winner: winnerId,
        }),
      );

      // ✅ Frontend state'ini backend'den gelen skorlarla güncelle
      setPlayerScore(finalUserScore);
      setOpponentScore(finalOpponentScore);

      console.log("✅ Turnuva maçı tamamlandı, winner:", userIsWinner ? "player" : "opponent");

      // 🎯 TURNUVA PUANLARINI LİDERLİK SIRALAMASINA YANSIT
      if (!statsUpdatedRef.current) {
        statsUpdatedRef.current = true;
        const gameDuration = gameType === "timed" ? 120 : Math.floor((Date.now() - gameStartTime) / 1000);

        console.log("📊 Turnuva istatistikleri güncelleniyor:", {
          userId: user.id,
          score: finalUserScore,
          isWinner: userIsWinner,
          gameMode: "tournament",
        });

        const tournamentScoreMultiplier = userIsWinner ? 5 : 1; // Premium/boost sunucuda uygulanıyor
        const { error: statsError } = await (supabase.rpc as any)("update_game_stats", {
          p_user_id: user.id,
          p_score: finalUserScore * tournamentScoreMultiplier,
          p_words: playerWordsWithScores,
          p_is_winner: userIsWinner,
          p_game_duration: gameDuration,
          p_first_word_time: firstWordTime,
          p_game_mode: "tournament",
        });

        if (statsError) {
          console.error("❌ Turnuva istatistik güncelleme hatası:", statsError);
        } else {
          console.log("✅ Turnuva puanları liderlik sıralamasına yansıtıldı");
          await forceRefreshProfile?.();
        }

        // 🎯 Kullanıcının turnuva yolculuğu bittiyse puanı oynanan aşama sayısına böl
        // - Maçı kaybettiyse (eliminated) veya finali oynadıysa (round 3) yolculuk biter
        const userJourneyEnded = !userIsWinner || activeTournamentMatch.round >= 3;
        if (userJourneyEnded && activeTournamentMatch.tournament_id) {
          try {
            const { data: finRes, error: finErr } = await (supabase.rpc as any)("finalize_tournament_score", {
              p_user_id: user.id,
              p_tournament_id: activeTournamentMatch.tournament_id,
            });
            if (finErr) console.error("❌ finalize_tournament_score:", finErr);
            else {
              console.log("✅ finalize_tournament_score (GamePage):", finRes);
              await forceRefreshProfile?.();
            }
          } catch (e) {
            console.error("❌ finalize_tournament_score exception:", e);
          }
        }
      }

      // Aynı turdaki TÜM maçları kontrol et
      const { data: allRoundMatches } = await supabase
        .from("tournament_matches")
        .select("id, status")
        .eq("tournament_id", activeTournamentMatch.tournament_id)
        .eq("round", activeTournamentMatch.round);

      console.log(`🔍 ${activeTournamentMatch.round}. turdaki toplam maç sayısı:`, allRoundMatches?.length);

      const allMatchesCompleted = allRoundMatches?.every((match) => match.status === "completed");

      // ✅ Turnuva state'ini tamamen temizle (eski maç state'i yeni tura karışmasın)
      console.log("🧹 Turnuva maçı bitti, state temizleniyor...");
      setTournamentMatch(null); // ⚠️ KRİTİK: Eski match state'i temizle
      setPlayerScore(0);
      setOpponentScore(0);
      setGameStarted(false);
      setGameEnded(false);
      preLevelRef.current = 0;
      preScoreRef.current = null;
      levelUpCheckedRef.current = false;
      leaveRoom();

      // ⚠️ KRİTİK: DEVRE DIŞI - Bağlantı koruması
      console.log("⚠️ [GamePage] Tournament channel cleanup ATLANYOR (bağlantı koruması)");
      // const channels = supabase.getChannels();
      // channels.forEach((channel) => {
      //   if (channel.topic.includes(tournamentMatch.id)) {
      //     console.log("🔌 Unsubscribing from channel:", channel.topic);
      //     supabase.removeChannel(channel);
      //   }
      // });

      // ⏳ KRİTİK: Winner_id propagation için bekle
      console.log("⏳ Waiting for winner_id to propagate in database...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 🔍 Winner_id'yi doğrula
      const { data: finalMatch } = await supabase
        .from("tournament_matches")
        .select("winner_id")
        .eq("id", activeTournamentMatch.id)
        .single();

      console.log("✅ Winner confirmed in DB:", finalMatch?.winner_id?.slice(-8));

      // 🎯 MUTLAKA YÖNLENDİRME YAP (kazanan/kaybeden fark etmez)
      if (allMatchesCompleted) {
        console.log(
          `🏆 Tüm ${activeTournamentMatch.round}. tur maçları tamamlandı! Round advancement bracket sayfasında yapılacak.`,
        );

        // Bracket sayfasına yönlendir - advancement orada gerçekleşecek
        console.log("🔄 1.5 saniye sonra bracket sayfasına yönlendirilecek");
        setTimeout(
          () => {
            console.log("🔄 Bracket sayfasına yönlendiriliyor...");
            navigate(`/tournament/bracket/${activeTournamentMatch.tournament_id}`);
          },
          userIsWinner ? 1500 : 0,
        );
      } else {
        console.log(
          `⏳ Diğer maçlar devam ediyor. Tamamlanan: ${allRoundMatches?.filter((m) => m.status === "completed").length}/${allRoundMatches?.length}`,
        );

        // Backend winner_id'ye göre yönlendirme (hızlandırıldı: 1.5 saniye)
        const redirectDelay = userIsWinner ? 1500 : 0;
        const redirectPath = `/tournament/bracket/${activeTournamentMatch.tournament_id}`;

        console.log(`🔄 ${redirectDelay / 1000} saniye sonra ${redirectPath}'e yönlendirilecek`);
        setTimeout(() => {
          console.log("🔄 Yönlendiriliyor...");
          navigate(redirectPath);
        }, redirectDelay);
      }
    } catch (error) {
      console.error("Turnuva maç bitiş hatası:", error);
      // Hata durumunda bile winner'ı fallback ile belirle
      const isPlayer1 = String(tournamentMatch?.player1_id) === String(user?.id);
      const player1Score = isPlayer1 ? userScore : opponentScore;
      const player2Score = isPlayer1 ? opponentScore : userScore;
      const fallbackWinner = player1Score >= player2Score ? tournamentMatch?.player1_id : tournamentMatch?.player2_id;
      setWinner(fallbackWinner === user?.id ? "player" : "opponent");

      // 3 saniye sonra yönlendir
      setTimeout(() => {
        navigate(`/tournament/bracket/${tournamentMatch?.tournament_id}`);
      }, 3000);
    }
  };

  // ❌ KALDIRILDI: Gereksiz polling - winner zaten handleTournamentGameEnd içinde doğru şekilde belirleniyor
  // Bu polling sadece "Skor hesaplanıyor..." mesajı gösterip gereksiz gecikmeye neden oluyordu

  const requestRematch = async () => {
    // 🔒 Tek istek kuralı: bu maç sonucu ekranında ikinci kez rematch gönderilemez
    if (rematchSentOnce || rematchSendingRef.current || waitingForRematchResponse) {
      console.log("🚫 Rematch isteği zaten gönderildi, tekrar gönderim engellendi");
      return;
    }
    setRematchSentOnce(true);
    if (!user) {
      console.error("❌ Rematch: User yok");
      return;
    }

    // 🤖 Bot rakip için özel akış: 2-7s gerçekçi gecikme, %75 kabul / %25 ret
    if (hasMultiplayerBotOpponent) {
      const roomKey = currentRoom?.id || "bot-room";
      const storageKey = `botRematchDecision:${roomKey}`;
      let decision = sessionStorage.getItem(storageKey) as "accepted" | "left" | null;
      if (!decision) {
        decision = Math.random() < 0.75 ? "accepted" : "left";
        sessionStorage.setItem(storageKey, decision);
      }

      // Gerçek oyuncuya gönderilmiş gibi "istek gönderildi" toastu
      setWaitingForRematchResponse(true);
      setBotRematchStatus("waiting");
      toast({
        title: "🔄 Tekrar Oyun İsteği Gönderildi",
        description: "Rakibinizin yanıtını bekliyoruz...",
        duration: 3000,
      });

      const delayMs = 2000 + Math.floor(Math.random() * 5001); // 2000-7000ms

      setTimeout(async () => {
        if (!isMountedRef.current) return;

        if (decision === "left") {
          setWaitingForRematchResponse(false);
          setBotRematchStatus("declined");
          setTimeout(() => {
            if (isMountedRef.current) setBotRematchStatus("idle");
          }, 2500);
          toast({
            title: "❌ Rematch Reddedildi",
            description: "Rakip rematch isteğini reddetti.",
            variant: "destructive",
            duration: 1500,
          });
          return;
        }

        const currentGameType: "timed" | "score" = gameType;
        const botIdentity =
          currentBotIdentity ||
          (() => {
            const fallbackSeed = seedFromText(`${currentRoom?.id || "bot-room"}:rematch`);
            const fallbackName = generateBotName(fallbackSeed);
            return { seed: fallbackSeed, name: fallbackName, avatar: generateBotAvatar(fallbackSeed, fallbackName) };
          })();

        roomSessionRef.current += 1;
        if (pendingEndGameTimeoutRef.current) {
          clearTimeout(pendingEndGameTimeoutRef.current);
          pendingEndGameTimeoutRef.current = null;
        }
        if (currentRoom?.id) {
          matchBanlist.add(currentRoom.id);
        }
        setRematchRequested(true);
        setWaitingForRematchResponse(false);
        setBotRematchStatus("accepted");

        toast({
          title: "✅ Rakip Kabul Etti",
          description: "Oyun başlıyor...",
          duration: 1500,
        });

        try {
          const roomCode = generateRoomCode();
          const grid = generateRandomGrid().flat();

          const roomInsert = {
            host_id: user.id,
            room_code: roomCode,
            game_mode: `private-room-${currentGameType}`,
            game_type_new: currentGameType,
            status: "waiting",
            max_players: 2,
            time_limit: currentGameType === "timed" ? 120 : 0,
            max_score: currentGameType === "score" ? 500 : 0,
            current_grid: grid,
          };

          const { data: room, error: roomError } = await supabase
            .from("game_rooms")
            .insert(roomInsert)
            .select("id")
            .single();

          if (roomError || !room?.id) throw roomError || new Error("Bot rematch room oluşturulamadı");

          const { error: participantsError } = await supabase.from("game_participants").insert([
            { room_id: room.id, user_id: user.id, score: 0, is_bot: false, is_ready: true },
            { room_id: room.id, user_id: null, score: 0, is_bot: true, is_ready: true },
          ]);
          if (participantsError) throw participantsError;

          sessionStorage.setItem(`${BOT_REMATCH_META_PREFIX}${room.id}`, JSON.stringify(botIdentity));

          // 🚀 Bekleme sayfası atlanıyor: oda direkt aktif edilip maça giriliyor
          await supabase
            .from("game_rooms")
            .update({ status: "active", player1_id: user.id, player2_id: null })
            .eq("id", room.id);
          try {
            await supabase.rpc("start_game_countdown", { p_room_id: room.id });
          } catch {
            /* countdown zaten başlamış olabilir */
          }

          const params = new URLSearchParams({
            room: room.id,
            type: currentGameType,
            botRematch: "1",
            botSeed: String(botIdentity.seed),
            botName: botIdentity.name,
            botAvatar: botIdentity.avatar,
          });
          navigate(`/game/private-room?${params.toString()}`, { replace: true });

        } catch (error) {
          console.error("❌ Bot rematch room oluşturma hatası:", error);
          setRematchRequested(false);
          setWaitingForRematchResponse(false);
          setRematchSentOnce(false);
          setBotRematchStatus("idle");
          toast({
            title: "Hata",
            description: "Tekrar oyun odası oluşturulamadı.",
            variant: "destructive",
          });
        }
      }, delayMs);

      return;
    }

    if (!opponentId) {
      console.error("❌ Rematch: Opponent yok");
      toast({
        title: "Hata",
        description: "Rakip bulunamadı",
        variant: "destructive",
      });
      return;
    }

    console.log("🔄 Rematch isteği başlatılıyor (yeni hook)...");

    try {
      // Disconnect logic'i geçici olarak devre dışı bırak
      disconnectHandledRef.current = true;

      setRematchRequested(true);
      setWaitingForRematchResponse(true);
      rematchSendingRef.current = true;

      // Yeni hook ile rematch gönder
      const currentGameType: "timed" | "score" = currentRoom?.game_mode?.includes("score") ? "score" : "timed";
      console.log("🎮 Mevcut oyun türü:", currentGameType, "game_mode:", currentRoom?.game_mode);

      const success = await sendRematchContext(
        opponentId,
        currentGameType,
        currentRoom?.game_mode || "private-room-timed",
      );

      if (!success) {
        setRematchRequested(false);
        setWaitingForRematchResponse(false);
        setRematchSentOnce(false); // gönderim başarısız: tekrar denenebilir
        rematchSendingRef.current = false;
        disconnectHandledRef.current = false;
      }
    } catch (error) {
      console.error("Rematch request error:", error);
      setRematchRequested(false);
      setWaitingForRematchResponse(false);
      rematchSendingRef.current = false;
      disconnectHandledRef.current = false;
      toast({
        title: "Hata",
        description: "Tekrar oyun isteği gönderilemedi.",
        variant: "destructive",
      });
    }
  };

  // 🔒 PRODUCTION-READY: Merkezi countdown başlatma fonksiyonu
  // Bu fonksiyon countdown'ın sadece BİR KERE başlatılmasını garanti eder
  // Birden fazla trigger (real-time subscription, initial load, event) olsa bile
  // countdown asla reset edilmez
  // 🎯 Buffer animasyonları dahil: 3.5s preparing + 0.5s ready + 1s blank = 5s total
  // GamePage.tsx içinde initiateCountdown fonksiyonunu bul ve bununla değiştir:

  // 🔒 Countdown zamanlayıcılarını temizlemek için ref
  const countdownTimersRef = useRef<NodeJS.Timeout[]>([]);

  const initiateCountdown = useCallback(
    (countdownStartedAt: string, skipBuffer: boolean = false, force: boolean = false) => {
      // 🔧 FIX: Server time hazır değilse countdown başlatma - yanlış timing önleme
      if (!contextServerTimeReady && !force) {
        console.log("⏱️ Server time henüz hazır değil, countdown erteleniyor...");
        // Server time hazır olunca tekrar dene
        setTimeout(() => {
          if (isMountedRef.current && contextServerTimeReady) {
            initiateCountdown(countdownStartedAt, skipBuffer, true);
          }
        }, 500);
        return false;
      }

      if (gameStarted && !force) {
        console.log("⏱️ Oyun zaten başladı, countdown atlandı");
        return false;
      }

      // 🔒 KRİTİK: Aynı timestamp zaten işlendiyse KESINLIKLE atla
      // Bu, countdown'ın 5'ten tekrar başlamasını önler
      if (processedCountdownRef.current === countdownStartedAt) {
        console.log("⏱️ Bu countdown zaten işlendi, KESINLIKLE atlanıyor:", countdownStartedAt);
        return false;
      }

      // 🔒 GUARD: Görsel countdown zaten gösteriliyorsa yeni timestamp'i YOKSAY
      // Bu, realtime event'lerin countdown'ı resetlemesini önler
      if (showCountdown) {
        console.log("⏱️ Görsel countdown zaten aktif, yeni timestamp yoksayılıyor");
        return false;
      }

      // 🔧 FIX: Farklı bir timestamp gelirse VE henüz countdown başlamamışsa
      if (countdownInitiatedRef.current && processedCountdownRef.current !== countdownStartedAt) {
        console.log("⚠️ Farklı countdown timestamp geldi ama countdown zaten init edilmiş, ATLANYOR:", {
          eski: processedCountdownRef.current,
          yeni: countdownStartedAt,
        });
        return false; // 🔒 RESET YAPMA - mevcut countdown devam etsin
      }

      console.log("⏱️ Countdown başlatılıyor:", countdownStartedAt, "skipBuffer:", skipBuffer);

      // 🔒 Eski zamanlayıcıları temizle
      countdownTimersRef.current.forEach((t) => clearTimeout(t));
      countdownTimersRef.current = [];

      // Flag'i işaretle
      countdownInitiatedRef.current = true;
      processedCountdownRef.current = countdownStartedAt;

      // 🎯 KRİTİK: Yeni zamanlama sistemi
      // countdown_started_at = buffer animasyonlarının başlaması gereken zaman (2s idle bekleme SONRASI)
      // IDLE: 0-2s (zaten geçmiş - countdown_started_at 2s sonrasına set edildi)
      // BUFFER: 0-5s (Preparing 3.5s + Ready 1.5s)
      // COUNTDOWN: 5-10s (5-4-3-2-1)
      // TOPLAM: 2s idle + 5s buffer + 5s countdown = 12s
      const countdownStartTime = new Date(countdownStartedAt).getTime();
      const BUFFER_MS = 5000; // 5 saniyelik buffer (preparing -> ready)
      const COUNTDOWN_DURATION_MS = 5000; // 5 saniyelik geri sayım
      const actualCountdownStart = countdownStartTime + BUFFER_MS;
      const countdownEndTime = actualCountdownStart + COUNTDOWN_DURATION_MS;

      const now = Date.now() + serverTimeOffset;
      const msUntilBufferStart = countdownStartTime - now; // countdown_started_at'a kadar olan süre
      const msElapsedSinceStart = now - countdownStartTime;
      const msUntilCountdown = actualCountdownStart - now;
      const msUntilGameStart = countdownEndTime - now;

      console.log("⏱️ Countdown timing (YENİ SİSTEM):", {
        countdownStartedAt,
        countdownStartTime: new Date(countdownStartTime).toISOString(),
        actualCountdownStart: new Date(actualCountdownStart).toISOString(),
        countdownEndTime: new Date(countdownEndTime).toISOString(),
        now: new Date(now).toISOString(),
        msUntilBufferStart,
        msElapsedSinceStart,
        msUntilCountdown,
        msUntilGameStart,
        skipBuffer,
      });

      // 🎯 SENARYO 0: Buffer henüz başlamadı (2s idle bekleme süresi içindeyiz)
      // Bu durumda countdown_started_at gelecekte, beklememiz gerekiyor
      if (msUntilBufferStart > 0) {
        console.log("⏳ IDLE BEKLEME: Buffer henüz başlamadı, bekleniyor...", msUntilBufferStart, "ms");

        // 2s idle bekleme süresi bitince buffer'ı başlat
        const idleTimer = setTimeout(() => {
          if (isMountedRef.current) {
            console.log("✅ IDLE bekleme bitti - Buffer animasyonları başlıyor");
            setPreparingOpponent("preparing");
          }
        }, msUntilBufferStart);
        countdownTimersRef.current.push(idleTimer);

        // Preparing -> Ready geçişi (3.5s preparing süresi sonra)
        const readyTimer = setTimeout(() => {
          if (isMountedRef.current) {
            console.log("🎯 Oyuncu Hazır gösteriliyor");
            setPreparingOpponent("ready");
          }
        }, msUntilBufferStart + 3500); // 3.5s preparing
        countdownTimersRef.current.push(readyTimer);

        // Buffer bitince countdown başlat
        // 🔧 KRİTİK: countdownServerTime = ŞU AN + kalan süre (countdown başlayacağı an)
        // GameCountdown bu zamanı alıp 5 saniye sonrasını countdownEnd olarak hesaplayacak
        const countdownTimer = setTimeout(() => {
          if (isMountedRef.current) {
            console.log("🏆 Buffer bitti - 5-4-3-2-1 Countdown başlıyor");
            setPreparingOpponent(null);
            // 🔧 FIX: Her cihazda aynı mutlak sunucu zamanını kullan - senkronizasyon kaymasını önle
            setCountdownServerTime(new Date(actualCountdownStart).toISOString());
            setShowCountdown(true);
          }
        }, msUntilCountdown);
        countdownTimersRef.current.push(countdownTimer);

        return true;
      }

      // 🎯 SENARYO 1: Countdown tamamen bitmişse direkt oyunu başlat
      if (msUntilGameStart <= 0) {
        console.log("⚡ Countdown tamamen bitmiş, direkt oyun başlatılıyor:", {
          now: new Date(now).toISOString(),
          countdownEndTime: new Date(countdownEndTime).toISOString(),
        });
        setPreparingOpponent(null);
        setShowCountdown(false);
        setGameStarted(true);
        gameStartedRef.current = true;
        gameHasStartedRef.current = true;
        return true;
      }

      // 🎯 SENARYO 1.5: Geç katılım / geç room sync
      // Buffer geçmişse hazırlık animasyonlarını TEKRAR oynatmak yerine
      // doğrudan aktif countdown fazına sunucu zamanıyla senkron gir.
      if (skipBuffer && msUntilCountdown <= 0) {
        console.log("⚡ Buffer replay atlandı - aktif countdown fazına senkron giriş:", {
          now: new Date(now).toISOString(),
          actualCountdownStart: new Date(actualCountdownStart).toISOString(),
          msUntilCountdown,
          msUntilGameStart,
        });

        setPreparingOpponent(null);
        setCountdownServerTime(new Date(actualCountdownStart).toISOString());
        setShowCountdown(true);
        return true;
      }

      // 🔧 KRİTİK: Buffer animasyonları her zaman gösterilmeli
      // skipBuffer parametresini YOKSAY - oyuncular neyi beklediklerini bilmeli

      // 🎯 SENARYO 2: Buffer süresi GEÇSE BİLE minimum buffer göster
      const MIN_PREPARING_SHOW_MS = 1500; // Minimum "Hazırlanıyor" süresi
      const MIN_READY_SHOW_MS = 1000; // Minimum "Hazır" süresi
      const MIN_BUFFER_TOTAL_MS = MIN_PREPARING_SHOW_MS + MIN_READY_SHOW_MS; // 2.5s

      if (msUntilCountdown <= 0) {
        // 🔧 FIX: Buffer geçmiş - minimum buffer göster ama countdown'da SUNUCU ZAMANI kullan
        // Her cihaz aynı actualCountdownStart'ı kullanarak senkronize kalır
        // GameCountdown'ın MIN_DISPLAY_MS mekanizması geç mount'ları ele alır

        console.log("🎯 Buffer süresi geçmiş ama MİNİMUM buffer gösteriliyor:", {
          msUntilCountdown,
          actualCountdownStart: new Date(actualCountdownStart).toISOString(),
          now: new Date(now).toISOString(),
        });

        // 🔒 KRİTİK: Önce "Hazırlanıyor..." göster
        setPreparingOpponent("preparing");

        // Sonra "Hazır" göster
        const readyTimer = setTimeout(() => {
          if (isMountedRef.current) {
            console.log("🎯 Minimum buffer: Oyuncu Hazır gösteriliyor");
            setPreparingOpponent("ready");
          }
        }, MIN_PREPARING_SHOW_MS);
        countdownTimersRef.current.push(readyTimer);

        // Son olarak countdown başlat
        const countdownTimer = setTimeout(() => {
          if (isMountedRef.current) {
            console.log("🏆 Minimum buffer tamamlandı - 5-4-3-2-1 Countdown başlıyor");
            setPreparingOpponent(null);
            // 🔧 SYNC FIX: Sunucunun mutlak zamanını kullan - tüm cihazlar aynı anchor
            // GameCountdown MIN_DISPLAY_MS ile geç mount'larda bile sayıları atlamaz
            setCountdownServerTime(new Date(actualCountdownStart).toISOString());
            setShowCountdown(true);
          }
        }, MIN_BUFFER_TOTAL_MS);
        countdownTimersRef.current.push(countdownTimer);

        return true;
      }

      // 🎯 SENARYO 3: Buffer süresi içindeyiz - normal akış
      // Buffer animasyonlarını göster (Hazırlanıyor -> Hazır)
      // Countdown'u buffer bitince başlat

      console.log("⏰ Buffer süresi içinde:", {
        msElapsedSinceStart,
        msUntilCountdown,
        kalan: `${Math.ceil(msUntilCountdown / 1000)} saniye`,
      });

      // 🎯 Buffer animasyonlarını göster
      // İlk 3.5 saniye: "Hazırlanıyor..."
      // Son 1.5 saniye: "Hazır!"
      const PREPARING_DURATION = 3500;
      const READY_DURATION = 1500;

      if (msElapsedSinceStart < PREPARING_DURATION) {
        // Henüz "Hazırlanıyor" süresi içindeyiz
        const remainingPreparing = PREPARING_DURATION - msElapsedSinceStart;
        console.log("🎯 'Hazırlanıyor...' gösteriliyor, kalan:", remainingPreparing, "ms");
        setPreparingOpponent("preparing");

        // "Hazır" gösterme zamanı
        const readyTimer = setTimeout(() => {
          if (isMountedRef.current) {
            console.log("🎯 Oyuncu Hazır gösteriliyor");
            setPreparingOpponent("ready");
          }
        }, remainingPreparing);
        countdownTimersRef.current.push(readyTimer);
      } else if (msElapsedSinceStart < BUFFER_MS) {
        // "Hazır" süresi içindeyiz
        console.log("🎯 Oyuncu Hazır gösteriliyor (geç katılım)");
        setPreparingOpponent("ready");
      }

      // 🎯 Buffer bitince countdown başlat
      const countdownTimer = setTimeout(() => {
        if (isMountedRef.current) {
          console.log("🏆 Buffer bitti - 5-4-3-2-1 Countdown başlıyor");
          // Önce buffer animasyonunu kapat
          setPreparingOpponent(null);
          // 🔧 FIX: Mutlak sunucu zamanı kullan - cihazlar arası senkronizasyon
          setCountdownServerTime(new Date(actualCountdownStart).toISOString());
          setShowCountdown(true);
        }
      }, msUntilCountdown);
      countdownTimersRef.current.push(countdownTimer);
      return true;
    },
    [gameStarted, serverTimeOffset, showCountdown, contextServerTimeReady],
  );

  // 4. resetGameForRematch fonksiyonunu ekleyin:
  const resetGameForRematch = () => {
    console.log("🔄 resetGameForRematch: Başlatılıyor");

    roomSessionRef.current += 1;
    if (pendingEndGameTimeoutRef.current) {
      clearTimeout(pendingEndGameTimeoutRef.current);
      pendingEndGameTimeoutRef.current = null;
      console.log("✅ Pending endGame timeout cleared for rematch");
    }
    if (gameEndFinalizeTimeoutRef.current) {
      clearTimeout(gameEndFinalizeTimeoutRef.current);
      gameEndFinalizeTimeoutRef.current = null;
      console.log("✅ Finalize timeout cleared for rematch");
    }

    // Clear existing timers and intervals
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      console.log("✅ Main timer cleared for rematch");
    }

    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
      console.log("✅ Sync interval cleared for rematch");
    }

    // 🔒 Countdown zamanlayıcılarını temizle
    countdownTimersRef.current.forEach((t) => clearTimeout(t));
    countdownTimersRef.current = [];

    // Reset server time tracking
    serverMatchStartRef.current = null;
    countdownCompletedAtRef.current = null;
    startedAtRef.current = null;
    endsAtTimestampRef.current = null; // 🔒 KRİTİK: Timer'ın tekrar init olabilmesi için

    // ⚠️ KRİTİK: Optimistic update flag'ini sıfırla
    setIsMatchFinishing(false);

    // Disconnect kontrolü yeniden aktif et
    disconnectHandledRef.current = false;
    countdownCheckDoneRef.current = false; // Countdown kontrolünü sıfırla

    // Oyunu sıfırla
    setGameGrid(generateRandomGrid());
    setSelectedLetters([]);
    // currentWord artık derived value, manuel set'e gerek yok
    setUsedWords(new Set());
    setGlobalUsedWords(new Set());
    setPlayerWords([]);
    setOpponentWords([]);
    setPlayerWordsWithScores([]);
    setOpponentWordsWithScores([]);
    setPlayerScore(0);
    setOpponentScore(0);
    timeLeftRef.current = gameType === "timed" ? 120 : 0;
    setDisplayTime(timeLeftRef.current);
    // Countdown, server zamanıyla veya vs-computer'da local zamanla başlatılacak
    setCountdownServerTime(null);
    setShowCountdown(false);
    countdownInitiatedRef.current = false; // 🔒 Rematch için countdown guard'ı sıfırla
    processedCountdownRef.current = null; // 🔒 Rematch için işlenmiş countdown'ı sıfırla
    roomVersionRef.current = null; // 🔢 Yeni oda için version takibini sıfırla
    setGameStarted(false);
    setGameEnded(false);
    jokerUsedInMatchRef.current = false;
    setHintEvent({ id: 0, text: "" });
    preLevelRef.current = 0;
    preScoreRef.current = null;
    levelUpCheckedRef.current = false;
    gameEndedRef.current = false; // 🔒 Reset ref too
    gameStartedRef.current = false; // Arka plan disconnect kontrolü için sıfırla
    gameHasStartedRef.current = false; // 🔒 KRİTİK: Bu ref sıfırlanmazsa handleCountdownComplete çalışmaz!
    setWinner(null);
    setShowResults(false); // ⚠️ KRİTİK: Skor kartını kapat
    setTimeWarningPlayed(false);
    setRematchRequested(false);
    setWaitingForRematchResponse(false);
    setRematchSentOnce(false);
    setFinalPlayerScore(0);
    setFinalOpponentScore(0);
    // Joker state'leri artık hook'tan geldiği için sıfırlama yok
    setSelectedJoker(null);
    setHighlightedLetters([]);
    setIsJokerActive(false);
    comboCountRef.current = 0;
    setComboEvent({ id: 0, count: 0 });
    setBonusEvent({ id: 0, amount: 0 });
    setComboResetId((prev) => prev + 1);

    // Room'daki used words'ü temizle
    if (currentRoom) {
      supabase.from("game_words").delete().eq("room_id", currentRoom.id);
    }
  };

  const createNextRoundMatches = async (tournamentId: string, nextRound: number) => {
    try {
      console.log(`🏆 ${nextRound}. tur maçları oluşturuluyor...`);

      // Eğer bu tur için maçlar zaten oluşturulduysa tekrar oluşturma
      const { data: existing } = await supabase
        .from("tournament_matches")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("round", nextRound);

      if (existing && existing.length > 0) {
        console.log(`⏭️ ${nextRound}. tur için ${existing.length} maç zaten var, oluşturma atlandı.`);
        return;
      }

      // Önceki turun kazananlarını al
      const { data: winners } = await supabase
        .from("tournament_matches")
        .select("winner_id")
        .eq("tournament_id", tournamentId)
        .eq("round", nextRound - 1)
        .eq("status", "completed")
        .not("winner_id", "is", null);

      if (!winners || winners.length === 0) {
        console.error("Kazanan bulunamadı");
        return;
      }

      // Kazananları karıştır
      const winnerIds = winners.map((w) => w.winner_id);
      const shuffledWinners = [...winnerIds].sort(() => Math.random() - 0.5);

      // Yeni tur maçlarını oluştur
      const newMatches = [];
      for (let i = 0; i < shuffledWinners.length / 2; i++) {
        const player1Id = shuffledWinners[i * 2];
        const player2Id = shuffledWinners[i * 2 + 1];

        newMatches.push({
          tournament_id: tournamentId,
          round: nextRound,
          match_number: i + 1,
          player1_id: player1Id,
          player2_id: player2Id,
          status: "pending",
          created_at: new Date().toISOString(),
        });
      }

      // Database'e kaydet
      const { error } = await supabase.from("tournament_matches").insert(newMatches);

      if (error) {
        console.error("Yeni tur maçları kaydedilemedi:", error);
        return;
      }

      console.log(`✅ ${nextRound}. tur için ${newMatches.length} maç oluşturuldu`);

      // Turnuva bilgisini güncelle
      await supabase
        .from("tournaments")
        .update({
          current_round: nextRound,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tournamentId);
    } catch (error) {
      console.error("createNextRoundMatches hatası:", error);
    }
  };

  const checkNextRoundCreation = async (tournamentId: string) => {
    try {
      // Bu turdaki tüm maçlar bitti mi kontrol et
      const { data: remainingMatches } = await supabase
        .from("tournament_matches")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("status", "pending")
        .limit(1);

      if (remainingMatches && remainingMatches.length === 0) {
        console.log("🏆 Turdaki tüm maçlar bitti, sonraki tur oluşturuluyor...");

        // Kazananları al
        const { data: winners } = await supabase
          .from("tournament_matches")
          .select("winner_id, round")
          .eq("tournament_id", tournamentId)
          .eq("status", "completed")
          .order("round", { ascending: false });

        if (winners && winners.length > 1) {
          const currentRound = Math.max(...winners.map((w) => w.round));
          const nextRound = currentRound + 1;

          if (nextRound <= 3) {
            // Final'e kadar
            await createNextRoundMatches(tournamentId, nextRound);
          }
        }
      }
    } catch (error) {
      console.error("Sonraki tur kontrol hatası:", error);
    }
  };

  const checkAndCreateNextRound = async (tournamentId: string) => {
    try {
      // Mevcut turdaki tüm maçlar tamamlandı mı?
      const { data: incompleteMatches } = await supabase
        .from("tournament_matches")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("status", "pending")
        .limit(1);

      if (incompleteMatches.length === 0) {
        // Bir sonraki turu başlat
        const { data: currentRound } = await supabase
          .from("tournament_matches")
          .select("round")
          .eq("tournament_id", tournamentId)
          .order("round", { ascending: false })
          .limit(1);

        const nextRound = currentRound[0].round + 1;

        if (nextRound <= 3) {
          // Finale kadar
          await createTournamentMatches(tournamentId, nextRound);
        } else {
          // Turnuvayı tamamla
          await supabase
            .from("tournaments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", tournamentId);
        }
      }
    } catch (error) {
      console.error("Sonraki tur kontrol hatası:", error);
    }
  };

  const createTournamentMatches = async (tournamentId: string, round: number) => {
    try {
      // Katılımcıları al
      const { data: participants } = await supabase
        .from("tournament_participants")
        .select("user_id")
        .eq("tournament_id", tournamentId);

      if (!participants) return;

      // Rastgele sırala
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      const matchCount = shuffled.length / 2;

      // Maçları oluştur
      for (let i = 0; i < matchCount; i++) {
        await supabase.from("tournament_matches").insert({
          tournament_id: tournamentId,
          round: round,
          match_number: i + 1,
          player1_id: shuffled[i * 2].user_id,
          player2_id: shuffled[i * 2 + 1].user_id,
          status: "pending",
        } as any);
      }
    } catch (error) {
      console.error("Maç oluşturma hatası:", error);
    }
  };

  const completeBotMatches = async (tournamentId: string, round: number) => {
    try {
      console.log(`Bot maçları tamamlanıyor - Round ${round}`);

      const { data: botMatches } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round", round)
        .eq("status", "pending");

      for (const match of botMatches || []) {
        const isUserMatch = match.player1_id === user?.id || match.player2_id === user?.id;

        if (!isUserMatch) {
          const winner = Math.random() > 0.5 ? match.player1_id : match.player2_id;
          const winnerScore = Math.floor(Math.random() * 20) + 25; // 25-45
          const loserScore = Math.floor(Math.random() * 15) + 10; // 10-25

          await supabase
            .from("tournament_matches")
            .update({
              status: "completed",
              winner_id: winner,
              player1_score: winner === match.player1_id ? winnerScore : loserScore,
              player2_score: winner === match.player2_id ? winnerScore : loserScore,
              updated_at: new Date().toISOString(),
            })
            .eq("id", match.id);

          console.log(`Bot maçı tamamlandı: ${match.id}`);
        }
      }

      console.log(`Round ${round} bot maçları tamamlandı`);
    } catch (error) {
      console.error("Bot maçları tamamlama hatası:", error);
    }
  };

  // YENİ FONKSİYON: Turnuva bitiş kartını göster
  const showTournamentEndCard = async (
    isWinner: boolean,
    userScore: number,
    opponentScore: number,
    tournamentId: string,
  ) => {
    try {
      // Mevcut turu ve durumu kontrol et
      const { data: tournament } = await supabase
        .from("tournaments")
        .select("current_round, status")
        .eq("id", tournamentId)
        .single();

      if (!tournament) {
        navigate("/tournament");
        return;
      }

      let message = "";
      let buttonText = "Turnuva Sayfasına Dön";

      if (isWinner) {
        if (tournament.current_round === 1) {
          message = "🎉 Tebrikler! Yarı finale çıkmaya hak kazandınız.";
        } else if (tournament.current_round === 2) {
          message = "🔥 Muhteşem! Finale hak kazandınız.";
        } else if (tournament.current_round === 3) {
          message = "👑 Tebrikler! TURNUVA ŞAMPİYONU OLDUNUZ!";
          buttonText = "Ana Sayfaya Dön";
        }
      } else {
        message = "😢 Maalesef elendiniz.";
      }

      // Custom modal/toast göster
      const modalDiv = document.createElement("div");
      modalDiv.className = "fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4";
      modalDiv.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full text-center shadow-2xl">
        <div class="text-2xl mb-4">${isWinner ? "🏆" : "😢"}</div>
        <h3 class="text-lg font-bold mb-4">${message}</h3>
        <div class="text-sm text-gray-600 mb-6">
          Skor: ${userScore} - ${opponentScore}
        </div>
        <button id="tournament-btn" class="w-full bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded font-medium">
          ${buttonText}
        </button>
      </div>
    `;

      document.body.appendChild(modalDiv);

      // Button event listener
      const tournamentBtn = modalDiv.querySelector("#tournament-btn");

      if (tournamentBtn) {
        tournamentBtn.addEventListener("click", () => {
          document.body.removeChild(modalDiv);
          // Her durumda bracket sayfasına yönlendir - şampiyonluk kartı burada gösterilecek
          navigate(`/tournament/bracket/${tournamentId}`);
        });
      }

      // Otomatik yönlendirme (3 saniye sonra)
      setTimeout(() => {
        if (document.body.contains(modalDiv)) {
          document.body.removeChild(modalDiv);
        }
        // Her durumda bracket sayfasına yönlendir - şampiyonluk kartı burada gösterilecek
        navigate(`/tournament/bracket/${tournamentId}`);
      }, 3000);
    } catch (error) {
      console.error("❌ Turnuva bitiş kartı hatası:", error);
      navigate("/tournament");
    }
  };

  const updatePlayerStatistics = async (
    userId: string,
    gameScore: number,
    words: Array<{ word: string; score: number }>,
    isWinner: boolean,
  ) => {
    try {
      console.log("📊 Oyun istatistikleri güncelleniyor:", { userId, gameScore, words: words.length, isWinner });

      const gameDuration = gameType === "timed" ? 120 : Math.floor((Date.now() - gameStartTime) / 1000);

      console.log("📞 RPC çağrısı yapılıyor:", {
        p_user_id: userId,
        p_score: gameScore,
        p_words: words,
        p_is_winner: isWinner,
        p_game_duration: gameDuration,
      });

      const isTie = gameScore === opponentScoreRef.current;
      const multiplier = isWinner ? 10 : isTie ? 5 : 1; // Premium/boost sunucuda uygulanıyor
      const { data, error } = await (supabase.rpc as any)("update_game_stats", {
        p_user_id: userId,
        p_score: gameScore * multiplier,
        p_words: words,
        p_is_winner: isWinner,
        p_game_duration: gameDuration,
        p_first_word_time: firstWordTime,
        p_game_mode: gameMode,
      });

      console.log("📊 RPC sonucu:", { data, error });

      if (error) {
        console.error("❌ RPC hatası:", error);
      } else {
        console.log("✅ Oyun istatistikleri güncellendi");

        // Rank puanı güncelle - rastgele eşleşme ve özel oda
        if (
          gameMode === "random-match" ||
          (gameMode as string) === "random-match-timed" ||
          (gameMode as string) === "random-match-score" ||
          gameMode === "private-room"
        ) {
          const rpChange = isWinner ? 50 : isTie ? 10 : -30;
          const { data: currentProfile } = await supabase
            .from("profiles")
            .select("rank_points")
            .eq("id", userId)
            .single();
          const currentRP = (currentProfile as any)?.rank_points || 0;
          const newRP = Math.max(0, currentRP + rpChange);
          const oldTier = getRankTier(currentRP);
          const newTier = getRankTier(newRP);
          await supabase
            .from("profiles")
            .update({ rank_points: newRP } as any)
            .eq("id", userId);
          console.log(`🏅 Rank puanı güncellendi: ${currentRP} → ${newRP} (${rpChange > 0 ? "+" : ""}${rpChange} RP)`);
          // Rank tier değişimi kontrolü (yükselme)
          if (newTier.id !== oldTier.id && newRP > currentRP && newTier.id !== "cirak") {
            setRankUpTier(newTier);
            setTimeout(() => setShowRankUp(true), 2000);
          }
        }
      }
    } catch (error) {
      console.error("❌ İstatistik güncelleme hatası:", error);
    }
  };

  const checkBadges = async (userId: string, wordsCount?: number) => {
    try {
      console.log("🏆 Rozet kontrolü yapılıyor:", userId);

      // YENİ fonksiyon adını kullan - void döndürüyor artık
      const { error } = await supabase.rpc("check_and_award_badges_simple", {
        p_user_id: userId,
      });

      if (error) {
        console.error("❌ Rozet kontrolü hatası:", error);
      }

      console.log("✅ Rozet kontrolü tamamlandı");
    } catch (error) {
      console.error("❌ Rozet kontrolü hatası:", error);
    }
  };

  // Oyun biti fonksiyonunu güncelle
  const handleGameEnd = async () => {
    console.log("🏁 handleGameEnd çağrıldı!");
    console.log("🎮 gameMode:", gameMode, "tournamentMatch:", !!tournamentMatch);

    const finalUserScore = playerScoreRef.current;
    const finalOpponentScore = opponentScoreRef.current;

    // ✅ TURNUVA KONTROLÜ - tournamentMatch var mı?
    if (gameMode === "tournament" && tournamentMatch && user) {
      console.log("🏆 Tournament handleTournamentGameEnd çağrılacak!");

      // Hemen çağır
      handleTournamentGameEnd(finalUserScore, finalOpponentScore);
      return; // Erken çık
    }

    const resolvedWinner: "player" | "opponent" | "tie" =
      finalUserScore > finalOpponentScore ? "player" : finalUserScore < finalOpponentScore ? "opponent" : "tie";
    if (!winnerRef.current) {
      winnerRef.current = resolvedWinner;
      setWinner(resolvedWinner);
      playEndResultSoundOnce(resolvedWinner);
      setButtonsEnabled(false);
      setTimeout(() => setButtonsEnabled(true), 1000);
      setFinalPlayerScore(finalUserScore);
      setFinalOpponentScore(finalOpponentScore);
    }

    // vs-computer modunda istatistik güncelle
    if (user) {
      if (statsUpdatedRef.current) {
        console.log("⏭️ Skipping duplicate stats update (handleGameEnd)");
      } else {
        statsUpdatedRef.current = true;
        const gameDuration = gameType === "timed" ? 120 : Math.floor((Date.now() - gameStartTime) / 1000);

        const isWinner = finalUserScore > finalOpponentScore;
        const isTie = finalUserScore === finalOpponentScore;

        // 🤖 Random-match'te bot rakip de olsa puanlar normal şekilde işlensin (liderlik + RP)
        {
          const scoreMultiplier = isWinner ? 5 : isTie ? 2 : 1; // Premium/boost sunucuda uygulanıyor
          const { error } = await (supabase.rpc as any)("update_game_stats", {
            p_user_id: user.id,
            p_score: finalUserScore * scoreMultiplier,
            p_words: playerWordsWithScores,
            p_is_winner: isWinner,
            p_game_duration: gameDuration,
            p_first_word_time: firstWordTime,
            p_game_mode: gameMode,
          });

          if (error) {
            console.error("İstatistik güncelleme hatası:", error);
          } else {
            console.log("İstatistikler güncellendi - gameMode:", gameMode);
            await forceRefreshProfile?.();
          }

          // Rank puanı güncelle - rastgele eşleşme ve özel oda
          if (
            gameMode === "random-match" ||
            (gameMode as string) === "random-match-timed" ||
            (gameMode as string) === "random-match-score" ||
            gameMode === "private-room"
          ) {
            const rpChange = isWinner ? 50 : isTie ? 10 : -30;
            const { data: currentProfile } = await supabase
              .from("profiles")
              .select("rank_points")
              .eq("id", user.id)
              .single();
            const currentRP = (currentProfile as any)?.rank_points || 0;
            const newRP = Math.max(0, currentRP + rpChange);
            const oldTier = getRankTier(currentRP);
            const newTier = getRankTier(newRP);
            await supabase
              .from("profiles")
              .update({ rank_points: newRP } as any)
              .eq("id", user.id);
            console.log(
              `🏅 Rank puanı güncellendi: ${currentRP} → ${newRP} (${rpChange > 0 ? "+" : ""}${rpChange} RP)`,
            );
            if (newTier.id !== oldTier.id && newRP > currentRP && newTier.id !== "cirak") {
              setRankUpTier(newTier);
              setTimeout(() => setShowRankUp(true), 2000);
            }
          }
        }
      }
    }

    // Normal oyun sonu
    setGameEnded(true);
    setShowResults(true);
  };

  // 🔧 5. GamePage.tsx - Turnuva modu rakip belirleme düzeltmesi
  useEffect(() => {
    if (gameMode === "tournament" && tournamentMatch) {
      const userIdString = String(user?.id);
      const opponentId =
        String(tournamentMatch.player1_id) === userIdString ? tournamentMatch.player2_id : tournamentMatch.player1_id;

      console.log("🎯 Turnuva rakip analizi:", {
        matchId: tournamentMatch.id,
        player1: String(tournamentMatch.player1_id).slice(-8),
        player2: String(tournamentMatch.player2_id).slice(-8),
        currentUser: userIdString.slice(-8),
        opponentId: String(opponentId).slice(-8),
      });

      if (!opponentId) {
        setIsAIOpponent(true);
        setOpponentName("Bekleniyor...");
      } else {
        const oppParticipant = participants.find((p) => String(p.user_id) === String(opponentId));
        const isBotById = String(opponentId).startsWith("bot_");
        const isBotByFlag = (oppParticipant as any)?.is_bot === true;
        if (isBotById || isBotByFlag) {
          setIsAIOpponent(true);
          const seed = Array.from(String(opponentId)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
          setOpponentName(generateBotName(seed));
        } else {
          setIsAIOpponent(false);
          if (oppParticipant && (oppParticipant as any).profiles?.username) {
            setOpponentName((oppParticipant as any).profiles.username);
          } else {
            setOpponentName("Turnuva Oyuncusu");
          }
        }
      }
    }
  }, [gameMode, tournamentMatch, user?.id, participants]);

  // Rakip ismini göster - turnuva için
  const getOpponentDisplayName = () => {
    if (gameMode === "tournament" && tournamentMatch) {
      const opponentId =
        tournamentMatch.player1_id === user?.id ? tournamentMatch.player2_id : tournamentMatch.player1_id;
      const opponentParticipant = participants.find((p) => String(p.user_id) === String(opponentId));
      const isBotOpponent = Boolean(opponentParticipant?.is_bot) || String(opponentId || "").startsWith("bot_");

      if (!opponentId || isBotOpponent) {
        const seed = Array.from(String(opponentId || "bot")).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        return opponentParticipant?.profiles?.username || generateBotName(seed);
      }

      // Eğer state'te belirlenmiş bir rakip adı varsa onu kullan
      if (opponentName && opponentName.trim().length > 0) {
        return opponentName;
      }

      // Participants yüklenmediyse fallback
      if (!participants || participants.length === 0) {
        return "Rakip";
      }

      const realOpponent = participants.find(
        (p) => String(p.user_id) === String(opponentId) && !p.is_bot && p.user_id !== null,
      );

      if (realOpponent && (realOpponent as any).profiles?.username) {
        return (realOpponent as any).profiles.username;
      }

      return "Turnuva Rakibi";
    }

    // Diğer modlar için fallback
    switch (gameMode) {
      case "vs-computer":
        return "Bilgisayar";
      case "private-room":
        return "Arkadaş";
      case "random-match":
        const botParticipant = participants.find((p) => p.is_bot === true);
        if (botParticipant) {
          return (
            currentBotIdentity?.name ||
            generateBotName(seedFromText(`${currentRoom?.id || ""}${botParticipant.id || ""}`))
          );
        }
        if (opponentName && opponentName !== "Rakip Aranıyor...") {
          return opponentName;
        }
        return "Rakip";
      default:
        return "AI Rakip";
    }
  };

  // Turnuva modunda geri dönüş engelle
  const handleBackToMenu = async () => {
    // Turnuva modunda özel çıkış dialog'u göster
    if (gameMode === "tournament") {
      setShowTournamentExitDialog(true);
      return;
    }

    // Diğer modlarda: oyun bitmediyse çıkış onay kartı göster (maç ekranı açılır açılmaz da)
    if (!gameEnded) {
      setShowExitDialog(true);
      return;
    }

    if (currentRoom) {
      await leaveRoom();
    }

    // Oyundan çıkarken matchmaking state'ini de temizle
    window.dispatchEvent(new CustomEvent("cleanupMatchmaking"));

    navigate(homeBackPath());
  };

  // Random match için grid'i URL'den al ve game room oluştur
  useEffect(() => {
    const initializeRandomMatch = async () => {
      if (gameMode !== "random-match") return;
      if (!user?.id) return;
      if (randomMatchInitRef.current) return;
      randomMatchInitRef.current = true;

      console.log("🎲 Random match initialization başlıyor");

      const roomId = searchParams.get("room");
      const type = searchParams.get("type") as "timed" | "score";

      console.log("📍 URL Parameters - room:", roomId, "type:", type);

      if (!roomId || !type) {
        console.error("❌ Random match için room ID veya type eksik", { roomId, type });
        navigate(homeBackPath());
        return;
      }

      try {
        // 🎮 Nakama match ID formatı kontrol et (UUID)
        const isNakamaMatch = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);

        if (isNakamaMatch) {
          console.log("🎮 Nakama match detected:", roomId);
          console.log("✅ Skipping Supabase matchmaking_rooms lookup");

          // Nakama match için direkt grid oluştur
          const gridToUse = generateRandomGrid();
          setGameGrid(gridToUse);

          // 🔥 ÖNEMLİ: joinRoom çağır ki participants yüklensin (küçük gecikmeli yeniden dene)
          console.log("🔗 Joining Nakama game room:", roomId);
          let success = false;
          for (let attempt = 1; attempt <= 20; attempt++) {
            success = await joinRoom(roomId);
            if (success) break;
            console.warn(`⏳ Join retry ${attempt}/20 - oda hazır değil olabilir`);
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          if (!success) {
            console.error("❌ Nakama room'a katılamadı (tüm denemeler başarısız)");
            toast({
              title: "Bağlantı Hatası",
              description: "Oyun odasına bağlanılamadı",
              variant: "destructive",
            });
            navigate(homeBackPath());
            return;
          }

          console.log("✅ Nakama room'a katıldı, participants yüklenecek");
          return; // Supabase matchmaking_rooms işlemlerini atla
        }

        // Eski Supabase sistemi için devam et
        console.log("📊 Supabase matchmaking room aranıyor:", roomId);

        const { data: matchmakingRoom, error: matchError } = await supabase
          .from("matchmaking_rooms")
          .select("*")
          .eq("id", roomId)
          .single();

        if (matchError || !matchmakingRoom) {
          console.error("❌ Matchmaking room bulunamadı:", matchError);
          toast({
            title: "Oda Hatası",
            description: "Eşleşme odasına ulaşılamadı",
            variant: "destructive",
          });
          navigate(homeBackPath());
          return;
        }

        console.log("✅ Matchmaking room bulundu:", matchmakingRoom.id);

        // Grid'i al
        let gridToUse: string[][] = generateRandomGrid();

        if (matchmakingRoom.room_data && typeof matchmakingRoom.room_data === "object") {
          const roomDataObj = matchmakingRoom.room_data as any;
          if (roomDataObj.game_grid && Array.isArray(roomDataObj.game_grid)) {
            console.log("📊 Matchmaking room grid alındı");

            const grid = [];
            for (let i = 0; i < 4; i++) {
              const row = [];
              for (let j = 0; j < 4; j++) {
                row.push(roomDataObj.game_grid[i * 4 + j] || "A");
              }
              grid.push(row);
            }
            gridToUse = grid;
          }
        }

        setGameGrid(gridToUse);

        // Game room oluştur veya bul
        const { data: existingRoom } = await supabase
          .from("game_rooms")
          .select("*")
          .eq("id", roomId)
          .eq("status", "waiting")
          .single();

        let gameRoomId = roomId;

        if (!existingRoom) {
          const flatGrid = gridToUse.flat();

          const { data: newRoom, error: createError } = await supabase
            .from("game_rooms")
            .insert({
              id: roomId,
              host_id: user.id,
              game_mode: type,
              status: "waiting",
              max_players: 2,
              time_limit: type === "timed" ? 120 : 0,
              max_score: type === "score" ? 100 : 0,
              current_grid: flatGrid,
            })
            .select()
            .single();

          if (createError) {
            console.error("❌ Game room oluşturulamadı:", createError);
            toast({
              title: "Oda Hatası",
              description: "Oyun odası oluşturulamadı",
              variant: "destructive",
            });
            navigate(homeBackPath());
            return;
          }

          console.log("✅ Game room oluşturuldu:", newRoom.id);
        }

        // Küçük gecikmeli yeniden dene (eventual consistency için)
        let success = false;
        for (let attempt = 1; attempt <= 6; attempt++) {
          success = await joinRoom(gameRoomId);
          if (success) break;
          console.warn(`⏳ Random match join retry ${attempt}/6`);
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        if (success) {
          console.log("✅ Random match room'a katıldı");
        } else {
          console.error("❌ Random match room'a katılamadı (tüm denemeler başarısız)");
          toast({
            title: "Bağlantı Hatası",
            description: "Oyun odasına bağlanılamadı",
            variant: "destructive",
          });
          navigate(homeBackPath());
        }
      } catch (error) {
        console.error("❌ Random match initialization hatası:", error);
        navigate(homeBackPath());
      }
    };

    initializeRandomMatch();
  }, [gameMode, user?.id, joinRoom, navigate, toast, setGameGrid, generateRandomGrid, searchParams]);

  // Initialize private room from URL params
  useEffect(() => {
    const init = async () => {
      if (gameMode !== "private-room") return;
      if (!user?.id) return;

      const roomParam = searchParams.get("room");
      const type = searchParams.get("type") as "timed" | "score";

      // Aynı oda için tekrar init etme, oda değiştiyse init'i tekrar çalıştır
      if (privateRoomInitRef.current && lastInitializedRoomRef.current === roomParam) return;
      privateRoomInitRef.current = true;
      lastInitializedRoomRef.current = roomParam || null;

      if (!roomParam || !type) {
        console.error("❌ Private room için room veya type eksik");
        navigate(homeBackPath());
        return;
      }

      // room param kod (room_code) olabilir; UUID değilse ID'yi lookup yap
      let roomId = roomParam;
      if (!isUuid(roomParam)) {
        const getIdByCode = async (code: string, attempts = 8, delayMs = 250): Promise<string | null> => {
          for (let i = 0; i < attempts; i++) {
            const { data } = await supabase.from("game_rooms").select("id").eq("room_code", code).maybeSingle();
            if (data?.id) return data.id;
            await new Promise((r) => setTimeout(r, delayMs));
          }
          return null;
        };
        const resolvedId = await getIdByCode(roomParam);
        if (!resolvedId) {
          toast({ title: "Bağlantı Hatası", description: "Oda bulunamadı", variant: "destructive" });
          navigate(homeBackPath());
          return;
        }
        roomId = resolvedId;
      }

      // Yeni oda açıldığında rematch ve disconnect bayraklarını temizle
      resetGameForRematch();
      setRematchRequested(false);
      setWaitingForRematchResponse(false);
      disconnectHandledRef.current = false;

      console.log("🎯 Loading private room data:", shortId(roomId));

      // Grid'i yükle
      const { data: roomData } = await supabase.from("game_rooms").select("current_grid").eq("id", roomId).single();

      if (roomData?.current_grid) {
        console.log("📊 Private room grid yüklendi");
        const grid = [];
        for (let i = 0; i < 4; i++) {
          const row = [];
          for (let j = 0; j < 4; j++) {
            row.push(roomData.current_grid[i * 4 + j] || "A");
          }
          grid.push(row);
        }
        setGameGrid(grid);
      }

      // Küçük gecikmeli yeniden dene
      let joined = false;
      for (let attempt = 1; attempt <= 20; attempt++) {
        joined = await joinRoom(roomId);
        if (joined) break;
        console.warn(`⏳ Join retry ${attempt}/20`);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (!joined) {
        toast({ title: "Bağlantı Hatası", description: "Oyun odasına bağlanılamadı", variant: "destructive" });
        navigate(homeBackPath());
        return;
      }

      // 🔒 REMATCH FIX: joinRoom sırasında countdown_started_at henüz set edilmemiş olabilir
      // (RPC henüz tamamlanmamış). Poll ile kontrol et ve currentRoom'u güncelle.
      if (!countdownInitiatedRef.current) {
        for (let poll = 0; poll < 15; poll++) {
          const { data: freshRoom } = await supabase
            .from("game_rooms")
            .select("countdown_started_at, status, player1_id, player2_id")
            .eq("id", roomId)
            .single();

          if (freshRoom?.countdown_started_at) {
            console.log("✅ Countdown detected via polling (attempt", poll + 1, "):", freshRoom.countdown_started_at);
            // GameContext currentRoom'u güncellemek için tekrar fetch et
            const { data: fullRoom } = await supabase.from("game_rooms").select("*").eq("id", roomId).single();
            if (fullRoom) {
              // joinRoom tekrar çağırarak currentRoom'u güncelle
              await joinRoom(roomId);
            }
            break;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    };
    init();
  }, [gameMode, user?.id, joinRoom, navigate, searchParams, toast, setGameGrid]);

  // Tournament match bilgisini al - SADECE gameMode 'tournament' ise
  useEffect(() => {
    const initializeTournamentMatch = async () => {
      // SADECE tournament modunda çalışsın
      if (gameMode !== "tournament") return;

      const urlParams = new URLSearchParams(window.location.search);
      const matchId = urlParams.get("match");
      const tournamentId = urlParams.get("tournament");

      console.log("🎯 URL parametreleri:", { matchId, tournamentId });

      if (matchId) {
        // 🛡️ TURNUVA MAÇI KORUMASI: Bu maç daha önce tamamlandıysa tekrar oynama
        const completedKey = `${STORAGE_KEYS.TOURNAMENT_MATCH_COMPLETED_PREFIX}${matchId}`;
        const completed = await nativeStorage.getItem(completedKey);
        if (completed) {
          const data = JSON.parse(completed);
          console.warn("⚠️ Bu turnuva maçı zaten tamamlanmış:", data);
          toast({
            title: "⚠️ Maç Zaten Bitti",
            description: "Bu maç daha önce tamamlandı. Lütfen bir sonraki tura geçin.",
            variant: "destructive",
          });
          setTimeout(() => navigate("/tournament"), 2000);
          return;
        }

        try {
          // Maç bilgilerini al
          const { data: matchData, error } = await supabase
            .from("tournament_matches")
            .select("*")
            .eq("id", matchId)
            .single();

          if (error) {
            console.error("Maç bilgisi alınamadı:", error);
            return;
          }

          if (matchData) {
            // Maç zaten completed ise tekrar oynama
            if (matchData.status === "completed") {
              console.warn("⛔ Bu maç zaten veritabanında 'completed' olarak işaretlenmiş.");
              toast({
                title: "Maç Tamamlandı",
                description: "Bu maç zaten oynandı. Turnuva sayfasına yönlendiriliyorsunuz.",
              });
              // Bracket sayfasına zorla yönlendir
              setTimeout(() => navigate(`/tournament/bracket/${tournamentId}`), 1000);
              return;
            }

            console.log("✅ Turnuva maçı yüklendi:", matchData.id);
            setTournamentMatch(matchData);

            // 🎯 Countdown mantığı satır 2831-2857'de (loadTournamentMatch useEffect'inde) idare ediliyor
            // Orada animasyonlarla birlikte düzgün başlatılacak

            // Maç durumunu güncelle
            await supabase
              .from("tournament_matches")
              .update({
                status: "pending", // pending olsun ki auto_start_countdown_finished_games fonksiyonu başlatsın
                updated_at: new Date().toISOString(),
              })
              .eq("id", matchId);
          }
        } catch (error) {
          console.error("Turnuva maçı başlatma hatası:", error);
        }
      } else if (tournamentId && user) {
        // Match ID yoksa, kullanıcının maçını bul
        console.log("🔍 Kullanıcı maçı aranıyor tournament için...");

        const { data: userMatch } = await supabase
          .from("tournament_matches")
          .select("*")
          .eq("tournament_id", tournamentId)
          .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
          .eq("status", "in_progress")
          .single();

        if (userMatch) {
          console.log("✅ Kullanıcı maçı bulundu:", userMatch.id);
          setTournamentMatch(userMatch);

          // URL'yi güncelle
          window.history.replaceState(null, "", `/game?match=${userMatch.id}&tournament=${tournamentId}`);
        }
      }
    };

    initializeTournamentMatch();
  }, [gameMode, user?.id]);

  // JOKER FONKSİYONLARI

  // 1. Değiştir Jokeri - 5 harf değiştir (3 sesli, 2 sessiz)
  const useDegisTirJoker = async () => {
    if (jokers.degistir <= 0 || isJokerActive || !gameStarted || gameEnded || showCountdown || !!preparingOpponent)
      return;

    playSpecialSound("/degistir.mp3");

    setIsJokerActive(true);
    setSelectedJoker("degistir");
    setGridSyncPaused(true);

    const vowels = ["A", "E", "İ", "I", "O", "U", "Ü", "Ö"];
    const consonants = [
      "B",
      "C",
      "Ç",
      "D",
      "F",
      "G",
      "Ğ",
      "H",
      "J",
      "K",
      "L",
      "M",
      "N",
      "P",
      "R",
      "S",
      "Ş",
      "T",
      "V",
      "Y",
      "Z",
    ];

    const newGrid = [...gameGrid.map((row) => [...row])];

    // Rastgele 5 pozisyon seç
    const positions: { row: number; col: number }[] = [];
    while (positions.length < 5) {
      const row = Math.floor(Math.random() * 4);
      const col = Math.floor(Math.random() * 4);
      if (!positions.some((p) => p.row === row && p.col === col)) {
        positions.push({ row, col });
      }
    }

    // İlk 3 pozisyona sesli harf
    for (let i = 0; i < 3; i++) {
      const randomVowel = vowels[Math.floor(Math.random() * vowels.length)];
      newGrid[positions[i].row][positions[i].col] = randomVowel;
    }

    // Son 2 pozisyona sessiz harf
    for (let i = 3; i < 5; i++) {
      const randomConsonant = consonants[Math.floor(Math.random() * consonants.length)];
      newGrid[positions[i].row][positions[i].col] = randomConsonant;
    }

    setHighlightedLetters(positions);
    setGameGrid(newGrid);

    // Input feedback göster
    showCustomToast("Değiştirme Yapılıyor", "", "green");

    // ⚠️ Server'a grid gönderme - sadece lokal değişiklik
    console.log("🎯 Değiştir jokeri - sadece lokal grid değişikliği");

    const jokerUsed = await useJoker("degistir");
    if (!jokerUsed) {
      console.error("❌ Değiştir joker kullanılamadı!");
      setIsJokerActive(false);
      setSelectedJoker(null);
      setGridSyncPaused(false);
      return;
    }
    jokerUsedInMatchRef.current = true;

    setTimeout(() => {
      setHighlightedLetters([]);
      setIsJokerActive(false);
      setSelectedJoker(null);
    }, 500);

    setSelectedLetters([]);
    // currentWord artık derived value, manuel set'e gerek yok
  };

  // 2. Fısılda Jokeri - Sözlükteki orijinal haliyle göster (çevirme yapma!)
  const useFisildaJoker = async () => {
    if (jokers.fisilida <= 0 || isJokerActive || !gameStarted || gameEnded || showCountdown || !!preparingOpponent)
      return;

    // ✅ HEMEN FEEDBACK VER
    playSpecialSound("/fisilda.mp3");
    triggerHapticFeedback?.();
    playSound("buttonClick");

    // ✅ BUTON ANİMASYONU İÇİN JOKER STATE'İNİ GÜNCELLE
    setSelectedJoker("fisilida");
    setIsJokerActive(true);

    const possibleWords = [
      "KEDİ",
      "MASA",
      "ARABA",
      "OKUL",
      "KİTAP",
      "DENİZ",
      "AĞAÇ",
      "ÇİÇEK",
      "DOSTLUK",
      "GÜNEŞ",
      "YILDIZ",
      "BULUT",
      "RÜZGAR",
      "ATEŞ",
      "TOPRAK",
      "SEVGİ",
      "MUTLULUK",
      "UMUT",
      "HAYAL",
      "RENKLER",
      "MÜZİK",
      "DANS",
      "ŞARKI",
      "OYUN",
      "SPOR",
      "FUTBOL",
      "BASKETBOL",
      "TENİS",
      "YÜZME",
      "KOŞU",
      "BİSİKLET",
      "YEMEK",
      "EKMEK",
      "PEYNİR",
      "DOMATES",
      "SALATA",
      "ÇORBA",
      "MEYVE",
      "ELMA",
      "ARMUT",
      "ÇİLEK",
      "KIRAZ",
      "ÜZÜM",
      "PORTAKAL",
      "MANGO",
      "SEBZE",
      "HAVUÇ",
      "PATLICAN",
      "BİBER",
      "SOĞAN",
      "SARIMSAK",
      "PATATES",
    ];

    const availableLetters = gameGrid.flat();
    const letterCount: { [key: string]: number } = {};

    availableLetters.forEach((letter) => {
      letterCount[letter] = (letterCount[letter] || 0) + 1;
    });

    // Önce wordlist'ten kontrol et (eğer yüklenmişse)
    let validWords = [];

    if (wordlistLoaded) {
      const wordArray = Array.from(wordlist).map((word) => word.toLocaleUpperCase("tr-TR").trim());
      validWords = wordArray.filter((word) => {
        if (usedWords.has(word)) return false;

        const wordLetterCount: { [key: string]: number } = {};
        for (const letter of word) {
          wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
        }

        for (const [letter, needed] of Object.entries(wordLetterCount)) {
          if ((letterCount[letter] || 0) < needed) {
            return false;
          }
        }
        return true;
      });
    } else {
      // Fallback: önceden tanımlı kelimeler
      validWords = possibleWords.filter((word) => {
        if (usedWords.has(word.toLocaleUpperCase("tr-TR"))) return false;

        const wordLetterCount: { [key: string]: number } = {};
        for (const letter of word) {
          wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
        }

        for (const [letter, needed] of Object.entries(wordLetterCount)) {
          if ((letterCount[letter] || 0) < needed) {
            return false;
          }
        }
        return true;
      });
    }

    if (validWords.length > 0) {
      // Kelime bulundu
      const selectedWord = validWords[Math.floor(Math.random() * validWords.length)];

      // Input feedback göster
      showCustomToast("Harfleri Takip Et", "", "green");

      // Kelime sırasına göre harfleri bul
      const wordPositions: { row: number; col: number }[] = [];
      const usedPositions: { row: number; col: number }[] = [];

      for (const letter of selectedWord) {
        let letterFound = false;
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 4; col++) {
            if (gameGrid[row][col] === letter && !usedPositions.some((p) => p.row === row && p.col === col)) {
              wordPositions.push({ row, col });
              usedPositions.push({ row, col });
              letterFound = true;
              break;
            }
          }
          if (letterFound) break;
        }
      }

      console.log(`💡 Fısılda: "${selectedWord}" kelimesi (sözlük hali) için ${wordPositions.length} pozisyon bulundu`);

      // Kelime sırasına göre harfleri sırayla yak (oyuncu animasyon sırasında tıklayabilir)
      setIsFisildaAnimating(true);
      for (let i = 0; i < wordPositions.length; i++) {
        setTimeout(() => {
          setHighlightedLetters([wordPositions[i]]);
          playSound("buttonClick");

          setTimeout(() => {
            setHighlightedLetters([]);
          }, 400);
        }, i * 500);
      }

      setTimeout(
        () => {
          setIsJokerActive(false);
          setIsFisildaAnimating(false);
          setSelectedJoker(null); // ✅ Buton animasyonunu kapat
        },
        wordPositions.length * 500 + 800,
      );

      // SADECE BAŞARILI DURUMDA JOKER SAYISINI AZALT
      const jokerUsed = await useJoker("fisilida");
      if (!jokerUsed) {
        console.error("❌ Fısılda joker kullanılamadı!");
        setIsJokerActive(false);
        setSelectedJoker(null); // ✅ Hata durumunda da temizle
        return;
      }
      jokerUsedInMatchRef.current = true;
    } else {
      // Kelime bulunamadı
      setIsJokerActive(false);
      setSelectedJoker(null); // ✅ Buton animasyonunu kapat

      toast({
        title: "💡 Fısılda Jokeri",
        description:
          "Şu an kulağına fısıldayacağım bir kelime aklıma gelmedi. Eğer değiştir jokeri ile yeni harfler alırsan belki bir şeyler bulabilirim! 🤔",
        duration: 4000,
      });
    }
  };

  // 3. Sen Yaz Jokeri - Otomatik kelime üret ve gönder
  const useSenYazJoker = async () => {
    if (jokers.senYaz <= 0 || isJokerActive || !gameStarted || gameEnded || showCountdown || !!preparingOpponent)
      return;

    playSpecialSound("/senyaz.mp3");

    setIsJokerActive(true);
    setSelectedJoker("senYaz");

    const possibleWords = [
      "KEDİ",
      "MASA",
      "ARABA",
      "OKUL",
      "KİTAP",
      "DENİZ",
      "AĞAÇ",
      "ÇİÇEK",
      "DOSTLUK",
      "GÜNEŞ",
      "YILDIZ",
      "BULUT",
      "RÜZGAR",
      "ATEŞ",
      "TOPRAK",
      "SEVGİ",
      "MUTLULUK",
      "UMUT",
      "HAYAL",
      "RENKLER",
      "MÜZİK",
      "DANS",
      "ŞARKI",
      "OYUN",
      "SPOR",
      "FUTBOL",
      "BASKETBOL",
      "TENİS",
      "YÜZME",
      "KOŞU",
      "BİSİKLET",
    ];

    const availableLetters = gameGrid.flat();
    const letterCount: { [key: string]: number } = {};

    availableLetters.forEach((letter) => {
      letterCount[letter] = (letterCount[letter] || 0) + 1;
    });

    // Önce wordlist'ten kontrol et (eğer yüklenmişse)
    let validWords = [];

    if (wordlistLoaded) {
      // Wordlist'ten mevcut harflerle yapılabilecek kelimeleri bul
      const wordArray = Array.from(wordlist);
      validWords = wordArray.filter((word) => {
        if (usedWords.has(word)) return false;

        const wordLetterCount: { [key: string]: number } = {};
        for (const letter of word) {
          wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
        }

        for (const [letter, needed] of Object.entries(wordLetterCount)) {
          if ((letterCount[letter] || 0) < needed) {
            return false;
          }
        }
        return true;
      });
    } else {
      // Fallback: önceden tanımlı kelimeler
      validWords = possibleWords.filter((word) => {
        if (usedWords.has(word.toLocaleUpperCase("tr-TR"))) return false;

        const wordLetterCount: { [key: string]: number } = {};
        for (const letter of word) {
          wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
        }

        for (const [letter, needed] of Object.entries(wordLetterCount)) {
          if ((letterCount[letter] || 0) < needed) {
            return false;
          }
        }
        return true;
      });
    }

    // ÖNCE KELİME VAR MI DİYE KONTROL ET
    if (validWords.length === 0) {
      // Kelime bulunamadı - joker sayısını AZALTMA!
      setIsJokerActive(false);
      setSelectedJoker(null);

      toast({
        title: "✍️ Sen Yaz Jokeri",
        description: "Düşünüyorum ama henüz bulamadım. İstersen harfleri değiştir öyle deneyelim! 🤯",
        duration: 4000,
      });

      return; // Fonksiyondan çık, joker azaltma
    }

    // Kelime var, şimdi işlemi dene
    const selectedWord = validWords[Math.floor(Math.random() * validWords.length)];
    const normalizedSelectedWord = selectedWord.toLocaleUpperCase("tr-TR");

    // ÇİFTE KONTROL: Bu kelime gerçekten kullanılmamış mı?
    if (usedWords.has(normalizedSelectedWord)) {
      console.log("⚠️ Sen Yaz Jokeri: Seçilen kelime zaten kullanılmış:", selectedWord);
      setIsJokerActive(false);
      setSelectedJoker(null);

      toast({
        title: "✍️ Sen Yaz Jokeri",
        description: "Düşünüyorum ama henüz bulamadım. İstersen harfleri değiştir öyle deneyelim! 🤯",
        duration: 4000,
      });

      return; // Fonksiyondan çık, joker azaltma
    }

    // Harflerin pozisyonlarını bul
    const wordPositions: { letter: string; row: number; col: number }[] = [];
    const usedPositions: { row: number; col: number }[] = [];
    let canFormWord = true;

    for (const letter of selectedWord) {
      let letterFound = false;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if (gameGrid[row][col] === letter && !usedPositions.some((p) => p.row === row && p.col === col)) {
            wordPositions.push({ letter, row, col });
            usedPositions.push({ row, col });
            letterFound = true;
            break;
          }
        }
        if (letterFound) break;
      }

      if (!letterFound) {
        canFormWord = false;
        break;
      }
    }

    // Eğer kelimeyi oluşturamıyorsak
    if (!canFormWord || wordPositions.length !== selectedWord.length) {
      console.log("⚠️ Sen Yaz Jokeri: Kelime ızgarada oluşturulamıyor:", selectedWord);
      setIsJokerActive(false);
      setSelectedJoker(null);

      toast({
        title: "✍️ Sen Yaz Jokeri",
        description: "Düşünüyorum ama henüz bulamadım. İstersen harfleri değiştir öyle deneyelim! 🤯",
        duration: 4000,
      });

      return; // Fonksiyondan çık, joker azaltma
    }

    // Harfleri sırayla ızgarada yak (highlight)
    // Tüm harfleri aynı anda yak
    const allPositions = wordPositions.map((p) => ({ row: p.row, col: p.col }));
    setHighlightedLetters(allPositions);
    playSound("buttonClick");

    setTimeout(() => {
      setHighlightedLetters([]);
    }, 600);

    // Input feedback göster - Sen Yaz kelimeyi yeşil olarak göster
    showCustomToast(normalizedSelectedWord, "", "green");

    const animationDelay = 800;
    setTimeout(async () => {
      let jokerSuccess = false;

      try {
        const normalizedWord = selectedWord.toLocaleUpperCase("tr-TR");

        // Son kontrol: Kelime hala kullanılmamış mı?
        if (!usedWords.has(normalizedWord)) {
          const result = validateWordLocal(selectedWord);

          if (result.isValid) {
            const newUsedWords = new Set([...usedWords, normalizedWord]);
            setUsedWords(newUsedWords);

            const newScore = playerScore + result.points;
            setPlayerScore(newScore);

            // Calculate first word time (in seconds)
            const wordTimestamp = Date.now();
            if (firstWordTime === null && gameStartTime > 0) {
              const timeToFirstWord = Math.floor((wordTimestamp - gameStartTime) / 1000);
              setFirstWordTime(timeToFirstWord);
              console.log("⚡ İlk kelime süresi:", timeToFirstWord, "saniye");
            }

            setPlayerWords((prev) => [...prev, selectedWord]);
            setPlayerWordsWithScores((prev) => [
              ...prev,
              { word: selectedWord, score: result.points, timestamp: wordTimestamp },
            ]);

            triggerWordEffects();

            if (currentRoom) {
              await updateScore(newScore);
            }

            jokerSuccess = true; // İşlem başarılı
            console.log("✅ Sen Yaz Jokeri başarılı:", selectedWord, "Puan:", result.points);
          } else {
            console.log("❌ Sen Yaz Jokeri: Kelime geçersiz:", selectedWord);
          }
        } else {
          console.log("❌ Sen Yaz Jokeri: Kelime zaten kullanılmış:", selectedWord);
        }
      } catch (error) {
        console.error("❌ Sen Yaz Jokeri hatası:", error);
      }

      // currentWord artık derived value, manuel set'e gerek yok
      setSelectedLetters([]);
      setIsJokerActive(false);
      setSelectedJoker(null);

      // SADECE GERÇEKTEN BAŞARILI OLDUĞUNDA JOKER SAYISINI AZALT
      if (jokerSuccess) {
        const jokerUsed = await useJoker("senYaz");
        if (jokerUsed) {
          jokerUsedInMatchRef.current = true;
          console.log("🎯 Sen Yaz Jokeri harcanı!");
        } else {
          console.error("❌ Sen Yaz joker kullanılamadı!");
        }
        console.log("🎯 Sen Yaz Jokeri harcanı!");
      } else {
        console.log("💾 Sen Yaz Jokeri korundu (işlem başarısız)!");
      }
    }, animationDelay);
  };
  // Sync grid with room data and fetch avatars
  useEffect(() => {
    const syncWithRoom = () => {
      if (!user) return;

      // Rakip bilgilerini al
      if ((gameMode === "private-room" || gameMode === "tournament") && participants.length >= 2) {
        const opponent = participants.find((p) => p.user_id !== user.id && !p.is_bot);

        if (opponent) {
          if ((opponent as any).profiles?.username) {
            setOpponentName((opponent as any).profiles.username);
          }
        }
      }
    };

    syncWithRoom();
  }, [participants, user, gameMode]);

  // 🎯 MP modlarında skoru participants'tan senkronize et (tek kaynak) - 0'a düşmeyi engelle
  useEffect(() => {
    if (gameMode !== "private-room" && gameMode !== "random-match") return;
    if (!user) return;

    const me = participants.find((p) => String(p.user_id) === String(user.id));
    const opp = participants.find((p) => p.user_id && String(p.user_id) !== String(user.id) && !p.is_bot);

    // 🛡️ Rakip skoru - SADECE geçerli ve artan bir skor varsa güncelle (0'a düşmeyi engelle)
    if (opp && typeof (opp as any).score === "number") {
      const newOppScore = (opp as any).score;
      // Oyun başladıysa ve yeni skor mevcut skordan küçükse güncelleme (reset dışında)
      if (gameStarted && newOppScore < opponentScore && opponentScore > 0) {
        console.log("⚠️ Rakip skoru düşüyor, güncelleme atlandı:", opponentScore, "-x->", newOppScore);
        return;
      }
      if (newOppScore !== opponentScore) {
        console.log("🎯 Participants sync -> opponent score:", opponentScore, "->", newOppScore);
        setOpponentScore(newOppScore);
      }
    }

    // 🛡️ Kendi skorunu da aynı mantıkla senkronize et
    if (me && typeof (me as any).score === "number") {
      const newMyScore = (me as any).score;
      if (gameStarted && newMyScore < playerScore && playerScore > 0) {
        console.log("⚠️ Kendi skorum düşüyor, güncelleme atlandı:", playerScore, "-x->", newMyScore);
        return;
      }
      if (newMyScore !== playerScore) {
        console.log("🎯 Participants sync -> player score:", playerScore, "->", newMyScore);
        setPlayerScore(newMyScore);
      }
    }
  }, [participants, gameMode, user?.id, gameStarted, opponentScore, playerScore]);

  // 🎯 MP skor yedeği: participant realtime event'i kaçarsa game_rooms skor kolonlarından senkronize et
  useEffect(() => {
    if (gameMode !== "private-room" && gameMode !== "random-match") return;
    if (!user?.id || !currentRoom?.id || !gameStarted) return;

    const isPlayer1 = currentRoom.player1_id === user.id;
    const isPlayer2 = currentRoom.player2_id === user.id;
    if (!isPlayer1 && !isPlayer2) return;

    const roomPlayerScore = isPlayer1 ? currentRoom.player1_score : currentRoom.player2_score;
    const roomOpponentScore = isPlayer1 ? currentRoom.player2_score : currentRoom.player1_score;

    if (typeof roomOpponentScore === "number") {
      setOpponentScore((prev) => {
        if (gameStarted && roomOpponentScore < prev && prev > 0) return prev;
        return roomOpponentScore !== prev ? roomOpponentScore : prev;
      });
    }

    if (typeof roomPlayerScore === "number") {
      setPlayerScore((prev) => (roomPlayerScore > prev ? roomPlayerScore : prev));
    }
  }, [
    gameMode,
    user?.id,
    currentRoom?.id,
    currentRoom?.player1_id,
    currentRoom?.player2_id,
    currentRoom?.player1_score,
    currentRoom?.player2_score,
    gameStarted,
  ]);

  // Load wordlist from public/wordlist.txt
  useEffect(() => {
    const loadWordlist = async () => {
      try {
        console.log("📖 Loading wordlist from public/wordlist.txt...");
        const response = await fetch("/wordlist.txt");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        const words = text
          .split("\n")
          .map((word) => word.trim().toLocaleUpperCase("tr-TR"))
          .filter((word) => word.length >= 3); // Minimum 3 harf

        const wordSet = new Set(words);
        setWordlist(wordSet);
        setWordlistLoaded(true);
        console.log(`✅ Wordlist loaded (TR): ${wordSet.size} words`);
      } catch (error) {
        console.error("❌ Failed to load wordlist:", error);
        setWordlistLoaded(false);
      }
    };

    loadWordlist();
  }, []);

  // Turkish locale uppercase helper
  const toTRUpper = (s: string): string => s.toLocaleUpperCase("tr-TR").trim();

  // Local word validation - Sözlükteki kelimeleri Türkçe'ye çevir
  const validateWordLocal = useCallback(
    (word: string): { isValid: boolean; points: number; message: string } => {
      const upperWord = toTRUpper(word);

      console.log("🔍 Word validation (exact TR match):", {
        originalWord: word,
        upperWord,
        globalUsedCount: globalUsedWords.size,
        isUsed: globalUsedWords.has(upperWord),
      });

      if (upperWord.length < 3) {
        return { isValid: false, points: 0, message: "Kelime en az 3 harf olmalıdır" };
      }

      const turkishPattern = /^[A-ZÇĞIİÖŞÜ]+$/;
      if (!turkishPattern.test(upperWord)) {
        return { isValid: false, points: 0, message: "Sadece Türkçe harfler kullanabilirsiniz" };
      }

      if (wordlistLoaded) {
        const wordExists = wordlist.has(upperWord);
        if (!wordExists) {
          return { isValid: false, points: 0, message: "Bu kelime sözlükte bulunamadı" };
        }
      } else {
        return { isValid: false, points: 0, message: "Sözlük yüklenemedi." };
      }

      const calculatePoints = (w: string): number => {
        // 🎯 MOD BAZLI PUANLAMA: vs-computer daha düşük, multiplayer daha yüksek
        let multiplier = 2; // vs-computer için default

        if (gameMode === "random-match" || gameMode === "private-room" || gameMode === "tournament") {
          multiplier = 3; // Multiplayer modlar için %50 daha fazla
        }

        const basePoints = w.length * multiplier;
        let rareLetterBonus = 0;
        const rareLetters = ["J", "Z", "Ğ", "Ü", "Ö", "Ç", "Ş"];
        for (const letter of w) {
          if (rareLetters.includes(letter)) rareLetterBonus += 3;
        }
        return Math.max(basePoints + rareLetterBonus, 5);
      };

      const points = calculatePoints(upperWord);

      return { isValid: true, points, message: "Geçerli kelime" };
    },
    [wordlist, wordlistLoaded, globalUsedWords],
  );

  useEffect(() => {
    const initializeGame = async () => {
      // 🎵 Arka plan müziği artık maça başlarken kapatılmıyor.
      // Oyuncu maç ekranındaki ses düğmesiyle isterse müziği de birlikte kapatabilir.

      console.log("GamePage isPremium:", isPremium, "gameMode:", gameMode);

      // Turnuva modunda kredi düşürme - katılırken zaten 3 hak düşürüldü
      if (gameMode === "tournament") {
        console.log("Tournament mode - credits already deducted on join, skipping");
        return;
      }

      // 🛡️ Aynı oda için kredi sadece bir kez düşürülsün (remount koruması)
      const roomKeyForCredit = searchParams.get("room") || currentRoom?.id || "";
      if (roomKeyForCredit) {
        const creditKey = `creditConsumed:${roomKeyForCredit}`;
        if (sessionStorage.getItem(creditKey) === "1") {
          console.log("Credit already consumed for this room, skipping");
          return;
        }
        sessionStorage.setItem(creditKey, "1");
      }

      if (!isPremium) {
        console.log("User is not premium, consuming credit...");
        const creditConsumed = await consumeCredit();
        console.log("Credit consumed result:", creditConsumed);
        if (!creditConsumed) {
          if (roomKeyForCredit) {
            sessionStorage.removeItem(`creditConsumed:${roomKeyForCredit}`);
          }
          toast({
            title: "Sayfaların tükendi",
            description: "Oyun oynamak için yeterli sayfan yok. Kırtasiyeden sayfa satın alabilirsiniz.",
            variant: "destructive",
          });
          navigate("/market");
          return;
        }
      } else {
        console.log("User is premium, skipping credit consumption");
      }
    };

    initializeGame();

    return () => {
      fadeInBackgroundMusic(1000);
    };
  }, []);

  // Load tournament match data from URL parameters
  useEffect(() => {
    const loadTournamentData = async () => {
      const tournamentId = searchParams.get("tournament");
      // Match ID path parametresinden veya query parametresinden gelebilir
      const matchId = urlMatchId || searchParams.get("match");

      if (!matchId || !user || gameMode !== "tournament") return;

      console.log("🏆 Loading tournament match data:", {
        tournamentId,
        matchId,
        source: urlMatchId ? "path" : "query",
      });

      try {
        // Load match data
        const { data: matchData } = await supabase.from("tournament_matches").select("*").eq("id", matchId).single();

        if (matchData) {
          console.log("🏆 Tournament match loaded:", matchData);

          // Tournament ID'yi match data'sından al (URL'de yoksa)
          const finalTournamentId = tournamentId || matchData.tournament_id;

          // ⚠️ KRİTİK: TAMAMLANMIŞ MAÇI TEKRAR BAŞLATMA - sessizce bracket'e dön
          if (matchData.status === "completed") {
            console.log("🚫 Bu maç zaten tamamlanmış, bracket sayfasına sessizce yönlendiriliyor:", matchData.id);
            // Toast gösterme - döngüyü kırmak için sessizce dön
            navigate(`/tournament/bracket/${finalTournamentId}`, {
              replace: true,
              state: { fromCompletedMatch: matchData.id },
            });
            return;
          }

          // ⚠️ KRİTİK: STRICT Status Listener - Maç tamamlandığında HEMEN yönlendir
          console.log("📡 Setting up STRICT match status listener for match:", matchId);
          const statusChannel = supabase
            .channel(`tournament-match-status-${matchId}`)
            .on(
              "postgres_changes",
              {
                event: "UPDATE",
                schema: "public",
                table: "tournament_matches",
                filter: `id=eq.${matchId}`,
              },
              (payload) => {
                console.log("📡 Match status update received:", payload.new);
                const newStatus = (payload.new as any)?.status;
                const completedMatchId = (payload.new as any)?.id;

                // 🚨 STRICT: Status 'completed' ise HEMEN unmount ve yönlendir
                if (newStatus === "completed") {
                  console.log("🚫 STRICT: Match status changed to COMPLETED - forcing unmount and redirect");

                  // 🔒 Bu maçı tamamlanmış olarak işaretle - tekrar oyun sayfası açılmasını önle
                  if (completedMatchId) {
                    const completedMatchKey = `${STORAGE_KEYS.TOURNAMENT_MATCH_COMPLETED_PREFIX}${completedMatchId}`;
                    nativeStorage.setItem(completedMatchKey, "true");
                    console.log("✅ Match marked as completed in storage:", completedMatchId);
                  }

                  // Optimistic flag set et
                  setIsMatchFinishing(true);

                  // Cache invalidate
                  queryClient.invalidateQueries({ queryKey: ["tournament_matches"] });
                  queryClient.invalidateQueries({ queryKey: ["active_match"] });

                  // ❌ DEVRE DIŞI: Listener kapat - bağlantı koruması
                  // supabase.removeChannel(statusChannel);
                  console.log("⚠️ [GamePage] Status channel cleanup ATLANYOR (bağlantı koruması)");

                  // HEMEN yönlendir - local state dinleme
                  setTimeout(() => {
                    navigate(`/tournament/bracket/${finalTournamentId}`, {
                      replace: true,
                      state: { fromCompletedMatch: completedMatchId },
                    });
                  }, 500);
                }
              },
            )
            .subscribe();

          setTournamentMatch(matchData);

          // 🎯 SERVER-SIDE COUNTDOWN SYNC - Merkezi fonksiyon kullan (random-match ile aynı mantık)
          if (matchData.countdown_started_at && !countdownInitiatedRef.current) {
            console.log("🎯 Tournament countdown başlatılıyor (initial load):", matchData.countdown_started_at);
            // 🔒 Orijinal timestamp'i geç - initiateCountdown içinde buffer hesaplanacak
            initiateCountdown(matchData.countdown_started_at);
          }
        }

        // Load tournament participants (profiles ayrı sorgu ile eklenecek)
        // Tournament ID'yi match data'sından alabildiğimiz için finalTournamentId kullan
        if (matchData?.tournament_id || tournamentId) {
          const finalTournamentId = tournamentId || matchData.tournament_id;

          const { data: participantsData } = await supabase
            .from("tournament_participants")
            .select("*")
            .eq("tournament_id", finalTournamentId);

          if (participantsData) {
            console.log("👥 Tournament participants loaded:", participantsData.length);

            // Profil bilgilerini ayrı çek (user_id text olduğu için FK yok)
            const userIds = participantsData
              .filter(
                (p) =>
                  !p.is_bot &&
                  p.user_id &&
                  /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(
                    String(p.user_id),
                  ),
              )
              .map((p) => String(p.user_id));

            let profileMap: Record<
              string,
              { username: string | null; avatar_url: string | null; premium_until: string | null }
            > = {};
            if (userIds.length > 0) {
              const { data: profilesData } = await supabase
                .from("profiles")
                .select("id, username, avatar_url, premium_until")
                .in("id", userIds);

              if (profilesData) {
                profilesData.forEach((pr) => {
                  profileMap[pr.id as string] = {
                    username: pr.username,
                    avatar_url: pr.avatar_url,
                    premium_until: (pr as any).premium_until ?? null,
                  };
                });
              }
            }

            if (matchData) {
              // Filter participants for this match ve profilleri ekle
              const matchParticipants = participantsData
                .filter((p) => p.user_id === matchData.player1_id || p.user_id === matchData.player2_id)
                .map((p) => ({
                  id: p.id,
                  room_id: searchParams.get("room"),
                  user_id: p.user_id,
                  score: 0,
                  joined_at: p.joined_at,
                  is_bot: p.is_bot,
                  profiles: p.user_id ? profileMap[String(p.user_id)] : undefined,
                }));

              console.log("🔄 Setting tournament participants:", matchParticipants.length);
              setTournamentParticipants(matchParticipants);
            }
          }
        }
      } catch (error) {
        console.error("❌ Error loading tournament data:", error);
      }
    };

    loadTournamentData();
  }, [gameMode, searchParams, user, urlMatchId]);

  // Load random match room data from URL parameters
  useEffect(() => {
    if (randomMatchInitRef.current) return;
    randomMatchInitRef.current = true;
    const loadRandomMatchData = async () => {
      const roomId = searchParams.get("room");

      if (!roomId || !user || gameMode !== "random-match") return;

      console.log("🎯 Loading random match room data:", roomId);

      try {
        // Önce game_rooms tablosunu kontrol et (özel odalar için)
        const { data: existingGameRoom } = await supabase
          .from("game_rooms")
          .select("*")
          .eq("id", roomId)
          .in("status", ["waiting", "active"])
          .maybeSingle();

        if (existingGameRoom) {
          console.log("🏠 Private/Game room found:", existingGameRoom.id);

          // Join existing room using GameContext function
          // Küçük gecikmeli yeniden dene
          let joined = false;
          for (let attempt = 1; attempt <= 20; attempt++) {
            joined = await joinRoom(roomId);
            if (joined) break;
            console.warn(`⏳ Existing room join retry ${attempt}/20`);
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
          if (!joined) {
            console.error("❌ Failed to join existing room (tüm denemeler başarısız)");
            toast({
              title: "Bağlantı Hatası",
              description: "Oyun odasına bağlanılamadı",
              variant: "destructive",
            });
            navigate(homeBackPath());
            return;
          }

          console.log("✅ Joined existing game room");
          return;
        }

        // Eğer game_rooms'da yoksa matchmaking_rooms'a bak
        const { data: matchmakingRoom } = await supabase
          .from("matchmaking_rooms")
          .select("*")
          .eq("id", roomId)
          .maybeSingle();

        if (!matchmakingRoom) {
          console.error("❌ Room not found in either table:", roomId);
          toast({
            title: "Hata",
            description: "Oyun odası bulunamadı",
            variant: "destructive",
          });
          navigate(homeBackPath());
          return;
        }

        console.log("🏠 Matchmaking room found:", matchmakingRoom);

        // Check if game room already exists for this matchmaking room
        const { data: existingRoom } = await supabase
          .from("game_rooms")
          .select("*")
          .eq("room_code", roomId)
          .in("status", ["waiting", "active"])
          .maybeSingle();

        if (existingRoom) {
          console.log("🏠 Existing game room found, joining:", existingRoom.id);

          // Join existing room using GameContext function
          const joined = await joinRoom(roomId);
          if (!joined) {
            console.error("❌ Failed to join existing room");
            navigate(homeBackPath());
            return;
          }
        } else {
          console.log("🏗️ Creating new game room...");
          const gameRoom = await createRoom(`random-match-${gameType}`, roomId);

          if (!gameRoom) {
            console.error("❌ Failed to create game room");
            navigate(homeBackPath());
            return;
          }

          console.log("✅ Game room created successfully");

          // Participants'ın yüklenmesini bekle
          let retries = 0;
          const maxRetries = 10;
          const checkParticipants = () => {
            if (participants.length >= 2) {
              console.log("✅ Participants loaded, game ready to start");
              return;
            }

            retries++;
            if (retries < maxRetries) {
              console.log(`⏳ Waiting for participants... (${retries}/${maxRetries})`);
              setTimeout(checkParticipants, 500);
            } else {
              console.log("⚠️ Timeout waiting for participants");
            }
          };

          checkParticipants();

          console.log("✅ Game room created:", gameRoom.id);
        }

        // Add AI opponent if needed (context will handle participant checking)
        setTimeout(async () => {
          // Resolve game room id reliably using room_code -> game_rooms lookup
          const { data: gameRoomRow } = await supabase
            .from("game_rooms")
            .select("id")
            .eq("room_code", roomId)
            .in("status", ["waiting", "active"])
            .maybeSingle();
          const resolvedRoomId = gameRoomRow?.id || currentRoom?.id || null;
          if (!resolvedRoomId) {
            console.warn("⚠️ Could not resolve game room id for participants check");
            return;
          }
          const { data: participants } = await supabase
            .from("game_participants")
            .select("*")
            .eq("room_id", resolvedRoomId);

          console.log("👥 Current participants after room setup:", participants?.length || 0);

          // Random-match'te bot ekleme - KALDIRILDI! Sadece gerçek oyuncular
          // if (participants && participants.length === 1) {
          //   console.log('🤖 Adding AI opponent...');
          //   await addAIOpponent();
          // }
        }, 1000);
      } catch (error) {
        console.error("❌ Error loading random match data:", error);
        navigate(homeBackPath());
      }
    };

    loadRandomMatchData();
  }, [gameMode, searchParams, user, createRoom, addAIOpponent, navigate, gameType]);

  // Check for winner and apply end game bonuses

  const checkWinnerWithScores = useCallback(
    async (currentPlayerScore: number, currentOpponentScore: number) => {
      // gameEnded state'i bazı akışlarda checkWinner çağrısından önce set ediliyor.
      // Bu durumda erken çıkmak skor/istatistik RPC'sini tamamen kaçırıyor.
      const existingWinner = winnerRef.current;

      let gameResult: "player" | "opponent" | "tie";
      // Skor çarpanı: Kazanma=x5, Beraberlik=x2, Kaybetme=x1
      let scoreMultiplier = 1;

      // Tournament: rely on backend for winner, avoid client-side decision
      if (gameMode === "tournament") {
        console.log("🏆 Tournament mode - winner is determined by backend; skipping local checkWinnerWithScores");
        return;
      }

      if (existingWinner) {
        gameResult = existingWinner;
        scoreMultiplier = gameResult === "player" ? 5 : gameResult === "tie" ? 2 : 1;
        console.log("🏆 Winner zaten handleGameEnd içinde belirlendi, cleanup akışı devam ediyor:", gameResult);
      } else if (gameMode === "vs-computer") {
        // Final winner determination - Multiplayer ve vs-computer için ayrı mantık
        // vs-computer için mevcut mantık
        // 🔊 Maç sonu sesi: setWinner çağrısı playEndResultSoundOnce effect'ini
        // tetikleyerek celebration/gameLose/tie sesini TEK seferde çalıyor.
        // Burada ayrıca playSound("gameWin") + playCelebrationSound çağrısı
        // native'de NativeAudio.stop+play çakışmasına yol açıp sesi susturuyordu.
        if (currentPlayerScore > currentOpponentScore) {
          gameResult = "player";
          scoreMultiplier = 5;
          setWinner("player");
          setButtonsEnabled(false);
          setTimeout(() => setButtonsEnabled(true), 1000);
          console.log("🏆 Player wins! Score:", currentPlayerScore, "vs", currentOpponentScore);
        } else if (currentPlayerScore < currentOpponentScore) {
          gameResult = "opponent";
          setWinner("opponent");
          setButtonsEnabled(false);
          setTimeout(() => setButtonsEnabled(true), 1000);
          console.log("🏆 Opponent wins! Score:", currentOpponentScore, "vs", currentPlayerScore);
        } else {
          gameResult = "tie";
          scoreMultiplier = 2;
          setWinner("tie");
          setButtonsEnabled(false);
          setTimeout(() => setButtonsEnabled(true), 1000);
          console.log("🏆 It's a tie! Both scores:", currentPlayerScore);
        }
      } else {
        // Multiplayer - currentPlayerScore ve currentOpponentScore kullan
        console.log("🏆 Multiplayer kazanan kontrolü:", {
          currentPlayerScore,
          currentOpponentScore,
          gameMode,
        });

        if (currentPlayerScore > currentOpponentScore) {
          gameResult = "player";
          scoreMultiplier = 5;
          setWinner("player");
          setButtonsEnabled(false);
          setTimeout(() => setButtonsEnabled(true), 1000);
          console.log("🏆 Player wins! Score:", currentPlayerScore, "vs", currentOpponentScore);
        } else if (currentPlayerScore < currentOpponentScore) {
          gameResult = "opponent";
          setWinner("opponent");
          setButtonsEnabled(false);
          setTimeout(() => setButtonsEnabled(true), 1000);
          console.log("🏆 Opponent wins! Score:", currentOpponentScore, "vs", currentPlayerScore);
        } else {
          // Beraberlik (tournament mode buraya gelmez, zaten backend'de handle edilir)
          gameResult = "tie";
          scoreMultiplier = 2;
          setWinner("tie");
          setButtonsEnabled(false);
          setTimeout(() => setButtonsEnabled(true), 1000);
          console.log("🏆 Tie! Both scores:", currentPlayerScore);
        }
      }

      // İstatistik güncelleme (turnuva buraya gelmeden erken çıkar; duplicate guard var)
      if (user) {
        if (statsUpdatedRef.current) {
          console.log("⏭️ Skipping duplicate stats update (effect)");
        } else {
          statsUpdatedRef.current = true;
          console.log("📊 checkWinnerWithScores - İstatistik güncelleniyor...");

          try {
            const gameDuration = gameType === "timed" ? 120 : Math.floor((Date.now() - gameStartTime) / 1000);

            // Mevcut update_game_stats imzası ile istatistikleri tek kaynaktan yaz
            const finalScoreMultiplier = scoreMultiplier; // Premium/boost sunucuda uygulanıyor
            const { data, error } = await (supabase.rpc as any)("update_game_stats", {
              p_user_id: user.id,
              p_score: currentPlayerScore * finalScoreMultiplier,
              p_words: playerWordsWithScores,
              p_is_winner: gameResult === "player",
              p_game_duration: gameDuration,
              p_first_word_time: firstWordTime,
              p_game_mode: gameMode,
            });

            if (error) {
              console.error("❌ İstatistik güncelleme hatası:", error);
            } else {
              console.log("✅ İstatistikler başarıyla güncellendi!");
              await forceRefreshProfile?.();
            }

            // ➕ En uzun kelime ve en yüksek puanlı kelime istatistiklerini (vs-computer) güncelle - RPC sonucu ne olursa olsun çalıştır
            try {
              const longest = playerWordsWithScores.reduce<{ word: string; score: number } | null>((acc, w) => {
                return !acc || w.word.length >= acc.word.length ? w : acc;
              }, null);
              const bestScore = playerWordsWithScores.reduce<{ word: string; score: number } | null>((acc, w) => {
                return !acc || w.score > acc.score ? w : acc;
              }, null);

              if (user && (longest || bestScore)) {
                const { data: cur } = await supabase
                  .from("profiles")
                  .select("longest_word_length, highest_word_score")
                  .eq("id", user.id)
                  .maybeSingle();

                const updates: Record<string, any> = {};
                if (longest) {
                  const len = longest.word.length;
                  if (!cur || (cur.longest_word_length ?? 0) <= len) {
                    updates.longest_word = longest.word;
                    updates.longest_word_length = len;
                  }
                }
                if (bestScore) {
                  if (!cur || (cur.highest_word_score ?? 0) < bestScore.score) {
                    updates.highest_word = bestScore.word;
                    updates.highest_word_score = bestScore.score;
                  }
                }

                if (Object.keys(updates).length > 0) {
                  await supabase.from("profiles").update(updates).eq("id", user.id);
                }
              }
            } catch (e) {
              console.warn("⚠️ Profil kelime istatistikleri güncellenemedi:", e);
            }

            // Rozet kontrolü
            setTimeout(() => {
              checkBadges(user.id, playerWordsWithScores.length);
            }, 500);
          } catch (error) {
            console.error("❌ İstatistik güncelleme hatası:", error);
          }
        }
      }

      // Skor çarpanı bilgisi toast
      if (user) {
        const baseLabel =
          gameResult === "player" ? "Kazanma (x5)" : gameResult === "tie" ? "Beraberlik (x2)" : "Mağlubiyet (x1)";
        const extras: string[] = [];
        if (isPremium) extras.push("VIP x2");
        if (hasScoreBoost) extras.push("Liderlik x2");
        const multiplierLabel = extras.length > 0 ? `${baseLabel} + ${extras.join(" + ")}` : baseLabel;
        const totalMult = 1 + (isPremium ? 1 : 0) + (hasScoreBoost ? 1 : 0);
        const finalScore = currentPlayerScore * scoreMultiplier * totalMult;
        setTimeout(() => {
          toast({
            title: `${multiplierLabel}`,
            description: `${currentPlayerScore} puan → ${finalScore} EXP olarak kaydedildi!`,
            duration: 2000,
          });
        }, 1000);
      }

      // End the game and cleanup room (for multiplayer modes)
      // End the game and cleanup room
      if (currentRoom) {
        console.log("🎮 Oyun bitti, endGame çağrılacak:", {
          gameMode: gameMode,
          currentRoom: currentRoom?.id?.slice(-8),
          user: user?.id?.slice(-8),
          playerScore: currentPlayerScore,
          gameResult: gameResult,
        });

        const endGameRoomId = currentRoom.id;
        const endGameSession = roomSessionRef.current;
        pendingEndGameTimeoutRef.current = setTimeout(async () => {
          pendingEndGameTimeoutRef.current = null;
          if (
            !isMountedRef.current ||
            roomSessionRef.current !== endGameSession ||
            currentRoomIdRef.current !== endGameRoomId
          ) {
            console.log("🚫 Eski maç endGame callback'i iptal edildi", {
              endGameRoomId: endGameRoomId?.slice(-8),
              currentRoomId: currentRoomIdRef.current?.slice(-8),
              endGameSession,
              currentSession: roomSessionRef.current,
            });
            return;
          }

          console.log("⏰ setTimeout tetiklendi, endGame çağrılıyor...");

          const playerStats = user
            ? {
                userId: user.id,
                score: currentPlayerScore,
                words: playerWordsWithScores,
                isWinner: gameResult === "player",
              }
            : undefined;

          console.log("📊 playerStats:", playerStats);

          const opponentParticipant = participants.find((p) => p.user_id !== user?.id && !p.is_bot);
          const opponentStats = opponentParticipant?.user_id
            ? {
                userId: opponentParticipant.user_id,
                score: currentOpponentScore,
                words: opponentWordsWithScores,
                isWinner: gameResult === "opponent",
              }
            : undefined;

          console.log("👥 opponentStats:", opponentStats);
          console.log("🔥 endGame çağrılıyor...");

          await endGame(playerStats, opponentStats);

          console.log("✅ endGame tamamlandı");
        }, 3000);
      }

      // Final skorları kaydet (reset'ten etkilenmemesi için)
      setFinalPlayerScore(currentPlayerScore);
      setFinalOpponentScore(currentOpponentScore);

      // Sonuç ekranını göster
      console.log("🎯 Setting showResults to true - rematch UI should appear");
      setShowResults(true);
    },
    [
      gameEnded,
      winner,
      user,
      currentRoom,
      gameMode,
      endGame,
      playSound,
      playCelebrationSound,
      playGameLoseSound,
      playTieSound,
      toast,
      participants,
      playerWordsWithScores,
      opponentWordsWithScores,
      gameStartTime,
      gameType,
      isPremium,
      hasScoreBoost,
    ],
  );

  // 🏆 TURNUVA MAÇLARI İÇİN REAL-TIME SCORE SYNC + COUNTDOWN SYNC
  // DÜZELTME: Bağımlılık dizisinden opponentScore, gameEnded, showCountdown çıkarıldı.
  // Bu sayede bağlantı kopup durmayacak.
  useEffect(() => {
    if (gameMode !== "tournament" || !tournamentMatch || !user) return;

    console.log("🔄 Turnuva maçı real-time subscription başlatılıyor:", tournamentMatch.id);

    const channel = supabase
      .channel(`tournament-match-${tournamentMatch.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournament_matches",
          filter: `id=eq.${tournamentMatch.id}`,
        },
        (payload) => {
          const newData = payload.new as any;

          // ✅ TAMAMLANMIŞ MAÇI TEKRAR BAŞLATMA
          if (newData.status === "completed") {
            console.log("⚠️ Maç tamamlandı real-time event - restart önleniyor:", newData.id);
            return;
          }

          // Match state'ini güncelle
          setTournamentMatch(newData);

          // ------------------------------------------------------------
          // 🎯 1. COUNTDOWN MANTIĞI - SADECE OYUN BAŞLAMADIYSA
          // ------------------------------------------------------------
          // 🔒 KRİTİK: Countdown veya buffer zaten başlatıldıysa KESINLIKLE yeni event'i yoksay
          // Bu, countdown'ın tekrar 5'ten başlamasını önler
          if (countdownInitiatedRef.current) {
            console.log("⚠️ Countdown/buffer zaten başlatıldı - real-time event KESINLIKLE yok sayıldı");
            // Skor sync'e devam et (return yok)
          } else if (newData.countdown_started_at) {
            // 🔒 İlk kez countdown başlatılıyor
            console.log("🎯 Tournament countdown hazırlanıyor (real-time):", newData.countdown_started_at);

            // skipBuffer = false - buffer animasyonları her zaman gösterilecek
            initiateCountdown(newData.countdown_started_at, false);
          }

          // ------------------------------------------------------------
          // 🎯 2. SKOR SENKRONİZASYONU - SADECE OYUN AKTİFKEN
          // ------------------------------------------------------------
          if (!gameStarted) {
            console.log("⚠️ Oyun henüz başlamadı - skor sync atlandı");
            return;
          }

          const currentUserId = user.id;
          const isPlayer1 = newData.player1_id === currentUserId;

          // Rakibin yeni skoru
          const newOpponentScore = isPlayer1 ? newData.player2_score : newData.player1_score;

          // Kendi yeni skorum
          const newPlayerScore = isPlayer1 ? newData.player1_score : newData.player2_score;

          // Sadece oyun aktifken skor senkronizasyonu yap
          if (typeof newOpponentScore === "number") {
            setOpponentScore((prevScore) => {
              if (newOpponentScore !== prevScore) {
                console.log(`🔄 Rakip Skoru Güncellendi: ${prevScore} -> ${newOpponentScore}`);
                return newOpponentScore;
              }
              return prevScore;
            });
          }

          if (typeof newPlayerScore === "number") {
            setPlayerScore((prev) => {
              if (newPlayerScore > prev) return newPlayerScore;
              return prev;
            });
          }
        },
      )
      .subscribe();

    // ⚠️ CLEANUP DEVRE DIŞI - Bağlantı koruması
    return () => {
      console.log("⚠️ [GamePage] Turnuva maçı subscription cleanup ATLANYOR (bağlantı koruması)");
      // ❌ DEVRE DIŞI: supabase.removeChannel(channel);
    };
    // ⚠️ DİKKAT: gameStarted ve showCountdown dependency'ye eklendi
    // Oyun başladığında countdown tekrar başlamaması için gerekli
  }, [gameMode, tournamentMatch?.id, user?.id, serverTimeOffset, gameStarted, showCountdown, preparingOpponent]);

  // 🏆 TURNUVA MAÇLARI İÇİN INITIAL COUNTDOWN SYNC - Sayfa açıldığında animasyonları başlat
  useEffect(() => {
    if (gameMode !== "tournament" || !tournamentMatch?.countdown_started_at) return;
    if (countdownInitiatedRef.current) return;

    console.log("🏆 Tournament initial countdown sync:", tournamentMatch.countdown_started_at);

    // 🔧 Turnuva mantığıyla aynı hesaplama
    const countdownStartTime = new Date(tournamentMatch.countdown_started_at).getTime();
    const BUFFER_MS = 5000; // Buffer süresi (preparing + ready + blank)
    const COUNTDOWN_MS = 5000; // Countdown süresi (5-4-3-2-1)
    const countdownEndTime = countdownStartTime + BUFFER_MS + COUNTDOWN_MS;

    const serverNow = Date.now() + serverTimeOffset;
    const msElapsedSinceStart = serverNow - countdownStartTime;
    const msUntilGameStart = countdownEndTime - serverNow;

    console.log("🏆 Tournament countdown timing:", {
      originalTime: new Date(countdownStartTime).toISOString(),
      countdownEndTime: new Date(countdownEndTime).toISOString(),
      serverNow: new Date(serverNow).toISOString(),
      msElapsedSinceStart,
      msUntilGameStart,
    });

    // 🎯 SENARYO 1: Countdown tamamen bitmişse direkt oyunu başlat
    if (msUntilGameStart <= 0) {
      console.log("🏆 Tournament countdown geçmiş, oyun direkt başlatılıyor");
      countdownInitiatedRef.current = true;
      setPreparingOpponent(null);
      setShowCountdown(false);
      setGameStarted(true);
      gameHasStartedRef.current = true;
      gameStartedRef.current = true;
      return;
    }

    // 🎯 SENARYO 2: Buffer veya countdown devam ediyor
    // 🔧 FIX: skipBuffer her zaman false - minimum buffer animasyonları gösterilmeli
    console.log("🏆 Countdown başlatılıyor, initiateCountdown kendi zamanlamasını yapacak");
    initiateCountdown(tournamentMatch.countdown_started_at, false); // skipBuffer = false
  }, [gameMode, tournamentMatch?.countdown_started_at, serverTimeOffset, initiateCountdown]);

  // 🎯 Participant is_ready state'ine göre "Oyuncu Hazırlanıyor" / "Oyuncu Hazır" overlay'ini göster
  // 🔧 FIX: Bu overlay initiateCountdown tarafından yönetiliyor
  // Bu effect sadece countdown başlamadan ÖNCE (countdown_started_at yok iken) is_ready state'ine göre gösterir
  // countdown_started_at varsa initiateCountdown buffer animasyonlarını yönetiyor
  useEffect(() => {
    // Sadece multiplayer modlar için (vs-computer için AI logic ayrı)
    if (gameMode === "vs-computer" || gameMode === "tournament") return;

    // 🔧 KRİTİK: Görsel countdown (5-4-3-2-1) başladıysa veya oyun başladıysa overlay'i gizle
    // showCountdown = görsel countdown aktif
    if (showCountdown || gameStarted) {
      if (preparingOpponent) {
        console.log("🎯 Görsel countdown başladı, overlay kapatılıyor");
        setPreparingOpponent(null);
      }
      return;
    }

    // 🔧 FIX: countdown_started_at varsa initiateCountdown buffer animasyonlarını yönetiyor
    // Bu effect'in araya girmesine gerek yok - çakışma yaratır
    if (currentRoom?.countdown_started_at) {
      return;
    }

    // Participants yoksa veya yetersizse atla
    if (!participants || participants.length < 2) return;

    const otherParticipant = participants.find((p) => p.user_id !== user?.id);
    if (!otherParticipant) return;

    // 🎯 countdown_started_at yok - is_ready state'ine göre overlay göster
    // Bu, eşleşme bulundu ama henüz ikisi de hazır değil durumu için
    if (!otherParticipant.is_ready) {
      // Oyuncu henüz hazır değil
      if (preparingOpponent !== "preparing") {
        console.log("👤 Oyuncu hazırlanıyor overlay gösteriliyor (is_ready=false)");
        setPreparingOpponent("preparing");
      }
    } else {
      // Oyuncu hazır - countdown_started_at bekliyor
      if (preparingOpponent !== "ready") {
        console.log("✅ Oyuncu hazır overlay gösteriliyor (is_ready=true, countdown bekleniyor)");
        setPreparingOpponent("ready");
      }
    }
  }, [
    gameMode,
    participants,
    user?.id,
    showCountdown,
    gameStarted,
    preparingOpponent,
    currentRoom?.countdown_started_at,
  ]);

  // 🔒 CİHAZ HAZIRLIK SİNYALİ: Server time senkronu + geri sayım asset'leri yüklenmeden
  // "hazır" deme. Böylece yavaş cihaz hazır olana kadar countdown hiç başlamaz.
  const [assetsPrepared, setAssetsPrepared] = useState(false);
  useEffect(() => {
    let cancelled = false;
    ensureImagesLoaded()
      .then(() => {
        if (!cancelled) setAssetsPrepared(true);
      })
      .catch(() => {
        if (!cancelled) setAssetsPrepared(true);
      });
    // Güvenlik ağı: 4sn içinde yüklenmezse yine de devam et (oyun kilitlenmesin)
    const t = setTimeout(() => {
      if (!cancelled) setAssetsPrepared(true);
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const clientPrepared = assetsPrepared && contextServerTimeReady;


  // 🆕 TÜM MODLAR İÇİN OTOMATİK HAZIR DURUMU VE COUNTDOWN BAŞLATMA
  // AI modundaki gibi: Her iki oyuncu da hazır olunca otomatik countdown başlat
  useEffect(() => {
    if (!currentRoom?.id || !user?.id) return;
    if (!participants || participants.length < 2) return;

    // Countdown zaten başlamışsa bir şey yapma
    if (currentRoom.countdown_started_at) return;

    // Oyun zaten başlamışsa bir şey yapma
    if (gameStarted) return;

    const currentParticipant = participants.find((p) => p.user_id === user.id);
    const otherParticipant = participants.find((p) => p.user_id !== user.id);

    if (!currentParticipant || !otherParticipant) return;

    console.log("🔍 Hazır durumu kontrolü:", {
      gameMode,
      currentReady: currentParticipant.is_ready,
      otherReady: otherParticipant.is_ready,
      otherIsAI: otherParticipant.is_ai,
      clientPrepared,
    });

    // 🔒 SENKRON GARANTİSİ: "Hazır" sinyalini SADECE cihaz gerçekten hazır olunca gönder.
    // (server time senkronu tamam + geri sayım görselleri/sesleri yüklendi)
    // Böylece yavaş cihaz "hazır" demeden countdown başlamaz; hızlı cihaz onu bekler.
    if (!clientPrepared) {
      console.log("⏳ Cihaz henüz tam hazır değil (server time / asset), hazır sinyali bekletiliyor");
      return;
    }

    // Mevcut oyuncuyu otomatik hazır yap (eğer henüz hazır değilse)
    if (!currentParticipant.is_ready) {
      console.log("✅ Oyuncu otomatik hazır hale getiriliyor...");
      supabase
        .from("game_participants")
        .update({ is_ready: true })
        .eq("id", currentParticipant.id)
        .then(({ error }) => {
          if (error) {
            console.error("❌ Oyuncu hazır yapılamadı:", error);
          } else {
            console.log("✅ Oyuncu hazır duruma getirildi");
          }
        });
      return; // Güncelleme yapıldı, bir sonraki render'da kontrol devam edecek
    }


    // Her iki oyuncu da hazırsa countdown başlat
    // 🔒 ÖNEMLİ: Race condition önleme - sadece ilk katılan (joined_at küçük olan) countdown başlatır
    if (currentParticipant.is_ready && otherParticipant.is_ready) {
      const sortedParticipants = [...participants].sort((a, b) => {
        const timeA = new Date(a.joined_at || 0).getTime();
        const timeB = new Date(b.joined_at || 0).getTime();
        return timeA - timeB;
      });

      const firstJoined = sortedParticipants[0];

      // Sadece ilk katılan oyuncu countdown başlatır
      if (firstJoined.user_id !== user.id) {
        console.log("⏳ Diğer oyuncu countdown başlatacak, bekleniyor...");
        return;
      }

      console.log(`✅ ${gameMode} modunda her iki oyuncu hazır - senkron bekleme başlıyor...`);

      // 🔒 SUNUCU OTORİTESİ: Başlangıç anını artık istemci HESAPLAMIYOR.
      // RPC sunucu saatinde (now() + idle) hesaplar, satırı kilitler ve
      // countdown_started_at zaten yazılmışsa aynı değeri döner (idempotent).
      // Böylece istemci offset hatası maça bulaşmıyor ve yarış durumu kalkıyor.
      const IDLE_WAIT_MS = 3000;

      supabase
        .rpc("start_match_countdown", {
          p_room_id: currentRoom.id,
          p_idle_ms: IDLE_WAIT_MS,
        })
        .then(({ data, error }) => {
          if (error) {
            console.error("❌ Countdown başlatma hatası (RPC):", error);
          } else {
            console.log(`✅ ${gameMode} - countdown sunucu tarafından planlandı:`, data);
          }
        });
    }
  }, [
    currentRoom?.id,
    currentRoom?.countdown_started_at,
    participants,
    user?.id,
    gameMode,
    gameStarted,
    serverTimeOffset,
    clientPrepared,
  ]);

  // 🛰️ COUNTDOWN POLLING FALLBACK (yavaş/gecikmeli realtime koruması)
  // Yavaş cihazda realtime paketi gecikirse countdown_started_at'ı DB'den yoklayarak
  // en fazla ~500ms gecikmeyle yakalar - böylece iki cihaz da aynı anda buffer'a girer.
  useEffect(() => {
    if (gameMode === "tournament" || gameMode === "vs-computer") return;
    if (!currentRoom?.id || !user?.id) return;
    if (gameStarted || showCountdown || countdownInitiatedRef.current) return;
    if (currentRoom.countdown_started_at) return;
    if (!clientPrepared) return;

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled || countdownInitiatedRef.current) return;
      attempts += 1;
      if (attempts > 22) {
        // ~30 saniye sonra bırak (1.5s aralık)
        cancelled = true;
        return;
      }

      const { data } = await supabase
        .from("game_rooms")
        .select("countdown_started_at")
        .eq("id", currentRoom.id)
        .maybeSingle();

      const cs = (data as any)?.countdown_started_at as string | undefined;
      if (!cs || cancelled || countdownInitiatedRef.current) return;
      if (processedCountdownRef.current === cs) return;

      const countdownStartTime = new Date(cs).getTime();
      const shouldSkipBuffer = Date.now() + serverTimeOffset - countdownStartTime >= 5000;
      console.log("🛰️ Countdown polling ile yakalandı:", { cs, shouldSkipBuffer });
      cancelled = true;
      initiateCountdown(cs, shouldSkipBuffer);
    };

    // Realtime ana yol; polling sadece yedek → sunucu yükünü 3x azaltmak için 1.5s
    const interval = setInterval(poll, 1500);
    poll();


    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    gameMode,
    currentRoom?.id,
    currentRoom?.countdown_started_at,
    user?.id,
    gameStarted,
    showCountdown,
    clientPrepared,
    serverTimeOffset,
    initiateCountdown,
  ]);


  // 🎮 NORMAL OYUNLAR (RANDOM-MATCH, PRIVATE-ROOM) İÇİN COUNTDOWN SYNC
  // 🔒 Çift tetiklemeyi önlemek için: İlk yüklemede ve realtime'da aynı countdown_started_at kontrolü
  const countdownChannelRef = useRef<any>(null);

  useEffect(() => {
    if (gameMode === "tournament" || gameMode === "vs-computer") return;
    if (!currentRoom || !user) return;

    // 🔒 OYUN BAŞLADIYSA SUBSCRIPTION'I KAPAT VE ÇIKIŞ YAP
    if (gameStarted) {
      if (countdownChannelRef.current) {
        console.log("🛑 Oyun başladı, countdown subscription kapatılıyor");
        supabase.removeChannel(countdownChannelRef.current);
        countdownChannelRef.current = null;
      }
      return;
    }

    // Countdown zaten gösteriliyorsa yeni subscription açma
    if (showCountdown) return;

    // 🔒 Server time hazır değilse bekle - yanlış hesaplama yapılmasın
    if (!serverTimeReady) {
      console.log("⏳ Server time henüz hazır değil, countdown bekleniyor...");
      return;
    }

    // 🔒 REMATCH/STALE ROOM GUARD: currentRoom henüz URL'deki yeni oda ile eşleşmediyse hiçbir şey yapma.
    // Aksi halde önceki maçın "countdown_started_at" değeri okunup oyun anında başlamış/bitmiş gibi davranır
    // (rematch sonrası GamePage açılır açılmaz kapanma / saat ilerlemiş gibi görünme bug'ı).
    if (gameMode === "private-room" || gameMode === "random-match") {
      const urlRoomParam = searchParams.get("room");
      if (urlRoomParam && currentRoom.id !== urlRoomParam && (currentRoom as any).room_code !== urlRoomParam) {
        console.log("⏳ currentRoom henüz URL room'una eşleşmedi, countdown bekleniyor", {
          urlRoomParam,
          currentRoomId: currentRoom.id?.slice(-8),
        });
        return;
      }
    }

    // 🔒 İLK YÜKLEME: Room'da zaten countdown_started_at varsa HEMEN başlat
    // ⚡ REMATCH FIX: Bu kontrolü channel varlığından ÖNCE yap
    // Aksi halde channel zaten varsa bu blok atlanır ve countdown tetiklenmez
    if (currentRoom.countdown_started_at && !countdownInitiatedRef.current) {
      const countdownStartTime = new Date(currentRoom.countdown_started_at).getTime();
      const BUFFER_MS = 5000;
      const COUNTDOWN_MS = 5000;
      const countdownEndTime = countdownStartTime + BUFFER_MS + COUNTDOWN_MS;

      const nowWithOffset = Date.now() + serverTimeOffset;
      const msElapsed = nowWithOffset - countdownStartTime;
      const msUntilGameStart = countdownEndTime - nowWithOffset;

      console.log("🎯 İlk yükleme countdown kontrolü:", {
        countdownStartedAt: currentRoom.countdown_started_at,
        msElapsed,
        msUntilGameStart,
        nowWithOffset: new Date(nowWithOffset).toISOString(),
      });

      // 🎯 SENARYO 1: Countdown tamamen bitmişse direkt oyunu başlat
      if (msUntilGameStart <= 0) {
        console.log("⚡ Countdown süresi geçmiş, oyun başlatılıyor");
        countdownInitiatedRef.current = true;
        setGameStarted(true);
        gameStartedRef.current = true;
        gameHasStartedRef.current = true;
        return;
      }

      // 🎯 SENARYO 2: Buffer veya countdown devam ediyor
      // Buffer geçmişse geç katılan cihazı aktif countdown fazına doğrudan kilitle
      if (msElapsed >= 0) {
        const shouldSkipBuffer = msElapsed >= BUFFER_MS;
        console.log("🎮 Countdown başlatılıyor, initiateCountdown kendi zamanlamasını yapacak:", {
          msElapsed,
          shouldSkipBuffer,
          countdownStartedAt: currentRoom.countdown_started_at,
        });
        initiateCountdown(currentRoom.countdown_started_at, shouldSkipBuffer);
        return;
      }
    }

    // Zaten subscription varsa tekrar açma
    if (countdownChannelRef.current) return;

    console.log("🔄 Game room countdown subscription başlatılıyor:", shortId(currentRoom?.id));

    const channel = supabase
      .channel(`game-room-countdown-${currentRoom.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${currentRoom.id}`,
        },
        (payload) => {
          // 🔒 CALLBACK İÇİNDE REF KULLAN - closure sorunu yok!
          if (gameStartedRef.current) {
            console.log("⚠️ Countdown zaten aktif veya oyun başladı - event ignored");
            return;
          }

          const newData = payload.new as any;

          // 🔢 VERSION GAP KONTROLÜ (AAA "seq" mantığı):
          // Odanın her güncellemesinde version 1 artar. Aradaki bir paket kaçtıysa
          // (version atlaması) tek seferlik FULL FETCH yapıp gerçek durumu alırız.
          const incomingVersion = typeof newData.version === "number" ? newData.version : null;
          if (incomingVersion !== null) {
            const prevVersion = roomVersionRef.current;
            roomVersionRef.current = incomingVersion;

            if (prevVersion !== null && incomingVersion > prevVersion + 1) {
              console.warn("🔢 Room version atlaması tespit edildi - full fetch yapılıyor:", {
                prevVersion,
                incomingVersion,
              });
              supabase
                .from("game_rooms")
                .select("countdown_started_at, status, version")
                .eq("id", currentRoom.id)
                .maybeSingle()
                .then(({ data: fresh }) => {
                  const f = fresh as any;
                  if (!f) return;
                  if (typeof f.version === "number") roomVersionRef.current = f.version;
                  if (gameStartedRef.current || !f.countdown_started_at) return;
                  if (processedCountdownRef.current === f.countdown_started_at) return;
                  const cst = new Date(f.countdown_started_at).getTime();
                  const skip = Date.now() + serverTimeOffset - cst >= 5000;
                  initiateCountdown(f.countdown_started_at, skip);
                });
              return;
            }
          }

          if (newData.countdown_started_at) {
            // 🔒 KRİTİK: Aynı countdown_started_at zaten işlenmişse atla
            if (processedCountdownRef.current === newData.countdown_started_at) {
              console.log("⚠️ Bu countdown zaten işlendi (realtime), atlanıyor:", newData.countdown_started_at);
              return;
            }

            const countdownStartTime = new Date(newData.countdown_started_at).getTime();
            const BUFFER_MS = 5000;
            const COUNTDOWN_MS = 5000;
            const countdownEndTime = countdownStartTime + BUFFER_MS + COUNTDOWN_MS;

            const nowWithOffset = Date.now() + serverTimeOffset;
            const msElapsed = nowWithOffset - countdownStartTime;
            const msUntilGameStart = countdownEndTime - nowWithOffset;

            console.log(
              "🎯 Game room countdown (realtime):",
              newData.countdown_started_at,
              "msElapsed:",
              msElapsed,
              "msUntilGameStart:",
              msUntilGameStart,
            );

            // 🎯 SENARYO 1: Countdown tamamen bitmişse direkt oyunu başlat
            if (msUntilGameStart <= 0) {
              console.log("⚡ Countdown süresi geçmiş (realtime), oyun başlatılıyor");
              countdownInitiatedRef.current = true;
              processedCountdownRef.current = newData.countdown_started_at;
              setGameStarted(true);
              gameStartedRef.current = true;
              gameHasStartedRef.current = true;
            } else if (msElapsed >= BUFFER_MS) {
              // Buffer geçmiş ama countdown devam ediyor - countdown'a atla
              initiateCountdown(newData.countdown_started_at, true);
            } else {
              // Buffer süresi içinde - tam animasyonlarla başlat
              initiateCountdown(newData.countdown_started_at, false);
            }
          }
        },
      )
      .subscribe();

    countdownChannelRef.current = channel;

    return () => {
      // ✅ Bu effect'in oluşturduğu kanalı, oyun başlamış olsun ya da olmasın HER ZAMAN kapat.
      // Önceki hâliyle (yalnızca gameStartedRef.current true ise temizle) rematch sonrası
      // henüz oyunu başlamamış eski oda kanalı açık kalıp sızıntıya (leak) yol açıyordu.
      console.log("🧹 Countdown subscription temizleniyor (effect cleanup):", shortId(currentRoom?.id));
      supabase.removeChannel(channel);
      if (countdownChannelRef.current === channel) {
        countdownChannelRef.current = null;
      }
    };
  }, [
    gameMode,
    currentRoom?.id,
    currentRoom?.countdown_started_at,
    user,
    showCountdown,
    gameStarted,
    serverTimeOffset,
    serverTimeReady,
    initiateCountdown,
  ]);

  const handleTournamentExit = async () => {
    if (!user || !tournamentMatch) return;

    console.log("🚪 Turnuva maçından ayrılıyor:", user.id, "Tournament:", tournamentMatch.tournament_id);

    try {
      // Rakibi belirle
      let opponentId = tournamentMatch.player1_id === user.id ? tournamentMatch.player2_id : tournamentMatch.player1_id;

      console.log("🎯 Rakip ID:", opponentId);

      // Turnuva maçından ayrılma cezası uygula (-500 puan)
      if (currentRoom?.id) {
        const { error: penaltyError } = await supabase.rpc("apply_disconnect_penalty", {
          p_offender_id: user.id,
          p_room_id: currentRoom.id,
        });

        if (penaltyError) {
          console.error("❌ Ceza uygulanamadı:", penaltyError);
        } else {
          console.log("⚖️ Turnuva ayrılma cezası uygulandı: -500 puan");
        }
      }

      // Eğer rakip bot değilse, puan ekle ve bildirim gönder (TÜM TABLOLARA ATOMIK OLARAK)
      if (opponentId && !opponentId.startsWith("bot_")) {
        opponentId = opponentId.trim();

        try {
          await supabase.rpc("award_disconnect_bonus", {
            p_user_id: opponentId,
            p_bonus_points: 500,
          });
          console.log("✅ Rakibe 500 puan eklendi (tüm tablolar):", opponentId.slice(-8));
        } catch (err) {
          console.error("❌ Rakibe bonus verme hatası:", err);
        }

        // RAKIBE BİLDİRİM GÖNDER
        console.log("📢 Rakibe bildirim gönderiliyor:", opponentId);
        const { error: notificationError } = await supabase.from("notifications").insert({
          user_id: opponentId,
          type: "tournament_opponent_left",
          message: `Rakibiniz turnuva maçından ayrıldı ve +500 puan kazandınız!`,
          related_id: tournamentMatch.id,
          is_read: false,
        });

        if (notificationError) {
          console.error("❌ Rakibe bildirim gönderilemedi:", notificationError);
        } else {
          console.log("✅ Rakibe bildirim başarıyla gönderildi");
        }
      } else {
        console.log("🤖 Rakip bot, puan ve bildirim gönderilmiyor");
      }

      // Maçı tamamla (çıkan kişi 0 puan alır, rakip 500 puan alır)
      const isUserPlayer1 = tournamentMatch.player1_id === user.id;
      const winnerId = tournamentMatch.player1_id === user.id ? tournamentMatch.player2_id : tournamentMatch.player1_id;

      await supabase
        .from("tournament_matches")
        .update({
          status: "completed",
          winner_id: winnerId || "forfeit",
          player1_score: isUserPlayer1 ? 0 : 500,
          player2_score: isUserPlayer1 ? 500 : 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tournamentMatch.id);

      // ✅ TURNUVA KATILIMCISINI SİL (kritik - yoksa yeni turnuvaya katılamaz)
      console.log("🗑️ tournament_participants kaydı siliniyor...");
      const { error: participantDeleteError } = await supabase.rpc("delete_tournament_participant", {
        p_tournament_id: tournamentMatch.tournament_id,
        p_user_id: user.id,
      });

      if (participantDeleteError) {
        console.error("❌ Tournament participant silinemedi:", participantDeleteError);
      } else {
        console.log("✅ Tournament participant başarıyla silindi");
      }

      setShowTournamentExitDialog(false);

      // GameContext'i temizle
      leaveRoom();

      navigate("/tournament");
    } catch (error) {
      console.error("Çıkış hatası:", error);

      // Hata durumunda da turnuva kaydını temizle
      try {
        await supabase.rpc("delete_tournament_participant", {
          p_tournament_id: tournamentMatch.tournament_id,
          p_user_id: user.id,
        });
      } catch (cleanupError) {
        console.error("Cleanup hatası:", cleanupError);
      }

      leaveRoom();
      navigate("/tournament");
    }
  };

  // Timer effect - start only when match truly starts and guard early-finish
  useEffect(() => {
    // 🔧 FIX (timer freeze): gameStarted=true ise (countdown bitmiş) timer'ı her durumda başlat.
    // Önceki katı koşul (roomActive + haveTwoRealPlayers) realtime gecikmesinde
    // timer'ın hiç başlamamasına ve süre 2:00'da donmasına yol açıyordu.
    const canStart = gameType === "timed" && gameStarted && !gameEnded && !timerRef.current;

    if (!canStart) return;

    console.log("⏱️ Timer BAŞLATILIYOR - Tek sefer, time:", timeLeftRef.current);

    // 🔒 REMATCH FIX: Clear any existing timer immediately before starting new one
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      console.log("✅ Existing timer cleared before initializing new one (rematch fix)");
    }

    let syncInterval: NodeJS.Timeout | null = null;

    // ⚠️ GUARD: Oyun bittiyse timer başlatma
    if (gameEnded) {
      console.log("🛑 Timer başlatılmadı - oyun zaten bitti");
      return;
    }

    // 🔒 KRİTİK: Timer zaten başlatıldıysa VE çalışıyorsa, başlatma
    // Ancak endsAtTimestampRef doluysa ve timerRef boşsa, timer'ı başlat
    if (endsAtTimestampRef.current && timerRef.current) {
      console.log("⏱️ Timer zaten çalışıyor, yeniden başlatma atlandı");
      return;
    }

    // 🔧 FIX: endsAtTimestampRef dolu ama timerRef boşsa, timer interval'ı başlat
    // Bu, handleCountdownComplete'in hemen ends_at set etmesi durumunda gerekli
    const hasEndsAt = !!endsAtTimestampRef.current;

    // ⏱️ TIMESTAMP-BASED TIMER - Prevents jumps and glitches
    console.log("⏱️ Starting TIMESTAMP-BASED timer (no more setInterval decrement)", { hasEndsAt });
    // ⏱️ TIMESTAMP-BASED TIMER - Prevents jumps and glitches
    const initializeTimer = async () => {
      // 🔒 KRİTİK: Timer zaten çalışıyorsa, tekrar başlatma!
      if (timerRef.current) {
        console.log("⏱️ Timer already running, skipping re-init");
        return;
      }

      // 🔧 FIX: handleCountdownComplete zaten endsAtTimestampRef'i set ettiyse, sadece interval başlat
      let endsAtTimestamp = endsAtTimestampRef.current;

      if (endsAtTimestamp) {
        console.log(
          "⏱️ endsAtTimestampRef zaten dolu, interval başlatılıyor:",
          new Date(endsAtTimestamp).toISOString(),
        );
      } else {
        // Normal hesaplama - endsAtTimestampRef henüz set edilmemiş

        try {
          let gameStartTimestamp = 0;

          // 1. ADIM: Başlangıç ve Bitiş Zamanlarını Belirle
          // Timer 2:00'dan başlaması için offset ayarı
          // 🔒 KRİTİK: Buffer (5s) + Countdown (5s) = 10000ms toplam
          // Normal oyunlar (Random/Private): 10000ms (5s buffer animasyonu + 5s geri sayım)
          // Turnuva: 12000ms (daha uzun animasyon süresi)
          const GAME_START_OFFSET_MS = 10000; // 🔧 FIXED: 5s buffer + 5s countdown = 10000ms
          const TOURNAMENT_START_OFFSET_MS = 12000;

          if (gameMode === "tournament" && tournamentMatch) {
            // 🔒 SERVER-AUTHORITY: ends_at varsa doğrudan onu kullan (tek gerçek kaynak)
            if (tournamentMatch.ends_at) {
              endsAtTimestamp = new Date(tournamentMatch.ends_at).getTime();
              gameStartTimestamp = endsAtTimestamp - 120 * 1000;

              console.log("🏆 Tournament timer: Authoritative ends_at kullanılıyor", {
                endsAt: tournamentMatch.ends_at,
                gameStart: new Date(gameStartTimestamp).toISOString(),
              });
            } else if (tournamentMatch.countdown_started_at) {
              // Fallback: eski kayıtlar için countdown_started_at tabanlı hesap
              const countdownStartTime = new Date(tournamentMatch.countdown_started_at).getTime();
              gameStartTimestamp = countdownStartTime + TOURNAMENT_START_OFFSET_MS;
              endsAtTimestamp = gameStartTimestamp + 120 * 1000;

              console.log("🏆 Tournament timer: Fallback countdown_started_at", {
                countdownStart: new Date(countdownStartTime).toISOString(),
                gameStart: new Date(gameStartTimestamp).toISOString(),
                endsAt: new Date(endsAtTimestamp).toISOString(),
                offsetUsed: TOURNAMENT_START_OFFSET_MS,
              });
            } else {
              console.warn("⚠️ Tournament timing verisi eksik, fallback kullanılıyor");
              gameStartTimestamp = Date.now() + serverTimeOffset;
              endsAtTimestamp = gameStartTimestamp + 120 * 1000;
            }
          } else if (currentRoom?.countdown_started_at) {
            // 🎮 Normal oyunlarda countdown_started_at tek gerçek başlangıç kaynağıdır.
            // Oda countdown'dan önce active olduysa DB'deki eski ends_at 10-12 saniye erken
            // kalabilir; bu yüzden normal maçlarda ends_at yerine countdown anchor'ını kullan.
            const countdownStartTime = new Date(currentRoom.countdown_started_at).getTime();

            // 🔧 FIX: Buffer (5s) + Countdown (5s) = 10s offset
            // Oyun her zaman countdown_started_at + 10s'de başlamalı
            // Timer her zaman 2:00'dan başlamalı
            const BUFFER_MS = 5000;
            const COUNTDOWN_MS = 5000;
            const TOTAL_OFFSET_MS = BUFFER_MS + COUNTDOWN_MS; // 10000ms

            gameStartTimestamp = countdownStartTime + TOTAL_OFFSET_MS;
            endsAtTimestamp = gameStartTimestamp + 120 * 1000;

            // 🔧 FIX: Mevcut sunucu zamanını kontrol et
            // Eğer oyun zaten başlamışsa, kalan süreyi hesapla
            const currentServerTime = Date.now() + serverTimeOffset;
            const msUntilGameStart = gameStartTimestamp - currentServerTime;

            // Eğer oyun başlama zamanı geçmişse (geç katılım), timer kalan süreden başlamalı
            if (msUntilGameStart < 0) {
              console.log("⚠️ Geç katılım tespit edildi, timer kalan süreden başlıyor:", {
                geçenSüre: Math.abs(msUntilGameStart),
                kalanSüre: Math.max(0, (endsAtTimestamp - currentServerTime) / 1000),
              });
            }

            console.log("🎮 Random/Private game timer: Server-synchronized timing", {
              countdownStart: new Date(countdownStartTime).toISOString(),
              gameStart: new Date(gameStartTimestamp).toISOString(),
              endsAt: new Date(endsAtTimestamp).toISOString(),
              countdown_started_at: currentRoom.countdown_started_at,
              offsetUsed: TOTAL_OFFSET_MS,
              msUntilGameStart,
            });
          } else if (currentRoom?.started_at) {
            // Fallback: started_at kullan (eski oyunlar için)
            gameStartTimestamp = new Date(currentRoom.started_at).getTime();
            endsAtTimestamp = gameStartTimestamp + 120 * 1000;

            console.log("⚠️ Using started_at fallback (countdown_started_at not found)");
          } else {
            // Final Fallback: vs-computer için
            gameStartTimestamp = Date.now() + serverTimeOffset;
            endsAtTimestamp = gameStartTimestamp + 120 * 1000;

            console.log("⚠️ Using immediate start fallback");
          }

          // Hesaplanan değeri ref'e ata
          endsAtTimestampRef.current = endsAtTimestamp;
        } catch (error) {
          console.error("❌ Timer calculation error:", error);
          endsAtTimestamp = Date.now() + 120 * 1000;
          endsAtTimestampRef.current = endsAtTimestamp;
        }
      }

      // 🔧 FIX: Timer başlatıldığında ilk değeri HEMEN hesapla
      // Bu sayede 2:05 veya 2:08 gibi yanlış değerler gösterilmez
      const nowForInitial = Date.now() + serverTimeOffset;
      const initialRemainingMs = Math.max(0, endsAtTimestamp! - nowForInitial);
      const initialRemainingSeconds = Math.min(120, Math.floor(initialRemainingMs / 1000));

      // 🔒 KRİTİK: Başlangıç değeri 120'yi geçmemeli
      // Eğer countdown henüz bitmemişse, timer 120'den başlamalı
      // Eğer geç katılımsa, kalan süreden başlamalı
      const displayInitial = Math.min(120, initialRemainingSeconds);
      timeLeftRef.current = displayInitial;
      setDisplayTime(displayInitial);

      console.log("⏱️ Timer başlangıç değeri:", {
        hesaplanan: initialRemainingSeconds,
        gösterilen: displayInitial,
        nowForInitial: new Date(nowForInitial).toISOString(),
        endsAt: new Date(endsAtTimestamp!).toISOString(),
      });

      // Timer hemen 120'den başlamalı, beklememeli
      if (displayInitial === 120) {
        console.log("⏱️ Timer 120 saniyeden başlıyor (tam zamanında)");
      } else if (displayInitial > 120) {
        console.log("⚠️ Timer değeri 120'den büyük, 120'ye clamp ediliyor");
        timeLeftRef.current = 120;
        setDisplayTime(120);
      } else {
        console.log("⚠️ Geç katılım - timer", displayInitial, "saniyeden başlıyor");
      }

      // 2. ADIM: Sayacı Başlat
      // 🔧 FIX: 200ms interval ile smooth güncelleme - saniye atlamayı önler
      let lastDisplayedSecond = displayInitial;

      timerRef.current = setInterval(() => {
        // Eğer unmount olduysa veya ends_at yoksa dur
        if (!endsAtTimestampRef.current || !isMountedRef.current) return;

        // Oyun bittiyse timer'ı durdur
        if (gameEndedRef.current) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return;
        }

        const currentServerTime = Date.now() + serverTimeOffset;

        // 🔓 OYUN BAŞLADI: Normal Geri Sayım
        const remainingMs = Math.max(0, endsAtTimestampRef.current - currentServerTime);
        const remainingSeconds = Math.min(120, Math.floor(remainingMs / 1000));

        // 🔧 FIX: Sadece saniye değiştiğinde state güncelle
        if (remainingSeconds !== lastDisplayedSecond) {
          lastDisplayedSecond = remainingSeconds;
          timeLeftRef.current = remainingSeconds;
          setDisplayTime(remainingSeconds);

          // 🔊 30 saniyeye gelince süre azalıyor sesini çal
          if (remainingSeconds === 30 && !timeWarningPlayed) {
            setTimeWarningPlayed(true);
            playTimeWarningSequence();
          }
        }

        // Süre Bitti Kontrolü
        if (remainingSeconds <= 0 && !gameEndedRef.current) {
          console.log("⏰ TIMESTAMP TIMER: Time reached 0 - ending game");
          gameEndedRef.current = true;

          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // ⚠️ DEVRE DIŞI: removeChannel - bağlantı koruması
          if (syncInterval) {
            if (typeof syncInterval === "object" && "unsubscribe" in syncInterval) {
              console.log("⚠️ [GamePage] Sync interval removeChannel ATLANYOR (bağlantı koruması)");
            } else {
              clearInterval(syncInterval as any);
            }
          }

          if (gameMode === "tournament" && tournamentMatch) {
            setIsMatchFinishing(true);
            handleGameEnd();
          } else {
            const finalizeSession = roomSessionRef.current;
            const finalizeRoomId = currentRoomIdRef.current;
            handleGameEnd();
            if (gameEndFinalizeTimeoutRef.current) clearTimeout(gameEndFinalizeTimeoutRef.current);
            gameEndFinalizeTimeoutRef.current = setTimeout(() => {
              gameEndFinalizeTimeoutRef.current = null;
              if (
                !isMountedRef.current ||
                roomSessionRef.current !== finalizeSession ||
                currentRoomIdRef.current !== finalizeRoomId
              ) {
                console.log("🚫 Eski maça ait finalize timeout yok sayıldı");
                return;
              }
              setGameEnded(true);
              checkWinnerWithScores(playerScoreRef.current, opponentScoreRef.current);
            }, 50);
          }
        }
      }, 200); // 🔧 FIX: 200ms interval - smooth timer
    };

    initializeTimer();

    return () => {
      // Cleanup intervals
      console.log("🧹 Timer useEffect cleanup - clearing intervals");
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        console.log("✅ Timer cleared in cleanup");
      }
      // ⚠️ DEVRE DIŞI: removeChannel - bağlantı koruması
      if (syncInterval) {
        if (typeof syncInterval === "object" && "unsubscribe" in syncInterval) {
          // ❌ DEVRE DIŞI: supabase.removeChannel(syncInterval as any);
          console.log("⚠️ [GamePage] Timer cleanup removeChannel ATLANYOR (bağlantı koruması)");
        } else {
          clearInterval(syncInterval);
        }
      }
    };
  }, [
    gameStarted,
    gameEnded,
    gameType,
    gameMode,
    tournamentMatch?.id,
    participants.length,
    currentRoom?.status,
    currentRoom?.started_at,
    currentRoom?.id,
    serverTimeOffset,
    currentRoom?.countdown_started_at,
    tournamentMatch?.countdown_started_at,
    timerWatchdogTick, // 🩺 WATCHDOG: Donmuş timer'ı yeniden başlatmak için
  ]);

  // 🩺 ============ TIMER WATCHDOG ============
  // Sorun: Bazen multiplayer maçlarında countdown_started_at realtime ile gelmiyor
  // veya timer effect koşulları sağlanamıyor → timer 2:00'da donuk kalıyor, grid tıklanmıyor.
  // Çözüm: Oyun başladıktan sonra displayTime'ı izle. 5sn boyunca değişmediyse
  // DB'den room/match'i FRESH çek, ends_at'ı yeniden hesapla, timer effect'i re-trigger et.
  useEffect(() => {
    if (!gameStarted || gameEnded || gameType !== "timed") return;
    if (gameMode !== "random-match" && gameMode !== "private-room") return;
    if (!currentRoom?.id) return;

    let lastSeenTime = displayTime;
    let stuckSince = Date.now();

    const watchdog = setInterval(async () => {
      if (gameEndedRef.current || !isMountedRef.current) return;

      // Timer hareket ediyorsa watchdog'u resetle
      if (timeLeftRef.current !== lastSeenTime) {
        lastSeenTime = timeLeftRef.current;
        stuckSince = Date.now();
        return;
      }

      // 🔧 FIX: Sadece 120'de değil, HERHANGİ bir değerde 5sn+ donmuşsa kurtar
      const stuckMs = Date.now() - stuckSince;
      if (stuckMs < 5000) return;
      if (watchdogRecoveringRef.current) return;

      console.warn("🩺 [Watchdog] Timer 2:00'da donmuş tespit edildi, kurtarma başlıyor...", {
        roomId: currentRoom.id,
        hasEndsAt: !!endsAtTimestampRef.current,
        hasTimer: !!timerRef.current,
        countdownStartedAt: currentRoom.countdown_started_at,
      });

      watchdogRecoveringRef.current = true;
      try {
        // 1. DB'den fresh room verisi çek
        const { data: freshRoom, error } = await supabase
          .from("game_rooms")
          .select("countdown_started_at, started_at, status, ends_at")
          .eq("id", currentRoom.id)
          .maybeSingle();

        if (error || !freshRoom) {
          console.warn("🩺 [Watchdog] Fresh room çekilemedi:", error);
          return;
        }

        // 2. ends_at hesapla
        let recoveredEndsAt: number | null = null;
        if (freshRoom.countdown_started_at) {
          const cdStart = new Date(freshRoom.countdown_started_at).getTime();
          recoveredEndsAt = cdStart + 10000 + 120 * 1000; // 5s buffer + 5s countdown + 120s game
        } else if ((freshRoom as any).ends_at) {
          recoveredEndsAt = new Date((freshRoom as any).ends_at).getTime();
        } else if ((freshRoom as any).started_at) {
          recoveredEndsAt = new Date((freshRoom as any).started_at).getTime() + 120 * 1000;
        }

        if (!recoveredEndsAt) {
          console.warn("🩺 [Watchdog] ends_at hesaplanamadı, fresh room timing verisi eksik");
          return;
        }

        // 3. Mevcut interval'i temizle (varsa) ve ref'i resetle ki effect yeniden init etsin
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        endsAtTimestampRef.current = recoveredEndsAt;

        // 4. Effect'i tetikleyerek timer interval'ini yeniden başlat
        setTimerWatchdogTick((t) => t + 1);

        // 5. İlk değeri hemen göster
        const nowSrv = Date.now() + serverTimeOffset;
        const remaining = Math.max(0, Math.min(120, Math.floor((recoveredEndsAt - nowSrv) / 1000)));
        timeLeftRef.current = remaining;
        setDisplayTime(remaining);
        lastSeenTime = remaining;
        stuckSince = Date.now();

        // 🔧 FIX: Effect re-trigger fail ederse, interval'ı doğrudan watchdog başlatsın
        setTimeout(() => {
          if (!isMountedRef.current || gameEndedRef.current) return;
          if (timerRef.current) return; // Effect zaten başlattıysa atla

          console.warn("🩺 [Watchdog] Effect tetiklenmedi, interval doğrudan başlatılıyor (fallback)");
          let lastSec = timeLeftRef.current;
          timerRef.current = setInterval(() => {
            if (!endsAtTimestampRef.current || !isMountedRef.current || gameEndedRef.current) {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              return;
            }
            const now = Date.now() + serverTimeOffset;
            const sec = Math.min(120, Math.max(0, Math.floor((endsAtTimestampRef.current - now) / 1000)));
            if (sec !== lastSec) {
              lastSec = sec;
              timeLeftRef.current = sec;
              setDisplayTime(sec);
            }
            if (sec <= 0 && !gameEndedRef.current) {
              gameEndedRef.current = true;
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              const finalizeSession = roomSessionRef.current;
              const finalizeRoomId = currentRoomIdRef.current;
              handleGameEnd();
              if (gameEndFinalizeTimeoutRef.current) clearTimeout(gameEndFinalizeTimeoutRef.current);
              gameEndFinalizeTimeoutRef.current = setTimeout(() => {
                gameEndFinalizeTimeoutRef.current = null;
                if (
                  !isMountedRef.current ||
                  roomSessionRef.current !== finalizeSession ||
                  currentRoomIdRef.current !== finalizeRoomId
                ) {
                  console.log("🚫 Eski maça ait finalize timeout yok sayıldı (watchdog)");
                  return;
                }
                setGameEnded(true);
                checkWinnerWithScores(playerScoreRef.current, opponentScoreRef.current);
              }, 50);
            }
          }, 200);
        }, 500);

        console.log("🩺 [Watchdog] ✅ Kurtarma tamamlandı, timer yeniden başlatıldı", {
          recoveredEndsAt: new Date(recoveredEndsAt).toISOString(),
          remaining,
        });
      } catch (err) {
        console.error("🩺 [Watchdog] Kurtarma hatası:", err);
      } finally {
        // Aynı anda tekrar tetiklenmesini önle, ama 3sn sonra yeni denemeye izin ver
        setTimeout(() => {
          watchdogRecoveringRef.current = false;
        }, 3000);
      }
    }, 1000);

    return () => clearInterval(watchdog);
  }, [
    gameStarted,
    gameEnded,
    gameType,
    gameMode,
    currentRoom?.id,
    currentRoom?.countdown_started_at,
    serverTimeOffset,
  ]);

  // GameContext'teki participants zaten real-time güncel tutuluyor
  // Bu ekstra güncelleme titreme yapıyordu

  // ❌ KALDIRILDI: Gereksiz real-time listener
  // GameContext'te zaten optimistic update yapılıyor
  // Bu ekstra listener ve fetch titreme yapıyordu

  // Timer sync for private-room and random-match games using server started_at
  // ⚠️ DİKKAT: Bu sync timer'ı DEVRE DIŞI - timestamp-based timer zaten server sync'li çalışıyor
  // İki timer aynı anda çalışınca 3'er 3'er atlıyor
  const startedAtRef = useRef<string | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // ❌ SYNC TIMER DEVRE DIŞI - timestamp-based timer yeterli
    return () => {
      console.log("🧹 Sync interval cleanup (disabled)");
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [gameType, gameMode, gameStarted, gameEnded, currentRoom?.started_at, currentRoom?.time_limit, currentRoom?.id]);

  // started_at değiştiğinde ref'i resetle
  useEffect(() => {
    if (!currentRoom?.started_at) {
      startedAtRef.current = null;
    }
  }, [currentRoom?.id]);

  // Focus/blur event handler
  useEffect(() => {
    if (gameType !== "timed" || !gameStarted || gameEnded) return;

    // Focus/blur olaylarında hiçbir şey yapma - sadece timer devam etsin
    const handleFocus = () => {
      console.log("📱 Sayfa focus aldı - timer devam ediyor");
    };

    const handleBlur = () => {
      console.log("📱 Sayfa focus kaybetti - timer devam ediyor");
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [gameType, gameStarted, gameEnded]);

  // Timer useEffect'inden SONRA ekleyin
  useEffect(() => {
    if (gameStarted && !gameEnded) {
      setGameStartTime(Date.now());
    }
  }, [gameStarted, gameEnded]);

  // Check win conditions based on game type
  useEffect(() => {
    if (gameType === "score" && gameStarted && !gameEnded) {
      const maxScore = currentRoom?.max_score || 500;

      // ⬇️ SADECE 0'dan büyük skorları kontrol et ve minimum skor eşiği ekle
      const shouldEndGame =
        (playerScore >= maxScore && playerScore > 10) || (opponentScore >= maxScore && opponentScore > 10);

      if (shouldEndGame) {
        console.log("🏁 Score mode game end triggered:", {
          playerScore,
          opponentScore,
          maxScore,
          gameStarted,
          gameEnded,
          gameMode,
        });
        setGameEnded(true);

        // Tournament mode için SADECE handleGameEnd çağır (skor kaydetmeyi handleTournamentMatchEnd yapacak)
        if (gameMode === "tournament" && tournamentMatch) {
          console.log("🏆 Tournament score mode - handleGameEnd çağrılıyor");
          setGameEnded(true);
          handleGameEnd();
        } else {
          // Diğer modlar için normal akış
          checkWinnerWithScores(playerScore, opponentScore);
        }
      }
    }
  }, [
    playerScore,
    opponentScore,
    checkWinnerWithScores,
    gameType,
    currentRoom?.max_score,
    gameStarted,
    gameEnded,
    gameMode,
    handleGameEnd,
  ]);

  // Check if playing with AI (unified logic for all modes)
  const isPlayingWithAI = useCallback(() => {
    const aiStatus = (() => {
      switch (gameMode) {
        case "vs-computer":
          return true;
        case "tournament": {
          if (tournamentMatch) {
            const opponentId =
              tournamentMatch.player1_id === user?.id ? tournamentMatch.player2_id : tournamentMatch.player1_id;

            // Bot kontrolü - tournament_participants tablosundaki is_bot flag'ini kontrol et
            // Önce participants'ta is_bot flag'ini kontrol et
            const opponentParticipant = tournamentParticipants.find((p) => String(p.user_id) === String(opponentId));

            // is_bot flag'i true ise veya bot_ prefix'i varsa AI olarak kabul et
            const isBot =
              !opponentId ||
              opponentId === null ||
              opponentId === undefined ||
              opponentParticipant?.is_bot === true ||
              String(opponentId).startsWith("bot_") ||
              opponentId === "bot";

            console.log("🤖 Tournament AI Check:", {
              matchId: tournamentMatch.id.slice(-8),
              opponentId: opponentId?.slice(-8) || "NULL",
              isBot,
              isBotFlag: opponentParticipant?.is_bot,
              player1: tournamentMatch.player1_id?.slice(-8),
              player2: tournamentMatch.player2_id?.slice(-8),
              currentUser: user?.id?.slice(-8),
            });

            return isBot;
          }
          return false;
        }
        case "private-room":
          return participants.some((p) => p.is_bot === true) || participants.length < 2;
        case "random-match":
          const hasAI = participants.some((p) => p.is_bot);
          const hasRealOpponent = participants.filter((p) => !p.is_bot).length >= 2;
          return hasAI && !hasRealOpponent;
        default:
          return false;
      }
    })();

    console.log("🤖 AI Status Final - Mode:", gameMode, "PlayingWithAI:", aiStatus);
    return aiStatus;
  }, [gameMode, participants, tournamentMatch, user?.id, tournamentParticipants]);

  // Real-time kelime senkronizasyonu
  useEffect(() => {
    if (!currentRoom?.id || !user) return;

    console.log("🔄 === WORD SYNC BAŞLADI ===");
    console.log("🔄 Room ID:", shortId(currentRoom?.id));

    const syncUsedWords = async () => {
      if (syncingRef.current) {
        console.log("🔄 Sync already in progress, skipping");
        return;
      }

      syncingRef.current = true;

      try {
        if (gameMode === "vs-computer") {
          console.log("🤖 vs-computer mode: Not loading previous words, starting fresh");
          setGlobalUsedWords(new Set());
          setUsedWords(new Set());
          return;
        }

        const { data: roomWords } = await supabase
          .from("game_words")
          .select("word, player_id")
          .eq("room_id", currentRoom.id);

        if (roomWords) {
          const allWordsSet = new Set(roomWords.map((w) => w.word.toLocaleUpperCase("tr-TR")));
          const myWordsSet = new Set(
            roomWords.filter((w) => w.player_id === user.id).map((w) => w.word.toLocaleUpperCase("tr-TR")),
          );

          console.log("🔄 Syncing - All words:", allWordsSet.size, "My words:", myWordsSet.size);
          setGlobalUsedWords(allWordsSet as Set<string>);
          setUsedWords(myWordsSet as Set<string>);
        }
      } catch (error) {
        console.error("❌ Word sync error:", error);
      } finally {
        syncingRef.current = false;
      }
    };

    const initialSyncTimer = setTimeout(syncUsedWords, 500);

    const wordChannel = supabase
      .channel(`mobile-words-${currentRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_words",
          filter: `room_id=eq.${currentRoom.id}`,
        },
        (payload) => {
          console.log("📱 Mobile real-time word:", payload.new?.word, "from player:", payload.new?.player_id);

          if (payload.new?.word && !syncingRef.current && payload.new?.player_id !== user.id) {
            const newWord = payload.new.word.toLocaleUpperCase("tr-TR");

            setTimeout(() => {
              setGlobalUsedWords((prev) => new Set([...prev, newWord]));
            }, 100);
          }
        },
      )
      .subscribe();

    // ⚠️ CLEANUP DEVRE DIŞI - Bağlantı koruması
    return () => {
      clearTimeout(initialSyncTimer);
      console.log("⚠️ [GamePage] Mobile word sync cleanup ATLANYOR (bağlantı koruması)");
      // ❌ DEVRE DIŞI: supabase.removeChannel(wordChannel);
    };
  }, [currentRoom?.id, user?.id, gameMode]);

  // 🏆 Turnuva real-time senkronizasyonu - Ref ile closure sorunu çözümü
  const tournamentChannelRef = useRef<any>(null);
  const tournamentMatchIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (gameMode !== "tournament" || !tournamentMatch) {
      // Turnuva modundan çıkıldığında channel'ı temizle
      if (tournamentChannelRef.current) {
        console.log("🧹 Turnuva channel temizleniyor (mod değişti)");
        supabase.removeChannel(tournamentChannelRef.current);
        tournamentChannelRef.current = null;
        tournamentMatchIdRef.current = null;
      }
      return;
    }

    // Aynı maç için zaten subscription varsa yeni oluşturma
    if (tournamentMatchIdRef.current === tournamentMatch.id && tournamentChannelRef.current) {
      console.log("⏭️ Turnuva subscription zaten aktif:", tournamentMatch.id.slice(-8));
      return;
    }

    // Önceki subscription'ı temizle (farklı maç için)
    if (tournamentChannelRef.current) {
      console.log("🔄 Eski turnuva channel temizleniyor, yeni maç için");
      supabase.removeChannel(tournamentChannelRef.current);
    }

    console.log("🏆 Turnuva real-time senkronizasyon başlatıldı:", tournamentMatch.id.slice(-8));
    tournamentMatchIdRef.current = tournamentMatch.id;

    // Tournament match değişikliklerini dinle
    const tournamentChannel = supabase
      .channel(`tournament-match-${tournamentMatch.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournament_matches",
          filter: `id=eq.${tournamentMatch.id}`,
        },
        (payload) => {
          console.log("🔄 Tournament match güncellendi:", payload.new);

          // Rakip skorunu real-time güncelle
          const newMatch = payload.new as any;
          const currentUserId = user?.id;

          if (currentUserId) {
            const isPlayer1 = String(newMatch.player1_id) === String(currentUserId);
            const newOpponentScore = isPlayer1 ? (newMatch.player2_score ?? 0) : (newMatch.player1_score ?? 0);
            const newPlayerScore = isPlayer1 ? (newMatch.player1_score ?? 0) : (newMatch.player2_score ?? 0);

            console.log("🔄 Real-time tournament sync:", {
              isPlayer1,
              newPlayerScore,
              newOpponentScore,
            });

            // 🔥 Functional update kullan - closure sorunu yok!
            setOpponentScore((prev) => {
              if (newOpponentScore !== prev) {
                console.log("🔄 Rakip skoru güncellendi:", prev, "->", newOpponentScore);
                return newOpponentScore;
              }
              return prev;
            });

            // Kendi skorumuzu güncelleme - kendi skorumuz zaten local'de güncel
            // Sadece rakipten gelen skor güncellemesini al
          }
        },
      )
      .subscribe((status) => {
        console.log("🏆 Tournament channel status:", status);
      });

    tournamentChannelRef.current = tournamentChannel;

    return () => {
      // Cleanup sadece component unmount olduğunda
      console.log("⚠️ [GamePage] Turnuva real-time useEffect cleanup");
      // NOT: Channel'ı burada temizlemiyoruz çünkü bağlantı koruması aktif
      // Sadece tournamentMatch değiştiğinde veya gameMode değiştiğinde temizle
    };
  }, [gameMode, tournamentMatch?.id, user?.id]);

  // İlk sync
  useEffect(() => {
    if (!currentRoom) return;

    const initialSyncTimer = setTimeout(syncUsedWords, 500);

    // Real-time word changes dinle
    const wordChannel = supabase
      .channel(`mobile-words-${currentRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_words",
          filter: `room_id=eq.${currentRoom.id}`,
        },
        (payload) => {
          console.log("📱 Mobile real-time word:", payload.new?.word, "from player:", payload.new?.player_id);

          // Don't process words from the current user to prevent duplicate validation
          if (payload.new?.word && !syncingRef.current && payload.new?.player_id !== user?.id) {
            const newWord = payload.new.word.toLocaleUpperCase("tr-TR");

            // Debounced update - only for other players' words
            setTimeout(() => {
              setGlobalUsedWords((prev) => new Set([...prev, newWord]));
              // Do NOT add to setUsedWords here; keep my words separate
            }, 100);
          }
        },
      )
      .subscribe();

    // ⚠️ CLEANUP DEVRE DIŞI - Bağlantı koruması
    return () => {
      clearTimeout(initialSyncTimer);
      console.log("⚠️ [GamePage] Mobile word sync cleanup 2 ATLANYOR (bağlantı koruması)");
      // ❌ DEVRE DIŞI: supabase.removeChannel(wordChannel);
    };
  }, [currentRoom?.id, user?.id]);

  const syncUsedWords = async () => {
    if (syncingRef.current) return;

    syncingRef.current = true;

    try {
      if (gameMode === "vs-computer") {
        setGlobalUsedWords(new Set());
        setUsedWords(new Set());
        return;
      }

      const { data: roomWords } = await supabase
        .from("game_words")
        .select("word, player_id")
        .eq("room_id", currentRoom.id);

      if (roomWords) {
        const allWordsSet = new Set(roomWords.map((w) => w.word.toLocaleUpperCase("tr-TR")));
        const myWordsSet = new Set(
          roomWords.filter((w) => w.player_id === user?.id).map((w) => w.word.toLocaleUpperCase("tr-TR")),
        );

        setGlobalUsedWords(allWordsSet as Set<string>);
        setUsedWords(myWordsSet as Set<string>);
      }
    } catch (error) {
      console.error("❌ Word sync error:", error);
    } finally {
      syncingRef.current = false;
    }
  };

  // Tournament activity tracking (removed - not needed for core functionality)

  // AI continuous play effect - unified for all modes when playing with AI
  // isPlayingWithAI bir ref üzerinden tutulur - dependency array sorunundan kaçınmak için
  const aiPlayingRef = useRef(false);
  useEffect(() => {
    aiPlayingRef.current = isPlayingWithAI();
  }, [isPlayingWithAI]);

  useEffect(() => {
    if (!gameStarted || gameEnded || !user) {
      return;
    }

    // gameStarted olduğunda AI durumunu bir kez al - stale closure önlemek için
    const aiPlaying = aiPlayingRef.current;
    if (!aiPlaying) {
      console.log("🤖 AI not playing:", { gameStarted, gameEnded, gameMode });
      return;
    }

    console.log("🤖 Starting AI play with setTimeout for game mode:", gameMode);
    let cancelled = false;

    const scheduleNextAIWord = () => {
      if (cancelled) return;
      // Turnuva: round'a göre artan zorluk (çeyrek 2.5-25s, yarı 2.5-20s, final 2.5-15s)
      // Random-match botu normal AI modundan biraz daha hızlı
      let minDelay = 2500;
      let maxDelay = 25000;
      if (gameMode === "tournament") {
        const round = tournamentMatch?.round ?? 1;
        minDelay = 2500;
        maxDelay = round >= 3 ? 15000 : round === 2 ? 20000 : 25000;
      } else if (gameMode === "random-match") {
        minDelay = 1500;
        maxDelay = 12000;
      }
      const delay = minDelay + Math.random() * (maxDelay - minDelay);

      setTimeout(async () => {
        if (cancelled) return;
        try {
          const potentialWords = [
            // Kısa kelimeler (3-4 harf) - kolay, sık
            "KEDİ",
            "MASA",
            "ARABA",
            "OKUL",
            "KİTAP",
            "EV",
            "GÖZ",
            "EL",
            "YOL",
            "SU",
            "DİŞ",
            "BAŞ",
            "KOL",
            "AY",
            "GÜN",
            "YIL",
            "AKİL",
            "İPEK",
            "GÜL",
            "TAŞ",
            "ODA",
            "KAPI",
            "YATAK",
            "KOLA",
            "ÇAY",
            "SÜT",
            "TUZ",
            "EKŞİ",
            "EV",
            // Orta kelimeler (5-7 harf) - puan için güzel
            "DENİZ",
            "AĞAÇ",
            "ÇİÇEK",
            "GÜNEŞ",
            "YILDIZ",
            "BULUT",
            "RÜZGAR",
            "ATEŞ",
            "TOPRAK",
            "SEVGİ",
            "MUTLU",
            "UMUT",
            "HAYAL",
            "MÜZİK",
            "DANS",
            "ŞARKI",
            "OYUN",
            "SPOR",
            "FUTBOL",
            "TENİS",
            "YÜZME",
            "KOŞU",
            "YEMEK",
            "EKMEK",
            "PEYNİR",
            "DOMATES",
            "SALATA",
            "ÇORBA",
            "MEYVE",
            "ELMA",
            "ARMUT",
            "ÇİLEK",
            "KIRAZ",
            "ÜZÜM",
            "MANGO",
            "HAVUÇ",
            "BİBER",
            "SOĞAN",
            "PATATES",
            "KÖPEK",
            "BALINA",
            "ASLAN",
            "KAPLAN",
            "ZÜRAFA",
            "PENGUEN",
            "LEYLEK",
            "PENCERE",
            "SALON",
            "MUTFAK",
            "BANYO",
            "KAHVE",
            "ŞEKER",
            "OKUYUCU",
            "YAZICI",
            "ÇALIŞMA",
            "TOPLAMA",
            "ÇARPMA",
            "BÖLME",
            "YARIŞMA",
            "TURNUVA",
            "KAZANAN",
            "BAŞARI",
            "GURUR",
            "CESUR",
            "DENEYİM",
            "BİLGİSAYAR",
            "TELEFON",
            "TABLET",
            "UÇAK",
            "GEMİ",
            "KÖPRÜ",
            "TÜNEL",
            "YÜKSEK",
            "DERİN",
            "GENIŞ",
            "UZUN",
            // Uzun kelimeler (8+ harf) - yüksek puan
            "DOSTLUK",
            "RENKLER",
            "MUTLULUK",
            "BİSİKLET",
            "BASKETBOL",
            "PATLICAN",
            "SARIMSAK",
            "PORTAKAL",
            "MÜHENDIS",
            "ÖĞRETMEN",
            "DOKTORLUK",
            "KARDEŞLIK",
            "ARKADAŞLIK",
            "BERBERLIK",
            "GELENEKSEL",
            "KÜTÜPHANE",
            "HASTAHANE",
            "ÜNIVERSITE",
            "MİMARLIK",
          ];

          // Kelime listesini karıştır, daha büyük havuzdan seç
          const shuffledWords = [...potentialWords].sort(() => Math.random() - 0.5);
          let wordUsed = false;
          const currentGlobalUsed = globalUsedWordsRef.current;

          for (const word of shuffledWords) {
            const normalizedWord = word.toLocaleUpperCase("tr-TR");

            if (!currentGlobalUsed.has(normalizedWord)) {
              // Random-match botu normal AI moduna göre biraz daha yüksek puan kazanır
              const basePoints =
                gameMode === "tournament"
                  ? Math.floor(Math.random() * 24) + 12 // 12-35 puan
                  : gameMode === "random-match"
                    ? Math.floor(Math.random() * 14) + 10 // 10-23 puan
                    : Math.floor(Math.random() * 15) + 8; // 8-22 puan (ai mode)
              // Uzun kelimelere bonus
              const lengthBonus =
                word.length >= 8
                  ? Math.floor(Math.random() * (gameMode === "random-match" ? 13 : 15)) +
                    (gameMode === "random-match" ? 10 : 10)
                  : word.length >= 6
                    ? Math.floor(Math.random() * (gameMode === "random-match" ? 7 : 8)) +
                      (gameMode === "random-match" ? 5 : 5)
                    : 0;
              const points = basePoints + lengthBonus;

              const currentOpponentScore = opponentScoreRef.current;
              console.log(
                `🤖 AI used word in ${gameMode}: ${word} with ${points} points (Total opponents: ${currentOpponentScore + points})`,
              );

              const newOpponentScore = currentOpponentScore + points;
              setOpponentScore(newOpponentScore);
              setOpponentWords((prev) => [...prev, word]);
              setOpponentWordsWithScores((prev) => [...prev, { word, score: points }]);

              // 🔇 AI rakip kelime yazdığında bip sesi çıkarılmıyor (kullanıcı isteği)

              // globalUsedWordsRef'i güncelle - set state async olduğundan ref üzerinden de ekle
              globalUsedWordsRef.current = new Set([...currentGlobalUsed, normalizedWord]);
              setGlobalUsedWords(new Set([...currentGlobalUsed, normalizedWord]));

              // Turnuva modunda Supabase'i de güncelle
              if (gameMode === "tournament" && tournamentMatch && user) {
                const isPlayer1 = tournamentMatch.player1_id === user.id;
                const updateField = isPlayer1 ? "player2_score" : "player1_score";

                try {
                  // Fire-and-forget — botun bir sonraki kelimeyi planlamasını network gecikmesi bloklamasın
                  supabase
                    .from("tournament_matches")
                    .update({
                      [updateField]: newOpponentScore,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", tournamentMatch.id)
                    .then(({ error }) => {
                      if (error) console.error("❌ Bot tournament score update error:", error);
                      else console.log("🏆 Tournament bot score updated in DB:", newOpponentScore);
                    });
                } catch (error) {
                  console.error("❌ Bot tournament score update error:", error);
                }
              }

              wordUsed = true;
              break;
            }
          }

          if (!wordUsed) {
            // Fallback: kelime listesi tükendi, puan ver
            const fallbackPoints =
              gameMode === "tournament"
                ? Math.floor(Math.random() * 20) + 10 // 10-29
                : Math.floor(Math.random() * 6) + 3; // 3-8
            const currentOpponentScore = opponentScoreRef.current;
            const newScore = currentOpponentScore + fallbackPoints;
            setOpponentScore(newScore);
            console.log(`🤖 AI couldn't find unused word, got fallback ${fallbackPoints} points (Total: ${newScore})`);

            if (gameMode === "tournament" && tournamentMatch && user) {
              const isPlayer1 = tournamentMatch.player1_id === user.id;
              const updateField = isPlayer1 ? "player2_score" : "player1_score";

              try {
                supabase
                  .from("tournament_matches")
                  .update({
                    [updateField]: newScore,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", tournamentMatch.id)
                  .then(({ error }) => {
                    if (error) console.error("❌ Bot fallback score update error:", error);
                  });
              } catch (error) {
                console.error("❌ Bot fallback score update error:", error);
              }
            }
          }
        } catch (error) {
          console.error("🤖 AI word selection error:", error);
          const errorPoints =
            gameMode === "tournament" ? Math.floor(Math.random() * 15) + 8 : Math.floor(Math.random() * 5) + 2;
          const currentOpponentScore = opponentScoreRef.current;
          setOpponentScore(currentOpponentScore + errorPoints);
          console.log(`🤖 AI error, got ${errorPoints} points`);
        }
        // Sonraki kelimeyi planla
        scheduleNextAIWord();
      }, delay);
    };

    scheduleNextAIWord();

    return () => {
      console.log("🤖 Stopping AI play for game mode:", gameMode);
      cancelled = true;
    };
  }, [gameStarted, gameEnded, gameMode, user?.id, tournamentMatch?.id, tournamentMatch?.round]);

  // lastPlayerAction'ı başlat
  useEffect(() => {
    if (gameStarted && !gameEnded) {
      setLastPlayerAction(Date.now());
    }
  }, [gameStarted, gameEnded]);

  // 🤖 vs-computer modunda otomatik countdown başlatma - CLIENT TIME KULLAN
  useEffect(() => {
    if (gameMode === "vs-computer" && !gameStarted && !showCountdown && !gameEnded) {
      console.log("🤖 vs-computer mode - countdown hazırlanıyor (7s buffer ile)");
      setWaitingForPlayer(false);

      // Rakip hazırlanıyor animasyonu başlat (5 saniyelik buffer)
      setPreparingOpponent("preparing");

      // 3 saniye sonra "Oyuncu Hazır!" göster (geri sayıma 2sn kala)
      setTimeout(() => {
        setPreparingOpponent("ready");
      }, 3000);

      // 3.5 saniye sonra animasyonu temizle (geri sayıma 1.5sn kala bitmiş olsun)
      setTimeout(() => {
        setPreparingOpponent(null);
      }, 3500);

      // 5 saniye sonra countdown başlat
      // ÖNEMLİ: Countdown component'i serverStartTime'dan itibaren 5 saniye sayıyor
      // React render gecikmesi için 100ms buffer ekliyoruz
      setTimeout(() => {
        const countdownStart = new Date(Date.now()).toISOString();
        console.log("🤖 vs-computer countdown başlıyor:", countdownStart);
        setCountdownServerTime(countdownStart);
        setShowCountdown(true);
      }, 5000);

      setGameStarted(false);
    }
  }, [gameMode, gameStarted, showCountdown, gameEnded]);

  // 🎯 Countdown event listener (tüm modlar için)
  useEffect(() => {
    const handleCountdownStart = (event: CustomEvent) => {
      if (gameMode === "vs-computer") {
        return;
      }

      if (showCountdown || countdownServerTime || gameStarted || countdownInitiatedRef.current) {
        console.log("⚠️ Countdown zaten aktif veya oyun başladı - event ignored");
        return;
      }

      const { serverTime } = event.detail;
      const countdownStartTime = new Date(serverTime).getTime();
      const shouldSkipBuffer = Date.now() + serverTimeOffset - countdownStartTime >= 5000;

      console.log("⏰ Countdown event alındı:", {
        serverTime,
        shouldSkipBuffer,
      });

      initiateCountdown(serverTime, shouldSkipBuffer);
    };

    window.addEventListener("countdownStarted", handleCountdownStart as EventListener);

    return () => {
      window.removeEventListener("countdownStarted", handleCountdownStart as EventListener);
    };
  }, [gameMode, showCountdown, countdownServerTime, gameStarted, initiateCountdown, serverTimeOffset]);

  // ⏱️ Initial server countdown sync for private/random - 5sn buffer ile
  // 🔒 Bu useEffect artık initiateCountdown fonksiyonunu kullanıyor - duplicate mantık yok
  useEffect(() => {
    // KORUMA: Realtime zaten tetiklediyse veya oyun başladıysa veya countdown görünüyorsa girme
    if (
      (gameMode === "private-room" || gameMode === "random-match") &&
      currentRoom?.countdown_started_at &&
      !showCountdown &&
      !gameStarted &&
      !countdownServerTime &&
      serverTimeReady &&
      !countdownInitiatedRef.current
    ) {
      // Eğer bu timestamp daha önce işlendiyse tekrar işleme
      if (processedCountdownRef.current === currentRoom.countdown_started_at) {
        return;
      }
      const countdownStartTime = new Date(currentRoom.countdown_started_at).getTime();
      const shouldSkipBuffer = Date.now() + serverTimeOffset - countdownStartTime >= 5000;

      console.log("⏰ Initial countdown sync from room state:", {
        countdownStartedAt: currentRoom.countdown_started_at,
        shouldSkipBuffer,
      });

      // 🎯 Merkezi initiateCountdown fonksiyonunu kullan
      initiateCountdown(currentRoom.countdown_started_at, shouldSkipBuffer);
    }
  }, [
    gameMode,
    currentRoom?.countdown_started_at,
    showCountdown,
    gameStarted,
    serverTimeOffset,
    countdownServerTime,
    serverTimeReady,
    initiateCountdown,
  ]);

  // 🔍 GÜNCELLENMİŞ SÜRE YÖNETİMİ - Server Time Sync + 5sn Buffer
  // 🔒 Bu useEffect SADECE RANDOM-MATCH için RPC ile countdown başlatıyor
  // 🎯 ÖZEL ODA için countdown satır 4500-4580'deki useEffect tarafından başlatılıyor
  useEffect(() => {
    // 1. GEREKSİZ DURUMLARDA ÇIK
    // 🎯 KRİTİK: SADECE RANDOM-MATCH için bu yolu kullan - Özel oda ayrı bir mekanizma kullanıyor
    if (gameMode !== "random-match") return;
    if (showCountdown || gameStarted || gameHasStartedRef.current) return;
    if (countdownCheckDoneRef.current) return; // Kilit aktifse girme
    if (!serverTimeReady) return; // Server time hazır değilse bekle
    if (countdownInitiatedRef.current) return; // 🔒 Countdown zaten başlatıldıysa girme

    const realPlayers = participants.filter((p) => !p.is_bot && p.user_id !== null);
    if (realPlayers.length < 2) return;

    // 🔒 KİLİTLE (Taramalı tüfek sesini engeller)
    countdownCheckDoneRef.current = true;

    const checkCountdown = async () => {
      if (!currentRoom?.id) return;

      try {
        console.log("🔒 Senkronizasyon kontrolü (Server Time Sync) - RANDOM MATCH...");

        // A. Veritabanından zamanı çek
        const { data } = await supabase
          .from("game_rooms")
          .select("started_at, countdown_started_at")
          .eq("id", currentRoom.id)
          .single();

        let countdownStartedAt: string;

        // B. Veri yoksa RPC ile başlat
        if (!data?.countdown_started_at) {
          // KORUMA: Sadece oda sahibi (Host) geri sayımı başlatabilir!
          if (currentRoom.host_id === user?.id) {
            console.log("👑 Host yetkisi: Countdown RPC ile başlatılıyor...");
            const { data: rpcDate, error: rpcError } = await supabase.rpc("start_game_countdown", {
              p_room_id: currentRoom.id,
            });

            if (rpcError || !rpcDate) {
              console.error("❌ RPC hatası:", rpcError);
              return;
            }
            countdownStartedAt = rpcDate;
          } else {
            console.log("⏳ Misafir oyuncu: Host'un geri sayımı başlatması bekleniyor...");
            // 🔒 Kilidi geri aç ki realtime event'i yakalayabilsin
            countdownCheckDoneRef.current = false;
            return;
          }
        } else {
          // Zaten başlamışsa veriyi al
          countdownStartedAt = data.countdown_started_at;
        }

        const countdownStartTime = new Date(countdownStartedAt).getTime();
        const shouldSkipBuffer = Date.now() + serverTimeOffset - countdownStartTime >= 5000;

        console.log("🎯 Countdown başlatılıyor (RPC/DB sonrası):", {
          countdownStartedAt,
          shouldSkipBuffer,
        });

        // 🎯 Merkezi initiateCountdown fonksiyonunu kullan - duplicate mantık yok!
        initiateCountdown(countdownStartedAt, shouldSkipBuffer);
      } catch (error) {
        console.error("❌ Countdown hatası:", error);
      }
    };

    checkCountdown();
  }, [
    gameMode,
    participants.length,
    showCountdown,
    gameStarted,
    currentRoom?.id,
    serverTimeReady,
    serverTimeOffset,
    initiateCountdown,
    currentRoom?.host_id,
    user?.id,
  ]);

  // Multiplayer (private-room & random-match) waiting/start logic
  useEffect(() => {
    if (gameMode === "private-room" || gameMode === "random-match") {
      const realPlayers = participants.filter((p) => !p.is_bot && p.user_id !== null);
      const roomActive = currentRoom?.status === "active";
      const aiPlaying = isPlayingWithAI();

      if (roomActive && (realPlayers.length >= 2 || aiPlaying)) {
        console.log("✅ Oyun başlıyor! Koşul:", { realPlayers: realPlayers.length, aiPlaying });
        setWaitingForPlayer(false);

        // 🎯 Countdown GameContext tarafından başlatılıyor - burada duplike kod yok!

        if (!hasShownStartMessage) {
          setHasShownStartMessage(true);
          const modeLabel = gameMode === "private-room" ? "Özel Oda" : "Rastgele Eşleşme";
        }
      } else {
        // PRESENCE GLITCH GUARD: Oyun başladıysa geçici ayrılmaları görmezden gel, grid kilitlenmesin
        if (!gameStarted) {
          setWaitingForPlayer(true);
          // Oyun başlamadan önce beklemeye dönerse tekrar geri sayım hakkı tanı
          gameHasStartedRef.current = false;
          gameStartedRef.current = false; // Arka plan disconnect kontrolü için sıfırla
          setHasShownStartMessage(false);
        } else {
          console.log("⏳ Geçici oyuncu ayrılığı (presence) tespit edildi, oynanabilirliği koruyoruz");
        }
      }
    }
  }, [
    participants,
    gameMode,
    hasShownStartMessage,
    gameType,
    toast,
    currentRoom?.status,
    gameStarted,
    showCountdown,
    isPlayingWithAI,
  ]);

  // 🔄 useRematch hook'undan gelen state'leri senkronize et
  useEffect(() => {
    if (rematchIsWaiting) {
      // Context isWaiting true oldu, sending tamamlandı
      rematchSendingRef.current = false;
      setWaitingForRematchResponse(true);
    } else if (waitingForRematchResponse && !rematchIsWaiting && !rematchSendingRef.current) {
      // Hook waiting'i kapattı (timeout veya response) VE aktif gönderim yok
      setWaitingForRematchResponse(false);
      setRematchRequested(false);
      disconnectHandledRef.current = false;
    }
  }, [rematchIsWaiting]);

  // NOT: handleRematchAccept ve handleRematchReject artık global RematchContext tarafından yönetiliyor
  // GamePage'de bu fonksiyonlara gerek yok - RematchDialog App.tsx'te global olarak render ediliyor

  // Touch olayları için optimize edilmiş handler
  const handleLetterTouch = (letter: string, row: number, col: number, event: React.TouchEvent) => {
    event.preventDefault(); // Default touch davranışını engelle
    event.stopPropagation();
    handleLetterClick(letter, row, col);
  };

  // Mouse olayları için optimize edilmiş handler
  const handleLetterMouse = (letter: string, row: number, col: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handleLetterClick(letter, row, col);
  };

  // Handle letter click
  const lastCellTapRef = useRef<Record<string, number>>({});
  const handleLetterClick = useCallback(
    (letter: string, row: number, col: number) => {
      if (gameEnded || (waitingForPlayer && !gameStarted) || (isJokerActive && !isFisildaAnimating)) return;

      // Kullanıcı harfe dokunduğunda "kelime göndermedin" göz animasyonunu kapat
      if (showKelimeGondermedinAnim) setShowKelimeGondermedinAnim(false);

      // Per-hücre debounce: farklı harflere hızlı basınca hiçbiri kaçmaz,
      // sadece aynı hücreye çok hızlı çift dokunma engellenir.
      const now = Date.now();
      const cellKey = `${row}-${col}`;
      if (now - (lastCellTapRef.current[cellKey] || 0) < 120) return;
      lastCellTapRef.current[cellKey] = now;

      // Haptic feedback (mobil cihazlarda titreşim)
      if (!isNative && "vibrate" in navigator) {
        navigator.vibrate(50);
      }

      playSound("buttonClick");

      // Functional update: hızlı ardışık dokunmalarda stale state yüzünden harf kaybolmaz
      setSelectedLetters((prev) => {
        const exists = prev.some((s) => s.row === row && s.col === col);
        return exists ? prev.filter((s) => !(s.row === row && s.col === col)) : [...prev, { letter, row, col }];
      });
    },
    [
      gameEnded,
      waitingForPlayer,
      gameStarted,
      isJokerActive,
      isFisildaAnimating,
      showKelimeGondermedinAnim,
      playSound,
      isNative,
    ],
  );


  // Clear current word
  const clearWord = () => {
    setSelectedLetters([]);
    // currentWord artık derived value, otomatik temizlenecek
  };

  // Input field içinde feedback gösterme fonksiyonu
  const showCustomToast = (
    title: string,
    _description: string,
    color: "red" | "green" | "white" | "blue" | "bonus" = "red",
  ) => {
    // Önceki timer'ı temizle
    if (inputFeedbackTimerRef.current) {
      clearTimeout(inputFeedbackTimerRef.current);
    }

    const feedbackType =
      color === "green"
        ? "success"
        : color === "white"
          ? "success-long"
          : color === "blue"
            ? "success-xlong"
            : color === "bonus"
              ? "bonus"
              : "error";
    setInputFeedback({ text: title, type: feedbackType });

    // bonus için daha uzun süre göster
    const duration = color === "bonus" ? 1500 : 700;
    inputFeedbackTimerRef.current = setTimeout(() => {
      setInputFeedback(null);
      inputFeedbackTimerRef.current = null;
    }, duration);
  };

  // Submit word - Using local wordlist validation
  const submitWord = async () => {
    if ((waitingForPlayer && !gameStarted) || isJokerActive) return;

    // Prevent accidental double-taps/duplicate submissions (mobile)
    if (submissionLockRef.current) {
      console.log("⏳ Submission locked - ignoring duplicate tap");
      return;
    }
    submissionLockRef.current = true;

    setLastPlayerAction(Date.now());

    try {
      if (currentWord.length < 3) {
        showCustomToast("Geçersiz Kelime", "");
        return;
      }

      const normalizedWord = currentWord.toLocaleUpperCase("tr-TR");

      // Ignore rapid duplicate submission of the same word (e.g., double tap)
      if (recentSubmissionsRef.current.has(normalizedWord)) {
        console.log("⏳ Ignoring rapid duplicate submission for:", normalizedWord);
        return;
      }
      recentSubmissionsRef.current.add(normalizedWord);
      setTimeout(() => {
        recentSubmissionsRef.current.delete(normalizedWord);
      }, 800);

      // SADECE KENDİ KELİMELERİMİ KONTROL ET - rakibin kelimelerini değil!
      if (usedWords.has(normalizedWord)) {
        console.log("❌ Word already used by me!");
        showCustomToast("Kelime Zaten Kullanıldı", "");
        playSound("wrongWord");
        breakCombo();
        clearWord();
        return;
      }

      // LOCAL WORDLIST VALIDATION (CLIENT-SIDE, HIZLI)
      const result = validateWordLocal(currentWord);

      if (!result.isValid) {
        playSound("wrongWord");
        showCustomToast("Geçersiz Kelime", "");
        setInputFlash("error");
        setTimeout(() => setInputFlash(null), 600);
        breakCombo();
        clearWord();
        return;
      }

      console.log("✅ Word accepted:", currentWord, "Points:", result.points);

      // ✅ KELİMELE özel kontrolü
      const isKelimeleWord = normalizedWord === "KELİMELE";

      if (isKelimeleWord) {
        // 🎯 BONUS: Normal puanı 10 ile çarp
        result.points = result.points * 10;

        // Kazanma animasyonunu 1 kere oynat (~3sn)
        setShowKelimeleAnim(true);
        setTimeout(() => setShowKelimeleAnim(false), 3000);

        // Mor animasyon göster
        setInputFlash("success");
        setTimeout(() => setInputFlash(null), 600);
        showCustomToast("✨ BONUS ✨", "", "bonus");

        // Joker ödülleri ver (arka planda)
        if (user) {
          const jokerTypes = ["degistir", "fisilida", "senyaz"];
          jokerTypes.forEach(async (jokerType) => {
            try {
              const { data: existing } = await supabase
                .from("user_inventory")
                .select("id, quantity")
                .eq("user_id", user.id)
                .eq("item_type", jokerType)
                .maybeSingle();

              if (existing) {
                await supabase
                  .from("user_inventory")
                  .update({ quantity: existing.quantity + 1 })
                  .eq("id", existing.id);
              } else {
                await supabase.from("user_inventory").insert({ user_id: user.id, item_type: jokerType, quantity: 1 });
              }
            } catch (err) {
              console.error(`❌ Kelimele bonus joker (${jokerType}) hatası:`, err);
            }
          });

          // Rozet ver (SECURITY DEFINER RPC ile RLS bypass)
          (async () => {
            try {
              const { data: awarded, error: rpcErr } = await supabase.rpc("award_kelimele_badge", {
                p_user_id: user.id,
              });
              if (rpcErr) {
                console.error("❌ award_kelimele_badge RPC hatası:", rpcErr);
              } else if (awarded) {
                console.log("🏅 Kelimele rozeti kazanıldı!");
              } else {
                console.log("ℹ️ Kelimele rozeti zaten mevcut veya bulunamadı");
              }
            } catch (err) {
              console.error("❌ Kelimele rozet hatası:", err);
            }

            // Jokerleri yeniden yükle
            loadJokers();
          })();
        }
      } else {
        // Normal kelime: 6+ harf beyaz, kısa kelime yeşil feedback
        const isLong = normalizedWord.length >= 6;
        const isXLong = normalizedWord.length >= 7;
        setInputFlash(isXLong ? "success-xlong" : isLong ? "success-long" : "success");
        setTimeout(() => setInputFlash(null), 600);
        showCustomToast(normalizedWord, "", isXLong ? "blue" : isLong ? "white" : "green");

        // 🎉 5+ harfli kelimede ortada harf animasyonu (1 kerelik)
        if (normalizedWord.length >= 5) {
          setNiceCatchEvent((prev) => ({ id: prev.id + 1, length: normalizedWord.length }));
        }

        // 6+ harfli kelimede puan 2 katına çıkar ve ekstra animasyon göster
        if (isLong) {
          result.points = result.points * 2;
          if (normalizedWord.length >= 7) {
            setShowGunlukKonfetiAnim(true);
            setTimeout(() => setShowGunlukKonfetiAnim(false), 2500);
          } else {
            setShowAltiHarfAnim(true);
            setTimeout(() => setShowAltiHarfAnim(false), 2500);
          }
        }
      }

      // ✅ HEMEN GRİD'İ TEMİZLE VE UI'I GÜNCELLE (KULLANICI BEKLEMESİN)
      clearWord();

      // SADECE KENDİ LİSTEME EKLE - global'a ekleme, o real-time olarak gelecek
      setUsedWords((prev) => new Set([...prev, normalizedWord]));

      // Puan hesaplama HEMEN
      const newScore = playerScore + result.points;
      setPlayerScore(newScore);

      // 🔥 Combo boost tick (başarılı kelime)
      tickCombo();

      // Calculate first word time (in seconds)
      const wordTimestamp = Date.now();
      if (firstWordTime === null && gameStartTime > 0) {
        const timeToFirstWord = Math.floor((wordTimestamp - gameStartTime) / 1000);
        setFirstWordTime(timeToFirstWord);
        console.log("⚡ İlk kelime süresi:", timeToFirstWord, "saniye");
      }

      setPlayerWords((prev) => [...prev, currentWord]);
      setPlayerWordsWithScores((prev) => [
        ...prev,
        { word: currentWord, score: result.points, timestamp: wordTimestamp },
      ]);

      triggerWordEffects();

      // 🔥 DATABASE İŞLEMLERİNİ ARKA PLANDA YAP (fire-and-forget, kullanıcı beklemesin)

      // Database'e kelime kaydet (sadece multiplayer modlarda) - ASYNC, AWAIT'LEME
      if (currentRoom && user && (gameMode === "private-room" || gameMode === "random-match")) {
        supabase
          .from("game_words")
          .insert({
            room_id: currentRoom.id,
            player_id: user.id,
            word: normalizedWord,
            points: result.points,
          })
          .then((response) => {
            if (response.error) {
              console.error("❌ Database word save error:", response.error);
            } else {
              console.log("✅ Word saved to database:", normalizedWord);
              forceRefreshProfile?.();
            }
          });
      }

      // Profilde en uzun kelimeyi güncelle (tüm modlar) - ASYNC, AWAIT'LEME
      if (user) {
        const newLen = normalizedWord.length;
        const currentLen = profile?.longest_word_length ?? 0;
        if (newLen >= currentLen) {
          supabase
            .from("profiles")
            .update({ longest_word: normalizedWord, longest_word_length: newLen })
            .eq("id", user.id)
            .then((response) => {
              if (response.error) {
                console.warn("⚠️ Profil en uzun kelime güncellemesi başarısız:", response.error);
              } else {
                forceRefreshProfile?.();
              }
            });
        }
      }

      // Room score güncelleme - ASYNC, AWAIT'LEME
      if (currentRoom) {
        updateScore(newScore);
      }

      // Turnuva skoru güncelleme - ASYNC, AWAIT'LEME
      if (gameMode === "tournament" && tournamentMatch && user) {
        const isPlayer1 = tournamentMatch.player1_id === user.id;
        supabase
          .from("tournament_matches")
          .update({
            [isPlayer1 ? "player1_score" : "player2_score"]: newScore,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tournamentMatch.id)
          .then((response) => {
            if (response.error) {
              console.error("❌ Turnuva skor güncellenme hatası:", response.error);
            } else {
              console.log("🏆 Turnuva skoru güncellendi:", newScore);
            }
          });
      }

      // ❌ KALDIRILDI: VS-Computer modunda her kelime gönderildiğinde award_disconnect_bonus çağrılıyordu
      // Bu, oyun sonunda update_game_stats ile AYNI puanlar tekrar yazıldığı için ÇİFT PUAN'a neden oluyordu.
      // Artık tüm puan hesaplaması sadece oyun sonunda update_game_stats RPC ile yapılıyor.
    } finally {
      submissionLockRef.current = false;
    }
  };

  // Trigger word effects (confetti/fireworks) if purchased
  const triggerWordEffects = () => {
    console.log("🎵 WORD EFFECTS TRIGGERED:", currentWord.length);
    if (!(settings?.effects_enabled ?? true)) return;

    const hasConfetti = hasPurchased("effect_confetti") && (settings?.confetti_effect_enabled ?? true);
    const hasFireworks = hasPurchased("effect_fireworks") && (settings?.fireworks_effect_enabled ?? true);

    // Kelime uzunluğuna göre ses çal
    if (currentWord.length === 4) {
      playSpecialSound("/yes.mp3");
    } else if (currentWord.length === 5) {
      playSpecialSound("/wow2.mp3");
    } else if (currentWord.length === 6) {
      playSpecialSound("/yahoo.mp3");
    } else if (currentWord.length >= 7) {
      playSpecialSound("/didyouseethat.mp3");
    }

    if (hasConfetti && hasFireworks) {
      if (Math.random() > 0.5) {
        createConfettiEffect();
      } else {
        createFireworksEffect();
      }
    } else if (hasConfetti) {
      createConfettiEffect();
    } else if (hasFireworks) {
      createFireworksEffect();
    }
  };

  // Create confetti effect - Enhanced version
  const createConfettiEffect = () => {
    const confettiContainer = document.createElement("div");
    confettiContainer.className = "fixed inset-0 pointer-events-none z-50";
    document.body.appendChild(confettiContainer);

    // Daha çok konfeti, farklı boyutlar ve şekiller
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement("div");

      // Rastgele şekil seç
      const shapes = ["circle", "square", "triangle"];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];

      // Rastgele boyut
      const size = Math.random() * 8 + 4; // 4-12px

      confetti.className = `absolute animate-[confetti_${2 + Math.random() * 2}s_ease-out_forwards] confetti-${shape}`;
      confetti.style.width = `${size}px`;
      confetti.style.height = `${size}px`;
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.top = `-10px`;

      // Rastgele renk
      const colors = [
        "#FFD700",
        "#FF6B6B",
        "#4ECDC4",
        "#45B7D1",
        "#96CEB4",
        "#FFEAA7",
        "#DDA0DD",
        "#98D8C8",
        "#F7DC6F",
        "#BB8FCE",
        "#85C1E9",
        "#F8C471",
      ];
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

      // Rastgele animasyon gecikmesi
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;

      // Rastgele rotasyon
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;

      confettiContainer.appendChild(confetti);
    }

    // Parlama efekti ekle
    const sparkle = document.createElement("div");
    sparkle.className = "fixed inset-0 pointer-events-none z-40";
    sparkle.style.background = "radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)";
    sparkle.style.animation = "sparkle-burst 1s ease-out forwards";
    document.body.appendChild(sparkle);

    setTimeout(() => {
      document.body.removeChild(confettiContainer);
      if (document.body.contains(sparkle)) {
        document.body.removeChild(sparkle);
      }
    }, 4000);
  };

  // Create fireworks effect - Enhanced version
  const createFireworksEffect = () => {
    const fireworksContainer = document.createElement("div");
    fireworksContainer.className = "fixed inset-0 pointer-events-none z-50";
    document.body.appendChild(fireworksContainer);

    // Çoklu patlamalar - DAHA FAZLA VE DAHA BÜYÜK
    for (let burst = 0; burst < 8; burst++) {
      // 5 → 8
      setTimeout(() => {
        // Rastgele pozisyon - DAHA MERKEZDE
        const centerX = Math.random() * (window.innerWidth - 400) + 200; // Daha merkezi
        const centerY = Math.random() * (window.innerHeight - 400) + 200; // Daha merkezi

        // Ana patlama - DAHA ÇOK PARÇACIK
        for (let i = 0; i < 30; i++) {
          // 20 → 30
          const firework = document.createElement("div");
          const colors = [
            "#FFD700",
            "#FF1493",
            "#00CED1",
            "#32CD32",
            "#FF69B4",
            "#1E90FF",
            "#FFA500",
            "#DA70D6",
            "#FF6347",
            "#40E0D0",
            "#ADFF2F",
            "#FF4500",
          ];

          firework.className = "firework-particle";
          firework.style.position = "absolute";
          firework.style.width = `${Math.random() * 10 + 6}px`; // 3-9px → 6-16px
          firework.style.height = `${Math.random() * 10 + 6}px`; // DAHA BÜYÜK
          firework.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
          firework.style.borderRadius = "50%";
          firework.style.left = `${centerX}px`;
          firework.style.top = `${centerY}px`;
          firework.style.boxShadow = `0 0 20px ${colors[Math.floor(Math.random() * colors.length)]}`; // 10px → 20px DAHA PARLI

          const angle = (i / 30) * 2 * Math.PI; // 20 → 30
          const distance = 120 + Math.random() * 200; // 80-200 → 120-320 DAHA UZAK
          const duration = 1.5 + Math.random() * 1; // 1-1.5s → 1.5-2.5s DAHA YAVAS

          firework.style.animation = `firework-burst ${duration}s ease-out forwards`;
          firework.style.setProperty("--end-x", `${Math.cos(angle) * distance}px`);
          firework.style.setProperty("--end-y", `${Math.sin(angle) * distance}px`);

          fireworksContainer.appendChild(firework);
        }

        // İkincil parçacıklar - DAHA ÇOK
        for (let j = 0; j < 25; j++) {
          // 15 → 25
          setTimeout(() => {
            const secondaryParticle = document.createElement("div");
            secondaryParticle.className = "firework-secondary";
            secondaryParticle.style.position = "absolute";
            secondaryParticle.style.width = "4px"; // 2px → 4px
            secondaryParticle.style.height = "4px"; // 2px → 4px
            secondaryParticle.style.backgroundColor = "#FFF";
            secondaryParticle.style.borderRadius = "50%";
            secondaryParticle.style.boxShadow = "0 0 10px #FFF"; // PARLAMA EKLE
            secondaryParticle.style.left = `${centerX + (Math.random() - 0.5) * 80}px`; // 40 → 80
            secondaryParticle.style.top = `${centerY + (Math.random() - 0.5) * 80}px`; // 40 → 80
            secondaryParticle.style.animation = "secondary-sparkle 1.2s ease-out forwards"; // 0.8s → 1.2s

            fireworksContainer.appendChild(secondaryParticle);
          }, j * 30); // 50ms → 30ms DAHA HIZLI
        }
      }, burst * 300); // 400ms → 300ms DAHA SIKIŞIK
    }

    setTimeout(() => {
      document.body.removeChild(fireworksContainer);
    }, 4000); // 3000ms → 4000ms DAHA UZUN
  };

  // Format time - dijital saat formatı
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Son 9 saniye geri sayım ses efekti
  const handleFinalCountdownTick = useCallback(
    (second: number) => {
      // Her saniyede tik ses efekti çal
      playSpecialSound("/geriSayimKlik.mp3");
      console.log(`⏰ Final countdown: ${second}`);
    },
    [playSpecialSound],
  );

  // Get opponent info based on game mode with avatar and premium status
  const getOpponentInfo = () => {
    // Helper to check if premium
    const isPremiumActive = (premiumUntil: string | null | undefined) => {
      if (!premiumUntil) return false;
      return new Date(premiumUntil) > new Date();
    };

    // Tournament mode için özel opponent isim mantığı
    if (gameMode === "tournament" && tournamentMatch) {
      const opponentId =
        tournamentMatch.player1_id === user?.id ? tournamentMatch.player2_id : tournamentMatch.player1_id;
      const opponentParticipant = participants.find((p) => String(p.user_id) === String(opponentId));
      const isBotOpponent = Boolean(opponentParticipant?.is_bot) || String(opponentId || "").startsWith("bot_");

      if (!opponentId || isBotOpponent) {
        const seed = Array.from(String(opponentId || "bot")).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        const botName = opponentParticipant?.profiles?.username || generateBotName(seed);
        return { name: botName, icon: Trophy, avatar: generateBotAvatar(seed, botName), isPremium: false };
      }

      // Participants yüklenmediyse fallback
      if (!participants || participants.length === 0) {
        return { name: "Rakip", icon: Trophy, avatar: null, isPremium: false };
      }

      const realOpponent = opponentParticipant && !opponentParticipant.is_bot ? opponentParticipant : null;

      if (realOpponent) {
        return {
          name: realOpponent.profiles?.username || "Rakip",
          icon: Trophy,
          avatar: realOpponent.profiles?.avatar_url || null,
          isPremium: isPremiumActive((realOpponent as any).profiles?.premium_until),
        };
      }

      return { name: "Turnuva Rakibi", icon: Trophy, avatar: null, isPremium: false };
    }

    const realOpponent = participants.find(
      (p) => !p.is_bot && String(p.user_id) !== String(user?.id) && p.user_id !== null,
    );

    // Gerçek rakip varsa onun bilgilerini kullan
    if (realOpponent) {
      return {
        name: (realOpponent as any).profiles?.username || "Oyuncu",
        icon: User,
        avatar: (realOpponent as any).profiles?.avatar_url || null,
        isPremium: isPremiumActive((realOpponent as any).profiles?.premium_until),
      };
    }

    switch (gameMode) {
      case "vs-computer":
        return { name: "Bilgisayar", icon: Bot, avatar: robotAvatar, isPremium: false };
      case "random-match":
      case "private-room":
        // 🤖 Bot rakip varsa (random-match fallback) tournament tarzı isim/avatar göster
        if (gameMode === "random-match" || gameMode === "private-room") {
          const botParticipant = participants.find((p) => p.is_bot === true);
          if (botParticipant) {
            const bot =
              currentBotIdentity ||
              (() => {
                const seed = seedFromText(`${currentRoom?.id || ""}${botParticipant.id || ""}`);
                const name = generateBotName(seed);
                return { seed, name, avatar: generateBotAvatar(seed, name) };
              })();
            return { name: bot.name, icon: User, avatar: bot.avatar, isPremium: false };
          }
        }
        if (participants.length >= 2) {
          const opponent = participants.find((p) => String(p.user_id) !== String(user?.id));

          if (opponent && (opponent as any).profiles?.username) {
            console.log("✅ Rakip bilgisi gösteriliyor:", (opponent as any).profiles.username);
            return {
              name: (opponent as any).profiles.username,
              icon: User,
              avatar: (opponent as any).profiles?.avatar_url || null,
              isPremium: isPremiumActive((opponent as any).profiles?.premium_until),
            };
          }
        }
        // Oyun başladıysa veya geri sayım varsa: asla "Rakip Aranıyor..."a dönme
        if (gameStarted || showCountdown) {
          const name = opponentName && opponentName !== "Rakip Aranıyor..." ? opponentName : "Rakip";
          console.log("🛡️ Oyun başladı - fallback rakip:", name);
          const fallbackOpponent = participants.find((p) => String(p.user_id) !== String(user?.id));
          return {
            name,
            icon: User,
            avatar: (fallbackOpponent as any)?.profiles?.avatar_url || null,
            isPremium: isPremiumActive((fallbackOpponent as any)?.profiles?.premium_until),
          };
        }
        // Henüz başlamadıysa ama state'te rakip varsa göster
        if (opponentName && opponentName !== "Rakip Aranıyor...") {
          console.log("📝 State'ten rakip:", opponentName);
          const stateOpponent = participants.find((p) => String(p.user_id) !== String(user?.id));
          return {
            name: opponentName,
            icon: User,
            avatar: (stateOpponent as any)?.profiles?.avatar_url || null,
            isPremium: isPremiumActive((stateOpponent as any)?.profiles?.premium_until),
          };
        }
        console.log("⏳ Henüz rakip yok, aranıyor...");
        return { name: "Rakip Aranıyor...", icon: User, avatar: null, isPremium: false };
      default:
        return { name: "Rakip", icon: User, avatar: null, isPremium: false };
    }
  };
  // Emoji reactions hook - sadece multiplayer modlarda
  const isMultiplayerMode = gameMode === "random-match" || gameMode === "private-room";
  const emojiRoomId = isMultiplayerMode ? currentRoom?.id || "" : "";
  const opponentIsBotForEmoji = gameMode === "random-match" && participants.some((p) => p.is_bot === true);
  const emojiReactions = GameEmojiReactions({
    roomId: emojiRoomId,
    userId: user?.id || "",
    gameStarted,
    gameEnded,
    simulateOpponentBot: opponentIsBotForEmoji,
    botContext: opponentIsBotForEmoji
      ? {
          botScore: opponentScore,
          playerScore: playerScore,
          timeLeftSec: displayTime,
          totalTimeSec: gameType === "timed" ? 120 : 0,
          gridLetters: gameGrid.flat(),
        }
      : undefined,
  });

  // GamePage.tsx'teki oyun sonu ekranını şu şekilde düzelt:

  // ✅ PNG tabanlı kazandın/kaybettin kartı (turnuva ve beraberlik hariç)
  const goHomeAfterMatch = async () => {
    if (currentRoom?.id) {
      // ⚠️ await: yeni arama başlamadan önce eski oda banlanmış olmalı
      await matchBanlist.add(currentRoom.id);
    }
    if (user?.id) {
      await supabase.from("rematch_opt_outs").upsert({
        user_id: user.id,
        opt_out_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    // 🔑 KRİTİK: Biten odayı context'ten ve kalıcı depodan temizle.
    // Aksi halde yeni arama sırasında resync eski "finished" odayı okuyup
    // önceki maçın kazandın/kaybettin kartını tekrar açıyor.
    try {
      await leaveRoom();
    } catch (e) {
      console.warn("⚠️ leaveRoom (maç sonu) hatası:", e);
    }
    window.dispatchEvent(new CustomEvent("cleanupMatchmaking"));
    navigate(homeBackPath());
  };


  const playAgainVsComputer = async () => {
    setButtonsEnabled(false);
    if (!isPremium && (gameMode as string) !== "tournament") {
      const creditConsumed = await consumeCredit();
      if (!creditConsumed) {
        toast({
          title: "Sayfaların tükendi",
          description: "Oyun oynamak için yeterli sayfan yok. Kırtasiyeden sayfa satın alabilirsiniz.",
          variant: "destructive",
        });
        navigate("/market");
        return;
      }
    }
    resetGameForRematch();
  };

  if (gameEnded && gameMode !== "tournament" && (winner === "player" || winner === "opponent")) {
    const isMulti = gameMode === "private-room" || gameMode === "random-match";
    const canRematch = isMulti
      ? !disconnectWin && !backgroundDisconnected && !rematchRequested && !waitingForRematchResponse && !rematchSentOnce
      : !disconnectWin;

    return (
      <div
        className="fixed inset-0 flex items-center justify-center p-4 relative overflow-hidden touch-none overscroll-none"
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {winner === "player" && confettiAnim && (
          <div className="absolute inset-0 pointer-events-none z-20">
            <Lottie animationData={confettiAnim} loop autoplay style={{ width: "100%", height: "100%" }} />
          </div>
        )}

        <div className="relative z-30 w-full -translate-y-[3%]">

          <MatchResultCard
            won={winner === "player"}
            playerScore={finalPlayerScore || playerScore}
            opponentScore={finalOpponentScore || opponentScore}
            adLoading={isAdLoading}
            disabled={!buttonsEnabled}
            onWatchAd={!adWatched && user && !isPremium ? handleWatchAd : undefined}
            onPlayAgain={canRematch ? (isMulti ? () => { requestRematch(); } : playAgainVsComputer) : undefined}
            onHome={goHomeAfterMatch}
            rematchStatus={
              !isMulti
                ? "idle"
                : hasMultiplayerBotOpponent
                  ? botRematchStatus
                  : rematchStatus !== "idle"
                    ? rematchStatus
                    : waitingForRematchResponse
                      ? "waiting"
                      : "idle"
            }
          >
            {waitingForRematchResponse && (
              <div className="absolute left-[10%] right-[10%] top-[72%] rounded-xl bg-black/60 border border-white/15 p-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-300" />
                  <span className="text-white text-xs font-medium">Rakibinizin yanıtı bekleniyor...</span>
                </div>
              </div>
            )}
          </MatchResultCard>
        </div>

        <LevelUpDialog open={showLevelUp} onClose={() => setShowLevelUp(false)} newLevel={newLevel} />
      </div>
    );
  }

  // Turnuva zaferlerinde ilerleme/şampiyonluk kartı gösterilir:
  // 1. tur → yarı finaldesin, 2. tur → finaldesin, 3. tur (final) → şampiyonsun
  const tournamentAdvanceRound = tournamentMatch?.round;
  if (
    gameEnded &&
    gameMode === "tournament" &&
    winner === "player" &&
    (tournamentAdvanceRound === 1 || tournamentAdvanceRound === 2 || tournamentAdvanceRound === 3)
  ) {
    const tournamentId = searchParams.get("tournament") || tournamentMatch?.tournament_id;
    const advancingImage =
      tournamentAdvanceRound === 1
        ? yariFinaldesinGorsel
        : tournamentAdvanceRound === 2
          ? finaldesinGorsel
          : sampiyonsunGorsel;
    const advancingAlt =
      tournamentAdvanceRound === 1 ? "Yarı Finaldesiniz" : tournamentAdvanceRound === 2 ? "Finaldesiniz" : "Şampiyonsunuz";


    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      >
        <div className="relative w-full max-w-md">
          <motion.img
            src={advancingImage}
            alt={advancingAlt}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full rounded-2xl shadow-2xl"
          />

          {/* Senin puanın */}
          <div
            className="absolute right-[21.5%] top-[48.8%] transform -translate-y-1/2 font-bold text-[#334155] text-right tabular-nums leading-none"
            style={{
              fontSize: "clamp(1rem, 4.5vw, 1.5rem)",
              fontFamily: "'Fredoka', 'Comfortaa', sans-serif",
              maxWidth: "22%",
              overflow: "hidden",
            }}
          >
            {playerScore}
          </div>
          {/* Rakip puanı */}
          <div
            className="absolute right-[21.5%] top-[63.8%] transform -translate-y-1/2 font-bold text-[#334155] text-right tabular-nums leading-none"
            style={{
              fontSize: "clamp(1rem, 4.5vw, 1.5rem)",
              fontFamily: "'Fredoka', 'Comfortaa', sans-serif",
              maxWidth: "22%",
              overflow: "hidden",
            }}
          >
            {opponentScore}
          </div>

        </div>
      </div>
    );
  }

  if (gameEnded) {

    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      >
        {/* Victory animations */}
        {winner === "player" && confettiAnim && (
          <div className="absolute inset-0 pointer-events-none z-20">
            <Lottie animationData={confettiAnim} loop autoplay style={{ width: "100%", height: "100%" }} />
          </div>
        )}

        <Card className="w-full max-w-md text-center relative z-10 bg-[#16213e]/80 backdrop-blur-md border border-white/10 shadow-2xl">
          <CardContent className="p-6">
            <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              {winner === "player" && winAnim && (
                <Lottie animationData={winAnim} loop autoplay style={{ width: 80, height: 80 }} />
              )}
              {winner === "opponent" && loseAnim && (
                <Lottie animationData={loseAnim} loop autoplay style={{ width: 80, height: 80 }} />
              )}
              {winner === "tie" && gameMode !== "tournament" && tieAnim && (
                <Lottie animationData={tieAnim} loop autoplay style={{ width: 80, height: 80 }} />
              )}
              {gameMode === "tournament" && !winner && (
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" aria-label="Sonuç belirleniyor" />
              )}
            </div>

            {/* Başlık */}
            <h2
              className={`text-2xl font-bold mb-2 ${winner === "player" ? "text-amber-400 animate-pulse" : "text-slate-400"}`}
            >
              {gameMode === "tournament"
                ? winner === "player"
                  ? "Maçı Kazandınız!"
                  : winner === "opponent"
                    ? "Elendiniz!"
                    : "Sonuç belirleniyor..."
                : winner === "player"
                  ? "Kazandın!"
                  : winner === "opponent"
                    ? "Kaybettin!"
                    : "Berabere!"}
            </h2>

            {/* Skorlar */}
            <div className="space-y-2 mb-6">
              <div className="flex justify-between bg-white/5 rounded-xl px-4 py-2 border border-white/10">
                <span className="text-slate-400 text-sm">Sizin Puanınız</span>
                <span className="font-bold text-white">{finalPlayerScore || playerScore}</span>
              </div>
              <div className="flex justify-between bg-white/5 rounded-xl px-4 py-2 border border-white/10">
                <span className="text-slate-400 text-sm">Rakip</span>
                <span className="font-bold text-white">{finalOpponentScore || opponentScore}</span>
              </div>
            </div>

            {/* Turnuva için otomatik yönlendirme mesajı */}
            {gameMode === "tournament" && winner === "player" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-800 text-sm font-medium">🏆 Turnuva sayfasına yönlendirildiniz!</p>
                <div className="mt-2">
                  <div className="text-yellow-600">Sonraki tur için bekleyiniz</div>
                </div>
              </div>
            )}

            {/* Butonlar - Sadece manuel durumlar için */}
            <div className="space-y-2">
              {gameMode === "tournament" ? (
                <>
                  {winner === "opponent" && (
                    <Button
                      variant="outline"
                      disabled={!buttonsEnabled}
                      onClick={() => {
                        playSound("buttonClick");
                        navigate("/tournament");
                      }}
                      className="w-full"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Turnuva Listesi
                    </Button>
                  )}
                  {winner === "player" && (
                    <Button
                      variant="outline"
                      disabled={!buttonsEnabled}
                      onClick={() => {
                        console.log("🚀 Manuel yönlendirme denemesi...");

                        // ✅ URL'den tournament ID al
                        const tournamentId = searchParams.get("tournament");

                        if (!tournamentId) {
                          console.error("❌ tournament ID URL parameter missing");
                          navigate("/tournament");
                          return;
                        }

                        console.log("🏆 Tournament ID from URL:", tournamentId);

                        // ✅ React Router ile Yönlendirme
                        navigate(`/tournament/bracket/${tournamentId}`);
                      }}
                      className="w-full"
                    >
                      <Trophy className="w-4 h-4 mr-2" />
                      Turnuva Sayfasına Git
                    </Button>
                  )}
                </>
              ) : gameMode === "private-room" || gameMode === "random-match" ? (
                // ✅ ÖZEL ODA VE RASTGELE EŞLEŞME BUTONLARI - YENİ
                <div className="space-y-2">
                  {/* Ödüllü Reklam Butonu - Premium kullanıcılara gösterme */}
                  {!adWatched && user && !isPremium && (
                    <button
                      onClick={handleWatchAd}
                      disabled={isAdLoading}
                      className="w-full flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm transition-all border border-amber-500/40 bg-gradient-to-r from-amber-900/50 to-yellow-900/50 hover:from-amber-800/60 hover:to-yellow-800/60 text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(245,158,11,0.2)]"
                      style={{ touchAction: "manipulation" }}
                    >
                      {isAdLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                          <span>Reklam Yükleniyor...</span>
                        </>
                      ) : (
                        <>
                          <img src="/klaketsvg.svg" alt="Reklam" className="w-5 h-5" />
                          <span>Reklam İzle → +1 Sayfa Kazan</span>
                          <span className="text-xs opacity-70 ml-1">({userCredits}/5)</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Disconnect durumunda (rakip ayrıldı VEYA biz arka plandan disconnect olduk) rematch butonu gösterme */}
                  {!disconnectWin &&
                    !backgroundDisconnected &&
                    !rematchRequested &&
                    !waitingForRematchResponse &&
                    !rematchSentOnce && (
                    <Button
                      disabled={!buttonsEnabled}
                      onClick={() => {
                        playSound("buttonClick");
                        requestRematch();
                      }}
                      className="w-full bg-green-500 hover:bg-green-600"
                    >
                      <img src="/tekrarsvg.svg" alt="Tekrar" className="w-5 h-5 shrink-0 mr-2" />
                      Tekrar Oyna
                    </Button>
                  )}

                  {waitingForRematchResponse && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span className="text-blue-800 font-medium">Rakibinizin yanıtı bekleniyor...</span>
                      </div>
                      <p className="text-blue-600 text-xs text-center mt-2">
                        30 saniye içinde yanıt vermezse istek iptal olacak
                      </p>
                    </div>
                  )}

                  <Button
                    disabled={!buttonsEnabled}
                    onClick={async () => {
                      playSound("buttonClick");
                      if (currentRoom?.id) {
                        matchBanlist.add(currentRoom.id);
                        console.log("🚫 Oda banlist'e eklendi:", shortId(currentRoom?.id));
                      }
                      if (user?.id) {
                        await supabase.from("rematch_opt_outs").upsert({
                          user_id: user.id,
                          opt_out_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                          updated_at: new Date().toISOString(),
                        });
                      }
                      window.dispatchEvent(new CustomEvent("cleanupMatchmaking"));
                      navigate(homeBackPath());
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <img src="/gerisvg.svg" alt="Geri" className="w-4 h-4 mr-2" />
                    Ana Menüye Dön
                  </Button>
                </div>
              ) : (
                // Normal mod butonları (vs-computer)
                <>
                  {/* Ödüllü Reklam Butonu - Premium kullanıcılara gösterme */}
                  {!adWatched && user && !isPremium && (
                    <button
                      onClick={handleWatchAd}
                      disabled={isAdLoading}
                      className="w-full flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm transition-all border border-amber-500/40 bg-gradient-to-r from-amber-900/50 to-yellow-900/50 hover:from-amber-800/60 hover:to-yellow-800/60 text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(245,158,11,0.2)]"
                      style={{ touchAction: "manipulation" }}
                    >
                      {isAdLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                          <span>Reklam Yükleniyor...</span>
                        </>
                      ) : (
                        <>
                          <img src="/klaketsvg.svg" alt="Reklam" className="w-5 h-5" />
                          <span>Reklam İzle → +1 Hak Kazan</span>
                          <span className="text-xs opacity-70 ml-1">({userCredits}/5)</span>
                        </>
                      )}
                    </button>
                  )}
                  <Button
                    disabled={!buttonsEnabled}
                    onClick={async () => {
                      playSound("buttonClick");
                      // Oyun bitiminde matchmaking state'ini temizle ve odayı banla
                      if (currentRoom?.id) {
                        matchBanlist.add(currentRoom.id);
                        console.log("🚫 Oda banlist'e eklendi:", shortId(currentRoom?.id));
                      }

                      // Kullanıcının rematch opt-out kaydını oluştur/güncelle (5 dakika geçerli)
                      if (user?.id) {
                        await supabase.from("rematch_opt_outs").upsert({
                          user_id: user.id,
                          opt_out_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 dakika sonrası
                          updated_at: new Date().toISOString(),
                        });
                      }

                      window.dispatchEvent(new CustomEvent("cleanupMatchmaking"));
                      navigate(homeBackPath());
                    }}
                    className="w-full"
                  >
                    <img src="/gerisvg.svg" alt="Geri" className="w-4 h-4 mr-2" />
                    Ana Menüye Dön
                  </Button>
                  {!disconnectWin && (
                    <Button
                      variant="outline"
                      disabled={!buttonsEnabled}
                      onClick={async () => {
                        playSound("buttonClick");
                        setButtonsEnabled(false);

                        if (!isPremium && (gameMode as string) !== "tournament") {
                          const creditConsumed = await consumeCredit();
                          if (!creditConsumed) {
                            toast({
                              title: "Sayfaların tükendi",
                              description:
                                "Oyun oynamak için yeterli sayfan yok. Kırtasiyeden sayfa satın alabilirsiniz.",
                              variant: "destructive",
                            });
                            navigate("/market");
                            return;
                          }
                        }

                        resetGameForRematch();
                      }}
                      className="w-full"
                    >
                      <img src="/tekrarsvg.svg" alt="Tekrar" className="w-5 h-5 shrink-0 mr-2" />
                      Tekrar Oyna
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
        {/* Level Up Dialog - gameEnded bloğu içinde */}
        <LevelUpDialog open={showLevelUp} onClose={() => setShowLevelUp(false)} newLevel={newLevel} />
      </div>
    );
  }

  const opponent = getOpponentInfo();

  const handleCountdownComplete = async () => {
    console.log("🏁 Countdown tamamlandı - oyun başlatılıyor");

    // 🔒 GUARD: Zaten başlatıldıysa tekrar çağırma
    if (gameStartedRef.current || gameHasStartedRef.current) {
      console.log("⚠️ handleCountdownComplete: Oyun zaten başlamış, atlanıyor");
      return;
    }

    setShowCountdown(false);
    countdownCompletedAtRef.current = Date.now();

    // 🔒 SERVER-AUTHORITY: Bitiş zamanı ASLA cihazın countdown'ı bitirdiği ana göre hesaplanmaz.
    // Her cihaz aynı server anchor'ını (ends_at veya countdown_started_at + 10s) kullanır.
    const nowServer = Date.now() + serverTimeOffset;
    const parseTs = (v?: string | null): number | null => {
      if (!v) return null;
      const t = new Date(v).getTime();
      return Number.isFinite(t) && t > 0 ? t : null;
    };

    const MATCH_DURATION_MS = 120 * 1000;
    const NORMAL_START_OFFSET_MS = 10000; // 5s buffer + 5s countdown
    const TOURNAMENT_START_OFFSET_MS = 12000;

    let endsAtTimestamp: number | null = null;

    if (gameMode === "tournament") {
      endsAtTimestamp = parseTs(tournamentMatch?.ends_at);
      if (!endsAtTimestamp) {
        const cs = parseTs((tournamentMatch as any)?.countdown_started_at);
        if (cs) endsAtTimestamp = cs + TOURNAMENT_START_OFFSET_MS + MATCH_DURATION_MS;
      }
    } else {
      // Random/private maçlarda countdown anchor'ı eski veya erken yazılmış ends_at'ten
      // daha güvenilirdir. Böylece bot ve gerçek oyuncu maçları tam 2:00'dan başlar.
      const cs = parseTs(currentRoom?.countdown_started_at);
      if (cs) endsAtTimestamp = cs + NORMAL_START_OFFSET_MS + MATCH_DURATION_MS;
      if (!endsAtTimestamp) endsAtTimestamp = parseTs((currentRoom as any)?.ends_at);
      if (!endsAtTimestamp) {
        const st = parseTs((currentRoom as any)?.started_at);
        if (st) endsAtTimestamp = st + MATCH_DURATION_MS;
      }
    }

    // Son çare (vs-computer / veri eksik): local server time
    if (!endsAtTimestamp) endsAtTimestamp = nowServer + MATCH_DURATION_MS;

    const remainingSeconds = Math.max(0, Math.min(120, Math.floor((endsAtTimestamp - nowServer) / 1000)));


    console.log("⏱️ Countdown sonrası timer server ends_at ile ayarlandı:", {
      now: new Date(nowServer).toISOString(),
      endsAt: new Date(endsAtTimestamp).toISOString(),
      displayTime: remainingSeconds,
      mode: gameMode,
    });

    endsAtTimestampRef.current = endsAtTimestamp;
    timeLeftRef.current = remainingSeconds;
    setDisplayTime(remainingSeconds);

    // Start game immediately
    setGameStarted(true);
    gameHasStartedRef.current = true;
    gameStartedRef.current = true;

    console.log("✅ Oyun başladı - timer server ile senkron");
  };

  return (
    <>
      {/* 🎉 KELİMELE bonus animasyonu (1 kerelik, 3sn) */}
      {showKelimeleAnim && confettiAnim && (
        <div className="fixed inset-0 pointer-events-none z-[9999]">
          <Lottie animationData={confettiAnim} loop={false} autoplay style={{ width: "100%", height: "100%" }} />
        </div>
      )}
      {/* ✨ 6+ harfli kelime animasyonu (ızgaranın ortasında, 1 kerelik) */}
      {showAltiHarfAnim && altiHarfAnim && (
        <div className="fixed inset-0 pointer-events-none z-[9998] flex items-center justify-center overflow-visible">
          <div
            style={{
              width: "min(80vw, 360px)",
              height: "min(80vw, 360px)",
              transform: "scale(2)",
              transformOrigin: "center center",
            }}
          >
            <Lottie animationData={altiHarfAnim} loop={false} autoplay style={{ width: "100%", height: "100%" }} />
          </div>
        </div>
      )}
      {/* 🎉 7+ harfli kelime animasyonu (gunlukKonfeti) */}
      {showGunlukKonfetiAnim && gunlukKonfetiAnim && (
        <div className="fixed inset-0 pointer-events-none z-[9998] flex items-center justify-center overflow-visible">
          <div
            style={{
              width: "min(80vw, 360px)",
              height: "min(80vw, 360px)",
              transform: "scale(2)",
              transformOrigin: "center center",
            }}
          >
            <Lottie animationData={gunlukKonfetiAnim} loop={false} autoplay style={{ width: "100%", height: "100%" }} />
          </div>
        </div>
      )}
      <>
        {/* ⚠️ KRİTİK GUARD: Maç bitişi sırasında render'ı engelle */}
        {isMatchFinishing && gameMode === "tournament" && (
          <div className="min-h-screen flex items-center justify-center" style={{ background: "#1a1a2e" }}>
            <div className="max-w-sm mx-auto text-center p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-cyan-400" />
              <p className="text-lg font-semibold text-white mb-2">Maç Tamamlanıyor...</p>
              <p className="text-sm text-slate-400">Sonuçlar hesaplanıyor ve turnuva bracket'i güncelleniyor.</p>
            </div>
          </div>
        )}

        {/* Normal oyun render'ı - sadece isMatchFinishing false ise göster */}
        {(!isMatchFinishing || gameMode !== "tournament") && (
          <>
            {showCountdown && (
              <GameCountdown
                key={`countdown-${currentRoom?.id || tournamentMatch?.id || "default"}`}
                onComplete={handleCountdownComplete}
                serverStartTime={countdownServerTime}
                serverTimeOffset={gameMode === "vs-computer" ? 0 : serverTimeOffset}
                countdownKey={currentRoom?.id || tournamentMatch?.id || "default"}
              />
            )}

            <div
              key={`game-${currentRoom?.id || tournamentMatch?.id || "container"}`}
              className="fixed inset-0 relative overflow-hidden touch-none overscroll-none"
              style={{
                background: "#1a1a2e",
                height: "100dvh",
                maxHeight: "100dvh",
                paddingTop: "calc(env(safe-area-inset-top, 8px) + 1rem)",
                paddingBottom: "env(safe-area-inset-bottom, 8px)",
                paddingLeft: "env(safe-area-inset-left, 4px)",
                paddingRight: "env(safe-area-inset-right, 4px)",
              }}
            >

              {matchBgAnim && (
                <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                  <img
                    src={matchBgAnim}
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
              )}
              <div className="h-full flex flex-col px-2 relative z-15 min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between py-2 shrink-0">
                  {/* Sol taraf - Geri butonu */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2 py-1 h-8 text-slate-300 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/10"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleBackToMenu();
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Çıkış
                  </Button>

                  {/* Orta kısım - Timer veya hedef + Turnuva bilgisi */}
                  {gameType === "timed" ? (
                    <div className="flex flex-col items-center space-y-1">
                      {gameMode === "tournament" && tournamentMatch && (
                        <div className="text-[10px] text-amber-400 font-bold tracking-wide uppercase">
                          {tournamentMatch.round === 1
                            ? "⚔️ Çeyrek Final"
                            : tournamentMatch.round === 2
                              ? "🥊 Yarı Final"
                              : "🏆 Final"}{" "}
                          · Maç {tournamentMatch.match_number}
                        </div>
                      )}
                      <div className="relative">
                        <div
                          className={`flex items-center justify-center h-9 px-4 rounded-xl transition-all duration-300 ${
                            displayTime <= 9 ? "invisible opacity-0" : "visible opacity-100"
                          } ${
                            displayTime <= 30
                              ? "bg-red-500/15 border border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                              : "bg-slate-900/70 border border-white/10"
                          }`}
                          style={{ minWidth: "110px" }}
                        >
                          <span
                            className={`font-mono text-lg font-black tracking-wider ${
                              displayTime <= 30 ? "text-red-400" : "text-cyan-300"
                            }`}
                            style={{
                              fontFamily: "'Orbitron', 'Courier New', monospace",
                              textShadow:
                                displayTime <= 30 ? "0 0 12px rgba(239,68,68,0.6)" : "0 0 12px rgba(103,232,249,0.5)",
                              fontVariantNumeric: "tabular-nums",
                              letterSpacing: "0.1em",
                            }}
                          >
                            {formatTime(displayTime)}
                          </span>
                        </div>
                        {/* Süre Azalıyor - moved to avatar cards overlay below */}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-1">
                      {gameMode === "tournament" && tournamentMatch && (
                        <div className="text-[10px] text-amber-400 font-bold tracking-wide uppercase">
                          {tournamentMatch.round === 1
                            ? "⚔️ Çeyrek Final"
                            : tournamentMatch.round === 2
                              ? "🥊 Yarı Final"
                              : "🏆 Final"}{" "}
                          · Maç {tournamentMatch.match_number}
                        </div>
                      )}
                      <div className="flex items-center space-x-2 bg-white/5 border border-white/15 rounded-xl px-3 py-1.5">
                        <Target className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-bold text-white">500 Puan</span>
                      </div>
                    </div>
                  )}

                  {/* Sağ taraf - Ses efekti aç/kapa + turnuva bilgisi */}
                  <div className="w-16 flex flex-col items-end justify-center gap-1">
                    <SoundEffectsToggle />
                    {gameMode === "tournament" && (
                      <div className="text-[10px] text-slate-400">vs {getOpponentDisplayName()}</div>
                    )}
                  </div>
                </div>

                {/* 🏆 Turnuva bilgi bandı */}
                {gameMode === "tournament" && tournamentMatch?.round && tournamentMatch.round <= 3 && (
                  <div className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-medium text-amber-200">
                      {tournamentMatch.round === 1
                        ? "Çeyrek final maçı! Kazanırsan sonraki tura geçeceksin."
                        : tournamentMatch.round === 2
                          ? "Yarı final maçı! Kazanırsan sonraki tura geçeceksin."
                          : "Final maçı! Kazanırsan sürpriz ödülün sahibi olacaksın."}
                    </span>
                  </div>
                )}

                {/* Scores - Oyuncu kartları */}
                <div className="grid grid-cols-2 gap-3 relative mb-2">
                  {/* Süre Azalıyor - avatar kartlarının ortasından kayan büyük yazı */}
                  <AnimatePresence>
                    {timeWarningPlayed && displayTime <= 30 && displayTime >= 27 && (
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none"
                        style={{ zIndex: 50 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <motion.div
                          className="flex items-center gap-2 leading-none font-black text-emerald-400 whitespace-nowrap"
                          style={{
                            fontSize: "2.25rem",
                            textShadow: "0 0 20px rgba(52,211,153,0.7), 0 0 40px rgba(16,185,129,0.4)",
                          }}
                          initial={{ x: -200, opacity: 0 }}
                          animate={{ x: [-200, 0, 0, 300], opacity: [0, 1, 1, 0] }}
                          transition={{ duration: 1.6, times: [0, 0.1875, 0.8125, 1], ease: "easeInOut" }}
                        >
                          <div style={{ width: "7rem", height: "7rem" }} className="shrink-0">
                            <Lottie
                              animationData={sureAzaliyorAnim}
                              loop
                              autoplay
                              style={{ width: "100%", height: "100%" }}
                            />
                          </div>
                          <div className="flex flex-col items-start">
                            <span>Süre</span>
                            <span>Azalıyor!</span>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* Oyuncu kartı */}
                  <div
                    className="relative rounded-2xl border border-white/10 overflow-hidden"
                    style={{ background: "linear-gradient(135deg, rgba(45,52,54,0.95) 0%, rgba(99,110,114,0.6) 100%)" }}
                  >
                    {/* Üst glow çizgisi */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                    <div className="p-3 text-center relative overflow-hidden">
                      {isMultiplayerMode && emojiReactions.PlayerEmojiOverlay}
                      <div className="relative inline-block">
                        <Avatar className="w-14 h-14 mx-auto mb-1.5 ring-2 ring-white/10">
                          <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} alt="Profile" />
                          <AvatarFallback className="bg-slate-700">
                            <User className="w-7 h-7 text-slate-300" />
                          </AvatarFallback>
                        </Avatar>
                        {isPremium && !!profile?.premium_until && new Date(profile.premium_until) > new Date() && (
                          <div className="absolute -bottom-1 -right-1 z-20">
                            <VipBadge size="sm" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1">Siz</p>
                      <p
                        className="text-2xl font-black text-white"
                        style={{ textShadow: "0 0 20px rgba(103,232,249,0.4)" }}
                      >
                        {playerScore}
                      </p>
                      {gameType === "score" && (
                        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                            style={{ width: `${Math.min((playerScore / 500) * 100, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Son 10 saniye geri sayım - kartların ortasında, ifadelerin üstünde */}
                  {gameStarted && !gameEnded && gameType === "timed" && displayTime >= 1 && displayTime <= 11 && (
                    <div className="absolute left-1/2 top-1/2 z-[9999] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                      <FinalCountdown displayTime={displayTime} onCountdownTick={handleFinalCountdownTick} />
                    </div>
                  )}

                  {/* 🔥 Combo Boost (2x..9x) ve bonus puan animasyonu */}
                  {gameStarted && !gameEnded && (
                    <div className="absolute left-1/2 top-1/2 z-[9998] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                      <ComboBoost
                        key={comboResetId}
                        comboEventId={comboEvent.id}
                        comboCount={comboEvent.count}
                        bonusEventId={bonusEvent.id}
                        bonusAmount={bonusEvent.amount}
                        resetId={comboResetId}
                      />
                      <NiceCatchText eventId={niceCatchEvent.id} wordLength={niceCatchEvent.length} />
                      <NiceCatchText
                        eventId={hintEvent.id}
                        customText={hintEvent.text}
                        holdMs={1000}
                        letterInStepMs={15}
                        letterOutStepMs={15}
                        fontSize="1.09375rem"
                      />
                    </div>
                  )}

                  {/* Rakip kartı */}
                  <div
                    className="relative rounded-2xl border border-white/10 overflow-hidden"
                    style={{ background: "linear-gradient(135deg, rgba(45,52,54,0.95) 0%, rgba(99,110,114,0.6) 100%)" }}
                  >
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
                    <div className="p-3 text-center relative overflow-hidden">
                      {isMultiplayerMode && emojiReactions.OpponentEmojiOverlay}
                      <div className="relative inline-block">
                        <Avatar className="w-14 h-14 mx-auto mb-1.5 ring-2 ring-white/10 bg-transparent">
                          <AvatarImage src={opponent.avatar} alt="Opponent" />
                          <AvatarFallback className="bg-slate-700">
                            <opponent.icon className="w-7 h-7 text-slate-300" />
                          </AvatarFallback>
                        </Avatar>
                        {opponent.isPremium && (
                          <div className="absolute -bottom-1 -right-1 z-20">
                            <VipBadge size="sm" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1 truncate max-w-[90px] mx-auto">
                        {opponent.name}
                      </p>
                      <p
                        className="text-2xl font-black text-white"
                        style={{ textShadow: "0 0 20px rgba(167,139,250,0.4)" }}
                      >
                        {opponentScore}
                      </p>
                      {gameType === "score" && (
                        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all duration-500"
                            style={{ width: `${Math.min((opponentScore / 500) * 100, 100)}%` }}
                          />
                        </div>
                      )}

                      {preparingOpponent && (
                        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                          {preparingOpponent === "preparing" ? (
                            <div className="text-center animate-pulse">
                              <p className="text-xs font-bold text-slate-300">
                                {gameMode === "vs-computer" ? "AI Hazırlanıyor..." : "Oyuncu Hazırlanıyor..."}
                              </p>
                              <div className="flex gap-1 justify-center mt-2">
                                {[0, 150, 300].map((delay) => (
                                  <div
                                    key={delay}
                                    className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
                                    style={{ animationDelay: `${delay}ms` }}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-green-400 animate-pulse">
                              ✓ {gameMode === "vs-computer" ? "AI Hazır!" : "Oyuncu Hazır!"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Joker Panel */}
                <div
                  className="rounded-2xl border border-white/10 p-2 mb-1"
                  style={{ background: "rgba(30,30,50,0.7)" }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <img src="/icons/jokerler-gorsel.svg" className="w-5 h-5 object-contain" alt="Jokerler" />
                    <img src="/icons/jokerler-text.svg" className="h-3.5 object-contain" alt="Jokerler" />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {/* Değiştir */}
                    <button
                      className={`joker-button relative flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-colors duration-150 overflow-visible ${
                        jokers.degistir <= 0 || isJokerActive || !gameStarted
                          ? "opacity-40 cursor-not-allowed border-white/5 bg-white/5"
                          : "border-emerald-500/30 bg-emerald-900/30 active:scale-95"
                      }`}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (jokers.degistir <= 0 || isJokerActive || !gameStarted || gameEnded) return;
                        useDegisTirJoker();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (jokers.degistir <= 0 || isJokerActive || !gameStarted || gameEnded) return;
                        useDegisTirJoker();
                      }}
                      disabled={jokers.degistir <= 0 || isJokerActive || !gameStarted}
                      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                    >
                      <img src="/icons/degistir.svg" className="w-7 h-7 mb-0.5 object-contain" alt="Değiştir" />
                      <span className="text-[10px] font-bold text-slate-300">Değiştir</span>
                      <div className="absolute -top-2 -right-2 flex items-center justify-center">
                        <img src="/icons/jokerler-badge.svg" className="w-7 h-7" alt="badge" />
                        <span
                          className="absolute text-[10px] font-bold text-white"
                          style={{ WebkitTextStroke: "0.5px black", textShadow: "0 0 2px black" }}
                        >
                          {jokers.degistir}
                        </span>
                      </div>
                    </button>
                    {/* Fısılda */}
                    <button
                      className={`joker-button relative flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-colors duration-150 overflow-visible ${
                        jokers.fisilida <= 0 || isJokerActive || !gameStarted
                          ? "opacity-40 cursor-not-allowed border-white/5 bg-white/5"
                          : "border-cyan-500/30 bg-cyan-900/30 active:scale-95"
                      }`}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (jokers.fisilida <= 0 || isJokerActive || !gameStarted || gameEnded) return;
                        useFisildaJoker();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (jokers.fisilida <= 0 || isJokerActive || !gameStarted || gameEnded) return;
                        useFisildaJoker();
                      }}
                      disabled={jokers.fisilida <= 0 || isJokerActive || !gameStarted}
                      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                    >
                      <img src="/icons/fisilda.svg" className="w-7 h-7 mb-0.5 object-contain" alt="Fısılda" />
                      <span className="text-[10px] font-bold text-slate-300">Fısılda</span>
                      <div className="absolute -top-2 -right-2 flex items-center justify-center">
                        <img src="/icons/jokerler-badge.svg" className="w-7 h-7" alt="badge" />
                        <span
                          className="absolute text-[10px] font-bold text-white"
                          style={{ WebkitTextStroke: "0.5px black", textShadow: "0 0 2px black" }}
                        >
                          {jokers.fisilida}
                        </span>
                      </div>
                    </button>
                    {/* Sen Yaz */}
                    <button
                      className={`joker-button relative flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-colors duration-150 overflow-visible ${
                        jokers.senYaz <= 0 || isJokerActive || !gameStarted
                          ? "opacity-40 cursor-not-allowed border-white/5 bg-white/5"
                          : "border-violet-500/30 bg-violet-900/30 active:scale-95"
                      }`}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (jokers.senYaz <= 0 || isJokerActive || !gameStarted || gameEnded) return;
                        useSenYazJoker();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (jokers.senYaz <= 0 || isJokerActive || !gameStarted || gameEnded) return;
                        useSenYazJoker();
                      }}
                      disabled={jokers.senYaz <= 0 || isJokerActive || !gameStarted}
                      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                    >
                      <img src="/icons/senyaz.svg" className="w-7 h-7 mb-0.5 object-contain" alt="Sen Yaz" />
                      <span className="text-[10px] font-bold text-slate-300">Sen Yaz</span>
                      <div className="absolute -top-2 -right-2 flex items-center justify-center">
                        <img src="/icons/jokerler-badge.svg" className="w-7 h-7" alt="badge" />
                        <span
                          className="absolute text-[10px] font-bold text-white"
                          style={{ WebkitTextStroke: "0.5px black", textShadow: "0 0 2px black" }}
                        >
                          {jokers.senYaz}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Current Word Input */}
                <div className="mb-1">
                  <div className="flex items-center space-x-2 w-full">
                    <div
                      className={`flex items-center justify-center h-14 w-full rounded-2xl backdrop-blur-md transition-all duration-200 px-3 relative overflow-hidden ${
                        inputFlash === "success-xlong"
                          ? "border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)] bg-cyan-950/40"
                          : inputFlash === "success-long"
                            ? "border-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.5)] bg-white/15"
                            : inputFlash === "success"
                              ? "border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)] bg-emerald-950/40"
                              : inputFlash === "error"
                                ? "border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] bg-red-950/40"
                                : "border border-white/10 bg-slate-900/70"
                      }`}
                    >
                      <AnimatePresence mode="popLayout">
                        {inputFeedback && (
                          <motion.div
                            key={inputFeedback.text + Date.now()}
                            initial={{ opacity: 1, x: 0 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -200 }}
                            transition={{ duration: 0.3, ease: "easeIn" }}
                            className={`absolute inset-0 flex items-center justify-center z-20 rounded-2xl ${
                              inputFeedback.type === "bonus"
                                ? "bg-violet-600/95 shadow-[0_0_20px_rgba(139,92,246,0.6)]"
                                : inputFeedback.type === "success-xlong"
                                  ? "bg-cyan-500/90 shadow-[0_0_20px_rgba(34,211,238,0.6)]"
                                  : inputFeedback.type === "success-long"
                                    ? "bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.6)] text-slate-900"
                                    : inputFeedback.type === "success"
                                      ? "bg-emerald-500/90"
                                      : "bg-red-500/90"
                            }`}
                          >
                            <span
                              className={`font-black font-mono tracking-wider drop-shadow-md ${inputFeedback.type === "success-long" ? "text-slate-900" : "text-white"} ${inputFeedback.type === "bonus" ? "text-2xl animate-pulse" : "text-xl"}`}
                            >
                              {inputFeedback.text}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {showKelimeGondermedinAnim && kelimeGondermedinAnim && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
                            style={{ gap: "16px" }}
                          >
                            <div style={{ height: "100%", aspectRatio: "1 / 1", transform: "scale(1.6) translateX(-6px)", transformOrigin: "center" }}>
                              <Lottie
                                animationData={kelimeGondermedinAnim}
                                loop
                                autoplay
                                style={{ height: "100%", width: "100%" }}
                              />
                            </div>
                            <div style={{ height: "100%", aspectRatio: "1 / 1", transform: "scale(1.6) translateX(6px)", transformOrigin: "center" }}>
                              <Lottie
                                animationData={kelimeGondermedinAnim}
                                loop
                                autoplay
                                style={{ height: "100%", width: "100%" }}
                              />
                            </div>

                          </motion.div>
                        )}
                      </AnimatePresence>

                      {selectedLetters.length === 0 && !isJokerActive && !inputFeedback && !showKelimeGondermedinAnim && (
                        <span className="text-white/20 font-bold font-mono text-lg select-none tracking-widest uppercase">
                          K E L İ M E L E
                        </span>
                      )}

                      <div className="flex gap-1 items-center justify-center z-10">
                        {selectedLetters.map((item, idx) => (
                          <span
                            key={`input-${item.row}-${item.col}`}
                            style={{ transform: "translateZ(0)", WebkitTransform: "translateZ(0)" }}
                            className="text-3xl font-mono font-extrabold text-white drop-shadow-sm select-none"
                          >
                            {item.letter}
                          </span>
                        ))}
                        {currentWord.length > selectedLetters.length && (
                          <span className="text-3xl font-mono font-extrabold text-white drop-shadow-sm">
                            {currentWord.slice(selectedLetters.length)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-900/70 border border-white/10 text-white text-base font-black px-3 py-1 min-w-10 h-10 flex items-center justify-center shrink-0 rounded-xl shadow-md">
                      {currentWord.length}
                    </div>
                  </div>
                </div>

                {/* Game Grid */}
                <div
                  className="rounded-2xl border border-white/10 mb-2 flex-1 min-h-0 flex items-center justify-center p-3"
                  style={{
                    background: "rgba(20,20,40,0.6)",
                    transform: "translateZ(0)",
                    WebkitTransform: "translateZ(0)",
                  }}
                >
                  <div className="grid grid-cols-4 gap-2 w-full">
                    {gameGrid.map((row, rowIndex) =>
                      row.map((letter, colIndex) => {
                        const isSelected = selectedLetters.some((s) => s.row === rowIndex && s.col === colIndex);
                        const isHighlighted = highlightedLetters.some((h) => h.row === rowIndex && h.col === colIndex);
                        const highlightStyle =
                          isHighlighted && selectedJoker === "degistir"
                            ? {
                                background: "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)",
                                borderColor: "rgba(34,197,94,0.9)",
                                boxShadow: "0 0 20px rgba(34,197,94,0.6)",
                              }
                            : isHighlighted && selectedJoker === "fisilida"
                              ? {
                                  background: "linear-gradient(135deg, #fde047 0%, #d97706 100%)",
                                  borderColor: "rgba(234,179,8,0.9)",
                                  boxShadow: "0 0 20px rgba(234,179,8,0.6)",
                                }
                              : isHighlighted && selectedJoker === "senYaz"
                                ? {
                                    background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
                                    borderColor: "rgba(59,130,246,0.9)",
                                    boxShadow: "0 0 20px rgba(59,130,246,0.6)",
                                  }
                                : undefined;
                        const selectedStyle = isSelected
                          ? {
                              background: "linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)",
                              borderColor: "rgba(168,85,247,0.9)",
                              boxShadow: "0 0 20px rgba(168,85,247,0.5)",
                            }
                          : undefined;
                        const colorStyle = { ...selectedStyle, ...highlightStyle };
                        const hasColor = Boolean(selectedStyle || highlightStyle);
                        const selectionOrder = selectedLetters.findIndex(
                          (s) => s.row === rowIndex && s.col === colIndex,
                        );
                        return (
                          <button
                            key={`${rowIndex}-${colIndex}`}
                            type="button"
                            className={`letter-button text-xl font-black relative overflow-visible rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${isSelected ? "selected" : ""} ${!gameStarted ? "opacity-40 cursor-not-allowed" : ""}`}
                            disabled={!gameStarted}
                            onPointerDown={(e) => {
                              if (!gameStarted) return;
                              // Fire immediately on first contact — works per-pointer for multi-touch
                              handleLetterClick(letter, rowIndex, colIndex);
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                            style={{
                              height: "clamp(40px, 7.2dvh, 59px)",
                              touchAction: "manipulation",

                              WebkitTapHighlightColor: "transparent",
                              WebkitTouchCallout: "none",
                              WebkitUserSelect: "none",
                              userSelect: "none",
                              pointerEvents: !gameStarted ? "none" : "auto",
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className="absolute -inset-px rounded-xl border pointer-events-none z-0"
                              style={{
                                opacity: hasColor ? 1 : 0,
                                borderColor: "transparent",
                                ...colorStyle,
                              }}
                            />
                            <span
                              className={`absolute inset-0 flex items-center justify-center z-10 ${isSelected ? "opacity-100 text-white font-black" : "opacity-0"}`}
                            >
                              {letter}
                            </span>
                            {!isSelected && (
                              <span
                                className="relative z-10"
                                style={{ transform: "translateZ(0)", WebkitTransform: "translateZ(0)" }}
                              >
                                {letter}
                              </span>
                            )}
                            {isSelected && selectionOrder >= 0 && (
                              <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-black border-2 border-slate-900 z-20 shadow-sm">
                                {selectionOrder + 1}
                              </span>
                            )}
                          </button>
                        );
                      }),
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    onTouchStart={(e) => {
                      if (!gameStarted) return;
                      e.preventDefault();
                      clearWord();
                    }}
                    onClick={(e) => {
                      if (!gameStarted) return;
                      e.preventDefault();
                      clearWord();
                    }}
                    className="h-12 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/20 rounded-xl font-bold"
                    disabled={selectedLetters.length === 0 || isJokerActive || !gameStarted}
                    style={{ touchAction: "manipulation" }}
                  >
                    <img src="/icons/silgi-gorsel.svg" alt="Sil" className="w-5 h-5 mr-2" />
                    Sil
                  </Button>

                  <Button
                    onTouchStart={(e) => {
                      if (!gameStarted) return;
                      e.preventDefault();
                      submitTouchTsRef.current = Date.now();
                      playSound("buttonClick");
                      submitWord();
                    }}
                    onClick={(e) => {
                      if (!gameStarted) return;
                      e.preventDefault();
                      if (Date.now() - submitTouchTsRef.current < 500) return;
                      playSound("buttonClick");
                      submitWord();
                    }}
                    className="h-12 rounded-xl font-black text-base bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-0 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                    disabled={currentWord.length < 3 || isValidating || isJokerActive || !gameStarted}
                    style={{ touchAction: "manipulation" }}
                  >
                    <img src="/icons/gonder-gorsel.svg" alt="Gönder" className="w-5 h-5 mr-2" />
                    {isValidating ? "Kontrol..." : "Gönder"}
                  </Button>
                </div>

                {/* İfadeler butonu - sadece multiplayer */}
                {isMultiplayerMode && (
                  <div className="relative shrink-0 mt-2">
                    {emojiReactions.PickerPanel}
                    {emojiReactions.PickerButton}
                  </div>
                )}
              </div>
            </div>

            {/* Exit Confirmation Dialog */}
            <ExitConfirmCardDialog
              open={showExitDialog}
              onContinue={() => setShowExitDialog(false)}
              onExit={async () => {
                setShowExitDialog(false);
                const leavingRoomId = currentRoom?.id || savedRoomIdRef.current;
                // 🔒 Oda banlist'e alınsın ki restore/otomatik geri dönüş olmasın
                if (leavingRoomId) {
                  try {
                    await matchBanlist.add(leavingRoomId);
                  } catch (e) {
                    console.warn("Banlist ekleme hatası:", e);
                  }
                }
                if (currentRoom) {
                  await leaveRoom();
                }
                // 🧹 Matchmaking state + bekleyen yönlendirmeyi temizle
                window.dispatchEvent(new CustomEvent("cleanupMatchmaking"));
                navigate(homeBackPath());
              }}
            />



            {/* Tournament Exit Dialog */}
            <ExitConfirmCardDialog
              open={showTournamentExitDialog}
              variant="tournament"
              onContinue={() => setShowTournamentExitDialog(false)}
              onExit={async () => {
                setShowTournamentExitDialog(false);
                await handleTournamentExit();
              }}
            />
          </>
        )}

        {/* RematchDialog artık App.tsx'te global olarak render ediliyor */}

        {/* Level Up Dialog */}
        <LevelUpDialog open={showLevelUp} onClose={() => setShowLevelUp(false)} newLevel={newLevel} />
        
      </>
    </>
  );
};

export default GamePage;
