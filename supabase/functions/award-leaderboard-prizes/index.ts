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

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // Turkiye saati = UTC+3
    const now = new Date();
    const turkeyOffset = 3 * 60 * 60 * 1000;
    const turkeyNow = new Date(now.getTime() + turkeyOffset);

    const dayOfWeek = turkeyNow.getUTCDay();
    const hour = turkeyNow.getUTCHours();
    const dateOfMonth = turkeyNow.getUTCDate();
    const month = turkeyNow.getUTCMonth();

    const results: string[] = [];

    console.log(`🕐 Turkey time: day=${dayOfWeek} hour=${hour} date=${dateOfMonth} month=${month}`);

    // Çift ödül koruması
    const alreadyAwarded = async (prizeType: string): Promise<boolean> => {
      const label = PRIZES[prizeType].label;
      
      let sinceDate: string;
      if (prizeType === "weekly") {
        const monday = new Date(turkeyNow);
        monday.setUTCDate(monday.getUTCDate() - ((dayOfWeek + 6) % 7));
        monday.setUTCHours(0, 0, 0, 0);
        sinceDate = monday.toISOString();
      } else if (prizeType === "monthly") {
        const monthStart = new Date(turkeyNow);
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);
        sinceDate = monthStart.toISOString();
      } else {
        const seasonMonth = month < 4 ? 0 : month < 8 ? 4 : 8;
        const seasonStart = new Date(turkeyNow);
        seasonStart.setUTCMonth(seasonMonth);
        seasonStart.setUTCDate(1);
        seasonStart.setUTCHours(0, 0, 0, 0);
        sinceDate = seasonStart.toISOString();
      }

      const { data } = await supabase
        .from("notifications")
        .select("id")
        .in("type", ["leaderboard_prize", "system"])
        .gte("created_at", sinceDate)
        .like("message", `%${label} liderlik%`)
        .limit(1);
      
      const found = !!(data && data.length > 0);
      if (found) {
        console.log(`⚠️ ${prizeType} prize already awarded since ${sinceDate}, skipping`);
      }
      return found;
    };

    // ===== WEEKLY: Her Pazartesi 00:00-00:59 TRT =====
    // KRİTİK: Önceki haftanın kazananını bul (mevcut hafta değil!)
    if (dayOfWeek === 1 && hour < 1) {
      if (await alreadyAwarded("weekly")) {
        results.push("Weekly prize already awarded, skipping");
      } else {
        const winner = await findPreviousWeekWinner(supabase, turkeyNow);
        if (winner) {
          await awardPrize(supabase, winner, PRIZES.weekly);
          results.push(`Weekly winner: ${winner}`);
        } else {
          results.push("No weekly winner found");
        }
      }
      await cleanupOldStats(supabase, "weekly_stats", "week_start", 56);
      results.push("Weekly stats cleanup done");
    }

    // ===== MONTHLY: Her ayın 1'i 00:00-00:59 TRT =====
    // KRİTİK: Önceki ayın kazananını bul
    if (dateOfMonth === 1 && hour < 1) {
      if (await alreadyAwarded("monthly")) {
        results.push("Monthly prize already awarded, skipping");
      } else {
        const winner = await findPreviousMonthWinner(supabase, turkeyNow);
        if (winner) {
          await awardPrize(supabase, winner, PRIZES.monthly);
          results.push(`Monthly winner: ${winner}`);
        } else {
          results.push("No monthly winner found");
        }
      }
      await cleanupOldStats(supabase, "monthly_stats", "month_start", 180);
      results.push("Monthly stats cleanup done");
    }

    // ===== SEASON: Mayıs 1, Eylül 1, Ocak 1 TRT =====
    const seasonResetMonths = [0, 4, 8];
    if (seasonResetMonths.includes(month) && dateOfMonth === 1 && hour < 1) {
      if (await alreadyAwarded("season")) {
        results.push("Season prize already awarded, skipping");
      } else {
        const winner = await findSeasonWinner(supabase);
        if (winner) {
          await awardPrize(supabase, winner, PRIZES.season);
          results.push(`Season winner: ${winner}`);
        } else {
          results.push("No season winner found");
        }
      }
    }

    console.log(`✅ Results: ${JSON.stringify(results)}`);

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

