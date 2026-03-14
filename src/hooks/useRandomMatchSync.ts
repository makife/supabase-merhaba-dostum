import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGame } from "@/contexts/GameContext";
import { useToast } from "@/hooks/use-toast";
import { useServerTime } from "./useServerTime";
import { matchBanlist } from "@/utils/matchBanlist";

/**
 * Random Match Sync Hook - Production Ready
 * 
 * Tek sorumluluk: Random match için senkronizasyon
 * 
 * Akış:
 * 1. URL'den room ID al
 * 2. Room'a katıl
 * 3. countdown_started_at'ı dinle (real-time)
 * 4. Countdown bitince gameStarted = true
 * 
 * Senkronizasyon prensibi:
 * - Server countdown_started_at timestamp verir
 * - Client sadece remaining = (start + duration) - serverNow hesaplar
 * - Hiç reset yok, hiç ping-pong yok
 */

export interface RandomMatchState {
  // Room bilgileri
  roomId: string | null;
  grid: string[][];
  
  // Oyuncu bilgileri
  opponentId: string | null;
  opponentName: string;
  opponentAvatar: string | null;
  
  // Senkronizasyon
  countdownStartedAt: number | null; // Server timestamp (ms)
  gameStartedAt: number | null; // Game actual start timestamp
  gameEndsAt: number | null; // Game end timestamp
  
  // Durumlar
  phase: "loading" | "waiting" | "countdown" | "playing" | "ended";
  error: string | null;
}

interface UseRandomMatchSyncOptions {
  onGameStart?: () => void;
  onGameEnd?: () => void;
  onOpponentDisconnect?: () => void;
}

const COUNTDOWN_DURATION = 5000; // 5 saniye countdown
const GAME_DURATION = 120000; // 2 dakika oyun

