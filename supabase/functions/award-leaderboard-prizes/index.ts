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
  weekly: { degistir: 3, fisilida: 3, senyaz: 3, oyunHakki: 3, label: "Haftalık", badgeId: "b1000001-0000-0000-0000-000000000002", countColumn: "weekly_first_count" },
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

    // TEST MODU: { "test": true, "userId": "...", "prizeType": "monthly" }
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (body.test === true && body.userId) {
      const prizeType = body.prizeType || "monthly";
      const prize = PRIZES[prizeType];
      if (!prize) {
        return new Response(
          JSON.stringify({ error: "Gecersiz prizeType. weekly / monthly / season olmali." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await awardPrize(supabase, body.userId, prize);
      return new Response(
        JSON.stringify({ success: true, message: `Test: ${prizeType} odulu verildi`, userId: body.userId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Turkiye saati = UTC+3
    const now = new Date();
    const turkeyOffset = 3 * 60 * 60 * 1000;
    const turkeyNow = new Date(now.getTime() + turkeyOffset);

    const dayOfWeek = turkeyNow.getUTCDay();
    const hour = turkeyNow.getUTCHours();
    const dateOfMonth = turkeyNow.getUTCDate();
    const month = turkeyNow.getUTCMonth();

    const results: string[] = [];
    const todayStr = turkeyNow.toISOString().split('T')[0];

    // Çift ödül koruması: bugün zaten ödül verilmiş mi?
    const alreadyAwarded = async (prizeType: string): Promise<boolean> => {
      const { data } = await supabase
        .from("notifications")
        .select("id")
        .eq("type", "leaderboard_prize")
        .gte("created_at", todayStr + "T00:00:00Z")
        .like("message", `%${PRIZES[prizeType].label}%`)
        .limit(1);
      return data && data.length > 0;
    };

    // Weekly (Her Pazartesi 00:00 Turkiye saati)
    if (dayOfWeek === 1 && hour < 1) {
      if (await alreadyAwarded("weekly")) {
        results.push("Weekly prize already awarded today, skipping");
      } else {
        const winner = await findWeeklyWinner(supabase);
        if (winner) {
          await awardPrize(supabase, winner, PRIZES.weekly);
          results.push(`Weekly winner: ${winner}`);
        }
      }
      await resetWeeklyStats(supabase);
      results.push("Weekly stats cleanup done");
    }

    // Monthly (Her ayin 1'i 00:00 Turkiye saati)
    if (dateOfMonth === 1 && hour < 1) {
      if (await alreadyAwarded("monthly")) {
        results.push("Monthly prize already awarded today, skipping");
      } else {
        const winner = await findMonthlyWinner(supabase);
        if (winner) {
          await awardPrize(supabase, winner, PRIZES.monthly);
          results.push(`Monthly winner: ${winner}`);
        }
      }
      await resetMonthlyStats(supabase);
      results.push("Monthly stats cleanup done");
    }

    // Season (Mayis 1, Eylul 1, Ocak 1 Turkiye saati)
    const seasonResetMonths = [0, 4, 8];
    if (seasonResetMonths.includes(month) && dateOfMonth === 1 && hour < 1) {
      if (await alreadyAwarded("season")) {
        results.push("Season prize already awarded today, skipping");
      } else {
        const prevSeasonStart = new Date(turkeyNow);
        prevSeasonStart.setUTCMonth(month - 4);
        prevSeasonStart.setUTCDate(1);
        prevSeasonStart.setUTCHours(0, 0, 0, 0);

        const winner = await findSeasonWinner(supabase, prevSeasonStart.toISOString(), turkeyNow.toISOString());
        if (winner) {
          await awardPrize(supabase, winner, PRIZES.season);
          results.push(`Season winner: ${winner}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in award-leaderboard-prizes:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function findWeeklyWinner(supabase: any): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_weekly_leaderboard", { limit_count: 1 });
  if (error) { console.error("Weekly leaderboard error:", error); return null; }
  if (!data || data.length === 0) return null;
  return data[0].user_id;
}

async function findMonthlyWinner(supabase: any): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_monthly_leaderboard", { limit_count: 1 });
  if (error) { console.error("Monthly leaderboard error:", error); return null; }
  if (!data || data.length === 0) return null;
  return data[0].user_id;
}

async function findSeasonWinner(supabase: any, seasonStart: string, seasonEnd: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_season_leaderboard", { limit_count: 1, season_start_date: seasonStart });
  if (error) { console.error("Season leaderboard error:", error); return null; }
  if (!data || data.length === 0) return null;
  return data[0].user_id;
}

async function awardPrize(supabase: any, userId: string, prize: PrizeConfig) {
  const jokerTypes = [
    { type: "joker_degistir", amount: prize.degistir },
    { type: "joker_fisilida", amount: prize.fisilida },
    { type: "joker_senyaz", amount: prize.senyaz },
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

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "leaderboard_prize",
    message: `🎉 Tebrikler! ${prize.label} liderlik tablosunda 1. oldun! Ödüllerin: ${prize.degistir} Değiştir, ${prize.fisilida} Fısılda, ${prize.senyaz} Senyaz${prize.oyunHakki ? `, +${prize.oyunHakki} Oyun Sayfası` : ""} hesabına eklendi!`,
  });

  console.log(`Prize awarded to ${userId}: ${JSON.stringify(prize)}`);
}

async function resetWeeklyStats(supabase: any) {
  // weekly_stats tablosundaki geçen haftanın kayıtlarını sıfırlamaya gerek yok
  // çünkü her hafta yeni kayıt oluşuyor (week_start ile)
  // Ama eski haftaların temizliğini yapalım (8 haftadan eski)
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const cutoff = eightWeeksAgo.toISOString().split('T')[0];

  const { error } = await supabase
    .from("weekly_stats")
    .delete()
    .lt("week_start", cutoff);

  if (error) {
    console.error("Weekly stats cleanup error:", error);
  } else {
    console.log("Weekly stats cleaned up (older than 8 weeks)");
  }
}

async function resetMonthlyStats(supabase: any) {
  // monthly_stats tablosundaki eski ayların temizliği (6 aydan eski)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoff = sixMonthsAgo.toISOString().split('T')[0];

  const { error } = await supabase
    .from("monthly_stats")
    .delete()
    .lt("month_start", cutoff);

  if (error) {
    console.error("Monthly stats cleanup error:", error);
  } else {
    console.log("Monthly stats cleaned up (older than 6 months)");
  }
}
