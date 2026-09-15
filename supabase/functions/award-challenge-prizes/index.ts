import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHALLENGE_TYPES = ["puzzle", "reaktor", "neon_blitz", "memory", "kelime_avi"];

// Her challenge türü için ödül tanımları
const CHALLENGE_REWARDS: Record<string, { type: string; field: string; amount: number; label: string }> = {
  puzzle: { type: "ink", field: "ink_count", amount: 3, label: "3 Mürekkep Damlası 🖊️" },
  reaktor: { type: "credits", field: "game_credits", amount: 3, label: "3 Oyun Sayfası 📄" },
  memory: { type: "spins", field: "bonus_spins", amount: 1, label: "1 Çark Çevirme Hakkı 🎡" },
};

// Neon blitz level-based rewards (written to user_inventory)
function getNeonBlitzRewards(level: number): { items: { item_type: string; quantity: number }[]; label: string } | null {
  if (level >= 25) {
    return {
      items: [
        { item_type: "fisilida", quantity: 2 },
        { item_type: "degistir", quantity: 2 },
        { item_type: "senyaz", quantity: 2 },
      ],
      label: "2 Fısılda + 2 Değiştir + 2 Senyaz"
    };
  } else if (level >= 20) {
    return {
      items: [
        { item_type: "fisilida", quantity: 2 },
        { item_type: "degistir", quantity: 2 },
      ],
      label: "2 Fısılda + 2 Değiştir"
    };
  } else if (level >= 15) {
    return {
      items: [
        { item_type: "fisilida", quantity: 2 },
      ],
      label: "2 Fısılda"
    };
  }
  return null;
}

