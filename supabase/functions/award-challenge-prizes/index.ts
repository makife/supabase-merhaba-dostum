import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHALLENGE_TYPES = ["word_hunt", "anagram", "word_chain"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Dünün tarihi (Türkiye saati)
    const now = new Date();
    const turkeyNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const yesterday = new Date(turkeyNow);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayDate = yesterday.toISOString().split("T")[0];

    console.log(`🏆 Checking challenge prizes for date: ${yesterdayDate}`);

    // Mükerrer ödül kontrolü
    const { data: alreadyDone } = await supabase
      .from("notifications")
      .select("id")
      .eq("type", "challenge_prize")
      .gte("created_at", `${yesterdayDate}T21:00:00Z`) // Turkey midnight = 21:00 UTC
      .limit(1);

    if (alreadyDone && alreadyDone.length > 0) {
      console.log("⚠️ Challenge prizes already awarded for this period");
      return new Response(
        JSON.stringify({ success: true, message: "Already awarded" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: string[] = [];

    for (const challengeType of CHALLENGE_TYPES) {
      // Her challenge türünün birincisini bul
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

      // bonus_spins artır
      const { data: profile } = await supabase
        .from("profiles")
        .select("bonus_spins")
        .eq("id", topScorer.user_id)
        .single();

      if (profile) {
        await supabase
          .from("profiles")
          .update({
            bonus_spins: (profile.bonus_spins || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", topScorer.user_id);
      }

      // Bildirim gönder
      const challengeNames: Record<string, string> = {
        word_hunt: "Kelime Avı",
        anagram: "Anagram",
        word_chain: "Kelime Zinciri",
      };

      await supabase.from("notifications").insert({
        user_id: topScorer.user_id,
        type: "challenge_prize",
        message: `🎯 Tebrikler! Dünkü ${challengeNames[challengeType]} challenge'ında 1. oldun! +1 Çark çevirme hakkı kazandın! 🎡`,
      });

      results.push(`${challengeType}: Winner ${topScorer.username} (${topScorer.score})`);
      console.log(`🎡 +1 bonus spin awarded to ${topScorer.username} for ${challengeType}`);
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
