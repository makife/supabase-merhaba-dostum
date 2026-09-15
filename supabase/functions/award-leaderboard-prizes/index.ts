import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PrizeTier {
  degistir: number;
  fisilida: number;
  senyaz: number;
  oyunHakki?: number;
  boostHours: number; // Maç sonu puan x2 boost süresi (saat)
}

interface PrizeConfig {
  label: string;
  badgeId: string;
  countColumn: string;
  tiers: PrizeTier[]; // [1., 2., 3.]
}

const PRIZES: Record<string, PrizeConfig> = {
  weekly: {
    label: "Haftalık",
    badgeId: "b1000001-0000-0000-0000-000000000002",
    countColumn: "weekly_first_count",
    tiers: [
      { degistir: 3, fisilida: 3, senyaz: 3, oyunHakki: 3, boostHours: 2 },
      { degistir: 2, fisilida: 2, senyaz: 2, oyunHakki: 2, boostHours: 1 },
      { degistir: 1, fisilida: 1, senyaz: 1, oyunHakki: 1, boostHours: 0.5 },
    ],
  },
  monthly: {
    label: "Aylık",
    badgeId: "b1000001-0000-0000-0000-000000000003",
    countColumn: "monthly_first_count",
    tiers: [
      { degistir: 8, fisilida: 8, senyaz: 8, oyunHakki: 6, boostHours: 48 },
      { degistir: 6, fisilida: 6, senyaz: 6, oyunHakki: 4, boostHours: 12 },
      { degistir: 4, fisilida: 4, senyaz: 4, oyunHakki: 2, boostHours: 3 },
    ],
  },
  season: {
    label: "Sezon",
    badgeId: "b1000001-0000-0000-0000-000000000001",
    countColumn: "season_first_count",
    tiers: [
      { degistir: 30, fisilida: 30, senyaz: 30, oyunHakki: 20, boostHours: 120 },
      { degistir: 20, fisilida: 20, senyaz: 20, oyunHakki: 10, boostHours: 72 },
      { degistir: 10, fisilida: 10, senyaz: 10, oyunHakki: 5, boostHours: 24 },
    ],
  },
};