// Helper: upsert joker into user_inventory
async function upsertInventoryItem(supabase: any, userId: string, itemType: string, addQuantity: number) {
  const { data: existing } = await supabase
    .from("user_inventory")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("item_type", itemType)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("user_inventory")
      .update({ quantity: (existing.quantity || 0) + addQuantity, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("user_inventory")
      .insert({ user_id: userId, item_type: itemType, quantity: addQuantity });
  }
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

    let overrideDate: string | null = null;
    try {
      const body = await req.json();
      if (body?.date) overrideDate = body.date;
    } catch { /* no body */ }

    let yesterdayDate: string;
    if (overrideDate) {
      yesterdayDate = overrideDate;
    } else {
      const now = new Date();
      const turkeyNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      const yesterday = new Date(turkeyNow);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      yesterdayDate = yesterday.toISOString().split("T")[0];
    }

    console.log(`🏆 Checking challenge prizes for date: ${yesterdayDate}`);

    // Mükerrer ödül kontrolü
    const { data: alreadyDone } = await supabase
      .from("notifications")
      .select("id")
      .eq("type", "challenge_prize")
      .gte("created_at", `${yesterdayDate}T21:00:00Z`)
      .limit(1);

    if (alreadyDone && alreadyDone.length > 0) {
      console.log("⚠️ Challenge prizes already awarded for this period");
      return new Response(
        JSON.stringify({ success: true, message: "Already awarded" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: string[] = [];
    const challengeNames: Record<string, string> = {
      puzzle: "Kelime Puzzle",
      reaktor: "Reaktör Koşusu",
      neon_blitz: "Refleks",
      memory: "Kelime Hafıza",
      kelime_avi: "Kelime Avı",
    };

    for (const challengeType of CHALLENGE_TYPES) {
      if (challengeType === "neon_blitz") {
        // Neon blitz: level-based rewards for ALL qualifying players
        const { data: allScores } = await supabase
          .from("challenge_scores")
          .select("user_id, username, score")
          .eq("challenge_type", "neon_blitz")
          .eq("date", yesterdayDate);

        if (!allScores || allScores.length === 0) {
          results.push("neon_blitz: No players");
          continue;
        }

        let awarded = 0;
        for (const player of allScores) {
          const level = Number(player.score);
          const rewards = getNeonBlitzRewards(level);
          if (!rewards) continue;

          // Write jokers to user_inventory (correct location)
          for (const item of rewards.items) {
            await upsertInventoryItem(supabase, player.user_id, item.item_type, item.quantity);
          }

          const { error: notifError } = await supabase.from("notifications").insert({
            user_id: player.user_id,
            type: "challenge_prize",
            message: `🎯 Dünkü Refleks challenge'ında Level ${level}'e ulaştın! +${rewards.label} kazandın!`,
          });
          if (notifError) console.error(`❌ Notification insert error (neon_blitz): ${notifError.message}`);

          awarded++;
          console.log(`🎁 Neon blitz: ${player.username} (Lvl ${level}) → ${rewards.label}`);
        }

        results.push(`neon_blitz: ${awarded} players awarded`);
      } else if (challengeType === "memory") {
        // Memory: ALL players who completed get +1 bonus_spins
        const { data: allScores } = await supabase
          .from("challenge_scores")
          .select("user_id, username, score")
          .eq("challenge_type", "memory")
          .eq("date", yesterdayDate);

        if (!allScores || allScores.length === 0) {
          results.push("memory: No players");
          continue;
        }

        let awarded = 0;
        for (const player of allScores) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("bonus_spins")
            .eq("id", player.user_id)
            .single();

          if (!profile) continue;

          await supabase.from("profiles").update({
            bonus_spins: ((profile as any).bonus_spins || 0) + 1,
            updated_at: new Date().toISOString(),
          }).eq("id", player.user_id);

          const { error: notifError } = await supabase.from("notifications").insert({
            user_id: player.user_id,
            type: "challenge_prize",
            message: `🧠 Dünkü Kelime Hafıza challenge'ını tamamladın! +1 Çark Çevirme Hakkı 🎡 kazandın!`,
          });
          if (notifError) console.error(`❌ Notification insert error (memory): ${notifError.message}`);

          awarded++;
          console.log(`🎁 Memory: ${player.username} → +1 bonus_spin`);
        }

        results.push(`memory: ${awarded} players awarded`);
      } else if (challengeType === "kelime_avi") {
        // Kelime Avı: top-1 winner gets a CLAIMABLE 1-hour x2 boost (activated by user)
        const { data: topScorer } = await supabase
          .from("challenge_scores")
          .select("user_id, username, score")
          .eq("challenge_type", "kelime_avi")
          .eq("date", yesterdayDate)
          .order("score", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!topScorer || !topScorer.user_id || Number(topScorer.score) <= 0) {
          results.push("kelime_avi: No players");
          continue;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("pending_boost_minutes, score_boost_until, score_boost_source")
          .eq("id", topScorer.user_id)
          .single();

        const currentPending = Number((profile as any)?.pending_boost_minutes || 0);
        const boostUntil = (profile as any)?.score_boost_until ? new Date((profile as any).score_boost_until) : null;
        const boostSource = (profile as any)?.score_boost_source;
        const hasActiveKelimeBoost = boostUntil && boostUntil.getTime() > Date.now() && boostSource === "kelime_avi";

        // Skip if user already has an unclaimed pending boost OR an active kelime_avi boost
        if (currentPending > 0 || hasActiveKelimeBoost) {
          results.push(`kelime_avi: Winner ${topScorer.username} already has boost (pending=${currentPending}, active=${hasActiveKelimeBoost}) → skipped`);
          console.log(`⏭️ Kelime Avı boost skipped for ${topScorer.username} (already has one)`);
          continue;
        }

        const newPending = 60; // +1 hour worth of minutes

        await supabase
          .from("profiles")
          .update({ pending_boost_minutes: newPending, updated_at: new Date().toISOString() })
          .eq("id", topScorer.user_id);

        const { error: notifError } = await supabase.from("notifications").insert({
          user_id: topScorer.user_id,
          type: "challenge_prize",
          message: `🕸️ Tebrikler! Dünkü Kelime Avı'nda 1. oldun! 1 saatlik x2 puan boost kazandın! Kelime Avı sayfasından istediğin zaman aktif edebilirsin ⚡`,
        });
        if (notifError) console.error(`❌ Notification insert error (kelime_avi): ${notifError.message}`);

        results.push(`kelime_avi: Winner ${topScorer.username} (${topScorer.score}) → +60 pending min`);
        console.log(`🎁 Kelime Avı pending boost awarded to ${topScorer.username} (now ${newPending} min)`);
      } else {
        // Standard challenge: top 1 winner
        const { data: topScorer } = await supabase
          .from("challenge_scores")
          .select("user_id, username, score")
          .eq("challenge_type", challengeType)
          .eq("date", yesterdayDate)
          .order("score", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!topScorer || !topScorer.user_id) {
          results.push(`${challengeType}: No players`);
          continue;
        }

        const reward = CHALLENGE_REWARDS[challengeType];

        const { data: profile } = await supabase
          .from("profiles")
          .select(`${reward.field}`)
          .eq("id", topScorer.user_id)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({
              [reward.field]: ((profile as any)[reward.field] || 0) + reward.amount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", topScorer.user_id);
        }

        const { error: notifError } = await supabase.from("notifications").insert({
          user_id: topScorer.user_id,
          type: "challenge_prize",
          message: `🎯 Tebrikler! Dünkü ${challengeNames[challengeType]} challenge'ında 1. oldun! +${reward.label} kazandın!`,
        });
        if (notifError) console.error(`❌ Notification insert error (${challengeType}): ${notifError.message}`);

        results.push(`${challengeType}: Winner ${topScorer.username} (${topScorer.score})`);
        console.log(`🎁 +${reward.label} awarded to ${topScorer.username} for ${challengeType}`);
      }
    }

    console.log(`✅ Results: ${JSON.stringify(results)}`);

    return new Response(
      JSON.stringify({ success: true, results, date: yesterdayDate }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in award-challenge-prizes:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