// ===== ÖNCEKİ HAFTA kazananını doğrudan weekly_stats tablosundan bul =====
async function findPreviousWeekWinner(supabase: any, turkeyNow: Date): Promise<string | null> {
  // Önceki haftanın Pazartesi gününü hesapla
  const prevMonday = new Date(turkeyNow);
  prevMonday.setUTCDate(prevMonday.getUTCDate() - ((turkeyNow.getUTCDay() + 6) % 7) - 7);
  const prevWeekStart = prevMonday.toISOString().split('T')[0];
  
  console.log(`📊 Looking for previous week winner (week_start: ${prevWeekStart})`);
  
  const { data, error } = await supabase
    .from("weekly_stats")
    .select("user_id, total_score, games_played")
    .eq("week_start", prevWeekStart)
    .gt("total_score", 0)
    .order("total_score", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) { console.error("Previous week winner error:", error); return null; }
  if (!data) {
    console.log(`📊 No data found for week_start: ${prevWeekStart}`);
    return null;
  }
  
  console.log(`📊 Previous week winner: ${data.user_id} with score ${data.total_score}`);
  return data.user_id;
}

// ===== ÖNCEKİ AY kazananını doğrudan monthly_stats tablosundan bul =====
async function findPreviousMonthWinner(supabase: any, turkeyNow: Date): Promise<string | null> {
  // Önceki ayın 1'ini hesapla
  const prevMonth = new Date(turkeyNow);
  prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
  prevMonth.setUTCDate(1);
  const prevMonthStart = prevMonth.toISOString().split('T')[0];
  
  console.log(`📊 Looking for previous month winner (month_start: ${prevMonthStart})`);
  
  const { data, error } = await supabase
    .from("monthly_stats")
    .select("user_id, total_score, games_played")
    .eq("month_start", prevMonthStart)
    .gt("total_score", 0)
    .order("total_score", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) { console.error("Previous month winner error:", error); return null; }
  if (!data) {
    console.log(`📊 No data found for month_start: ${prevMonthStart}`);
    return null;
  }
  
  console.log(`📊 Previous month winner: ${data.user_id} with score ${data.total_score}`);
  return data.user_id;
}

// ===== SEZON kazananı (sezon bittiğinde çağrılır, mevcut veriler hala mevcut) =====
async function findSeasonWinner(supabase: any): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_season_leaderboard", { limit_count: 1 });
  if (error) { console.error("Season leaderboard error:", error); return null; }
  if (!data || data.length === 0) return null;
  console.log(`📊 Season winner found: ${data[0].user_id} with score ${data[0].season_score}`);
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

  // Şampiyonluk sayacını artır
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

  // Rozet ver (sadece ilk kez)
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
    console.log(`🏅 Badge ${prize.badgeId} awarded to ${userId}`);
  }

  // Bildirim gönder
  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: userId,
    type: "leaderboard_prize",
    message: `🎉 Tebrikler! ${prize.label} liderlik tablosunda 1. oldun! Ödüllerin: ${prize.degistir} Değiştir, ${prize.fisilida} Fısılda, ${prize.senyaz} Senyaz${prize.oyunHakki ? `, +${prize.oyunHakki} Oyun Sayfası` : ""} hesabına eklendi!`,
  });

  if (notifError) {
    console.error(`❌ Notification insert error for ${userId}:`, notifError);
  }

  console.log(`🎁 Prize awarded to ${userId}: ${prize.label}`);
}

async function cleanupOldStats(supabase: any, table: string, dateColumn: string, daysOld: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoff = cutoffDate.toISOString().split('T')[0];

  const { error } = await supabase
    .from(table)
    .delete()
    .lt(dateColumn, cutoff);

  if (error) {
    console.error(`${table} cleanup error:`, error);
  } else {
    console.log(`🧹 ${table} cleaned up (older than ${daysOld} days)`);
  }
}