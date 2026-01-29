import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useJokerInventory } from "@/hooks/useJokerInventory";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { usePageResync } from "@/hooks/useGlobalResync";
import { AvatarOptionsDialog } from "@/components/AvatarOptionsDialog";
import { BadgesDialog } from "@/components/BadgesDialog";
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
  Star,
  Flame,
  Shield,
  Sparkles,
} from "lucide-react";

const ProfilePage = () => {
  const { user } = useAuth();
  const { profile } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { jokers } = useJokerInventory();
  const { uploadFromCamera, uploadFromGallery, uploadGameAvatar, deleteAvatar, uploading } = useAvatarUpload();
  const { id: routeId } = useParams();
  const viewedUserId = routeId || user?.id || null;
  const isOwnProfile = !routeId || routeId === user?.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState("");
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [showBadgesDialog, setShowBadgesDialog] = useState(false);
  const [viewedProfile, setViewedProfile] = useState<{ avatar_url?: string | null } | null>(null);
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
  });

  const [badges, setBadges] = useState
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

  // ... TÜM MEVCUT FONKSİYONLAR AYNI KALACAK ...
  // (calculateLevel, fetchBadges, fetchTournamentStats, vs. - hiçbir değişiklik yok)

  const calculateLevel = (totalScore: number) => {
    const baseExp = 1000;
    const expIncreasePerLevel = 100;

    let level = 1;
    let totalExpNeeded = 0;
    let currentLevelExp = baseExp;

    while (totalScore >= totalExpNeeded + currentLevelExp) {
      totalExpNeeded += currentLevelExp;
      level++;
      currentLevelExp = baseExp + (level - 1) * expIncreasePerLevel;
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
      const { data: finalMatches, error } = await supabase
        .from("tournament_matches")
        .select("winner_id, player1_id, player2_id, status, tournament_id, round")
        .or(`player1_id.eq.${viewedUserId},player2_id.eq.${viewedUserId}`)
        .eq("status", "completed");

      if (error) {
        console.error("Turnuva istatistikleri hatası:", error);
        return { won: 0, lost: 0, played: 0, winRate: 0 };
      }

      if (!finalMatches || finalMatches.length === 0) {
        return { won: 0, lost: 0, played: 0, winRate: 0 };
      }

      const tournamentMaxRounds: Record<string, number> = {};
      finalMatches.forEach((match) => {
        if (match.tournament_id) {
          tournamentMaxRounds[match.tournament_id] = Math.max(
            tournamentMaxRounds[match.tournament_id] || 0,
            match.round,
          );
        }
      });

      let won = 0;
      let lost = 0;

      finalMatches.forEach((match) => {
        if (match.tournament_id && match.round === tournamentMaxRounds[match.tournament_id]) {
          if (match.winner_id === viewedUserId) {
            won++;
          } else {
            lost++;
          }
        }
      });

      const played = won + lost;
      const winRate = played > 0 ? Math.round((won / played) * 100) : 0;

      return { won, lost, played, winRate };
    } catch (error) {
      console.error("Turnuva istatistikleri fetch hatası:", error);
      return { won: 0, lost: 0, played: 0, winRate: 0 };
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!viewedUserId) return;

      const { data } = await supabase.from("profiles").select("*").eq("id", viewedUserId).maybeSingle();

      const tournamentStats = await fetchTournamentStats();

      if (data) {
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
    fetchBadges();
  }, [viewedUserId]);

  const refreshProfileData = useCallback(async () => {
    if (!viewedUserId) return;
    
    console.log('🔄 [ProfilePage] Resync triggered - profil verileri yeniden yükleniyor...');
    
    try {
      const [profileResult, tournamentStats] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", viewedUserId).maybeSingle(),
        fetchTournamentStats()
      ]);
      
      const { data } = profileResult;
      
      if (data) {
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
      console.log('✅ [ProfilePage] Resync tamamlandı - rozetler dahil');
    } catch (error) {
      console.error('❌ [ProfilePage] Resync hatası:', error);
    }
  }, [viewedUserId, user?.email]);

  usePageResync(refreshProfileData, 'ProfilePage', false);

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
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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

  const subscriptionInfo = getSubscriptionInfo();

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
    setShowAvatarOptions(false);
    const avatarUrl = await uploadFromCamera();
    if (avatarUrl) {
      setProfileData((prev) => ({ ...prev, avatar_url: avatarUrl }));
    }
  };

  const handleGallerySelect = async () => {
    setShowAvatarOptions(false);
    const avatarUrl = await uploadFromGallery();
    if (avatarUrl) {
      setProfileData((prev) => ({ ...prev, avatar_url: avatarUrl }));
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
        }));
      }

      await fetchBadges();

      if (isOwnProfile && user) {
        await checkBadges(user.id);
      }

      toast.success("İstatistikler güncellendi!");
    } catch (error) {
      toast.error("Güncelleme hatası");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col relative overflow-hidden">
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-40 h-40 bg-purple-300/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-20 w-56 h-56 bg-blue-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-1/4 w-48 h-48 bg-pink-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-3xl mx-auto w-full flex flex-col min-h-screen relative z-10">
        {/* Header with Glassmorphism */}
        <div className="p-4 pt-6 bg-white/40 backdrop-blur-xl border-b border-white/50 shadow-2xl sticky top-0 z-20">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const fromPage = location.state?.from;
                if (fromPage === "/chat") {
                  navigate("/chat");
                } else {
                  navigate("/");
                }
              }}
              className="bg-white/60 backdrop-blur-sm border-white/80 hover:bg-white/80 hover:shadow-lg transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Geri
            </Button>

            {/* Animated Title */}
            <div className="relative">
              <h1 className="text-3xl font-black flex items-center bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                <User className="w-7 h-7 mr-3 text-purple-600 drop-shadow-lg" />
                {isOwnProfile ? "Profil" : `${profileData.username}`}
              </h1>
              <div className="absolute -inset-2 bg-gradient-to-r from-purple-400/20 to-pink-400/20 blur-xl -z-10 animate-pulse"></div>
            </div>

            <div className="w-16 flex justify-end">
              {isOwnProfile &&
                (isEditing ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSaveProfile}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-none hover:shadow-lg"
                  >
                    Kaydet
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleEditToggle} 
                    className="p-2 hover:bg-purple-100 transition-colors"
                  >
                    <Edit className="w-5 h-5 text-purple-600" />
                  </Button>
                ))}
            </div>
          </div>

          {/* Profile Header Card with Premium Design */}
          <Card className="border-2 border-white/50 bg-gradient-to-br from-white/70 to-white/50 backdrop-blur-xl shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                {/* Avatar with Glowing Ring */}
                <div className="flex flex-col items-center">
                  <div className={`relative ${isOwnProfile ? "cursor-pointer" : ""}`} onClick={handleAvatarClick}>
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-full blur opacity-75 animate-pulse"></div>
                    <Avatar className={`relative w-24 h-24 ${
                      subscriptionInfo 
                        ? "ring-4 ring-yellow-400/80 ring-offset-4 ring-offset-yellow-100/50 shadow-[0_0_20px_rgba(250,204,21,0.6)]"
                        : "ring-4 ring-purple-400/50 ring-offset-4 ring-offset-purple-100/50"
                    }`}>
                      <AvatarImage
                        src={(isOwnProfile ? profile?.avatar_url : viewedProfile?.avatar_url) || ""}
                        alt={profileData.username}
                      />
                      <AvatarFallback className="text-3xl bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">
                        {profileData.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Premium Crown Badge */}
                    {subscriptionInfo && (
                      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-2 shadow-lg animate-bounce">
                        <Crown className="w-5 h-5 text-white" />
                      </div>
                    )}
                    
                    {uploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  {isOwnProfile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAvatarClick}
                      className="mt-3 text-xs px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none hover:shadow-lg transition-all"
                      disabled={uploading}
                    >
                      {uploading ? (
                        <span className="flex items-center">
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Yükleniyor...
                        </span>
                      ) : (
                        "Yükle/Değiştir"
                      )}
                    </Button>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1">
                  {isEditing && isOwnProfile ? (
                    <Input
                      value={editedUsername}
                      onChange={(e) => setEditedUsername(e.target.value)}
                      className="text-2xl font-bold mb-2 bg-white/50 backdrop-blur-sm border-purple-300 focus:border-purple-500"
                      placeholder="Kullanıcı adınız"
                      maxLength={15}
                    />
                  ) : (
                    <h2 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {profileData.username}
                    </h2>
                  )}
                  {!isOwnProfile && <p className="text-sm text-purple-600 font-medium">Oyuncu Profili</p>}
                  {isOwnProfile && user?.email && (
                    <p className="text-xs text-gray-600 truncate max-w-xs mt-1">{user.email}</p>
                  )}
                  
                  {/* Badges Row */}
                  <div className="flex items-center space-x-2 mt-3 flex-wrap gap-2">
                    <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none shadow-lg px-3 py-1">
                      <Star className="w-3 h-3 mr-1" />
                      Seviye {profileData.level}
                    </Badge>
                    <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-none shadow-lg px-3 py-1">
                      <Target className="w-3 h-3 mr-1" />
                      {profileData.winRate}% Kazanma
                    </Badge>
                    {profileData.tournamentWinRate > 0 && (
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-none shadow-lg px-3 py-1 animate-pulse">
                        <Trophy className="w-3 h-3 mr-1" />
                        {profileData.tournamentWinRate}% Turnuva
                      </Badge>
                    )}
                    {subscriptionInfo && (
                      <Badge className="bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-white border-none shadow-xl px-3 py-1 animate-shimmer">
                        <Crown className="w-4 h-4 mr-1 animate-bounce" />
                        Premium
                        <Sparkles className="w-3 h-3 ml-1" />
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Level Progress with Gradient */}
              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span className="text-purple-700">Seviye İlerlemesi</span>
                  <span className="text-pink-600">
                    {profileData.experience.toLocaleString()}/{profileData.nextLevelExp.toLocaleString()} EXP
                  </span>
                </div>
                <div className="relative h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{ width: `${(profileData.experience / profileData.nextLevelExp) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-white/30 animate-shimmer"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 px-4 py-6">
          <div className="space-y-6 pb-6">
            {/* Premium Subscription Card */}
            {subscriptionInfo && (
              <Card className="border-2 border-yellow-300/50 bg-gradient-to-br from-yellow-50/90 via-amber-50/90 to-orange-50/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-400/10 animate-pulse"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center text-amber-700 text-xl">
                    <div className="relative">
                      <Crown className="w-6 h-6 mr-3 animate-bounce" />
                      <div className="absolute inset-0 animate-ping">
                        <Crown className="w-6 h-6 text-yellow-400 opacity-75" />
                      </div>
                    </div>
                    Premium Abonelik
                    <Sparkles className="w-5 h-5 ml-2 text-orange-500" />
                  </CardTitle>
                  <CardDescription className="text-amber-600">Aktif premium üyeliğinizin detayları</CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-lg">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-yellow-800">Abonelik Türü</p>
                        <p className="text-sm text-yellow-700">{subscriptionInfo.subscriptionType} Premium</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="bg-gradient-to-br from-orange-400 to-red-500 p-3 rounded-lg">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-orange-800">Kalan Süre</p>
                        <p className="text-sm text-orange-700">{subscriptionInfo.timeLeft}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="text-yellow-700">Yenilenme süresine kalan gün</span>
                      <span className="font-bold text-yellow-800">{subscriptionInfo.diffDays} gün</span>
                    </div>
                    <div className="relative h-3 bg-yellow-200 rounded-full overflow-hidden">
                      <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full shadow-lg"
                        style={{ width: `${Math.max(0, Math.min(100, ((30 - subscriptionInfo.diffDays) / 30) * 100))}%` }}
                      >
                        <div className="absolute inset-0 bg-white/30 animate-shimmer"></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Statistics Grid with Modern Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-100/80 to-cyan-100/80 backdrop-blur-xl border-2 border-blue-200/50 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                <CardContent className="p-5 text-center">
                  <div className="bg-white/60 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <Target className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="text-3xl font-black text-blue-700 mb-1">{profileData.totalGames}</p>
                  <p className="text-sm text-blue-600 font-semibold">Toplam Oyun</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-100/80 to-emerald-100/80 backdrop-blur-xl border-2 border-green-200/50 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                <CardContent className="p-5 text-center">
                  <div className="bg-white/60 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <Trophy className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-3xl font-black text-green-700 mb-1">{profileData.wins}</p>
                  <p className="text-sm text-green-600 font-semibold">Kazanma</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-100/80 to-pink-100/80 backdrop-blur-xl border-2 border-purple-200/50 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                <CardContent className="p-5 text-center">
                  <div className="bg-white/60 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <Flame className="w-8 h-8 text-purple-600 animate-pulse" />
                  </div>
                  <p className="text-3xl font-black text-purple-700 mb-1">{profileData.currentStreak}</p>
                  <p className="text-sm text-purple-600 font-semibold">Seri</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-cyan-100/80 to-blue-100/80 backdrop-blur-xl border-2 border-cyan-200/50 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                <CardContent className="p-5 text-center">
                  <div className="bg-white/60 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <TrendingUp className="w-8 h-8 text-cyan-600" />
                  </div>
                  <p className="text-3xl font-black text-cyan-700 mb-1">{Math.round(profileData.averageScore)}</p>
                  <p className="text-sm text-cyan-600 font-semibold">Ort. Puan</p>
                </CardContent>
              </Card>
            </div>

            {/* Tournament Statistics */}
            {profileData.tournamentsPlayed > 0 && (
              <Card className="border-2 border-yellow-300/50 bg-gradient-to-br from-yellow-50/90 via-amber-50/90 to-orange-50/90 backdrop-blur-xl shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center text-amber-700 text-xl">
                    <Trophy className="w-6 h-6 mr-3 text-yellow-500 drop-shadow-lg" />
                    Turnuva İstatistikleri
                  </CardTitle>
                  <CardDescription className="text-amber-600">Turnuva performansınız</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center bg-white/60 backdrop-blur-sm p-4 rounded-xl shadow-lg hover:shadow-xl transition-all">
                      <div className="flex items-center justify-center mb-3">
                        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-full p-3">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-amber-800">{profileData.tournamentsPlayed}</p>
                      <p className="text-sm text-amber-600 font-semibold">Katılım</p>
                    </div>
                    <div className="text-center bg-white/60 backdrop-blur-sm p-4 rounded-xl shadow-lg hover:shadow-xl transition-all">
                      <div className="flex items-center justify-center mb-3">
                        <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-3">
                          <Award className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-green-800">{profileData.tournamentsWon}</p>
                      <p className="text-sm text-green-600 font-semibold">Kazanma</p>
                    </div>
                    <div className="text-center bg-white/60 backdrop-blur-sm p-4 rounded-xl shadow-lg hover:shadow-xl transition-all">
                      <div className="flex items-center justify-center mb-3">
                        <div className="bg-gradient-to-br from-red-400 to-rose-500 rounded-full p-3">
                          <Target className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-red-700">{profileData.tournamentsLost}</p>
                      <p className="text-sm text-red-500 font-semibold">Kaybetme</p>
                    </div>
                    <div className="text-center bg-white/60 backdrop-blur-sm p-4 rounded-xl shadow-lg hover:shadow-xl transition-all">
                      <div className="flex items-center justify-center mb-3">
                        <div className="bg-gradient-to-br from-purple-400 to-pink-500 rounded-full p-3">
                          <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-purple-800">{profileData.tournamentWinRate}%</p>
                      <p className="text-sm text-purple-600 font-semibold">Başarı</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Badges Section */}
            <Card className="bg-white/70 backdrop-blur-xl border-2 border-white/50 shadow-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-xl">
                      <Shield className="w-6 h-6 mr-3 text-indigo-600" />
                      Rozetler
                    </CardTitle>
                    <CardDescription>Oyun içi başarılarınız ve rozetleriniz</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowBadgesDialog(true)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none hover:shadow-lg"
                  >
                    Tümünü Gör
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {badges
                    .filter((b) => b.earned)
                    .slice(0, 4)
                    .map((badge, index) => (
                      <div
                        key={badge.id}
                        className="flex items-center space-x-3 p-4 rounded-xl bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-sm border-2 border-indigo-200/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="text-3xl drop-shadow-lg">{badge.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate text-indigo-900">{badge.name}</p>
                          <p className="text-sm text-indigo-600 truncate">{badge.description}</p>
                        </div>
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-none shadow-lg">
                          <Star className="w-3 h-3 mr-1" />
                          Kazanıldı
                        </Badge>
                      </div>
                    ))}
                  {badges.filter((b) => b.earned).length === 0 && (
                    <div className="col-span-2 text-center py-12 text-gray-500">
                      <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-semibold">Henüz kazanılmış rozet yok</p>
                      <p className="text-sm">Oyna ve rozetleri kazan! 🏆</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Joker Inventory */}
            {(jokers.degistir > 0 || jokers.fisilida > 0 || jokers.senYaz > 0) && (
              <Card className="bg-white/70 backdrop-blur-xl border-2 border-white/50 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                    <Zap className="w-6 h-6 mr-3 text-yellow-600" />
                    🃏 Joker Envanteri
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-5 bg-gradient-to-br from-blue-100/80 to-cyan-100/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                      <img src="/degistirIkon.png" alt="Değiştir" className="w-12 h-12 mx-auto mb-3 object-contain drop-shadow-lg" />
                      <div className="text-sm text-blue-700 font-semibold mb-1">Değiştir</div>
                      <div className="text-2xl font-black text-blue-800">{jokers.degistir}</div>
                    </div>
                    <div className="text-center p-5 bg-gradient-to-br from-green-100/80 to-emerald-100/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                      <img src="/fisildaIkon.png" alt="Fısılda" className="w-12 h-12 mx-auto mb-3 object-contain drop-shadow-lg" />
                      <div className="text-sm text-green-700 font-semibold mb-1">Fısılda</div>
                      <div className="text-2xl font-black text-green-800">{jokers.fisilida}</div>
                    </div>
                    <div className="text-center p-5 bg-gradient-to-br from-purple-100/80 to-pink-100/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                      <img src="/senyazIkon.png" alt="Sen Yaz" className="w-12 h-12 mx-auto mb-3 object-contain drop-shadow-lg" />
                      <div className="text-sm text-purple-700 font-semibold mb-1">Sen Yaz</div>
                      <div className="text-2xl font-black text-purple-800">{jokers.senYaz}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detailed Stats */}
            <Card className="bg-white/70 backdrop-blur-xl border-2 border-white/50 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-xl">Detaylı İstatistikler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg hover:shadow-md transition-all">
                  <span className="font-medium text-gray-700">Toplam Puan:</span>
                  <span className="font-black text-purple-700">{profileData.totalScore.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg hover:shadow-md transition-all">
                  <span className="font-medium text-gray-700">En Uzun Kelime:</span>
                  <span className="font-black text-blue-700">
                    {profileData.longestWord
                      ? `${profileData.longestWord} (${profileData.longestWordLength} harf)`
                      : profileData.longestWordLength > 0
                        ? `${profileData.longestWordLength} harfli kelime`
                        : "Henüz yok"}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg hover:shadow-md transition-all">
                  <span className="font-medium text-gray-700">Kaybetme:</span>
                  <span className="font-black text-red-700">{profileData.losses}</span>
                </div>
                <div className="flex justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg hover:shadow-md transition-all">
                  <span className="font-medium text-gray-700">Kazanma Oranı:</span>
                  <span className="font-black text-green-700">{profileData.winRate}%</span>
                </div>
                <div className="flex justify-between p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg hover:shadow-md transition-all">
                  <span className="font-medium text-gray-700">Ortalama Puan:</span>
                  <span className="font-black text-indigo-700">{Math.round(profileData.averageScore)}</span>
                </div>
                {profileData.tournamentsPlayed > 0 && (
                  <>
                    <hr className="my-4 border-purple-200" />
                    <div className="text-sm font-bold text-purple-700 mb-3 flex items-center">
                      <Trophy className="w-4 h-4 mr-2" />
                      Turnuva Performansı
                    </div>
                    <div className="flex justify-between p-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg hover:shadow-md transition-all">
                      <span className="font-medium text-gray-700">Kazanılan Turnuva:</span>
                      <span className="font-black text-green-700">{profileData.tournamentsWon}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg hover:shadow-md transition-all">
                      <span className="font-medium text-gray-700">Kaybedilen Turnuva:</span>
                      <span className="font-black text-red-700">{profileData.tournamentsLost}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg hover:shadow-md transition-all">
                      <span className="font-medium text-gray-700">Toplam Turnuva:</span>
                      <span className="font-black text-amber-700">{profileData.tournamentsPlayed}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg hover:shadow-md transition-all">
                      <span className="font-medium text-gray-700">Turnuva Başarı Oranı:</span>
                      <span className="font-black text-yellow-700">{profileData.tournamentWinRate}%</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* Dialogs */}
        <AvatarOptionsDialog
          open={showAvatarOptions}
          onOpenChange={setShowAvatarOptions}
          onCameraSelect={handleCameraSelect}
          onGallerySelect={handleGallerySelect}
          onGameAvatarsSelect={handleGameAvatarsSelect}
          onDelete={handleDeleteAvatar}
        />

        <BadgesDialog
          open={showBadgesDialog}
          onOpenChange={setShowBadgesDialog}
          badges={badges}
          userStats={userStats}
        />
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        .animate-shimmer {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.5),
            transparent
          );
          background-size: 1000px 100%;
          animation: shimmer 3s infinite;
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;