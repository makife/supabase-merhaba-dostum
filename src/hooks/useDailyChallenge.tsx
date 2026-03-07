/**
 * Daily Challenge Hook
 * - Checks if user already played today (via Supabase)
 * - Saves scores to challenge_scores table
 * - Fetches leaderboard for each challenge type
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ChallengeType = "word_hunt" | "anagram" | "word_chain" | "puzzle";

interface ChallengeScore {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  words_found: number;
  date: string;
}

// Get today's date in Turkey timezone
const getTurkeyDate = (): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
};

export function useDailyChallenge(challengeType: ChallengeType) {
  const { user } = useAuth();
  const [hasPlayedToday, setHasPlayedToday] = useState(false);
  const [todayScore, setTodayScore] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<ChallengeScore[]>([]);
  const [loading, setLoading] = useState(true);

  const todayDate = getTurkeyDate();

  // Check if already played today & fetch leaderboard
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchData = async () => {
      const [myScoreRes, leaderboardRes] = await Promise.all([
        supabase
          .from("challenge_scores" as any)
          .select("score, words_found")
          .eq("user_id", user.id)
          .eq("challenge_type", challengeType)
          .eq("date", todayDate)
          .maybeSingle(),
        supabase
          .from("challenge_scores" as any)
          .select("id, user_id, username, avatar_url, score, words_found, date")
          .eq("challenge_type", challengeType)
          .eq("date", todayDate)
          .order("score", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(50),
      ]);

      if (myScoreRes.data) {
        setHasPlayedToday(true);
        setTodayScore((myScoreRes.data as any).score);
      }

      if (leaderboardRes.data) {
        setLeaderboard(leaderboardRes.data as any);
      }

      setLoading(false);
    };

    fetchData();
  }, [user, challengeType, todayDate]);

  // Save score after game ends
  const saveScore = useCallback(async (score: number, wordsFound: number) => {
    if (!user || hasPlayedToday) return false;

    // Get username from profile
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
        date: todayDate,
        username: profile?.username || "Anonim",
        avatar_url: profile?.avatar_url || null,
      });

    if (!error) {
      setHasPlayedToday(true);
      setTodayScore(score);
      // Refresh leaderboard
      const { data } = await supabase
        .from("challenge_scores" as any)
        .select("id, user_id, username, avatar_url, score, words_found, date")
        .eq("challenge_type", challengeType)
        .eq("date", todayDate)
        .order("score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(50);
      if (data) setLeaderboard(data as any);
      return true;
    }
    console.error("[DailyChallenge] Save error:", error);
    return false;
  }, [user, hasPlayedToday, challengeType, todayDate]);

  return { hasPlayedToday, todayScore, leaderboard, loading, saveScore };
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