export function useRandomMatchSync(options: UseRandomMatchSyncOptions = {}) {
  const { user } = useAuth();
  const { joinRoom, currentRoom, participants, leaveRoom } = useGame();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { serverNow, isReady: serverTimeReady, offset: serverOffset } = useServerTime();

  // State
  const [state, setState] = useState<RandomMatchState>({
    roomId: null,
    grid: [],
    opponentId: null,
    opponentName: "Rakip",
    opponentAvatar: null,
    countdownStartedAt: null,
    gameStartedAt: null,
    gameEndsAt: null,
    phase: "loading",
    error: null,
  });

  // Refs
  const initRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Countdown kalan süre hesapla
  const getCountdownRemaining = useCallback((): number => {
    if (!state.countdownStartedAt) return 5;
    
    const now = serverNow();
    const elapsed = now - state.countdownStartedAt;
    const remaining = Math.max(0, COUNTDOWN_DURATION - elapsed);
    
    return Math.ceil(remaining / 1000);
  }, [state.countdownStartedAt, serverNow]);

  // Oyun kalan süre hesapla
  const getGameTimeRemaining = useCallback((): number => {
    if (!state.gameEndsAt) return 120;
    
    const now = serverNow();
    const remaining = Math.max(0, state.gameEndsAt - now);
    
    return Math.floor(remaining / 1000);
  }, [state.gameEndsAt, serverNow]);

  // Rakip bilgilerini yükle
  const loadOpponentInfo = useCallback(async (opponentUserId: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", opponentUserId)
        .single();

      if (profile) {
        setState(prev => ({
          ...prev,
          opponentName: profile.username || "Rakip",
          opponentAvatar: profile.avatar_url,
        }));
      }
    } catch (err) {
      console.error("Opponent profile load error:", err);
    }
  }, []);

  // Room'a katıl ve real-time dinle
  const initializeMatch = useCallback(async () => {
    if (!user?.id || initRef.current) return;
    initRef.current = true;

    const roomId = searchParams.get("room");
    const gameType = searchParams.get("type") as "timed" | "score";

    console.log("🎮 Random match init:", { roomId, gameType });

    if (!roomId) {
      setState(prev => ({ ...prev, error: "Room ID bulunamadı", phase: "ended" }));
      return;
    }

    setState(prev => ({ ...prev, roomId, phase: "loading" }));

    try {
      // Room'a katıl (retry logic ile)
      let joined = false;
      for (let i = 0; i < 10; i++) {
        joined = await joinRoom(roomId);
        if (joined) break;
        await new Promise(r => setTimeout(r, 200));
      }

      if (!joined) {
        throw new Error("Room'a katılınamadı");
      }

      console.log("✅ Room'a katıldı:", roomId);

      // Room bilgilerini al
      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (roomError || !room) {
        throw new Error("Room bulunamadı");
      }

      // Grid'i parse et
      const gridFlat = room.current_grid as string[];
      const grid: string[][] = [];
      for (let i = 0; i < 4; i++) {
        grid.push(gridFlat.slice(i * 4, (i + 1) * 4));
      }

      // Rakip ID'sini bul
      const opponentId = room.host_id === user.id ? room.player2_id : room.host_id;

      setState(prev => ({
        ...prev,
        grid,
        opponentId,
        phase: room.countdown_started_at ? "countdown" : "waiting",
        countdownStartedAt: room.countdown_started_at 
          ? new Date(room.countdown_started_at).getTime() 
          : null,
      }));

      // Rakip profilini yükle
      if (opponentId) {
        loadOpponentInfo(opponentId);
      }

      // Real-time subscription - room updates
      const channel = supabase
        .channel(`random-match-${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "game_rooms",
            filter: `id=eq.${roomId}`,
          },
          (payload) => {
            console.log("📡 Room update:", payload.new);
            
            const newRoom = payload.new as any;
            
            // Countdown başladı mı?
            if (newRoom.countdown_started_at && !state.countdownStartedAt) {
              const countdownTs = new Date(newRoom.countdown_started_at).getTime();
              console.log("⏱️ Countdown started at:", countdownTs);
              
              setState(prev => ({
                ...prev,
                countdownStartedAt: countdownTs,
                phase: "countdown",
              }));
            }
            
            // Oyun başladı mı? (started_at set edildi)
            if (newRoom.started_at && !state.gameStartedAt) {
              const startedAt = new Date(newRoom.started_at).getTime();
              const endsAt = newRoom.ends_at 
                ? new Date(newRoom.ends_at).getTime()
                : startedAt + GAME_DURATION;
              
              console.log("🎮 Game started at:", startedAt, "ends at:", endsAt);
              
              setState(prev => ({
                ...prev,
                gameStartedAt: startedAt,
                gameEndsAt: endsAt,
                phase: "playing",
              }));
              
              options.onGameStart?.();
            }
            
            // Oyun bitti mi?
            if (newRoom.status === "finished" || newRoom.status === "completed") {
              console.log("🏁 Game finished");
              setState(prev => ({ ...prev, phase: "ended" }));
              options.onGameEnd?.();
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "game_participants",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            console.log("👋 Participant left:", payload.old);
            
            const leftUser = (payload.old as any).user_id;
            if (leftUser !== user.id && state.phase === "playing") {
              console.log("🚪 Opponent disconnected");
              options.onOpponentDisconnect?.();
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

      // Eğer countdown zaten başlamışsa, countdown'ı takip et
      if (room.countdown_started_at) {
        const countdownTs = new Date(room.countdown_started_at).getTime();
        setState(prev => ({
          ...prev,
          countdownStartedAt: countdownTs,
          phase: "countdown",
        }));
      }

    } catch (err) {
      console.error("❌ Match init error:", err);
      setState(prev => ({ 
        ...prev, 
        error: err instanceof Error ? err.message : "Bilinmeyen hata",
        phase: "ended",
      }));
      
      toast({
        title: "Bağlantı Hatası",
        description: "Oyun odasına bağlanılamadı",
        variant: "destructive",
      });
      
      navigate("/");
    }
  }, [user?.id, searchParams, joinRoom, loadOpponentInfo, options, toast, navigate, state.countdownStartedAt, state.gameStartedAt, state.phase]);

  // Countdown bittiğinde oyunu başlat
  useEffect(() => {
    if (state.phase !== "countdown" || !state.countdownStartedAt || !serverTimeReady) return;

    const checkCountdown = () => {
      const remaining = getCountdownRemaining();
      
      if (remaining <= 0 && state.phase === "countdown") {
        console.log("⏱️ Countdown complete, game starting...");
        
        // Game started at hesapla
        const gameStartedAt = state.countdownStartedAt! + COUNTDOWN_DURATION;
        const gameEndsAt = gameStartedAt + GAME_DURATION;
        
        setState(prev => ({
          ...prev,
          gameStartedAt,
          gameEndsAt,
          phase: "playing",
        }));
        
        options.onGameStart?.();
      }
    };

    const interval = setInterval(checkCountdown, 100);
    checkCountdown(); // İlk kontrol

    return () => clearInterval(interval);
  }, [state.phase, state.countdownStartedAt, serverTimeReady, getCountdownRemaining, options]);

  // Oyun süresi bittiğinde
  useEffect(() => {
    if (state.phase !== "playing" || !state.gameEndsAt || !serverTimeReady) return;

    const checkGameEnd = () => {
      const remaining = getGameTimeRemaining();
      
      if (remaining <= 0 && state.phase === "playing") {
        console.log("🏁 Game time up");
        setState(prev => ({ ...prev, phase: "ended" }));
        options.onGameEnd?.();
      }
    };

    const interval = setInterval(checkGameEnd, 500);
    checkGameEnd();

    return () => clearInterval(interval);
  }, [state.phase, state.gameEndsAt, serverTimeReady, getGameTimeRemaining, options]);

  // Init
  useEffect(() => {
    if (serverTimeReady) {
      initializeMatch();
    }
  }, [serverTimeReady, initializeMatch]);

  // ✅ Cleanup: Oda kanallarını temizle
  useEffect(() => {
    return () => {
      console.log("🔌 [useRandomMatchSync] Cleanup - kanal temizleniyor");
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (state.roomId) {
        matchBanlist.add(state.roomId);
      }
    };
  }, [state.roomId]);

  // Oyundan çık
  // ✅ Oyundan çık - kanal temizle
  const exitMatch = useCallback(async () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    await leaveRoom();
    
    if (state.roomId) {
      matchBanlist.add(state.roomId);
    }
    
    navigate("/");
  }, [leaveRoom, navigate, state.roomId]);

  return {
    ...state,
    serverOffset,
    serverNow,
    getCountdownRemaining,
    getGameTimeRemaining,
    exitMatch,
    isReady: serverTimeReady && state.phase !== "loading",
  };
}
