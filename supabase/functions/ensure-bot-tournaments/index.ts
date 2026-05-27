// Ensures that a minimum number of bot-created tournaments are always waiting,
// each pre-filled with 7 bot participants so that a single real player can join
// as the 8th and immediately start the bracket.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Hedef sayıyı her çağrıda 6-28 arası rastgele seç
const pickTarget = () => 6 + Math.floor(Math.random() * 23);
const BOT_TOURNAMENT_TTL_SEC = 30; // her turnuva 30 saniye yaşar

// Inline minimal name/avatar helpers (duplicated from client to avoid bundling)
const MALE = ["ahmet","mehmet","ali","emre","can","burak","yusuf","berk","arda","efe","emir","kaan","mert","kerem","bora","doruk","eren","alp","ege","koray","tolga","onur","umut","barış"];
const FEMALE = ["ayşe","zeynep","elif","ece","selin","merve","sude","ada","defne","ilayda","asya","nisa","irem","ela","nehir","maya","eylül","lara","derin","pelin","damla","su","ceren","begüm","deniz"];
const ALL = [...MALE, ...FEMALE];
const MALE_AV = Array.from({ length: 45 }, (_, i) => i + 1);
const FEMALE_AV = Array.from({ length: 45 }, (_, i) => i + 46);

function makeBot(seed: number) {
  const name = ALL[Math.abs(seed) % ALL.length];
  const isMale = MALE.includes(name);
  const pool = isMale ? MALE_AV : FEMALE_AV;
  const av = pool[Math.abs(seed * 13 + 7) % pool.length];
  const decor = Math.abs(seed) % 4;
  const num = 100 + (Math.abs(seed * 31) % 9000);
  const finalName =
    decor === 0 ? `${name}${num}` :
    decor === 1 ? `_${name}_` :
    decor === 2 ? `${name}.${Math.abs(seed) % 100}` :
                  `${name.charAt(0).toUpperCase()}${name.slice(1)}${num}`;
  return { username: finalName, avatar_url: `/avatarlar/${av}.svg` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cleanup: cancel stale bot tournaments
    const staleCutoff = new Date(Date.now() - BOT_TOURNAMENT_TTL_MIN * 60 * 1000).toISOString();
    await supabase
      .from("tournaments")
      .update({ status: "cancelled" })
      .eq("is_bot_tournament", true)
      .eq("status", "waiting")
      .lt("created_at", staleCutoff);

    // Count existing active bot tournaments
    const { count } = await supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .eq("is_bot_tournament", true)
      .eq("status", "waiting");

    const have = count ?? 0;
    const need = Math.max(0, TARGET_BOT_TOURNAMENTS - have);
    const created: string[] = [];

    for (let i = 0; i < need; i++) {
      const expiresAt = new Date(Date.now() + (8 + Math.floor(Math.random() * 7)) * 60 * 1000).toISOString();
      const hour = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
      const { data: t, error } = await supabase
        .from("tournaments")
        .insert({
          name: `Turnuva ${hour}`,
          creator_id: null,
          status: "waiting",
          game_type: "timed",
          max_participants: 8,
          current_round: 1,
          timeout_duration: 120,
          expires_at: expiresAt,
          is_bot_tournament: true,
        })
        .select("id")
        .single();

      if (error || !t) {
        console.error("create tournament failed", error);
        continue;
      }

      // insert 7 bot participants with unique fake user_ids
      const bots = Array.from({ length: 7 }, (_, idx) => {
        const seed = Date.now() + i * 1000 + idx * 37;
        const bot = makeBot(seed);
        return {
          tournament_id: t.id,
          user_id: crypto.randomUUID(),
          is_bot: true,
          // joined_at default now()
        };
      });
      const { error: pErr } = await supabase.from("tournament_participants").insert(bots);
      if (pErr) console.error("insert bots failed", pErr);
      else created.push(t.id);
    }

    return new Response(JSON.stringify({ ok: true, have, created: created.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
