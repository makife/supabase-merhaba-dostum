import { getRankTier, getRankProgress, getRankFrame } from "@/utils/rankSystem";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useSounds } from "@/hooks/useSounds";
import { usePageSwipeNav } from "@/hooks/usePageSwipeNav";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { usePendingAvatarRecovery } from "@/hooks/usePendingAvatarRecovery";
import { usePageResync } from "@/hooks/useGlobalResync";
import { IN_GAME_STATUS_POLL_MS, getInGameActivityThreshold } from "@/utils/playerActivityStatus";
import { AvatarOptionsDialog } from "@/components/AvatarOptionsDialog";
import { VipBadge } from "@/components/VipBadge";
import { BadgesDialog } from "@/components/BadgesDialog";
import { LevelUpDialog } from "@/components/LevelUpDialog";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import { Capacitor } from "@capacitor/core";
import { RealtimeClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Trophy,
  Target,
  Zap,
  Crown,
  Edit,
  TrendingUp,
  Calendar,
  Clock,
  Award,
  Users,
  User,
  MessageCircle,
  UserPlus,
  UserCheck,
  Flame,
  Star,
  Sparkles,
  Gift,
  Rocket,
} from "lucide-react";

const ProfilePage = () => {
  const { user } = useAuth();
  const { profile } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [jokers, setJokers] = useState({ degistir: 0, fisilida: 0, senYaz: 0 });
  const [testLevelUpOpen, setTestLevelUpOpen] = useState(false);
  const [testLevelUpValue, setTestLevelUpValue] = useState(1);
  const { captureFromCamera, captureFromGallery, uploadAvatar, uploadGameAvatar, deleteAvatar, uploading } =
    useAvatarUpload();
  const { id: routeId } = useParams();
  const { containerRef: swipeRef, swipeHandlers } = usePageSwipeNav({ route: "/profile", enabled: !routeId });
  const { playSound } = useSounds();
  const viewedUserId = routeId || user?.id || null;
  const isOwnProfile = !routeId || routeId === user?.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState("");
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [showBadgesDialog, setShowBadgesDialog] = useState(false);
  const [viewedProfile, setViewedProfile] = useState<{ avatar_url?: string | null } | null>(null);
  const [isUserOnline, setIsUserOnline] = useState(false);
  const [profileInGame, setProfileInGame] = useState(false);
  const [profileData, setProfileData] = useState({
    username: user?.email?.split("@")[0] || "Oyuncu",
    totalGames: 0,
    wins: 0,
    losses: 0,
    totalScore: 0,
    winRate: 0,
    longestWord: "",
    longestWordLength: 0,
    currentStreak: 0,
    level: 1,
    experience: 0,
    nextLevelExp: 1000,
    averageScore: 0,
    premiumUntil: null as string | null,
    tournamentsWon: 0,
    tournamentsLost: 0,
    tournamentsPlayed: 0,
    tournamentWinRate: 0,
    weeklyFirstCount: 0,
    monthlyFirstCount: 0,
    seasonFirstCount: 0,
    rankPoints: 0,
    scoreBoostUntil: null as string | null,
    scoreBoostSource: null as string | null,
    createdAt: null as string | null,
    lastSeen: null as string | null,
  });

  const [badges, setBadges] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      icon: string;
      earned: boolean;
      earned_at?: string;
      condition_type?: string;
      condition_value?: number;
    }>
  >([]);

  const [userStats, setUserStats] = useState<{
    total_games?: number;
    total_score?: number;
    win_streak?: number;
    total_words_created?: number;
    longest_word_length?: number;
    tournament_wins?: number;
    degistir_joker_used?: number;
    fisilida_joker_used?: number;
    senyaz_joker_used?: number;
    vs_bot_games?: number;
    private_room_games?: number;
    random_match_games?: number;
    wins?: number;
    fastest_word_time?: number;
  }>({});

  const calculateLevel = (totalScore: number) => {
    let level = 1;
    let totalExpNeeded = 0;
    let currentLevelExp = 1000;

    while (totalScore >= totalExpNeeded + currentLevelExp) {
      totalExpNeeded += currentLevelExp;
      level++;
      currentLevelExp = level * 1000;
    }

    const experience = totalScore - totalExpNeeded;
    const nextLevelExp = currentLevelExp;

    return { level, experience, nextLevelExp };
  };

  const fetchBadges = async () => {
    if (!viewedUserId) return;

    try {
      const { data: allBadges, error: badgesError } = await supabase.from("badges").select("*").order("name");

      if (badgesError) {
        console.error("Rozet fetch hatası:", badgesError);
        return;
      }

      const { data: userBadges, error: userBadgesError } = await supabase
        .from("user_badges")
        .select("badge_id, earned_at")
        .eq("user_id", viewedUserId);

      if (userBadgesError) {
        console.error("Kullanıcı rozet fetch hatası:", userBadgesError);
        return;
      }

      const earnedBadgeIds = new Set(userBadges?.map((ub) => ub.badge_id) || []);
      const badgesWithStatus =
        allBadges?.map((badge) => ({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          earned: earnedBadgeIds.has(badge.id),
          earned_at: userBadges?.find((ub) => ub.badge_id === badge.id)?.earned_at,
          condition_type: badge.condition_type,
          condition_value: badge.condition_value,
        })) || [];

      setBadges(badgesWithStatus);
    } catch (error) {
      console.error("Rozet yükleme hatası:", error);
    }
  };

  const fetchTournamentStats = async () => {
    if (!viewedUserId) return { won: 0, lost: 0, played: 0, winRate: 0 };

    try {
      const { data: profileStats } = await supabase
        .from("profiles")
        .select("tournament_wins")
        .eq("id", viewedUserId)
        .maybeSingle();

      const { data: userMatches, error } = await supabase
        .from("tournament_matches")
        .select("tournament_id")
        .or(`player1_id.eq.${viewedUserId},player2_id.eq.${viewedUserId}`)
        .eq("status", "completed");

      if (error) {
        console.error("Turnuva istatistikleri hatası:", error);
        return { won: 0, lost: 0, played: 0, winRate: 0 };
      }

      const tournamentIds = Array.from(new Set((userMatches || []).map((match) => match.tournament_id).filter(Boolean)));
      const won = profileStats?.tournament_wins || 0;

      if (tournamentIds.length === 0) {
        return { won, lost: 0, played: won, winRate: won > 0 ? 100 : 0 };
      }

      const { data: allMatches, error: allMatchesError } = await supabase
        .from("tournament_matches")
        .select("winner_id, player1_id, player2_id, tournament_id, round")
        .in("tournament_id", tournamentIds)
        .eq("status", "completed");

      if (allMatchesError) {
        console.error("Turnuva final istatistikleri hatası:", allMatchesError);
        return { won, lost: 0, played: won, winRate: won > 0 ? 100 : 0 };
      }

      const playedTournamentIds = new Set<string>();
      tournamentIds.forEach((tournamentId) => {
        const tournamentMatches = (allMatches || []).filter((match) => match.tournament_id === tournamentId);
        const maxRound = Math.max(...tournamentMatches.map((match) => match.round || 0));
        const finalRoundMatches = tournamentMatches.filter((match) => match.round === maxRound);
        if (maxRound > 0 && finalRoundMatches.length === 1) playedTournamentIds.add(tournamentId);
      });

      const played = Math.max(playedTournamentIds.size, won);
      const lost = Math.max(played - won, 0);
      const winRate = played > 0 ? Math.round((won / played) * 100) : 0;

      return { won, lost, played, winRate };
    } catch (error) {
      console.error("Turnuva istatistikleri fetch hatası:", error);
      return { won: 0, lost: 0, played: 0, winRate: 0 };
    }
  };

  const [avatarKey, setAvatarKey] = useState(0);

  const [localAvatarOverride, setLocalAvatarOverride] = useState<{ url: string; timestamp: number } | null>(null);

  const handleAvatarUploaded = useCallback((url: string) => {
    console.log("[ProfilePage] ✅ Avatar yüklendi, UI güncelleniyor:", url);

    const cacheBustedUrl = url.includes("?") ? `${url.split("?")[0]}?t=${Date.now()}` : `${url}?t=${Date.now()}`;

    console.log("[ProfilePage] 🔗 Cache-busted URL:", cacheBustedUrl);

    setLocalAvatarOverride({ url: cacheBustedUrl, timestamp: Date.now() });

    setAvatarKey((prev) => prev + 1);

    setViewedProfile((prev) => ({ ...prev, avatar_url: cacheBustedUrl }));
    setProfileData((prev: any) => ({ ...prev, avatar_url: cacheBustedUrl }));

    console.log("[ProfilePage] 🔄 localAvatarOverride SET EDİLDİ:", cacheBustedUrl.substring(0, 80));
  }, []);

  const { captureFromCameraWithRecovery, captureFromGalleryWithRecovery } =
    usePendingAvatarRecovery(handleAvatarUploaded);

  const effectiveAvatarUrl = useMemo(() => {
    if (localAvatarOverride) {
      const { url, timestamp } = localAvatarOverride;
      if (Date.now() - timestamp < 10000) {
        console.log("[ProfilePage] 🎯 Local override kullanılıyor:", url.substring(0, 60));
        return url;
      }
    }

    const profileUrl = isOwnProfile ? profile?.avatar_url : viewedProfile?.avatar_url;
    console.log("[ProfilePage] 📸 Profile URL kullanılıyor:", profileUrl?.substring(0, 60) || "(boş)");
    return profileUrl || "";
  }, [avatarKey, localAvatarOverride, profile?.avatar_url, viewedProfile?.avatar_url, isOwnProfile]);

  useEffect(() => {
    const handleAvatarUploadedEvent = (event: CustomEvent<{ url: string }>) => {
      console.log("[ProfilePage] 📡 avatar-uploaded event alındı:", event.detail.url);

      const originalUrl = event.detail.url;
      const cacheBustedUrl = originalUrl.includes("?")
        ? `${originalUrl.split("?")[0]}?t=${Date.now()}`
        : `${originalUrl}?t=${Date.now()}`;

      console.log("[ProfilePage] 📡 Cache-busted URL (event):", cacheBustedUrl);

      setLocalAvatarOverride({ url: cacheBustedUrl, timestamp: Date.now() });

      setAvatarKey((prev) => prev + 1);

      setViewedProfile((prev) => ({ ...prev, avatar_url: cacheBustedUrl }));
      setProfileData((prev: any) => ({ ...prev, avatar_url: cacheBustedUrl }));
    };

    window.addEventListener("avatar-uploaded", handleAvatarUploadedEvent as EventListener);

    return () => {
      window.removeEventListener("avatar-uploaded", handleAvatarUploadedEvent as EventListener);
    };
  }, []);

  useEffect(() => {
    if (isOwnProfile && profile?.avatar_url) {
      console.log("[ProfilePage] 🔄 UserContext profile değişti, viewedProfile güncelleniyor:", profile.avatar_url);
      setViewedProfile((prev) => ({ ...prev, avatar_url: profile.avatar_url }));
      setAvatarKey((prev) => prev + 1);
    }
  }, [isOwnProfile, profile?.avatar_url]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!viewedUserId) return;

      const [{ data }, tournamentStats] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", viewedUserId).maybeSingle(),
        fetchTournamentStats(),
      ]);

      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { data: presenceData } = await supabase
        .from("user_presence")
        .select("is_online, last_seen")
        .eq("user_id", viewedUserId)
        .maybeSingle();

      const isOnlineNow = !!presenceData?.is_online && !!presenceData?.last_seen && presenceData.last_seen >= oneMinuteAgo;
      setIsUserOnline(isOnlineNow);

      // 🔵 In-game freshness check via player_activities; profiles.in_game tek başına stale kalabiliyor
      const inGameThreshold = getInGameActivityThreshold();
      const { data: activityData } = await supabase
        .from("player_activities")
        .select("player_id")
        .eq("player_id", viewedUserId)
        .gte("last_action_time", inGameThreshold)
        .maybeSingle();

      if (data) {
        setProfileInGame(!!activityData);
        const levelData = calculateLevel(data.total_score || 0);
        const username = data.username || user?.email?.split("@")[0] || "Oyuncu";

        setViewedProfile({ avatar_url: data.avatar_url });

        setProfileData((prev) => ({
          ...prev,
          username: username,
          totalGames: data.total_games || 0,
          wins: data.wins || 0,
          losses: data.losses || 0,
          totalScore: data.total_score || 0,
          winRate: data.total_games > 0 ? Math.round(((data.wins || 0) / data.total_games) * 100) : 0,
          longestWord: data.longest_word || "",
          longestWordLength: data.longest_word_length || 0,
          currentStreak: data.win_streak || 0,
          level: levelData.level,
          experience: levelData.experience,
          nextLevelExp: levelData.nextLevelExp,
          premiumUntil: data.premium_until,
          averageScore: data.average_score || 0,
          tournamentsWon: tournamentStats.won,
          tournamentsLost: tournamentStats.lost,
          tournamentsPlayed: tournamentStats.played,
          tournamentWinRate: tournamentStats.winRate,
          weeklyFirstCount: data.weekly_first_count || 0,
          monthlyFirstCount: data.monthly_first_count || 0,
          seasonFirstCount: data.season_first_count || 0,
          rankPoints: (data as any).rank_points || 0,
          scoreBoostUntil: data.score_boost_until || null,
          scoreBoostSource: data.score_boost_source || null,
          createdAt: (data as any).created_at || null,
          lastSeen: presenceData?.last_seen || null,
        }));

        setUserStats({
          total_games: data.total_games || 0,
          total_score: data.total_score || 0,
          win_streak: data.win_streak || 0,
          total_words_created: data.total_words_created || 0,
          longest_word_length: data.longest_word_length || 0,
          tournament_wins: data.tournament_wins || 0,
          degistir_joker_used: data.degistir_joker_used || 0,
          fisilida_joker_used: data.fisilida_joker_used || 0,
          senyaz_joker_used: data.senyaz_joker_used || 0,
          vs_bot_games: data.vs_bot_games || 0,
          private_room_games: data.private_room_games || 0,
          random_match_games: data.random_match_games || 0,
          wins: data.wins || 0,
          fastest_word_time: data.fastest_word_time || 0,
        });
      }
    };

    fetchProfile();
    if (isOwnProfile || !viewedUserId) return;
    const interval = setInterval(fetchProfile, IN_GAME_STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [viewedUserId, isOwnProfile]);

  useEffect(() => {
    const fetchJokers = async () => {
      if (!viewedUserId) return;

      const { data } = await supabase
        .from("user_inventory")
        .select("item_type, quantity")
        .eq("user_id", viewedUserId)
        .in("item_type", [
          "degistir",
          "joker_degistir",
          "fisilda",
          "fisilida",
          "joker_fisildi",
          "joker_fisilida",
          "senYaz",
          "senyaz",
          "joker_senyaz",
        ]);

      const keyMap: Record<string, "degistir" | "fisilida" | "senYaz"> = {
        degistir: "degistir",
        joker_degistir: "degistir",
        fisilda: "fisilida",
        fisilida: "fisilida",
        joker_fisildi: "fisilida",
        joker_fisilida: "fisilida",
        senYaz: "senYaz",
        senyaz: "senYaz",
        joker_senyaz: "senYaz",
      };

      const result = { degistir: 0, fisilida: 0, senYaz: 0 };
      data?.forEach((item) => {
        const mapped = keyMap[item.item_type];
        if (mapped) result[mapped] += item.quantity;
      });
      setJokers(result);
    };

    fetchJokers();
  }, [viewedUserId]);

  useEffect(() => {
    if (!user || !isOwnProfile) return;

    const channel = supabase
      .channel("profile-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log("📊 Profile updated:", payload.new);
          const newData = payload.new;

          setProfileData((prev) => {
            const baseTotalScore = newData.total_score ?? prev.totalScore ?? 0;
            const levelData = calculateLevel(baseTotalScore);

            if (levelData.level > prev.level) {
              toast.success(`🎉 Seviye ${levelData.level}'e ulaştınız!`, { duration: 5000 });
            }

            return {
              ...prev,
              totalScore: baseTotalScore,
              totalGames: newData.total_games ?? prev.totalGames,
              wins: newData.wins ?? prev.wins,
              losses: newData.losses ?? prev.losses,
              longestWord: newData.longest_word ?? prev.longestWord,
              longestWordLength: newData.longest_word_length ?? prev.longestWordLength,
              currentStreak: newData.win_streak ?? prev.currentStreak,
              winRate:
                (newData.total_games ?? prev.totalGames) > 0
                  ? Math.round(((newData.wins ?? prev.wins ?? 0) / (newData.total_games ?? prev.totalGames ?? 1)) * 100)
                  : 0,
              level: levelData.level,
              experience: levelData.experience,
              nextLevelExp: levelData.nextLevelExp,
              averageScore: newData.average_score ?? prev.averageScore,
              rankPoints: newData.rank_points ?? prev.rankPoints,
              scoreBoostUntil: newData.score_boost_until ?? prev.scoreBoostUntil,
              scoreBoostSource: newData.score_boost_source ?? prev.scoreBoostSource,
            };
          });

          setUserStats((prev) => ({
            ...prev,
            total_games: newData.total_games ?? prev.total_games,
            total_score: newData.total_score ?? prev.total_score,
            win_streak: newData.win_streak ?? prev.win_streak,
            total_words_created: newData.total_words_created ?? prev.total_words_created,
            longest_word_length: newData.longest_word_length ?? prev.longest_word_length,
            tournament_wins: newData.tournament_wins ?? prev.tournament_wins,
            degistir_joker_used: newData.degistir_joker_used ?? prev.degistir_joker_used,
            fisilida_joker_used: newData.fisilida_joker_used ?? prev.fisilida_joker_used,
            senyaz_joker_used: newData.senyaz_joker_used ?? prev.senyaz_joker_used,
            vs_bot_games: newData.vs_bot_games ?? prev.vs_bot_games,
            private_room_games: newData.private_room_games ?? prev.private_room_games,
            random_match_games: newData.random_match_games ?? prev.random_match_games,
            wins: newData.wins ?? prev.wins,
            fastest_word_time: newData.fastest_word_time ?? prev.fastest_word_time,
          }));

          fetchBadges();

          if (user) {
            checkBadges(user.id);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_badges",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("🏆 New badge earned:", payload.new);

          const { data: badgeData } = await supabase
            .from("badges")
            .select("name, icon")
            .eq("id", payload.new.badge_id)
            .single();

          if (badgeData) {
            toast.success(`🏆 Yeni Rozet: ${badgeData.name} ${badgeData.icon}`, {
              duration: 5000,
            });
          }

          fetchBadges();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournament_matches",
          filter: `player1_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("🏆 Tournament match updated (as player1):", payload.new);
          if (payload.new.status === "completed") {
            const tournamentStats = await fetchTournamentStats();
            setProfileData((prev) => ({
              ...prev,
              tournamentsWon: tournamentStats.won,
              tournamentsLost: tournamentStats.lost,
              tournamentsPlayed: tournamentStats.played,
              tournamentWinRate: tournamentStats.winRate,
            }));

            if (user) {
              checkBadges(user.id);
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournament_matches",
          filter: `player2_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("🏆 Tournament match updated (as player2):", payload.new);
          if (payload.new.status === "completed") {
            const tournamentStats = await fetchTournamentStats();
            setProfileData((prev) => ({
              ...prev,
              tournamentsWon: tournamentStats.won,
              tournamentsLost: tournamentStats.lost,
              tournamentsPlayed: tournamentStats.played,
              tournamentWinRate: tournamentStats.winRate,
            }));

            if (user) {
              checkBadges(user.id);
            }
          }
        },
      )
      .subscribe();

    return () => {
      console.log("⚠️ [ProfilePage] Cleanup ATLANYOR (bağlantı koruması)");
    };
  }, [user, isOwnProfile]);

  useEffect(() => {
    const loadBadges = async () => {
      await fetchBadges();
      // Kendi profilimizse, hak edilen rozetleri kontrol et ve sonra tekrar çek
      if (isOwnProfile && user) {
        await checkBadges(user.id);
        await fetchBadges();
      }
    };
    loadBadges();
  }, [viewedUserId]);

  const refreshProfileData = useCallback(async () => {
    if (!viewedUserId) return;

    console.log("🔄 [ProfilePage] Resync triggered - profil verileri yeniden yükleniyor...");

    try {
      const inGameThreshold = getInGameActivityThreshold();
      const [profileResult, tournamentStats, activityResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", viewedUserId).maybeSingle(),
        fetchTournamentStats(),
        supabase
          .from("player_activities")
          .select("player_id")
          .eq("player_id", viewedUserId)
          .gte("last_action_time", inGameThreshold)
          .maybeSingle(),
      ]);

      const { data } = profileResult;

      if (data) {
        setProfileInGame(!!activityResult.data);
        const levelData = calculateLevel(data.total_score || 0);
        const username = data.username || user?.email?.split("@")[0] || "Oyuncu";

        setViewedProfile({ avatar_url: data.avatar_url });

        setProfileData((prev) => ({
          ...prev,
          username: username,
          totalGames: data.total_games || 0,
          wins: data.wins || 0,
          losses: data.losses || 0,
          totalScore: data.total_score || 0,
          winRate: data.total_games > 0 ? Math.round(((data.wins || 0) / data.total_games) * 100) : 0,
          longestWord: data.longest_word || "",
          longestWordLength: data.longest_word_length || 0,
          currentStreak: data.win_streak || 0,
          level: levelData.level,
          experience: levelData.experience,
          nextLevelExp: levelData.nextLevelExp,
          premiumUntil: data.premium_until,
          averageScore: data.average_score || 0,
          tournamentsWon: tournamentStats.won,
          tournamentsLost: tournamentStats.lost,
          tournamentsPlayed: tournamentStats.played,
          tournamentWinRate: tournamentStats.winRate,
          scoreBoostUntil: data.score_boost_until || null,
          scoreBoostSource: data.score_boost_source || null,
          createdAt: (data as any).created_at || null,
        }));

        setUserStats({
          total_games: data.total_games || 0,
          total_score: data.total_score || 0,
          win_streak: data.win_streak || 0,
          total_words_created: data.total_words_created || 0,
          longest_word_length: data.longest_word_length || 0,
          tournament_wins: data.tournament_wins || 0,
          degistir_joker_used: data.degistir_joker_used || 0,
          fisilida_joker_used: data.fisilida_joker_used || 0,
          senyaz_joker_used: data.senyaz_joker_used || 0,
          vs_bot_games: data.vs_bot_games || 0,
          private_room_games: data.private_room_games || 0,
          random_match_games: data.random_match_games || 0,
          wins: data.wins || 0,
          fastest_word_time: data.fastest_word_time || 0,
        });
      }

      await fetchBadges();
      console.log("✅ [ProfilePage] Resync tamamlandı - rozetler dahil");
    } catch (error) {
      console.error("❌ [ProfilePage] Resync hatası:", error);
    }
  }, [viewedUserId, user?.email]);

  usePageResync(refreshProfileData, "ProfilePage", false);

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedUsername(profileData.username);
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    if (!user || !isOwnProfile) return;

    if (editedUsername.length > 15) {
      toast.error("Rumuz en fazla 15 karakter olabilir");
      return;
    }

    if (editedUsername.length < 2) {
      toast.error("Rumuz en az 2 karakter olmalıdır");
      return;
    }

    // Aynı isim ise kontrol etmeye gerek yok
    if (editedUsername.toLowerCase() !== (profileData.username || "").toLowerCase()) {
      const { checkUsernameAvailable, usernameErrorMessage } = await import("@/utils/usernameValidation");
      const result = await checkUsernameAvailable(editedUsername);
      if (result !== "ok") {
        toast.error(usernameErrorMessage(result) ?? "Rumuz uygun değil");
        return;
      }
    }

    try {
      const { error } = await supabase.from("profiles").update({ username: editedUsername }).eq("id", user.id);

      if (error) throw error;

      setProfileData((prev) => ({ ...prev, username: editedUsername }));
      setIsEditing(false);
      toast.success("Profil başarıyla güncellendi");
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast.error("Profil güncellenirken hata oluştu");
    }
  };


  const getSubscriptionInfo = () => {
    if (!profileData.premiumUntil) return null;

    const premiumDate = new Date(profileData.premiumUntil);
    const now = new Date();

    if (premiumDate <= now) return null;

    const diffTime = premiumDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const isYearly = diffDays > 40;
    const subscriptionType = isYearly ? "Yıllık" : "Aylık";

    let timeLeft = "";
    if (diffDays > 365) {
      const years = Math.floor(diffDays / 365);
      const remainingDays = diffDays % 365;
      timeLeft = `${years} yıl ${remainingDays} gün`;
    } else if (diffDays > 30) {
      const months = Math.floor(diffDays / 30);
      const remainingDays = diffDays % 30;
      timeLeft = `${months} ay ${remainingDays} gün`;
    } else {
      timeLeft = `${diffDays} gün`;
    }

    return { subscriptionType, timeLeft, diffDays };
  };

  const getBoostInfo = () => {
    if (!profileData.scoreBoostUntil) return null;

    const boostDate = new Date(profileData.scoreBoostUntil);
    const now = new Date();

    if (boostDate <= now) return null;

    const diff = boostDate.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let timeLeft = "";
    if (days > 0) {
      timeLeft = `${days}g ${hours}s ${minutes}dk`;
    } else if (hours > 0) {
      timeLeft = `${hours}s ${minutes}dk ${seconds}sn`;
    } else if (minutes > 0) {
      timeLeft = `${minutes}dk ${seconds}sn`;
    } else {
      timeLeft = `${seconds}sn`;
    }

    const sourceLabels: Record<string, string> = {
      weekly: "Haftalık",
      monthly: "Aylık",
      season: "Sezonluk",
    };

    return {
      timeLeft,
      sourceLabel: sourceLabels[profileData.scoreBoostSource || ""] || "Puan Boostu",
    };
  };

  const subscriptionInfo = getSubscriptionInfo();
  const boostInfo = getBoostInfo();

  const checkBadges = async (userId: string) => {
    try {
      console.log("Rozet kontrolu yapiliyor:", userId);

      const { data: badges, error } = await supabase.rpc("check_and_award_badges_simple", {
        p_user_id: userId,
      });

      if (error) {
        console.error("Rozet kontrolu hatasi:", error);
      }

      console.log("Rozet kontrolu tamamlandi");
    } catch (error) {
      console.error("Rozet kontrolu hatasi:", error);
    }
  };

  const handleAvatarClick = () => {
    if (isOwnProfile) {
      setShowAvatarOptions(true);
    }
  };

  const handleCameraSelect = async () => {
    if (Capacitor.isNativePlatform()) {
      setShowAvatarOptions(false);
      console.log("[ProfilePage] 📷 Native kamera recovery modu aktif");
      await captureFromCameraWithRecovery();
      return;
    }

    try {
      // iOS'ta önce kamerayı aç, SONRA dialogu kapat
      // Gesture context'i korumak için Camera.getPhoto ÖNCE çağrılmalı
      console.log("[ProfilePage] 📷 iOS kamera açılıyor...");
      const result = await captureFromCamera();
      setShowAvatarOptions(false);
      
      if (result) {
        console.log("[ProfilePage] ✅ Fotoğraf alındı, yükleniyor...", (result.file.size / 1024).toFixed(0), "KB");
        const publicUrl = await uploadAvatar(result.file);
        if (publicUrl) {
          console.log("[ProfilePage] ✅ Avatar güncellendi:", publicUrl);
          handleAvatarUploaded(publicUrl);
          toast.success("Avatar güncellendi");
        } else {
          console.error("[ProfilePage] ❌ uploadAvatar null döndü");
          toast.error("Avatar yüklenemedi");
        }
      } else {
        console.log("[ProfilePage] 📷 Kamera iptal edildi veya sonuç alınamadı");
      }
    } catch (error: any) {
      setShowAvatarOptions(false);
      console.error("[ProfilePage] ❌ Kamera hatası:", error);
      toast.error("Fotoğraf çekilirken hata: " + (error?.message || String(error)));
    }
  };

  const handleGallerySelect = async () => {
    if (Capacitor.isNativePlatform()) {
      setShowAvatarOptions(false);
      console.log("[ProfilePage] 🖼️ Native galeri recovery modu aktif");
      await captureFromGalleryWithRecovery();
      return;
    }

    try {
      // iOS'ta önce galeriyi aç, SONRA dialogu kapat
      console.log("[ProfilePage] 🖼️ iOS galeri açılıyor...");
      const result = await captureFromGallery();
      setShowAvatarOptions(false);
      
      if (result) {
        console.log("[ProfilePage] ✅ Fotoğraf seçildi, yükleniyor...", (result.file.size / 1024).toFixed(0), "KB");
        const publicUrl = await uploadAvatar(result.file);
        if (publicUrl) {
          console.log("[ProfilePage] ✅ Avatar güncellendi:", publicUrl);
          handleAvatarUploaded(publicUrl);
          toast.success("Avatar güncellendi");
        } else {
          console.error("[ProfilePage] ❌ uploadAvatar null döndü");
          toast.error("Avatar yüklenemedi");
        }
      } else {
        console.log("[ProfilePage] 🖼️ Galeri iptal edildi veya sonuç alınamadı");
      }
    } catch (error: any) {
      setShowAvatarOptions(false);
      console.error("[ProfilePage] ❌ Galeri hatası:", error);
      toast.error("Fotoğraf seçilirken hata: " + (error?.message || String(error)));
    }
  };

  const handleGameAvatarsSelect = async (avatarPath: string) => {
    const avatarUrl = await uploadGameAvatar(avatarPath);
    if (avatarUrl) {
      setProfileData((prev) => ({ ...prev, avatar_url: avatarUrl }));
    }
  };

  const handleDeleteAvatar = async () => {
    setShowAvatarOptions(false);
    const success = await deleteAvatar();
    if (success) {
      setProfileData((prev) => ({ ...prev, avatar_url: "" }));
    }
  };

  const refreshStats = async () => {
    if (!viewedUserId) return;

    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", viewedUserId).single();

      const tournamentStats = await fetchTournamentStats();

      if (data) {
        const levelData = calculateLevel(data.total_score || 0);
        const username = data.username || user?.email?.split("@")[0] || "Oyuncu";

        setProfileData((prev) => ({
          ...prev,
          username: username,
          avatar_url: data.avatar_url || "",
          totalGames: data.total_games || 0,
          wins: data.wins || 0,
          losses: data.losses || 0,
          totalScore: data.total_score || 0,
          winRate: data.total_games > 0 ? Math.round(((data.wins || 0) / data.total_games) * 100) : 0,
          longestWord: data.longest_word || "",
          longestWordLength: data.longest_word_length || 0,
          currentStreak: data.win_streak || 0,
          level: levelData.level,
          experience: levelData.experience,
          nextLevelExp: levelData.nextLevelExp,
          premiumUntil: data.premium_until,
          averageScore: data.average_score || 0,
          tournamentsWon: tournamentStats.won,
          tournamentsLost: tournamentStats.lost,
          tournamentsPlayed: tournamentStats.played,
          tournamentWinRate: tournamentStats.winRate,
          scoreBoostUntil: data.score_boost_until || null,
          scoreBoostSource: data.score_boost_source || null,
          createdAt: (data as any).created_at || null,
        }));
      }

      await fetchBadges();

      if (isOwnProfile && user) {
        await checkBadges(user.id);
        await fetchBadges(); // checkBadges yeni rozet verdiyse tekrar çek
      }

      toast.success("İstatistikler güncellendi!");
    } catch (error) {
      toast.error("Güncelleme hatası");
    }
  };

  const progressPercent = (profileData.experience / profileData.nextLevelExp) * 100;
  const earnedBadges = badges.filter((b) => b.earned);
  const isPremium = profileData.premiumUntil && new Date(profileData.premiumUntil) > new Date();

  return (
    <div ref={swipeRef} {...swipeHandlers} className="min-h-screen bg-gradient-to-br from-[#0f1729] via-[#1a1a2e] to-[#16213e] overflow-hidden">
      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-[#1e2d45] border-b border-indigo-500/20">
        <div className="px-5 py-4 flex items-center gap-4">
          <Button
            onClick={() => {
              playSound("buttonClick");
              const fromPage = location.state?.from;
              if (fromPage === "/chat") {
                navigate("/chat");
              } else if (fromPage === "/friends") {
                navigate("/friends");
              } else {
                navigate("/");
              }
            }}
            className="bg-[#1e2d45] border border-indigo-500/20 text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>

          <div className="flex-1 flex items-center gap-2">
  <img src="/icons/profil-gorsel.svg" alt="" className="w-9 h-9 object-contain drop-shadow-md" />
  <div>
    {isOwnProfile ? (
      <img src="/icons/profil-text.svg" alt="Profil" className="h-7 object-contain" />
    ) : (
      <h1 className="text-lg font-bold text-white">{profileData.username}</h1>
    )}
    {(isUserOnline || profileInGame) && !isOwnProfile && (
      <div className="flex items-center gap-1 mt-0.5">
        <div className={`w-3 h-3 rounded-full ${profileInGame ? "bg-blue-500 shadow-[0_0_6px_rgba(96,165,250,0.9)]" : "bg-green-500"}`} />
        <span className={`text-[10px] font-medium ${profileInGame ? "text-blue-400" : "text-green-400"}`}>
          {profileInGame ? "Maçta" : "Çevrimiçi"}
        </span>
      </div>
    )}
  </div>
</div>
        </div>
      </div>

      {/* SCROLL AREA */}
      <div className="overflow-y-auto pb-20" style={{ height: "calc(100vh - 73px)" }}>
        {/* PROFILE HEADER CARD */}
        <div className="px-5 pt-6 pb-4">
          <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />

            {/* Resmi Değiştir (kartın sağ üstü) */}
            {isOwnProfile && (
              <Button
                size="sm"
                onClick={() => setShowAvatarOptions(true)}
                disabled={uploading}
                className="absolute top-2 right-1.5 z-30 h-6 px-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-[10px] font-bold shadow-lg border border-white/20"
              >
                <Edit className="w-3 h-3 mr-0.5" />
                Resmi Değiştir
              </Button>
            )}

            {/* Avatar Section */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="flex items-center justify-center mb-4 -my-2">
                {/* Avatar + rank çerçevesi */}
                <div className="relative w-44 h-44 flex items-center justify-center">
                  <Avatar
                    key={avatarKey}
                    className="w-[7.5rem] h-[7.5rem] relative z-10 rounded-full"
                    showFrame={false}
                  >
                    <AvatarImage
                      src={effectiveAvatarUrl}
                      alt={profileData.username}
                      key={`avatar-${avatarKey}-${effectiveAvatarUrl}`}
                      className="rounded-full object-cover"
                    />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-3xl font-bold rounded-full">
                      {profileData.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Rank çerçeve görseli */}
                  <img
                    src={getRankFrame(profileData.rankPoints)}
                    alt={getRankTier(profileData.rankPoints).name}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
                  />

                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center z-30">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  {isPremium && (
                    <div className="absolute bottom-2 right-2 z-30">
                      <VipBadge size="lg" />
                    </div>
                  )}
                  {profileInGame && !isOwnProfile && (
                    <span
                      className="absolute bottom-3 left-3 w-5 h-5 rounded-full bg-blue-400 border-2 border-[#1a1a2e] z-30 shadow-[0_0_8px_rgba(96,165,250,0.9)]"
                      aria-label="Maçta"
                    />
                  )}
                </div>
              </div>


              {/* Username */}
              {isEditing ? (
                <div className="flex gap-2 items-center mb-2">
                  <Input
                    value={editedUsername}
                    onChange={(e) => setEditedUsername(e.target.value)}
                    className="h-9 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20"
                    placeholder="Kullanıcı adı"
                    maxLength={15}
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveProfile}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                  >
                    Kaydet
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedUsername(profileData.username);
                    }}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                  >
                    İptal
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-white">{profileData.username}</h2>
                  {isOwnProfile && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setIsEditing(true)}
                      className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}

              {/* Level Badge */}
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 px-3 py-1 text-sm font-bold shadow-lg">
                  <Zap className="w-4 h-4 mr-1" />
                  Seviye {profileData.level}
                </Badge>
                {isPremium && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0 px-3 py-1 text-sm font-bold shadow-lg">
                    <Crown className="w-4 h-4 mr-1" />
                    Premium
                  </Badge>
                )}
              </div>

              {/* Rank Progress - XP barının üstünde */}
              <div className="w-full space-y-2 mb-3">
                <div className="flex justify-between text-xs text-yellow-400">
                  <span className="font-bold">{getRankTier(profileData.rankPoints).name}</span>
                  <span className="text-yellow-400/70">{profileData.rankPoints} RP</span>
                </div>
                <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-500 shadow-lg"
                    style={{ width: `${getRankProgress(profileData.rankPoints)}%` }}
                  >
                    <div className="absolute inset-0 bg-white/30 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Level Progress */}
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs text-white/70">
                  <span>
                    XP: {profileData.experience.toLocaleString()} / {profileData.nextLevelExp.toLocaleString()}
                  </span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500 shadow-lg"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="absolute inset-0 bg-white/30 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Friend Request Section for other profiles */}
              {!isOwnProfile && user?.id && viewedUserId && (
                <FriendRequestSection userId={user.id} viewedUserId={viewedUserId} navigate={navigate} />
              )}
            </div>
          </div>
        </div>

        {/* PREMIUM INFO */}
        {subscriptionInfo && (
          <div className="px-5 mb-6">
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Premium Abonelik</h3>
                  <p className="text-xs text-white/70">{subscriptionInfo.subscriptionType}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/80">
                  <span>Kalan Süre</span>
                  <span className="font-bold text-white">{subscriptionInfo.timeLeft}</span>
                </div>
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, ((30 - subscriptionInfo.diffDays) / 30) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOOST INFO */}
        <div className="px-5 mb-6">
          <div className={`rounded-2xl p-5 relative overflow-hidden border transition-all duration-300 ${
            boostInfo
              ? "bg-gradient-to-br from-purple-500/20 to-pink-600/20 border-purple-500/30"
              : "bg-gradient-to-br from-gray-500/10 to-slate-600/10 border-white/10 opacity-70"
          }`}>
            {boostInfo && (
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl" />
            )}
            <div className="relative z-10 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                boostInfo
                  ? "bg-gradient-to-br from-purple-400 to-pink-500"
                  : "bg-gradient-to-br from-gray-500 to-slate-600"
              }`}>
                <Rocket className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-bold ${boostInfo ? "text-white" : "text-white/60"}`}>
                    {boostInfo?.sourceLabel || "Puan Boostu"}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    boostInfo
                      ? "bg-purple-500/30 text-purple-300 border-purple-500/20"
                      : "bg-gray-500/20 text-gray-400 border-gray-500/20"
                  }`}>
                    x2 Puan
                  </span>
                </div>
                <p className="text-xs text-white/70 mt-0.5">
                  {boostInfo ? (
                    <>Kalan süre: <span className="text-white font-bold">{boostInfo.timeLeft}</span></>
                  ) : (
                    <span className="text-white/40">Şu an aktif değil</span>
                  )}
                </p>
              </div>
              <div className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
                boostInfo
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-gray-500/20 text-gray-400 border-gray-500/20"
              }`}>
                {boostInfo ? "Aktif" : "Pasif"}
              </div>
            </div>
          </div>
        </div>

        <LevelUpDialog
          open={testLevelUpOpen}
          onClose={() => setTestLevelUpOpen(false)}
          newLevel={testLevelUpValue}
        />



        {/* STATS GRID */}
        <div className="px-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-indigo-500 rounded-full" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">İstatistikler</h3>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              icon={Target}
              value={profileData.totalGames}
              label="Oyun"
              colorClass="from-rose-500 to-pink-600"
            />
            <StatCard
              icon={Trophy}
              value={profileData.wins}
              label="Galibiyet"
              colorClass="from-amber-500 to-orange-600"
            />
            <StatCard
              icon={Flame}
              value={profileData.currentStreak}
              label="Seri"
              colorClass="from-orange-500 to-red-600"
            />
            <StatCard
              icon={TrendingUp}
              value={Math.round(profileData.averageScore)}
              label="Ort. Puan"
              colorClass="from-cyan-500 to-blue-600"
            />
          </div>
        </div>

        {/* TOURNAMENT STATS */}
        {profileData.tournamentsPlayed > 0 && (
          <div className="px-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-amber-500 rounded-full" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Turnuva</h3>
            </div>
            <div className="bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border border-amber-500/30 rounded-2xl p-5">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <Users className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                  <p className="text-lg font-bold text-white">{profileData.tournamentsPlayed}</p>
                  <p className="text-[10px] text-white/60 uppercase tracking-wide">Katılım</p>
                </div>
                <div>
                  <Award className="w-5 h-5 mx-auto mb-1 text-green-400" />
                  <p className="text-lg font-bold text-white">{profileData.tournamentsWon}</p>
                  <p className="text-[10px] text-white/60 uppercase tracking-wide">Kazanma</p>
                </div>
                <div>
                  <Target className="w-5 h-5 mx-auto mb-1 text-red-400" />
                  <p className="text-lg font-bold text-white">{profileData.tournamentsLost}</p>
                  <p className="text-[10px] text-white/60 uppercase tracking-wide">Kaybetme</p>
                </div>
                <div>
                  <TrendingUp className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                  <p className="text-lg font-bold text-white">{profileData.tournamentWinRate}%</p>
                  <p className="text-[10px] text-white/60 uppercase tracking-wide">Başarı</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* JOKERS (Only for own profile) */}
        {isOwnProfile && (jokers.degistir > 0 || jokers.fisilida > 0 || jokers.senYaz > 0) && (
          <div className="px-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-purple-500 rounded-full" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Jokerler</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <JokerCard icon="degistirIkon.webp" value={jokers.degistir} label="Değiştir" />
              <JokerCard icon="fisildaIkon.webp" value={jokers.fisilida} label="Fısılda" />
              <JokerCard icon="senyazIkon.webp" value={jokers.senYaz} label="Sen Yaz" />
            </div>
          </div>
        )}

        {/* BADGES */}
        <div className="px-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-emerald-500 rounded-full" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Rozetler</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                playSound("buttonClick");
                setShowBadgesDialog(true);
              }}
              className="text-xs text-white/70 hover:text-white hover:bg-white/10"
            >
              Tümünü Gör
            </Button>
          </div>
          <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-4">
            {earnedBadges.length > 0 ? (
              <div className="flex flex-col gap-3">
                {earnedBadges.slice(0, 6).map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2"
                  >
                    <span className="text-2xl">{badge.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-white">{badge.name}</p>
                      <p className="text-[10px] text-white/60">{badge.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Award className="w-12 h-12 mx-auto mb-2 text-white/30" />
                <p className="text-sm text-white/50">Henüz rozet kazanılmadı</p>
              </div>
            )}
          </div>
        </div>

        {/* DETAILED STATS */}
        <div className="px-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-cyan-500 rounded-full" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Detaylı İstatistikler</h3>
          </div>
          <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-5 space-y-4">
            <DetailRow label="Toplam XP" value={profileData.totalScore.toLocaleString()} />
            <DetailRow
              label="En Uzun Kelime"
              value={
                profileData.longestWord
                  ? `${profileData.longestWord} (${profileData.longestWordLength} harf)`
                  : profileData.longestWordLength > 0
                    ? `${profileData.longestWordLength} harfli kelime`
                    : "Henüz yok"
              }
            />
            <DetailRow label="Kaybetme" value={profileData.losses.toString()} />
            <DetailRow label="Kazanma" value={profileData.wins.toString()} />
            <DetailRow label="Kazanma Oranı" value={`${profileData.winRate}%`} />
            <DetailRow label="Ortalama Puan" value={Math.round(profileData.averageScore).toString()} />

            {profileData.tournamentsPlayed > 0 && (
              <>
                <div className="border-t border-indigo-500/20 pt-4 mt-4">
                  <p className="text-sm font-bold text-white/70 mb-3 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" /> Turnuva Performansı
                  </p>
                </div>
                <DetailRow label="Kazanılan Turnuva" value={profileData.tournamentsWon.toString()} highlight="green" />
                <DetailRow label="Kaybedilen Turnuva" value={profileData.tournamentsLost.toString()} highlight="red" />
                <DetailRow label="Toplam Turnuva" value={profileData.tournamentsPlayed.toString()} />
                <DetailRow
                  label="Turnuva Başarı Oranı"
                  value={`${profileData.tournamentWinRate}%`}
                  highlight="yellow"
                />
              </>
            )}

            <div className="border-t border-indigo-500/20 pt-4 mt-4">
              <p className="text-sm font-bold text-white/70 mb-3">🏆 Liderlik Şampiyonlukları</p>
            </div>
            <DetailRow
              label="Sezon Şampiyonluğu"
              value={profileData.seasonFirstCount > 0 ? profileData.seasonFirstCount.toString() : "Yok"}
              highlight={profileData.seasonFirstCount > 0 ? "yellow" : undefined}
            />
            <DetailRow
              label="Haftalık 1.'lik"
              value={profileData.weeklyFirstCount > 0 ? profileData.weeklyFirstCount.toString() : "Yok"}
              highlight={profileData.weeklyFirstCount > 0 ? "green" : undefined}
            />
            <DetailRow
              label="Aylık 1.'lik"
              value={profileData.monthlyFirstCount > 0 ? profileData.monthlyFirstCount.toString() : "Yok"}
              highlight={profileData.monthlyFirstCount > 0 ? "green" : undefined}
            />
          </div>
        </div>

        {/* SON ÇEVRİM İÇİ */}
        <div className="text-center mt-4 mb-1">
          <p className="text-xs text-white/50 font-medium">
            Son çevrim içi:{" "}
            <span className="text-white/70">
              {isUserOnline
                ? "Şu an çevrim içi"
                : profileData.lastSeen
                ? new Date(profileData.lastSeen).toLocaleString("tr-TR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Istanbul",
                  })
                : "Bilinmiyor"}
            </span>
          </p>
        </div>

        {/* ÜYELİK TARİHİ */}
        {profileData.createdAt && (
          <div className="text-center mb-2">
            <p className="text-xs text-white/50 font-medium">
              Üyelik tarihi:{" "}
              <span className="text-white/70">
                {new Date(profileData.createdAt).toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* DIALOGS */}
      <AvatarOptionsDialog
        open={showAvatarOptions}
        onOpenChange={setShowAvatarOptions}
        onCameraSelect={handleCameraSelect}
        onGallerySelect={handleGallerySelect}
        onGameAvatarsSelect={handleGameAvatarsSelect}
        onDelete={handleDeleteAvatar}
      />

      <BadgesDialog open={showBadgesDialog} onOpenChange={setShowBadgesDialog} badges={badges} userStats={userStats} />
    </div>
  );
};

// HELPER COMPONENTS

const StatCard = ({ icon: Icon, value, label, colorClass }: any) => (
  <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-xl">
    <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-10`} />
    <Icon className="w-5 h-5 mb-1 text-white relative z-10" />
    <span className="text-base font-bold text-white tracking-tight relative z-10">{value}</span>
    <span className="text-[9px] text-white/60 font-medium uppercase tracking-wide relative z-10">{label}</span>
  </div>
);

const JokerCard = ({ icon, value, label }: any) => (
  <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-4 flex flex-col items-center justify-center shadow-xl">
    <img src={`/${icon}`} alt={label} className="w-8 h-8 mb-1 object-contain" />
    <span className="text-lg font-bold text-white">{value}</span>
    <span className="text-[10px] text-white/60 font-medium uppercase tracking-wide">{label}</span>
  </div>
);

const DetailRow = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "green" | "red" | "yellow";
}) => {
  const colorClass =
    highlight === "green"
      ? "text-green-400"
      : highlight === "red"
        ? "text-red-400"
        : highlight === "yellow"
          ? "text-yellow-400"
          : "text-white";

  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-white/70">{label}:</span>
      <span className={`text-sm font-bold ${colorClass}`}>{value}</span>
    </div>
  );
};

// Friend Request + Message Section
const FriendRequestSection = ({
  userId,
  viewedUserId,
  navigate,
}: {
  userId: string;
  viewedUserId: string;
  navigate: any;
}) => {
  const [friendshipStatus, setFriendshipStatus] = useState<"none" | "pending_sent" | "pending_received" | "accepted">(
    "none",
  );
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { sendFriendRequestNotification, sendFriendAcceptedNotification } = useSmartNotifications();

  useEffect(() => {
    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("🔐 Session:", session?.user?.id);
      console.log("🔍 Friendship check - userId:", userId, "viewedUserId:", viewedUserId);

      const { data: data1, error: e1 } = await supabase
        .from("friendships")
        .select("id, user_id, friend_id, status")
        .eq("user_id", userId)
        .eq("friend_id", viewedUserId);

      console.log("data1 (array):", data1, "error1:", e1);

      const { data: data2, error: e2 } = await supabase
        .from("friendships")
        .select("id, user_id, friend_id, status")
        .eq("user_id", viewedUserId)
        .eq("friend_id", userId);

      console.log("data2 (array):", data2, "error2:", e2);

      const data = data1?.[0] || data2?.[0];

      if (data) {
        setFriendshipId(data.id);
        console.log("✅ friendshipId set:", data.id, "status:", data.status);
        if (data.status === "accepted") setFriendshipStatus("accepted");
        else if (data.status === "pending" && data.user_id === userId) setFriendshipStatus("pending_sent");
        else if (data.status === "pending") setFriendshipStatus("pending_received");
      } else {
        console.log("❌ Friendship bulunamadı");
        setFriendshipStatus("none");
      }
      setLoading(false);
    };

    check();

    const channel = supabase
      .channel("friendship-status")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        () => {
          check();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, viewedUserId]);

  const sendRequest = async () => {
    const { error } = await supabase.from("friendships").insert({
      user_id: userId,
      friend_id: viewedUserId,
      status: "pending",
    });
    if (error) {
      if (error.code === "23505") toast.error("Zaten bir davet mevcut");
      else toast.error("Davet gönderilemedi");
    } else {
      toast.success("Arkadaşlık daveti gönderildi! 🤝");

      const { data: myProfile } = await supabase.from("profiles").select("username").eq("id", userId).single();
      const senderName = myProfile?.username || "Bir oyuncu";

      await supabase.from("notifications").insert({
        user_id: viewedUserId,
        type: "friend_request",
        message: `${senderName} sana arkadaşlık daveti gönderdi!`,
        related_id: userId,
      });

      await sendFriendRequestNotification(viewedUserId!, senderName);

      setFriendshipStatus("pending_sent");
    }
  };

  const acceptRequest = async () => {
    console.log("🤝 acceptRequest çalıştı - friendshipId:", friendshipId);
    if (!friendshipId) {
      console.log("❌ friendshipId yok");
      return;
    }

    const { error: updateError } = await supabase
      .from("friendships")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", friendshipId);

    console.log("✅ friendship update error:", updateError);

    const { data: myProfile } = await supabase.from("profiles").select("username").eq("id", userId).single();

    console.log("👤 myProfile:", myProfile);
    const accepterName = myProfile?.username || "Bir oyuncu";

    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: viewedUserId,
      type: "friend_request_accepted",
      message: `${accepterName} arkadaşlık davetini kabul etti! 🎉`,
      related_id: userId,
    });

    console.log("🔔 notification insert error:", notifError);

    await sendFriendAcceptedNotification(viewedUserId!, accepterName);

    toast.success("Arkadaşlık kabul edildi!");
    setFriendshipStatus("accepted");
  };

  const openChat = async () => {
    const participants = [userId, viewedUserId].sort();
    const chatId = `chat_${participants.join("_")}`;
    try {
      const { data: existingChat, error: chatError } = await supabase
        .from("private_chats")
        .select("id")
        .eq("id", chatId)
        .maybeSingle();
      if (chatError) throw chatError;
      if (!existingChat) {
        await supabase.from("private_chats").insert({
          id: chatId,
          user1_id: participants[0],
          user2_id: participants[1],
        });
      }
      navigate(`/chat?openPrivateChat=${viewedUserId}`);
    } catch (err) {
      toast.error("Sohbet açılırken hata oluştu");
    }
  };

  if (loading) return null;

  return (
    <div className="flex gap-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={openChat}
        className="flex-1 bg-white/10 hover:bg-white/20 border-white/20 text-white"
      >
        <MessageCircle className="w-4 h-4 mr-1" />
        Mesaj Yaz
      </Button>
      {friendshipStatus === "none" && (
        <Button
          variant="outline"
          size="sm"
          onClick={sendRequest}
          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-0 text-white"
        >
          <UserPlus className="w-4 h-4 mr-1" />
          Arkadaş Ekle
        </Button>
      )}
      {friendshipStatus === "pending_sent" && (
        <Button
          variant="outline"
          size="sm"
          disabled
          className="flex-1 bg-white/10 border-white/20 text-white/50 opacity-70"
        >
          <Clock className="w-4 h-4 mr-1" />
          Davet Edildi
        </Button>
      )}
      {friendshipStatus === "pending_received" && (
        <Button
          variant="outline"
          size="sm"
          onClick={acceptRequest}
          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-0 text-white"
        >
          <UserCheck className="w-4 h-4 mr-1" />
          Kabul Et
        </Button>
      )}
      {friendshipStatus === "accepted" && (
        <Button
          variant="outline"
          size="sm"
          disabled
          className="flex-1 bg-white/10 border-white/20 text-white/50 opacity-70"
        >
          <UserCheck className="w-4 h-4 mr-1" />
          Arkadaş
        </Button>
      )}
    </div>
  );
};

export default ProfilePage;
