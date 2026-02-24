import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PrizeConfig {
  degistir: number;
  fisilida: number;
  senyaz: number;
  oyunHakki?: number;
  label: string;
  badgeId: string;
  countColumn: string;
}

const PRIZES: Record<string, PrizeConfig> = {
  weekly: { degistir: 3, fisilida: 3, senyaz: 3, label: "Haftalık", badgeId: "b1000001-0000-0000-0000-000000000002", countColumn: "weekly_first_count" },
  monthly: { degistir: 8, fisilida: 8, senyaz: 8, oyunHakki: 10, label: "Aylık", badgeId: "b1000001-0000-0000-0000-000000000003", countColumn: "monthly_first_count" },
  season: { degistir: 20, fisilida: 20, senyaz: 20, oyunHakki: 25, label: "Sezon", badgeId: "b1000001-0000-0000-0000-000000000001", countColumn: "season_first_count" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const results: string[] = [];

    // --- Check Weekly (runs every Monday at 00:00) ---
    const dayOfWeek = now.getUTCDay();
    const hour = now.getUTCHours();
    
    if (dayOfWeek === 1 && hour < 1) {
      const lastWeekStart = new Date(now);
      lastWeekStart.setUTCDate(now.getUTCDate() - 7);
      lastWeekStart.setUTCHours(0, 0, 0, 0);
      const daysSinceMonday = (lastWeekStart.getUTCDay() + 6) % 7;
      lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - daysSinceMonday);

      const winner = await findWeeklyWinner(supabase, lastWeekStart.toISOString());
      if (winner) {
        await awardPrize(supabase, winner, PRIZES.weekly);
        results.push(`Weekly winner: ${winner}`);
      }
    }

    // --- Check Monthly (runs on 1st of month) ---
    if (now.getUTCDate() === 1 && hour < 1) {
      const lastMonthStart = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

      const winner = await findMonthlyWinner(supabase, lastMonthStart.toISOString(), lastMonthEnd.toISOString());
      if (winner) {
        await awardPrize(supabase, winner, PRIZES.monthly);
        results.push(`Monthly winner: ${winner}`);
      }
    }

    // --- Check Season (runs on May 1, Sep 1, Jan 1) ---
    const seasonResetMonths = [0, 4, 8];
    if (seasonResetMonths.includes(now.getUTCMonth()) && now.getUTCDate() === 1 && hour < 1) {
      const prevSeasonStart = new Date(now);
      prevSeasonStart.setUTCMonth(now.getUTCMonth() - 4);
      prevSeasonStart.setUTCDate(1);
      prevSeasonStart.setUTCHours(0, 0, 0, 0);

      const winner = await findSeasonWinner(supabase, prevSeasonStart.toISOString(), now.toISOString());
      if (winner) {
        await awardPrize(supabase, winner, PRIZES.season);
        results.push(`Season winner: ${winner}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in award-leaderboard-prizes:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function findWeeklyWinner(supabase: any, weekStart: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_weekly_leaderboard", { limit_count: 1 });
  if (error || !data || data.length === 0) return null;
  return data[0].user_id;
}

async function findMonthlyWinner(supabase: any, monthStart: string, monthEnd: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_monthly_leaderboard", { limit_count: 1 });
  if (error || !data || data.length === 0) return null;
  return data[0].user_id;
}

async function findSeasonWinner(supabase: any, seasonStart: string, seasonEnd: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("game_sessions")
    .select("user_id, score")
    .gte("created_at", seasonStart)
    .lt("created_at", seasonEnd);

  if (error || !data || data.length === 0) return null;

  const scores = new Map<string, number>();
  data.forEach((s: any) => {
    scores.set(s.user_id, (scores.get(s.user_id) || 0) + (s.score || 0));
  });

  let topUser: string | null = null;
  let topScore = 0;
  scores.forEach((score, userId) => {
    if (score > topScore) {
      topScore = score;
      topUser = userId;
    }
  });

  return topUser;
}

async function awardPrize(supabase: any, userId: string, prize: PrizeConfig) {
  // Award jokers via user_inventory (upsert)
  const jokerTypes = [
    { type: "degistir_joker", amount: prize.degistir },
    { type: "fisilida_joker", amount: prize.fisilida },
    { type: "senyaz_joker", amount: prize.senyaz },
  ];

  for (const joker of jokerTypes) {
    const { data: existing } = await supabase
      .from("user_inventory")
      .select("id, quantity")
      .eq("user_id", userId)
      .eq("item_type", joker.type)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_inventory")
        .update({ quantity: existing.quantity + joker.amount, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("user_inventory")
        .insert({ user_id: userId, item_type: joker.type, quantity: joker.amount });
    }
  }

  // Award game credits if applicable
  if (prize.oyunHakki) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("game_credits")
      .eq("id", userId)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({
          game_credits: (profile.game_credits || 0) + prize.oyunHakki,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }
  }

  // Increment championship count
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select(prize.countColumn)
    .eq("id", userId)
    .single();

  if (currentProfile) {
    const currentCount = currentProfile[prize.countColumn] || 0;
    await supabase
      .from("profiles")
      .update({
        [prize.countColumn]: currentCount + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }

  // Award badge (only first time - check if already has it)
  const { data: existingBadge } = await supabase
    .from("user_badges")
    .select("id")
    .eq("user_id", userId)
    .eq("badge_id", prize.badgeId)
    .maybeSingle();

  if (!existingBadge) {
    await supabase.from("user_badges").insert({
      user_id: userId,
      badge_id: prize.badgeId,
    });
    console.log(`Badge ${prize.badgeId} awarded to ${userId}`);
  }

  // Send notification
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "leaderboard_prize",
    message: `🎉 Tebrikler! ${prize.label} liderlik tablosunda 1. oldun! Ödüllerin: ${prize.degistir} Değiştir, ${prize.fisilida} Fısılda, ${prize.senyaz} Senyaz${prize.oyunHakki ? `, ${prize.oyunHakki} Oyun Hakkı` : ""} hesabına eklendi!`,
  });

  console.log(`Prize awarded to ${userId}: ${JSON.stringify(prize)}`);
}
