/**
 * Daily Challenge Hook
 * - Checks if user already played today (via Supabase)
 * - Saves scores to challenge_scores table
 * - Fetches leaderboard for each challenge type
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ChallengeType = "word_hunt" | "anagram" | "word_chain" | "puzzle" | "reaktor" | "neon_blitz" | "memory" | "kelime_avi";

interface ChallengeScore {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  words_found: number;
  moves_count: number;
  time_seconds: number;
  date: string;
  isPremium?: boolean;
}

// Get today's date in Turkey timezone
const getTurkeyDate = (): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
};

// Challenge types where lower score = better
const ASCENDING_CHALLENGES: ChallengeType[] = ["puzzle"];

export function useDailyChallenge(challengeType: ChallengeType) {
  const { user } = useAuth();
  const [hasPlayedToday, setHasPlayedToday] = useState(false);
  const [todayScore, setTodayScore] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<ChallengeScore[]>([]);
  const [loading, setLoading] = useState(true);
  const markedRef = useRef(false);

  const todayDate = getTurkeyDate();
  const isAscending = ASCENDING_CHALLENGES.includes(challengeType);

  const enrichWithPremium = async (entries: any[]): Promise<any[]> => {
    if (entries.length === 0) return entries;
    const userIds = [...new Set(entries.map((e: any) => e.user_id))];
    const now = new Date().toISOString();
    const { data: premiumData } = await supabase
      .from("profiles")
      .select("id, premium_until")
      .in("id", userIds)
      .gt("premium_until", now);
    const premiumSet = new Set(premiumData?.map((p: any) => p.id) || []);
    return entries.map((e: any) => ({ ...e, isPremium: premiumSet.has(e.user_id) }));
  };

  const refreshLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from("challenge_scores" as any)
      .select("id, user_id, username, avatar_url, score, words_found, moves_count, time_seconds, date")
      .eq("challenge_type", challengeType)
      .eq("date", todayDate)
      .order("score", { ascending: isAscending })
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) {
      const filtered = isAscending
        ? (data as any[]).filter((e: any) => e.score > 0)
        : (data as any[]);
      const enriched = await enrichWithPremium(filtered);
      setLeaderboard(enriched as any);
    }
  }, [challengeType, todayDate, isAscending]);

  // Check if already played today & fetch leaderboard
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchData = async () => {
      const [myScoreRes, leaderboardRes] = await Promise.all([
        supabase
          .from("challenge_scores" as any)
          .select("score, words_found, moves_count, time_seconds")
          .eq("user_id", user.id)
          .eq("challenge_type", challengeType)
          .eq("date", todayDate)
          .maybeSingle(),
        supabase
          .from("challenge_scores" as any)
          .select("id, user_id, username, avatar_url, score, words_found, moves_count, time_seconds, date")
          .eq("challenge_type", challengeType)
          .eq("date", todayDate)
          .order("score", { ascending: isAscending })
          .order("created_at", { ascending: true })
          .limit(50),
      ]);

      if (myScoreRes.data) {
        setHasPlayedToday(true);
        setTodayScore((myScoreRes.data as any).score);
        markedRef.current = true;
      }

      if (leaderboardRes.data) {
        const filtered = isAscending
          ? (leaderboardRes.data as any[]).filter((e: any) => e.score > 0)
          : (leaderboardRes.data as any[]);
        const enriched = await enrichWithPremium(filtered);
        setLeaderboard(enriched as any);
      }

      setLoading(false);
    };

    fetchData();
  }, [user, challengeType, todayDate, isAscending]);

  // Mark as played immediately (score 0) — called when game starts
  const markAsPlayed = useCallback(async () => {
    if (!user) return;
    // Always reflect "played" in UI state, even if already marked, to prevent
    // any race where consumer reads stale hasPlayedToday=false.
    setHasPlayedToday(true);
    if (markedRef.current) return;
    markedRef.current = true;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.id)
      .single();

    await supabase
      .from("challenge_scores" as any)
      .insert({
        user_id: user.id,
        challenge_type: challengeType,
        score: 0,
        words_found: 0,
        moves_count: 0,
        time_seconds: 0,
        date: todayDate,
        username: profile?.username || "Anonim",
        avatar_url: profile?.avatar_url || null,
      });

    setHasPlayedToday(true);
    setTodayScore(0);
    await refreshLeaderboard();
  }, [user, challengeType, todayDate, refreshLeaderboard]);

  // Save/update score after game ends
  const saveScore = useCallback(async (
    score: number,
    wordsFound: number,
    extra?: { moves_count?: number; time_seconds?: number }
  ) => {
    if (!user) return false;

    const updateData: any = { score, words_found: wordsFound };
    if (extra?.moves_count !== undefined) updateData.moves_count = extra.moves_count;
    if (extra?.time_seconds !== undefined) updateData.time_seconds = extra.time_seconds;

    if (markedRef.current) {
      if (score <= 0) return false;

      const { error } = await supabase
        .from("challenge_scores" as any)
        .update(updateData)
        .eq("user_id", user.id)
        .eq("challenge_type", challengeType)
        .eq("date", todayDate);

      if (!error) {
        setTodayScore(score);
        await refreshLeaderboard();
        return true;
      }
      console.error("[DailyChallenge] Update error:", error);
      return false;
    }

    // First time — insert
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.id)
      .single();

    const { error } = await supabase
      .from("challenge_scores" as any)
      .insert({
        user_id: user.id,
        challenge_type: challengeType,
        score,
        words_found: wordsFound,
        moves_count: extra?.moves_count || 0,
        time_seconds: extra?.time_seconds || 0,
        date: todayDate,
        username: profile?.username || "Anonim",
        avatar_url: profile?.avatar_url || null,
      });

    if (!error) {
      markedRef.current = true;
      setHasPlayedToday(true);
      setTodayScore(score);
      await refreshLeaderboard();
      return true;
    }
    console.error("[DailyChallenge] Save error:", error);
    return false;
  }, [user, challengeType, todayDate, refreshLeaderboard]);

  return { hasPlayedToday, todayScore, leaderboard, loading, saveScore, markAsPlayed };
}

// Static helper to check completion status for homepage
export async function getDailyChallengeStatus(userId: string): Promise<Record<ChallengeType, boolean>> {
  const todayDate = getTurkeyDate();
  const { data } = await supabase
    .from("challenge_scores" as any)
    .select("challenge_type")
    .eq("user_id", userId)
    .eq("date", todayDate);

  const result: Record<ChallengeType, boolean> = {
    word_hunt: false,
    anagram: false,
    word_chain: false,
    puzzle: false,
    reaktor: false,
    neon_blitz: false,
    memory: false,
    kelime_avi: false,
  };

  if (data) {
    (data as any[]).forEach((row: any) => {
      if (row.challenge_type in result) {
        result[row.challenge_type as ChallengeType] = true;
      }
    });
  }

  return result;
}