function formatBoost(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} dakika`;
  if (hours < 24) return `${hours} saat`;
  return `${hours / 24} gün`;
}

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

    // force_type: "weekly" | "monthly" | "season" — manuel tetikleme
    const forceType = body.force_type as string | undefined;

    // Turkiye saati = UTC+3
    const now = new Date();
    const turkeyOffset = 3 * 60 * 60 * 1000;
    const turkeyNow = new Date(now.getTime() + turkeyOffset);

    const dayOfWeek = turkeyNow.getUTCDay();
    const hour = turkeyNow.getUTCHours();
    const dateOfMonth = turkeyNow.getUTCDate();
    const month = turkeyNow.getUTCMonth();

    const results: string[] = [];

    console.log(`🕐 Turkey time: day=${dayOfWeek} hour=${hour} date=${dateOfMonth} month=${month} forceType=${forceType || "none"}`);

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

      console.log(`🔍 Checking alreadyAwarded for ${prizeType} since ${sinceDate}`);

      const { data, error } = await supabase
        .from("notifications")
        .select("id")
        .in("type", ["leaderboard_prize", "system"])
        .gte("created_at", sinceDate)
        .like("message", `%${label} liderlik%`)
        .limit(1);
      
      if (error) {
        console.error(`❌ alreadyAwarded query error for ${prizeType}:`, error);
        return false; // hata durumunda ödül vermeye devam et
      }

      const found = !!(data && data.length > 0);
      if (found) {
        console.log(`⚠️ ${prizeType} prize already awarded since ${sinceDate}, found: ${JSON.stringify(data)}`);
      } else {
        console.log(`✅ ${prizeType} prize NOT yet awarded, proceeding`);
      }
      return found;
    };

    // İlk 3'e sırayla ödül ver
    const awardTop3 = async (winners: string[], config: PrizeConfig) => {
      for (let i = 0; i < winners.length && i < config.tiers.length; i++) {
        await awardPrize(supabase, winners[i], config, i + 1);
      }
    };

    // ===== WEEKLY =====
    const shouldDoWeekly = forceType === "weekly" || (dayOfWeek === 1 && hour < 1);
    if (shouldDoWeekly) {
      console.log("📊 Processing WEEKLY prize...");
      if (await alreadyAwarded("weekly")) {
        results.push("Weekly prize already awarded, skipping");
      } else {
        const winners = await findPreviousWeekWinners(supabase, turkeyNow);
        if (winners.length > 0) {
          await awardTop3(winners, PRIZES.weekly);
          results.push(`Weekly winners: ${winners.join(", ")}`);
        } else {
          results.push("No weekly winner found");
        }
      }
    }

    // ===== MONTHLY =====
    const shouldDoMonthly = forceType === "monthly" || (dateOfMonth === 1 && hour < 1);
    if (shouldDoMonthly) {
      console.log("📊 Processing MONTHLY prize...");
      if (await alreadyAwarded("monthly")) {
        results.push("Monthly prize already awarded, skipping");
      } else {
        const winners = await findPreviousMonthWinners(supabase, turkeyNow);
        if (winners.length > 0) {
          await awardTop3(winners, PRIZES.monthly);
          results.push(`Monthly winners: ${winners.join(", ")}`);
        } else {
          results.push("No monthly winner found");
        }
      }
    }

    // ===== SEASON =====
    const seasonResetMonths = [0, 4, 8];
    const shouldDoSeason = forceType === "season" || (seasonResetMonths.includes(month) && dateOfMonth === 1 && hour < 1);
    if (shouldDoSeason) {
      console.log("📊 Processing SEASON prize...");
      if (await alreadyAwarded("season")) {
        results.push("Season prize already awarded, skipping");
      } else {
        const winners = await findSeasonWinners(supabase, turkeyNow);
        if (winners.length > 0) {
          await awardTop3(winners, PRIZES.season);
          results.push(`Season winners: ${winners.join(", ")}`);
        } else {
          results.push("No season winner found");
        }
      }
    }

    // Cleanup (sadece normal cron zamanında)
    if (!forceType) {
      if (dayOfWeek === 1 && hour < 1) {
        await cleanupOldStats(supabase, "weekly_stats", "week_start", 56);
        results.push("Weekly stats cleanup done");
      }
      if (dateOfMonth === 1 && hour < 1) {
        await cleanupOldStats(supabase, "monthly_stats", "month_start", 180);
        results.push("Monthly stats cleanup done");
      }
    }

    console.log(`✅ Results: ${JSON.stringify(results)}`);

    return new Response(
      JSON.stringify({ success: true, results, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in award-leaderboard-prizes:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ===== ÖNCEKİ HAFTA ilk 3'ünü doğrudan weekly_stats tablosundan bul =====
async function findPreviousWeekWinners(supabase: any, turkeyNow: Date): Promise<string[]> {
  const prevMonday = new Date(turkeyNow);
  prevMonday.setUTCDate(prevMonday.getUTCDate() - ((turkeyNow.getUTCDay() + 6) % 7) - 7);
  const prevWeekStart = prevMonday.toISOString().split('T')[0];
  
  console.log(`📊 Looking for previous week winners (week_start: ${prevWeekStart})`);
  
  const { data, error } = await supabase
    .from("weekly_stats")
    .select("user_id, total_score, games_played")
    .eq("week_start", prevWeekStart)
    .gt("total_score", 0)
    .order("total_score", { ascending: false })
    .limit(3);
  
  if (error) { console.error("❌ Previous week winners error:", error); return []; }
  if (!data || data.length === 0) {
    console.log(`📊 No data found for week_start: ${prevWeekStart}`);
    return [];
  }
  
  console.log(`📊 Previous week top3: ${JSON.stringify(data)}`);
  return data.map((d: any) => d.user_id);
}

// ===== ÖNCEKİ AY ilk 3'ünü doğrudan monthly_stats tablosundan bul =====
async function findPreviousMonthWinners(supabase: any, turkeyNow: Date): Promise<string[]> {
  const prevMonth = new Date(turkeyNow);
  prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
  prevMonth.setUTCDate(1);
  const prevMonthStart = prevMonth.toISOString().split('T')[0];
  
  console.log(`📊 Looking for previous month winners (month_start: ${prevMonthStart})`);
  
  const { data, error } = await supabase
    .from("monthly_stats")
    .select("user_id, total_score, games_played")
    .eq("month_start", prevMonthStart)
    .gt("total_score", 0)
    .order("total_score", { ascending: false })
    .limit(3);
  
  if (error) { console.error("❌ Previous month winners error:", error); return []; }
  if (!data || data.length === 0) {
    console.log(`📊 No data found for month_start: ${prevMonthStart}`);
    return [];
  }
  
  console.log(`📊 Previous month top3: ${JSON.stringify(data)}`);
  return data.map((d: any) => d.user_id);
}

// ===== ÖNCEKİ SEZON ilk 3'ü =====
// Cron 1 Ocak/Mayıs/Eylül 00:00 TR'de çalıştığı için yeni sezona geçilmiş olur.
// Önceki sezonun başlangıç tarihini hesaplayıp RPC'ye parametre olarak veriyoruz.
async function findSeasonWinners(supabase: any, turkeyNow: Date): Promise<string[]> {
  const curMonth = turkeyNow.getUTCMonth();
  const curYear = turkeyNow.getUTCFullYear();
  // Önceki sezon başlangıcı = mevcut başlangıçtan 4 ay öncesi
  const prevSeasonDate = new Date(Date.UTC(curYear, curMonth - 4, 1));
  const prevSeasonStart = prevSeasonDate.toISOString().split("T")[0];

  console.log(`📊 Looking for previous season winners (season_start: ${prevSeasonStart})`);

  const { data, error } = await supabase.rpc("get_season_leaderboard", {
    limit_count: 3,
    season_start_date: prevSeasonStart,
  });
  if (error) { console.error("❌ Season leaderboard error:", error); return []; }
  if (!data || data.length === 0) {
    console.log(`📊 No data found for season starting ${prevSeasonStart}`);
    return [];
  }
  console.log(`📊 Previous season top3: ${JSON.stringify(data.map((d: any) => ({ u: d.user_id, s: d.season_score })))}`);
  return data.map((d: any) => d.user_id);
}

async function awardPrize(supabase: any, userId: string, config: PrizeConfig, rank: number) {
  const prize = config.tiers[rank - 1];
  console.log(`🎁 Awarding ${config.label} prize (rank ${rank}) to ${userId}...`);
  
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
      const { error } = await supabase
        .from("user_inventory")
        .update({ quantity: existing.quantity + joker.amount, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) console.error(`❌ Joker update error (${joker.type}):`, error);
      else console.log(`✅ Joker ${joker.type}: ${existing.quantity} -> ${existing.quantity + joker.amount}`);
    } else {
      const { error } = await supabase
        .from("user_inventory")
        .insert({ user_id: userId, item_type: joker.type, quantity: joker.amount });
      if (error) console.error(`❌ Joker insert error (${joker.type}):`, error);
      else console.log(`✅ Joker ${joker.type}: 0 -> ${joker.amount}`);
    }
  }

  if (prize.oyunHakki) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("game_credits, bonus_credits")
      .eq("id", userId)
      .single();

    if (profile) {
      const currentCredits = (profile.game_credits || 0);
      const currentBonus = (profile.bonus_credits || 0);
      // game_credits cap 5, fazlasını bonus'a ekle
      const toGameCredits = Math.min(prize.oyunHakki, Math.max(0, 5 - currentCredits));
      const toBonus = prize.oyunHakki - toGameCredits;
      
      const { error } = await supabase
        .from("profiles")
        .update({
          game_credits: currentCredits + toGameCredits,
          bonus_credits: currentBonus + toBonus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) console.error(`❌ Game credits update error:`, error);
      else console.log(`✅ Credits: game_credits +${toGameCredits}, bonus_credits +${toBonus}`);
    }
  }

  // Şampiyonluk sayacı ve rozet sadece 1. olan için
  if (rank === 1) {
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select(config.countColumn)
      .eq("id", userId)
      .single();

    if (currentProfile) {
      const currentCount = currentProfile[config.countColumn] || 0;
      const { error } = await supabase
        .from("profiles")
        .update({
          [config.countColumn]: currentCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) console.error(`❌ Count update error:`, error);
      else console.log(`✅ ${config.countColumn}: ${currentCount} -> ${currentCount + 1}`);
    }
  }

  // 🚀 Maç sonu puan x2 boost süresini uzat (en uzun olan etkili — mevcutla karşılaştır)
  if (prize.boostHours > 0) {
    const { data: boostProfile } = await supabase
      .from("profiles")
      .select("score_boost_until")
      .eq("id", userId)
      .single();

    const newBoostEnd = new Date(Date.now() + prize.boostHours * 60 * 60 * 1000);

    const currentBoost = boostProfile?.score_boost_until ? new Date(boostProfile.score_boost_until) : null;
    const finalBoostEnd = currentBoost && currentBoost > newBoostEnd ? currentBoost : newBoostEnd;

    const { error: boostErr } = await supabase
      .from("profiles")
      .update({ score_boost_until: finalBoostEnd.toISOString(), score_boost_source: "leaderboard", updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (boostErr) console.error(`❌ Boost update error:`, boostErr);
    else console.log(`🚀 score_boost_until -> ${finalBoostEnd.toISOString()} (+${prize.boostHours}h)`);
  }

  if (rank === 1) {
    const { data: existingBadge } = await supabase
      .from("user_badges")
      .select("id")
      .eq("user_id", userId)
      .eq("badge_id", config.badgeId)
      .maybeSingle();

    if (!existingBadge) {
      const { error } = await supabase.from("user_badges").insert({
        user_id: userId,
        badge_id: config.badgeId,
      });
      if (error) console.error(`❌ Badge insert error:`, error);
      else console.log(`🏅 Badge ${config.badgeId} awarded to ${userId}`);
    }
  }

  // Bildirim gönder — type: "leaderboard_prize"
  const boostText = formatBoost(prize.boostHours);
  const notifMessage = `🎉 Tebrikler! ${config.label} liderlik tablosunda ${rank}. oldun! Ödüllerin: ${prize.degistir} Değiştir, ${prize.fisilida} Fısılda, ${prize.senyaz} Senyaz${prize.oyunHakki ? `, +${prize.oyunHakki} Oyun Sayfası` : ""} ve ${boostText} boyunca maç sonu puanlarınız x2! 🚀`;
  
  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: userId,
    type: "leaderboard_prize",
    message: notifMessage,
    is_read: false,
  });

  if (notifError) {
    console.error(`❌ Notification insert error for ${userId}:`, notifError);
  } else {
    console.log(`✅ Notification sent: ${notifMessage.substring(0, 50)}...`);
  }

  console.log(`🎁 Prize awarded successfully to ${userId}: ${config.label} #${rank}`);
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
